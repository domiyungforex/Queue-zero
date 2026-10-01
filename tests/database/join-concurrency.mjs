import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

export async function testJoinConcurrency(container) {
  function query(sql, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]);
      let output = "", errors = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Join concurrency test timed out")); }, 15000);
      child.stdout.on("data", (data) => { output += data; onOutput?.(output); });
      child.stderr.on("data", (data) => { errors += data; });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => { clearTimeout(timer); resolve({ code, output, errors }); });
      child.stdin.end(sql);
    });
  }
  const queueId = "60000000-0000-4000-8000-000000000001";
  const setup = await query(`begin;
    select set_config('request.jwt.claims','{"role":"authenticated","sub":"concurrent_join_owner"}',true);
    select public.onboard_business('Concurrent joins','healthcare','GH','Africa/Accra','Main','Address');
    select public.create_queue('${queueId}',
      (select id from public.businesses where owner_user_id='concurrent_join_owner'),
      (select l.id from public.locations l join public.businesses b on b.id=l.business_id where b.owner_user_id='concurrent_join_owner'),
      'Consultation',null,300,3,false,false);
    update public.queues set slug='concurrent-join' where id='${queueId}'; commit;`);
  assert.equal(setup.code, 0, setup.errors);
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const join = (customer, request = randomUUID()) => `select 'token=' || public.join_public_queue('concurrent-join','${request}','${digest(customer)}','${digest("shared-network")}','Customer',null);`;
  const session = "begin; set local role service_role;";
  async function overlap(firstSql, restSql, marker) {
    let ready;
    const started = new Promise((resolve) => { ready = resolve; });
    const first = query(`${firstSql} select pg_sleep(1); commit;`, (out) => { if (out.includes(marker)) ready(); });
    await Promise.race([started, first.then((result) => { throw new Error(`Missing lock marker: ${result.errors}`); })]);
    return Promise.all([first, ...restSql.map((sql) => query(`${session} ${sql} commit;`))]);
  }
  const results = await overlap(`${session} ${join("customer-0")}`, Array.from({ length: 11 }, (_, i) => join(`customer-${i + 1}`)), "token=");
  for (const result of results) assert.equal(result.code, 0, result.errors);
  assert.equal(new Set(results.map((r) => r.output.match(/token=([0-9a-f-]+)/)?.[1])).size, 12, "12 different customers receive distinct tokens");
  const request = randomUUID();
  const retries = await overlap(`${session} ${join("same-browser", request)}`, [join("same-browser", request), join("same-browser"), join("same-browser")], "token=");
  for (const result of retries) assert.equal(result.code, 0, result.errors);
  assert.equal(new Set(retries.map((r) => r.output.match(/token=([0-9a-f-]+)/)?.[1])).size, 1, "overlapping retries and tabs receive the same ticket");
  const counts = await query(`select count(*),count(distinct sequence_number),min(sequence_number),max(sequence_number),count(distinct public_token) from public.tickets where queue_id='${queueId}';
    select count(*) from public.ticket_events where queue_id='${queueId}';`);
  assert.equal(counts.code, 0, counts.errors);
  assert.equal(counts.output.trim(), "13|13|1|13|13\n13");
  const pause = await overlap(`begin; update public.queues set status='paused' where id='${queueId}'; select 'paused-lock';`, [join("late-customer")], "paused-lock");
  assert.equal(pause[0].code, 0, pause[0].errors);
  assert.notEqual(pause[1].code, 0);
  assert.match(pause[1].errors, /QZ002/);
  console.log("Concurrent joining: 12 unique allocations; overlapping retries create one ticket/event; pause lock rejects a waiting join.");
}
