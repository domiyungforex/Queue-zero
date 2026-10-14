import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

export async function testWorkspaceConcurrency(container) {
  const actor = "user_concurrent_workspace";
  const requestId = "30000000-0000-4000-8000-000000000001";
  const sessionSql = `begin; set local role authenticated;
    select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${actor}"}', true);`;
  const call = (name) => `public.onboard_organization_workspace(
    '${requestId}', '${name}', 'COMPANY_OTHER', 'GH', 'Africa/Accra', 'Main office', 'Accra')`;
  let markFirstCreated;
  const firstCreated = new Promise((resolve) => { markFirstCreated = resolve; });

  function query(sql, onOutput) {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
      let output = "";
      let errors = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Concurrent workspace test timed out")); }, 15000);
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
    select 'workspace=' || ${call("First organization")};
    select pg_sleep(1);
    commit;`, (output) => { if (output.includes("workspace=")) markFirstCreated(); });
  await Promise.race([firstCreated, first.then(() => { throw new Error("First transaction returned no workspace"); })]);
  const second = query(`${sessionSql} select 'workspace=' || ${call("Duplicate organization")}; commit;`);
  const results = await Promise.all([first, second]);
  const ids = results.map((output) => output.match(/workspace=([a-f0-9-]{36})/)?.[1]);
  assert.ok(ids[0]);
  assert.equal(ids[0], ids[1], "overlapping retries must return the same workspace");

  const counts = spawnSync("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: `select
      (select count(*) from public.businesses where owner_user_id = '${actor}'),
      (select count(*) from public.business_members where clerk_user_id = '${actor}'),
      (select count(*) from public.locations where business_id = '${ids[0]}'),
      (select count(*) from public.business_events where business_id = '${ids[0]}' and type = 'business_created'),
      (select onboarding_completed_at is not null from public.businesses where id = '${ids[0]}'),
      (select name from public.businesses where id = '${ids[0]}');`,
  });
  assert.equal(counts.status, 0, counts.stderr);
  assert.equal(counts.stdout.trim(), "1|1|1|1|t|First organization", "one complete organization workspace may commit");
  console.log("Concurrent workspace creation: overlapping retries returned one completed workspace, owner, location, and audit event.");

  const professionalActor = "user_concurrent_professional";
  const professionalSession = `begin; set local role authenticated;
    select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${professionalActor}"}', true);`;
  const professionalCall = (name) => `public.onboard_professional_workspace_v2(
    '${name}', 'DOCTOR', 'NG', 'Africa/Lagos', null, null,
    'Consultations', 'Authorized practice', 'Lagos')`;
  let markProfessionalCreated;
  const professionalCreated = new Promise((resolve) => { markProfessionalCreated = resolve; });
  const professionalFirst = query(`${professionalSession}
    select 'professional=' || ${professionalCall("First practice")};
    select pg_sleep(1);
    commit;`, (output) => { if (output.includes("professional=")) markProfessionalCreated(); });
  await Promise.race([professionalCreated, professionalFirst.then(() => { throw new Error("First professional transaction returned no workspace"); })]);
  const professionalSecond = query(`${professionalSession} select 'professional=' || ${professionalCall("Duplicate practice")}; commit;`);
  const professionalResults = await Promise.all([professionalFirst, professionalSecond]);
  const professionalIds = professionalResults.map((output) => output.match(/professional=([a-f0-9-]{36})/)?.[1]);
  assert.ok(professionalIds[0]);
  assert.equal(professionalIds[0], professionalIds[1], "overlapping professional retries must return the same workspace");

  const professionalCounts = spawnSync("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: `select
      (select count(*) from public.businesses where owner_user_id = '${professionalActor}' and professional_category = 'DOCTOR'),
      (select count(*) from public.business_members where clerk_user_id = '${professionalActor}'),
      (select count(*) from public.professional_workspace_profiles where business_id = '${professionalIds[0]}'),
      (select count(*) from public.locations where business_id = '${professionalIds[0]}'),
      (select count(*) from public.business_events where business_id = '${professionalIds[0]}' and type = 'professional_workspace_created');`,
  });
  assert.equal(professionalCounts.status, 0, professionalCounts.stderr);
  assert.equal(professionalCounts.stdout.trim(), "1|1|1|1|1", "one complete professional workspace may commit");
  console.log("Concurrent professional onboarding: overlapping retries returned one workspace, profile, location, owner, and audit event.");
}
