import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const BLOCKED = ["turnmark.conchportal.com", "supabase.co", "supabase.in"];

function assertIsolated(value) {
  if (!value) return null;
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (BLOCKED.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
    throw new Error("Refusing to load-test production or the hosted database.");
  }
  if (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("LOAD_TARGET must be HTTPS, or localhost.");
  }
  return url;
}

function sign(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(`turnmark:attendance:v1:${encoded}`).digest();
  return `${encoded}.${mac.toString("base64url")}`;
}

function verify(token, secret) {
  const [encoded, supplied] = token.split(".");
  const expected = createHmac("sha256", secret).update(`turnmark:attendance:v1:${encoded}`).digest();
  const received = Buffer.from(supplied, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("invalid");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
}

const target = assertIsolated(process.env.LOAD_TARGET);
if (target) {
  console.log(JSON.stringify({
    refused: false,
    note: "A target was accepted by the guard. This script does not send traffic. Point a separate staging runner at it.",
    target: target.origin,
  }));
}

const secret = "benchmark-secret-not-used-in-production-0123456789";
const now = Math.floor(Date.now() / 1000);
const tokens = Array.from({ length: 1000 }, () => sign({
  version: 1,
  purpose: "CLASS_ATTENDANCE",
  organization_id: randomUUID(),
  session_id: randomUUID(),
  nonce: randomUUID(),
  issued_at: now,
  expires_at: now + 3600,
}, secret));

const started = process.hrtime.bigint();
let checks = 0;
const deadline = started + 2_000_000_000n;
while (process.hrtime.bigint() < deadline) {
  verify(tokens[checks % tokens.length], secret);
  checks += 1;
}
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
const perSecond = Math.round(checks / (elapsedMs / 1000));
console.log(JSON.stringify({
  benchmark: "attendance-token-hmac",
  machine: "local-process",
  checks,
  elapsedMs: Math.round(elapsedMs),
  verificationsPerSecond: perSecond,
  databaseCommitsPerSecond: null,
  note: "This measures QR signature checks only. It is not an attendance commit rate and not a 10-million-user result.",
}));
