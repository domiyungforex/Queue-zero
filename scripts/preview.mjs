// Disposable local preview. No hosted credentials, tenant bypass, or production data.
import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

if (process.env.NODE_ENV === "production") throw new Error("The preview launcher is for local development only.");
const root = fileURLToPath(new URL("..", import.meta.url));
const suffix = randomBytes(6).toString("hex");
const network = `queuezero-preview-${suffix}`;
const database = `${network}-db`;
const rest = `${network}-rest`;
const password = randomBytes(24).toString("hex");
const jwtSecret = randomBytes(32).toString("hex");
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Use a local PORT between 1024 and 65535.");
const origin = process.env.PREVIEW_APP_URL || `http://localhost:${port}`;
const parsedOrigin = new URL(origin);
if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) throw new Error("PREVIEW_APP_URL must be an HTTP(S) origin without a trailing slash.");
let next;
let proxy;
let stopping = false;
function docker(args, input) {
  const result = spawnSync("docker", args, { cwd: root, input, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Local preview Docker ${args[0]} failed: ${(result.stderr || "Check Docker availability and image access.").replaceAll(password, "[redacted]").replaceAll(jwtSecret, "[redacted]")}`);
  return result.stdout.trim();
}
function sql(source) { docker(["exec", "-i", database, "psql", "-X", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], source); }
function token(role) {
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ role, exp: Math.floor(Date.now() / 1000) + 86400 })}`;
  return `${data}.${createHmac("sha256", jwtSecret).update(data).digest("base64url")}`;
}
async function stop() {
  if (stopping) return;
  stopping = true;
  if (next && next.exitCode === null) {
    next.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => next.once("exit", resolve)), delay(5000)]);
    if (next.exitCode === null) next.kill("SIGKILL");
  }
  proxy?.closeAllConnections(); proxy?.close();
  spawnSync("docker", ["rm", "--force", rest, database], { stdio: "ignore" });
  spawnSync("docker", ["network", "rm", network], { stdio: "ignore" });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop().then(() => process.exit(0)); });
try {
  console.log("Starting a disposable PostgreSQL + PostgREST demo. Data resets when stopped.");
  docker(["build", "-t", "queuezero-db-tests:local", "tests/database"]);
  docker(["network", "create", network]);
  docker(["run", "--rm", "-d", "--name", database, "--network", network, "-e", `POSTGRES_PASSWORD=${password}`, "queuezero-db-tests:local"]);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (spawnSync("docker", ["exec", database, "pg_isready", "-U", "postgres"], { stdio: "ignore" }).status === 0) { ready = true; break; }
    await delay(500);
  }
  if (!ready) throw new Error("Preview database did not start.");
  sql(readFileSync(new URL("../tests/database/bootstrap.sql", import.meta.url), "utf8"));
  for (const file of readdirSync(new URL("../supabase/migrations", import.meta.url)).filter((file) => file.endsWith(".sql")).sort()) {
    sql(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  sql(`create role preview_gateway login password '${password}' noinherit; grant anon,authenticated,service_role to preview_gateway;`);
  sql(readFileSync(new URL("./fixtures/preview.sql", import.meta.url), "utf8"));
  docker(["run", "--rm", "-d", "--name", rest, "--network", network, "-p", "127.0.0.1::3000",
    "-e", `PGRST_DB_URI=postgres://preview_gateway:${password}@${database}:5432/postgres`,
    "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon", "-e", `PGRST_JWT_SECRET=${jwtSecret}`,
    "postgrest/postgrest:v12.2.12"]);
  await delay(1000);
  const restPort = Number(docker(["port", rest, "3000/tcp"]).split(":").at(-1));
  // Supabase SDK uses /rest/v1; this localhost-only proxy strips that prefix.
  proxy = http.createServer((request, response) => {
    if (!request.url?.startsWith("/rest/v1/")) { response.writeHead(404).end(); return; }
    const upstream = http.request({ hostname: "127.0.0.1", port: restPort, method: request.method, path: request.url.slice("/rest/v1".length), headers: request.headers }, (result) => {
      response.writeHead(result.statusCode || 502, result.headers); result.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.on("aborted", () => upstream.destroy()); request.pipe(upstream);
  });
  await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(0, "127.0.0.1", resolve); });
  const proxyPort = proxy.address().port;
  const publicKey = token("anon");
  ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${proxyPort}/rest/v1/rpc/get_public_queue`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${publicKey}` }, body: JSON.stringify({ p_slug: "demo-clinic" }) });
      if (response.ok && (await response.json()).length === 1) { ready = true; break; }
    } catch { /* Wait for PostgREST startup. */ }
    await delay(500);
  }
  if (!ready) throw new Error("Preview API did not become ready.");
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", String(port)], {
    cwd: root, stdio: "inherit", env: { ...process.env,
      NEXT_PUBLIC_APP_URL: origin,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from("clerk.queuezero.invalid$").toString("base64")}`,
      CLERK_SECRET_KEY: "sk_live_local_preview_only",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${proxyPort}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey, SUPABASE_SERVICE_ROLE_KEY: token("service_role"),
      QUEUE_JOIN_SECRET: randomBytes(32).toString("hex"),
    },
  });
  console.log(`\nDemo queue: ${origin}/q/demo-clinic\nHomepage: ${origin}\nCustomer join/ticket/cancel use real local database transactions.\nBusiness sign-in needs real Clerk configuration. No hosted data is used.\nPress Ctrl+C to stop and remove this demo database.\n`);
  await new Promise((resolve, reject) => { next.once("error", reject); next.once("exit", (code) => { if (code && !stopping) reject(new Error("Preview web server exited.")); else resolve(); }); });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local preview failed.");
  process.exitCode = 1;
} finally { await stop(); }
