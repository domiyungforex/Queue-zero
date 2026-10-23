import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Opt-in against scripts/preview.mjs ONLY. Never mutate a hosted database.
const container = process.env.PREVIEW_DB_CONTAINER;
test.skip(!container, 'Requires the disposable local preview database; see PILOT_GUIDE.md.');
function sql(source: string) {
  if (!container || !/^queuezero-preview-[a-f0-9]{12}-db$/.test(container)) throw new Error('Expected disposable preview container');
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-XAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: source, encoding: 'utf8' }).trim();
}
function concurrentSql(source: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', container!, 'psql', '-XAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']);
    let output = ''; let error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(error)));
    child.stdin.end(source);
  });
}


test('five customer browsers: joins, calls, cancellation, no-show, pause and reconnect', async ({ browser, baseURL }) => {
  // The disposable preview has no Realtime service. Exercise the real outage
  // fallback (15 -> 30 -> 60 seconds plus jitter), not simulated broadcasts.
  test.setTimeout(360_000);
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local preview only');
  const queue = randomUUID();
  const slug = `acceptance-${queue}`;
  const owner = `acceptance_${queue.replaceAll('-', '')}`;
  const actor = `select set_config('request.jwt.claims','{"role":"authenticated","sub":"${owner}"}',true); set local role authenticated;`;
  sql(`begin; ${actor}
    select onboard_business('Acceptance clinic','healthcare','NG','Africa/Lagos','Main branch','Test address');
    select create_queue('${queue}',(select id from businesses where owner_user_id='${owner}'),
      (select l.id from locations l join businesses b on b.id=l.business_id where b.owner_user_id='${owner}' limit 1),
      'Acceptance consultation',null,300,3,false,false); commit;
    update queues set slug='${slug}' where id='${queue}';`);
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext({ viewport: { width: 390, height: 844 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      await page.goto(`${baseURL}/q/${slug}`);
      await page.getByRole('link', { name: 'Join queue', exact: true }).click();
      await page.getByLabel('First name').fill(`Phone ${i + 1}`);
      await page.getByRole('button', { name: 'Join queue', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'You’re in line' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Your ticket' })).toContainText(`A00${i + 1}`);
      await expect(page.getByText('Estimated wait', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(new Set(pages.map(page => page.url())).size).toBe(5);
    const call = (nonce: string) => `select row_to_json(r) from call_next_ticket('${queue}','${nonce}') r;`;
    const nonce = randomUUID();
    const results = await Promise.all([
      concurrentSql(`begin; ${actor} ${call(nonce)} select pg_sleep(0.5); commit;`),
      concurrentSql(`begin; ${actor} ${call(randomUUID())} commit;`),
    ]);
    expect(results.filter(value => value.includes('"outcome":"called"'))).toHaveLength(1);
    expect(results.filter(value => value.includes('"outcome":"already_serving"'))).toHaveLength(1);
    expect(sql(`select count(*) from ticket_events where queue_id='${queue}' and type='called'`)).toBe('1');
    sql(`begin; ${actor} ${call(nonce)} commit;`);
    expect(sql(`select count(*) from ticket_events where queue_id='${queue}' and type='called'`)).toBe('1');
    await expect(pages[0].getByRole('heading', { name: 'It’s your turn' })).toBeVisible({ timeout: 70_000 });
    await expect(pages[1].getByRole('region', { name: 'Your ticket' }).getByText('0', { exact: true })).toBeVisible({ timeout: 70_000 });
    const first = sql(`select id from tickets where queue_id='${queue}' and display_number='A001'`);
    sql(`begin; ${actor} select operate_ticket('${queue}','${first}','complete','${randomUUID()}'); ${call(randomUUID())} commit;`);
    await expect(pages[0].getByRole('heading', { name: 'Service completed' })).toBeVisible({ timeout: 70_000 });
    await expect(pages[1].getByRole('heading', { name: 'It’s your turn' })).toBeVisible({ timeout: 70_000 });
    const second = sql(`select id from tickets where queue_id='${queue}' and display_number='A002'`);
    sql(`begin; ${actor} select operate_ticket('${queue}','${second}','no_show','${randomUUID()}'); select operate_queue('${queue}','paused','${randomUUID()}'); commit;`);
    await expect(pages[1].getByRole('heading', { name: 'You were marked as a no-show' })).toBeVisible({ timeout: 70_000 });
    await expect(pages[2].getByText('Queue paused', { exact: true })).toBeVisible({ timeout: 70_000 });
    await contexts[2].setOffline(true);
    sql(`begin; ${actor} select operate_queue('${queue}','open','${randomUUID()}'); ${call(randomUUID())} commit;`);
    await contexts[2].setOffline(false);
    await pages[2].evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(pages[2].getByRole('heading', { name: 'It’s your turn' })).toBeVisible({ timeout: 70_000 });
    await pages[4].getByRole('button', { name: 'Leave queue', exact: true }).click();
    await pages[4].getByRole('button', { name: 'Yes, leave queue' }).click();
    await expect(pages[4].getByRole('heading', { name: 'You’ve left the queue' })).toBeVisible();
    const payload = await (await pages[3].request.get(pages[3].url().replace('/ticket/', '/api/tickets/'))).json();
    for (const key of ['id', 'queue_id', 'customer_name', 'phone', 'customer_key']) expect(payload).not.toHaveProperty(key);
    const response = await pages[3].request.get(`${baseURL}/api/tickets/not-a-token`);
    expect(response.status()).toBe(404);
    await pages[0].screenshot({ path: 'test-results/customer-completed-mobile.png', fullPage: true });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    // Retain audit history in this disposable DB; each run uses a new fixture business.
    sql(`update queues set status='closed' where id='${queue}';`);
  }
});
