import assert from "node:assert/strict";
import { spawn } from "node:child_process";

export async function testQueueManagementConcurrency(container) {
  const session = `begin; set local role authenticated;
    select set_config('request.jwt.claims', '{"role":"authenticated","sub":"user_queue_concurrency"}', true);`;
  const queueId = "20000000-0000-4000-8000-000000000001";
  const business = "(select id from public.businesses where owner_user_id='user_queue_concurrency')";
  const location = ` (select id from public.locations where business_id=${business})`;
  const create = `select 'queue=' || public.create_queue('${queueId}',${business},${location},'Consultation',null,300,3,false,false);`;

  function query(sql, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], { stdio: ["pipe", "pipe", "pipe"] });
      let output = "", errors = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Queue management concurrency test timed out")); }, 15000);
      child.stdout.on("data", (data) => { output += data; onOutput?.(output); });
      child.stderr.on("data", (data) => { errors += data; });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => { clearTimeout(timer); resolve({ code, output, errors }); });
      child.stdin.end(sql);
    });
  }

  const setup = await query(`${session} select public.onboard_business('Concurrent queues','healthcare','GH','Africa/Accra','Main','Accra'); commit;`);
  assert.equal(setup.code, 0, setup.errors);
  async function overlap(firstSql, secondSql, marker) {
    let ready;
    const started = new Promise((resolve) => { ready = resolve; });
    const first = query(`${session} ${firstSql} select pg_sleep(1); commit;`, (output) => { if (output.includes(marker)) ready(); });
    await Promise.race([started, first.then((result) => { throw new Error(`Missing transaction marker: ${result.errors}`); })]);
    const second = query(`${session} ${secondSql} commit;`);
    return Promise.all([first, second]);
  }
  const created = await overlap(create, create, "queue=");
  for (const result of created) {
    assert.equal(result.code, 0, result.errors);
    assert.ok(result.output.includes(`queue=${queueId}`));
  }
  const statusCall = (status) => `select 'status=' || public.set_queue_status('${queueId}',${business},1,'${status}');`;
  const changed = await overlap(statusCall("paused"), statusCall("closed"), "status=");
  assert.equal(changed[0].code, 0, changed[0].errors);
  assert.notEqual(changed[1].code, 0, "a stale concurrent status update must fail");
  assert.match(changed[1].errors, /40001/);
  const counts = await query(`select
    (select count(*) from public.queues where id='${queueId}'),
    (select count(*) from public.business_events where type='queue_created' and metadata->>'queue_id'='${queueId}'),
    (select count(*) from public.business_events where type='queue_status_changed' and metadata->>'queue_id'='${queueId}'),
    (select status from public.queues where id='${queueId}'),
    (select revision from public.queues where id='${queueId}');`);
  assert.equal(counts.code, 0, counts.errors);
  assert.equal(counts.output.trim(), "1|1|1|paused|2");
  console.log("Concurrent queue management: duplicate creation commits once; stale competing status change is rejected.");
  const businessId = (await query(`select id from public.businesses where owner_user_id='user_queue_concurrency';`)).output.trim();
  const locationId = (await query(`select id from public.locations where business_id='${businessId}';`)).output.trim();
  const newQueue = "20000000-0000-4000-8000-000000000009";
  const targetUser = "user_racegrant";
  const revokedSession = `begin; set local role authenticated; select set_config('request.jwt.claims','{"role":"authenticated","sub":"user_revokedmanager"}',true);`;
  const scenarios = [
    ["status", "", `select public.set_queue_status('${queueId}','${businessId}',2,'open');`],
    ["settings", "", `select public.update_queue('${queueId}','${businessId}',2,'${locationId}','Changed',null,300,3,false,false);`],
    ["team", "", `select public.save_staff('${businessId}','${targetUser}','staff',array['${queueId}'::uuid],false);`],
    ["location", `select public.save_location('${businessId}','${locationId}','Main','Accra','Africa/Accra',true);`, `select public.save_location('${businessId}','${locationId}','Changed','Changed','UTC',true);`],
    ["create", `select pg_advisory_xact_lock(hashtextextended('queuezero:create:${newQueue}',0));`, `select public.create_queue('${newQueue}','${businessId}','${locationId}','Changed',null,300,3,false,false);`],
  ];
  for (const [name, lock, operation] of scenarios) {
    const grant = await query(`${session} select public.save_staff('${businessId}','user_revokedmanager','admin',array[]::uuid[],false); commit;`);
    assert.equal(grant.code,0,grant.errors);
    let signal;
    const ready = new Promise(resolve => { signal = resolve; });
    const revoke = query(`${session} ${lock} select public.save_staff('${businessId}','user_revokedmanager','admin',array[]::uuid[],true); select 'revocation-held'; select pg_sleep(1); commit;`, output => { if(output.includes('revocation-held')) signal(); });
    await Promise.race([ready,revoke.then(result=>{throw new Error(`Revocation marker missing: ${result.errors}`);})]);
    const attempt = query(`${revokedSession} ${operation} commit;`);
    const [removed, denied] = await Promise.all([revoke,attempt]);
    assert.equal(removed.code,0,removed.errors);
    assert.notEqual(denied.code,0,`${name}: revoked manager must not complete a queued mutation`);
    assert.match(denied.errors,/42501/,`${name}: expected authorization denial`);
  }
  console.log("Concurrent manager revocation: pending status, settings, staff grants, location edits and queue creation all denied after revocation.");

}
