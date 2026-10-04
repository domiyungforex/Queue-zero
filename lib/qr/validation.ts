import { decodeSignedToken } from "./signing";

export class ExpiredAttendanceQr extends Error {}
export function validateAttendanceToken(token: string, secret: string, options: { now?: number; organizationId?: string; sessionId?: string; allowExpiredReplay?: boolean } = {}) {
  const payload = decodeSignedToken(token, secret);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (payload.issued_at > now || payload.expires_at <= payload.issued_at || payload.expires_at - payload.issued_at > 45) throw new Error("Invalid attendance QR.");
  if (options.organizationId && payload.organization_id !== options.organizationId) throw new Error("QR belongs to another organization.");
  if (options.sessionId && payload.session_id !== options.sessionId) throw new Error("QR belongs to another class.");
  if (payload.expires_at <= now && !options.allowExpiredReplay) throw new ExpiredAttendanceQr("This QR has expired. Scan the current classroom QR.");
  return payload;
}
