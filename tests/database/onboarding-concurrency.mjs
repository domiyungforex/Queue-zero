import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

export async function testOnboardingConcurrency(container) {
  const actor = "user_concurrent_onboarding";
  const sessionSql = `begin; set local role authenticated;
    select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${actor}"}', true);`;
  const call = (name) => `public.onboard_business('${name}', 'healthcare', 'GH', 'Africa/Accra', 'Main', 'Accra')`;
  let markFirstCreated;
  const firstCreated = new Promise((resolve) => { markFirstCreated = resolve; });

  function query(sql, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
      let output = "";
      let errors = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Concurrent onboarding test timed out")); }, 15000);
      child.stdout.on("data", (data) => { output += data; onOutput?.(output); });
      child.stderr.on("data", (data) => { errors += data; });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(errors || `psql failed: ${code}`));
        else resolve(output);
      });
      child.stdin.end(sql);
    });
  }

  const first = query(`${sessionSql}
    select 'business=' || ${call("First submission")};
    select pg_sleep(1);
    commit;`, (output) => { if (output.includes("business=")) markFirstCreated(); });
  // If the first transaction fails, do not wait forever for its success marker.
  await Promise.race([firstCreated, first.then(() => { throw new Error("First transaction returned no business"); })]);
  const second = query(`${sessionSql} select 'business=' || ${call("Duplicate submission")}; commit;`);
  const results = await Promise.all([first, second]);
  const ids = results.map((output) => output.match(/business=([a-f0-9-]{36})/)?.[1]);
  assert.ok(ids[0]);
  assert.equal(ids[0], ids[1], "overlapping submissions must return the same business");

  const counts = spawnSync("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: `select (select count(*) from public.businesses where owner_user_id = '${actor}'),
      (select count(*) from public.business_members where clerk_user_id = '${actor}'),
      (select count(*) from public.locations where business_id = '${ids[0]}'),
      (select count(*) from public.business_events where business_id = '${ids[0]}'),
      (select name from public.businesses where id = '${ids[0]}');`,
  });
  assert.equal(counts.status, 0, counts.stderr);
  assert.equal(counts.stdout.trim(), "1|1|1|1|First submission", "only one complete onboarding result may commit");
  console.log("Concurrent onboarding: two overlapping transactions returned one business, owner, location, and audit event.");
}
