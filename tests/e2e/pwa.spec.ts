import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768]) {
  test(`PWA navigation works at ${width}px with or without a worker`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/demo');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.getByRole('navigation', { name: 'Demo navigation' }).getByRole('link', { name: 'Staff console' }).click();
    await expect(page.getByRole('button', { name: 'Call next', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Your day, at a glance.' })).toBeVisible();
    await context.setOffline(true);
    await page.goto('/demo?offline-check=1');
    await expect(page.getByRole('heading', { name: 'Let’s get you reconnected.' })).toBeVisible();
    await context.setOffline(false);
    await page.getByRole('link', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Your day, at a glance.' })).toBeVisible();
    const cached = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.startsWith('queuezero-shell-'));
      return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)))).flat();
    });
    expect(cached).toEqual(['/offline.html']);
    await page.evaluate(async () => { for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister(); });
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test('install metadata and icons are served without authentication', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#003d32');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', theme_color: '#003d32' });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
  ]));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
});
