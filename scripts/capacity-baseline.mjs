#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

// Public, read-only routes inspected in the application. No private tokens,
// checkout, attendance submissions, queue joins or arbitrary URL input.
const routes = [
  { path: "/", contentType: "text/html" },
  { path: "/how-it-works", contentType: "text/html" },
  { path: "/solutions/education", contentType: "text/html" },
  { path: "/manifest.webmanifest", contentType: "application/manifest+json" },
  { path: "/llms.txt", contentType: "text/plain" },
];

function integer(name, fallback, minimum, maximum) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function configuration() {
  let url;
  try { url = new URL(process.env.CAPACITY_BASE_URL ?? "http://127.0.0.1:3000"); }
  catch { throw new Error("CAPACITY_BASE_URL must be an HTTP(S) origin."); }
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Provide an origin without credentials, path, query or fragment.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // Block this product's known production domain and Vercel alias family even
  // when an operator accidentally labels them staging.
  if (host === "conchportal.com" || host.endsWith(".conchportal.com")
    || /^queue-zero(?:[.-].*)?\.vercel\.app$/.test(host)
    || host === "queue-zero.vercel.app") {
    throw new Error("Production domains and Queue-zero Vercel aliases are blocked.");
  }
  const local = new Set(["localhost", "127.0.0.1", "[::1]"]).has(host);
  if (!local && (url.protocol !== "https:"
    || process.env.CAPACITY_APPROVED_STAGING_ORIGIN !== url.origin
    || process.env.CAPACITY_STAGING_ACK !== "isolated-staging-no-production")) {
    throw new Error("Hosted runs require HTTPS, an exact CAPACITY_APPROVED_STAGING_ORIGIN and CAPACITY_STAGING_ACK=isolated-staging-no-production.");
  }
  return {
    origin: url.origin,
    environment: local ? "local" : "explicit-staging",
    concurrency: integer("CAPACITY_CONCURRENCY", 2, 1, local ? 100 : 25),
    requestsPerSecond: integer("CAPACITY_RPS", 2, 1, local ? 20 : 5),
    durationSeconds: integer("CAPACITY_DURATION_SECONDS", 10, 1, 60),
    requestTimeoutMs: integer("CAPACITY_TIMEOUT_MS", 5_000, 100, 10_000),
    maxP95Ms: integer("CAPACITY_MAX_P95_MS", 2_500, 100, 10_000),
  };
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return Math.round(ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] * 100) / 100;
}

async function run(config) {
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const deadline = start + config.durationSeconds * 1_000;
  const spacing = 1_000 / config.requestsPerSecond;
  const samples = [];
  const statuses = {};
  const failures = {};
  let nextStart = start;
  let issued = 0;
  let failed = 0;
  let consecutiveErrors = 0;
  let abortReason = null;
  let bytes = 0;
  const shutdown = new AbortController();
  const interrupt = () => { abortReason = "operator_interrupt"; shutdown.abort(); };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);

  async function worker() {
    while (!abortReason) {
      // Reserve one start slot globally. Slow responses reduce the achieved rate;
      // this deliberately does not accumulate an unbounded pending queue.
      const slot = Math.max(nextStart, performance.now());
      if (slot >= deadline) return;
      nextStart = slot + spacing;
      try { await delay(Math.max(0, slot - performance.now()), undefined, { signal: shutdown.signal }); }
      catch { return; }
      if (abortReason || performance.now() >= deadline) return;
      const route = routes[issued++ % routes.length];
      const requestStart = performance.now();
      let failure = null;
      try {
        const response = await fetch(new URL(route.path, config.origin), {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          headers: { "User-Agent": "TuRnMaRk-capacity-baseline/1.0", Accept: route.contentType },
          signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(config.requestTimeoutMs)]),
        });
        statuses[response.status] = (statuses[response.status] ?? 0) + 1;
        // Drain the response so timings include payload transfer. Keep no body,
        // cookies or response headers in the report.
        const reader = response.body?.getReader();
        let received = 0;
        if (reader) {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            received += chunk.value.byteLength;
            if (received > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("oversized_response"); }
          }
        }
        bytes += received;
        if (response.status !== 200) failure = response.status >= 300 && response.status < 400 ? "redirect_rejected" : "unexpected_status";
        else if (!response.headers.get("content-type")?.includes(route.contentType)) failure = "unexpected_content_type";
      } catch (error) {
        failure = error instanceof Error && error.message === "oversized_response" ? "oversized_response" : "network_or_timeout";
      }
      samples.push(performance.now() - requestStart);
      if (failure) {
        failed++;
        consecutiveErrors++;
        failures[failure] = (failures[failure] ?? 0) + 1;
      } else consecutiveErrors = 0;
      if (!abortReason && (consecutiveErrors >= 5 || (samples.length >= 20 && failed / samples.length > 0.1))) {
        abortReason = "error_budget_exceeded";
      }
      if (!abortReason && samples.length >= 20 && percentile(samples, 0.95) > config.maxP95Ms) {
        abortReason = "latency_budget_exceeded";
      }
      if (abortReason) shutdown.abort();
    }
  }
  try { await Promise.all(Array.from({ length: config.concurrency }, worker)); }
  finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
  const elapsedSeconds = (performance.now() - start) / 1_000;
  const result = {
    kind: "public-http-baseline",
    startedAt,
    config,
    routes: routes.map(route => route.path),
    elapsedSeconds: Number(elapsedSeconds.toFixed(3)),
    requests: samples.length,
    failed,
    statuses,
    failures,
    bytes,
    achievedRequestsPerSecond: Number((samples.length / elapsedSeconds).toFixed(3)),
    latencyMs: { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) },
    abortReason,
    capacityVerified: false,
    limitations: "HTTP public reads only; no browser assets, authenticated screens, writes, database workload, Realtime connections or million-user capacity verified. Closed-loop pacing can hide saturation; inspect achieved rate.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (abortReason || failed || !samples.length) process.exitCode = 1;
}

try {
  const mode = process.argv[2] ?? "--check";
  if (process.argv.length > 3 || !["--check", "--run"].includes(mode)) throw new Error("Use --check (no requests, default) or --run.");
  const config = configuration();
  if (mode === "--check") process.stdout.write(`${JSON.stringify({ mode, config, routes: routes.map(route => route.path), requestsSent: 0 }, null, 2)}\n`);
  else await run(config);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Baseline failed."}\n`);
  process.exitCode = 1;
}
