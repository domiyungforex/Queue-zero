import { describe, expect, it } from "vitest";
import { zonedWallTimeToUtc } from "@/lib/school/class-time";
import { newAttendanceToken } from "@/lib/qr/rotation";
import { signAttendanceToken } from "@/lib/qr/signing";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";

const SECRET = "test-attendance-secret-with-at-least-32-characters";
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION_ID = "33333333-3333-4333-8333-333333333333";

describe("Attendance session lifecycle, QR validation & Africa/Lagos timezone", () => {
  it("1. validates a newly created immediate session QR immediately", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = newAttendanceToken(ORG_ID, SESSION_ID, now);
    const token = signAttendanceToken(payload, SECRET);

    const decoded = validateAttendanceToken(token, SECRET, {
      now,
      organizationId: ORG_ID,
      sessionId: SESSION_ID,
    });
    expect(decoded.session_id).toBe(SESSION_ID);
    expect(decoded.organization_id).toBe(ORG_ID);
  });

  it("2. tolerates minor DB-to-app clock skew on freshly issued QR tokens", () => {
    const serverNow = Math.floor(Date.now() / 1000);
    const dbAheadBy15s = serverNow + 15;
    const payload = newAttendanceToken(ORG_ID, SESSION_ID, dbAheadBy15s);
    const token = signAttendanceToken(payload, SECRET);

    const decoded = validateAttendanceToken(token, SECRET, { now: serverNow });
    expect(decoded.session_id).toBe(SESSION_ID);
  });

  it("3. rejects an expired QR token with ExpiredAttendanceQr", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = newAttendanceToken(ORG_ID, SESSION_ID, past, 1800);
    const token = signAttendanceToken(payload, SECRET);

    expect(() => validateAttendanceToken(token, SECRET)).toThrow(ExpiredAttendanceQr);
  });

  it("4. rejects a QR token belonging to a different session", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = newAttendanceToken(ORG_ID, SESSION_ID, now);
    const token = signAttendanceToken(payload, SECRET);

    expect(() =>
      validateAttendanceToken(token, SECRET, { now, sessionId: OTHER_SESSION_ID }),
    ).toThrow("QR belongs to another class.");
  });

  it("5. converts Africa/Lagos (UTC+1) wall-clock timestamps around midnight accurately", () => {
    // 00:30 Africa/Lagos on Nov 27 is 23:30 UTC on Nov 26
    expect(zonedWallTimeToUtc("2026-11-27T00:30", "Africa/Lagos")).toBe("2026-11-26T23:30:00.000Z");
    // 23:45 Africa/Lagos on Nov 26 is 22:45 UTC on Nov 26
    expect(zonedWallTimeToUtc("2026-11-26T23:45", "Africa/Lagos")).toBe("2026-11-26T22:45:00.000Z");
    // Year boundary in Africa/Lagos
    expect(zonedWallTimeToUtc("2027-01-01T00:15", "Africa/Lagos")).toBe("2026-12-31T23:15:00.000Z");
  });

  it("6. rejects malformed or non-positive expiry timestamps", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = newAttendanceToken(ORG_ID, SESSION_ID, now, 0);
    // expires_at <= issued_at must fail validation
    const token = signAttendanceToken(payload, SECRET);
    expect(() => validateAttendanceToken(token, SECRET, { now })).toThrow("Invalid attendance QR.");
  });
});
