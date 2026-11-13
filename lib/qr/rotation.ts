import { randomUUID } from "node:crypto";
import { type AttendanceToken } from "./token";

export const DEFAULT_CLASS_QR_LIFETIME_SECONDS = 2 * 60 * 60; // 2 hours (7200s)

export function newAttendanceToken(
  organizationId: string,
  sessionId: string,
  now = Math.floor(Date.now() / 1000),
  lifetimeSeconds = DEFAULT_CLASS_QR_LIFETIME_SECONDS
): AttendanceToken {
  return {
    version: 1,
    purpose: "CLASS_ATTENDANCE",
    organization_id: organizationId,
    session_id: sessionId,
    nonce: randomUUID(),
    issued_at: now,
    expires_at: now + lifetimeSeconds,
  };
}
