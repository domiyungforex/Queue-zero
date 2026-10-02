import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { testQueueManagementConcurrency } from "../tests/database/queue-management-concurrency.mjs";
import { testOnboardingConcurrency } from "../tests/database/onboarding-concurrency.mjs";

import { testJoinConcurrency } from "../tests/database/join-concurrency.mjs";

import { testCallNextConcurrency } from "../tests/database/call-next-concurrency.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const container = `queuezero-test-${randomUUID()}`;
const image = "queuezero-db-tests:local";

function docker(args, { input, capture = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: [input ? "pipe" : "ignore", capture ? "pipe" : "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed with exit ${result.status}`);
  return result.stdout;
}

function applySql(path) {
  const output = docker(["exec", "-i", container, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {
    input: readFileSync(new URL(path, import.meta.url), "utf8"), capture: true,
  });
  if (!output) throw new Error(`No migration output for ${path}`);
}

try {
  docker(["build", "-t", image, "tests/database"]);
  // No network or published port; this database contains only disposable fixtures.
  docker(["run", "--rm", "-d", "--network", "none", "--name", container,
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image], { capture: true });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "ignore" });
    if (result.status === 0) { ready = true; break; }
    await setTimeout(500);
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not start within 30 seconds");
  applySql("../tests/database/bootstrap.sql");
  for (const file of readdirSync(new URL("../supabase/migrations", import.meta.url)).filter((file) => file.endsWith(".sql")).sort()) {
    applySql(`../supabase/migrations/${file}`);
    console.log(`Applied ${file}`);
  }
  docker(["cp", "supabase/tests", `${container}:/tmp/queuezero-tests`]);
  docker(["exec", container, "pg_prove", "-U", "postgres", "-d", "postgres", "--ext", ".sql", "--recurse", "/tmp/queuezero-tests"]);
  await testOnboardingConcurrency(container);
  await testQueueManagementConcurrency(container);
  await testJoinConcurrency(container);
  await testCallNextConcurrency(container);
} finally {
  // The randomly named test container is the only resource removed.
  spawnSync("docker", ["rm", "--force", container], { stdio: "ignore" });
}
