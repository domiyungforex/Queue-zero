import { createHmac, timingSafeEqual } from "node:crypto";
import { attendanceTokenSchema, type AttendanceToken } from "./token";

function signature(payload: string, secret: string) {
  if (secret.length < 32) throw new Error("QR signing is not configured.");
  return createHmac("sha256", secret).update(`turnmark:attendance:v1:${payload}`).digest();
}
export function signAttendanceToken(payload: AttendanceToken, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(attendanceTokenSchema.parse(payload))).toString("base64url");
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`;
}
export function decodeSignedToken(token: string, secret: string): AttendanceToken {
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid attendance QR.");
  const [encoded, supplied] = token.split(".");
  const expected = signature(encoded, secret);
  const received = Buffer.from(supplied, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid attendance QR.");
  return attendanceTokenSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
}
