import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

export async function testCallNextConcurrency(container) {
  function query(sql, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]);
      let output = "", errors = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Call Next concurrency test timed out")); }, 15000);
      child.stdout.on("data", (chunk) => { output += chunk; onOutput?.(output); });
      child.stderr.on("data", (chunk) => { errors += chunk; });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => { clearTimeout(timer); resolve({ code, output, errors }); });
      child.stdin.end(sql);
    });
  }
  const queue = "e0000000-0000-4000-8000-000000000001";
  const session = (actor = "call_race_owner") => `begin; set local role authenticated; select set_config('request.jwt.claims','{"role":"authenticated","sub":"${actor}"}',true);`;
  const call = (nonce = randomUUID()) => `select 'result=' || row_to_json(r)::text from public.call_next_ticket('${queue}','${nonce}') r;`;
  const hash = (key) => createHash("sha256").update(key).digest("hex");
  const join = (key) => `select 'joined=' || public.join_public_queue('call-race','${randomUUID()}','${hash(key)}','${hash("network")}','Fixture',null);`;
  const complete = `update public.tickets set status='completed',completed_at=clock_timestamp() where queue_id='${queue}' and status='serving';`;
  async function must(sql) { const result = await query(sql); assert.equal(result.code, 0, result.errors); return result; }
  function result(row) { const match = row.output.match(/result=(\{[^\n]+\})/); assert.ok(match, row.output); return JSON.parse(match[1]); }
  async function overlap(firstSql, secondSql, marker) {
    let ready;
    const started = new Promise((resolve) => { ready = resolve; });
    const first = query(`${firstSql} select pg_sleep(1); commit;`, (out) => { if (out.includes(marker)) ready(); });
    await Promise.race([started, first.then((row) => { throw new Error(`Transaction marker missing: ${row.errors}`); })]);
    const second = query(`${secondSql} commit;`);
    return Promise.all([first, second]);
  }
  await must(`${session()} select public.onboard_business('Call race clinic','healthcare','GH','UTC','Main','Address');
    select public.create_queue('${queue}',(select id from public.businesses where owner_user_id='call_race_owner'),
    (select l.id from public.locations l join public.businesses b on b.id=l.business_id where b.owner_user_id='call_race_owner'),
    'Consultation',null,300,3,false,false); commit;`);
  await must(`update public.queues set slug='call-race' where id='${queue}';
    insert into public.business_members(id,business_id,clerk_user_id,role) select 'e1000000-0000-4000-8000-000000000001',business_id,'call_race_staff','staff' from public.queues where id='${queue}';
    insert into public.queue_staff_assignments(business_id,queue_id,business_member_id) select business_id,id,'e1000000-0000-4000-8000-000000000001' from public.queues where id='${queue}';
    ${join("first")} ${join("second")} ${join("third")}`);

  const nonce = randomUUID();
  const twoStaff = await overlap(`${session()} ${call(nonce)}`, `${session("call_race_staff")} ${call()}`, "result=");
  for (const row of twoStaff) assert.equal(row.code, 0, row.errors);
  assert.equal(result(twoStaff[0]).outcome, "called");
  assert.equal(result(twoStaff[1]).outcome, "already_serving");
  assert.equal(result(twoStaff[1]).ticket_id, result(twoStaff[0]).ticket_id);
  const calledId = result(twoStaff[0]).ticket_id;
  const invariant = await must(`select count(*) from public.ticket_events where queue_id='${queue}' and type='called'; select count(*) from public.tickets where queue_id='${queue}' and status='serving';`);
  assert.equal(invariant.output.trim(), "1\n1");
  const retry = await must(`${session()} ${call(nonce)} commit;`);
  assert.equal(result(retry).replayed, true);
  await must(complete);
  const afterCompletion = await must(`${session()} ${call(nonce)} commit;`);
  assert.equal(result(afterCompletion).ticket_id, calledId);
  assert.equal(result(afterCompletion).ticket_status, "completed");

  const sameNonce = randomUUID();
  const duplicates = await overlap(`${session()} ${call(sameNonce)}`, `${session()} ${call(sameNonce)}`, "result=");
  for (const row of duplicates) assert.equal(row.code, 0, row.errors);
  assert.equal(result(duplicates[0]).replayed, false); assert.equal(result(duplicates[1]).replayed, true);
  assert.equal(result(duplicates[0]).ticket_id, result(duplicates[1]).ticket_id);
  await must(complete);

  const lastToken = (await must(`select public_token from public.tickets where queue_id='${queue}' and status='waiting';`)).output.trim();
  const cancelledFirst = await overlap(`begin; select 'cancel=' || public.cancel_public_ticket('${lastToken}');`, `${session()} ${call()}`, "cancel=");
  for (const row of cancelledFirst) assert.equal(row.code, 0, row.errors);
  assert.equal(result(cancelledFirst[1]).outcome, "empty", "cancelled customer is never called");

  const joinedFirst = await overlap(`begin; ${join("fourth")}`, `${session()} ${call()}`, "joined=");
  for (const row of joinedFirst) assert.equal(row.code, 0, row.errors);
  assert.equal(result(joinedFirst[1]).outcome, "called", "call sees join committed while it waited for queue lock");
  await must(complete);
  await must(join("fifth"));
  const waitingToken = (await must(`select public_token from public.tickets where queue_id='${queue}' and status='waiting';`)).output.trim();
  const calledFirst = await overlap(`${session()} ${call()}`, `begin; select public.cancel_public_ticket('${waitingToken}');`, "result=");
  assert.equal(calledFirst[0].code, 0, calledFirst[0].errors);
  assert.notEqual(calledFirst[1].code, 0); assert.match(calledFirst[1].errors, /QZ007/);
  await must(complete);
  await must(join("sixth"));

  const pausedFirst = await overlap(`begin; update public.queues set status='paused' where id='${queue}'; select 'paused-lock';`, `${session()} ${call()}`, "paused-lock");
  assert.equal(pausedFirst[0].code, 0, pausedFirst[0].errors);
  assert.notEqual(pausedFirst[1].code, 0); assert.match(pausedFirst[1].errors, /QZ002/);
  await must(`update public.queues set status='open' where id='${queue}';`);
  const revokedFirst = await overlap(`begin; select 1 from public.queues where id='${queue}' for update;
    delete from public.queue_staff_assignments where queue_id='${queue}' and business_member_id='e1000000-0000-4000-8000-000000000001'; select 'revoked-lock';`,
    `${session("call_race_staff")} ${call()}`, "revoked-lock");
  assert.equal(revokedFirst[0].code, 0, revokedFirst[0].errors);
  assert.notEqual(revokedFirst[1].code, 0); assert.match(revokedFirst[1].errors, /42501/);
  const remaining = await must(`select count(*) from public.tickets where queue_id='${queue}' and status='waiting'; select count(*) from public.tickets where queue_id='${queue}' and status='serving';`);
  assert.equal(remaining.output.trim(), "1\n0", "pause and revoked permissions never consume the waiting customer");
  console.log("Concurrent Call Next: one call across two receptionists; exact retry replay; cancellation/join/pause races safe; staff revocation rechecked after lock wait.");
}
