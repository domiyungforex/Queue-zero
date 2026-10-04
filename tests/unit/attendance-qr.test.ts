import { describe, expect, it } from "vitest";
import { signAttendanceToken } from "@/lib/qr/signing";
import { validateAttendanceToken, ExpiredAttendanceQr } from "@/lib/qr/validation";
import { newAttendanceToken } from "@/lib/qr/rotation";
import { attendanceScanSchema } from "@/lib/qr/replay-protection";
import { safeAuthReturn } from "@/lib/school-student/return-url";
const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", session = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", secret = "a".repeat(64);
const token = newAttendanceToken(org, session, 1000);
describe("signed attendance QR", () => {
  it("round trips opaque domain payload and expires after 30 seconds", () => {
    expect(token.expires_at).toBe(1030);
    expect(validateAttendanceToken(signAttendanceToken(token, secret), secret, { now: 1001 })).toEqual(token);
    expect(Object.keys(token)).not.toContain("student_id");
  });
  it("rejects expired codes at the exact boundary", () => expect(() => validateAttendanceToken(signAttendanceToken(token, secret), secret, { now: 1030 })).toThrow(ExpiredAttendanceQr));
  it("rejects modified payloads and signatures", () => {
    const signed = signAttendanceToken(token, secret);
    const [payload, sig] = signed.split(".");
    const changed = Buffer.from(JSON.stringify({ ...token, session_id: org })).toString("base64url");
    for (const tampered of [`${changed}.${sig}`, `${payload}.${"A".repeat(43)}`, signed + "x", "not-a-token"]) expect(() => validateAttendanceToken(tampered, secret, {now:1001})).toThrow();
  });
  it("rejects other organization, class, signing key, future issue and excessive validity", () => {
    const signed = signAttendanceToken(token, secret);
    expect(() => validateAttendanceToken(signed, secret, { now: 1001, organizationId: session })).toThrow();
    expect(() => validateAttendanceToken(signed, secret, { now: 1001, sessionId: org })).toThrow();
    expect(() => validateAttendanceToken(signed, "b".repeat(64), { now: 1001 })).toThrow();
    expect(() => validateAttendanceToken(signed, secret, { now: 994 })).toThrow();
    expect(() => validateAttendanceToken(signAttendanceToken({ ...token, expires_at: token.issued_at + 18 * 60 * 60 + 1 }, secret), secret, { now: 1001 })).toThrow();
  });
  it("allows expired signatures solely for replay while retaining structural validation", () => {
    expect(validateAttendanceToken(signAttendanceToken(token,secret),secret,{now:2000,allowExpiredReplay:true})).toEqual(token);
    expect(()=>validateAttendanceToken(signAttendanceToken({...token,expires_at:900},secret),secret,{now:2000,allowExpiredReplay:true})).toThrow();
    expect(()=>validateAttendanceToken(signAttendanceToken({...token,expires_at:token.issued_at+18*60*60+1},secret),secret,{now:2000,allowExpiredReplay:true})).toThrow();
  });
  it("rotates unpredictable nonces", () => expect(newAttendanceToken(org, session, 1000).nonce).not.toBe(token.nonce));
  it("refuses caller-supplied identity and malformed request ids", () => {
    expect(attendanceScanSchema.safeParse({ token: "x", requestId: token.nonce, fullName:"Student", matricNumber:"PHY/1", student_id: org }).success).toBe(false);
    expect(attendanceScanSchema.safeParse({ token: "x", requestId: "arbitrary", fullName:"Student", matricNumber:"PHY/1" }).success).toBe(false);
  });
  it("preserves QR through authentication but rejects external redirects", () => {
    const path = `/attend?token=${signAttendanceToken(token, secret)}`;
    expect(safeAuthReturn(path)).toBe(path);
    for (const value of ["//evil.test", "/\\evil.test", "https://evil.test", "/\n/evil.test"]) expect(safeAuthReturn(value)).toBe("/dashboard");
  });
});
