import { execFile } from "node:child_process";
import { createServer, type RequestListener, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/capacity-baseline.mjs", import.meta.url));
const servers: Server[] = [];

function invoke(overrides: Record<string, string | undefined> = {}, mode = "--check") {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("CAPACITY_")) delete env[key];
  return new Promise<{ code: number; stdout: string; stderr: string }>(resolve => {
    execFile(process.execPath, [script, mode], { env: { ...env, ...overrides }, timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? typeof error.code === "number" ? error.code : 1 : 0, stdout, stderr });
    });
  });
}

async function listen(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local test server address");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
});

describe("capacity baseline safety", () => {
  it("defaults to a no-request local configuration", async () => {
    const result = await invoke();
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ requestsSent: 0, config: { origin: "http://127.0.0.1:3000", environment: "local", requestsPerSecond: 2 } });
  });

  it.each([
    "https://turnmark.conchportal.com", "https://turnmark.conchportal.com.", "https://www.conchportal.com",
    "https://queue-zero.vercel.app", "https://queue-zero-abc-domiyungforex-gmailcoms-projects.vercel.app",
    "https://queue-zero-git-main-domiyungforex-gmailcoms-projects.vercel.app",
  ])("rejects production aliases despite staging opt-in: %s", async origin => {
    const result = await invoke({ CAPACITY_BASE_URL: origin, CAPACITY_APPROVED_STAGING_ORIGIN: origin, CAPACITY_STAGING_ACK: "isolated-staging-no-production" });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("blocked");
  });

  it.each([
    "https://qa.example.test", "http://qa.example.test", "http://localhost.example.test",
    "http://user:secret@localhost:3000", "http://localhost:3000/api/private", "http://localhost:3000?token=secret",
  ])("rejects unapproved or credential-bearing targets: %s", async origin => {
    const result = await invoke({ CAPACITY_BASE_URL: origin });
    expect(result.code).toBe(1);
    expect(result.stderr).not.toContain("secret");
  });

  it("requires exact HTTPS staging origin and explicit acknowledgment", async () => {
    const result = await invoke({ CAPACITY_BASE_URL: "https://qa.example.test", CAPACITY_APPROVED_STAGING_ORIGIN: "https://qa.example.test", CAPACITY_STAGING_ACK: "isolated-staging-no-production" });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ requestsSent: 0, config: { environment: "explicit-staging" } });
    expect((await invoke({ CAPACITY_BASE_URL: "https://qa.example.test", CAPACITY_APPROVED_STAGING_ORIGIN: "https://other.example.test", CAPACITY_STAGING_ACK: "isolated-staging-no-production" })).code).toBe(1);
  });

  it.each([
    { CAPACITY_CONCURRENCY: "101" }, { CAPACITY_RPS: "21" }, { CAPACITY_DURATION_SECONDS: "61" },
    { CAPACITY_RPS: "0" }, { CAPACITY_CONCURRENCY: "NaN" }, { CAPACITY_TIMEOUT_MS: "999999" },
  ])("rejects unbounded/invalid workload %j", async config => {
    expect((await invoke(config)).code).toBe(1);
  });

  it("sends only bounded anonymous GETs to the inspected public routes", async () => {
    const requests: Array<{ method: string | undefined; path: string | undefined; cookie: string | undefined }> = [];
    const origin = await listen((request, response) => {
      requests.push({ method: request.method, path: request.url, cookie: request.headers.cookie });
      const contentType = request.url === "/manifest.webmanifest" ? "application/manifest+json" : request.url === "/llms.txt" ? "text/plain" : "text/html";
      response.writeHead(200, { "content-type": contentType, "set-cookie": "do-not-send=secret" });
      response.end("test-only local response");
    });
    const result = await invoke({ CAPACITY_BASE_URL: origin, CAPACITY_DURATION_SECONDS: "1", CAPACITY_RPS: "10", CAPACITY_CONCURRENCY: "2" }, "--run");
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ capacityVerified: false, failed: 0, abortReason: null });
    expect(requests.length).toBeGreaterThanOrEqual(5);
    expect(requests.length).toBeLessThanOrEqual(10);
    expect(new Set(requests.map(request => request.path))).toEqual(new Set(["/", "/how-it-works", "/solutions/education", "/manifest.webmanifest", "/llms.txt"]));
    expect(requests.every(request => request.method === "GET" && request.cookie === undefined)).toBe(true);
  });

  it("never follows redirects and stops when the error budget is exceeded", async () => {
    let destinationRequests = 0;
    const destination = await listen((_request, response) => { destinationRequests++; response.end("must not be fetched"); });
    const origin = await listen((_request, response) => { response.writeHead(302, { location: destination }); response.end(); });
    const result = await invoke({ CAPACITY_BASE_URL: origin, CAPACITY_DURATION_SECONDS: "2", CAPACITY_RPS: "20" }, "--run");
    expect(result.code).toBe(1);
    expect(destinationRequests).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ abortReason: "error_budget_exceeded", failures: { redirect_rejected: 5 } });
  });
});
