import { randomUUID } from "node:crypto";
import { QR_LIFETIME_SECONDS, type AttendanceToken } from "./token";
export function newAttendanceToken(organizationId: string, sessionId: string, now = Math.floor(Date.now() / 1000)): AttendanceToken {
  return { version: 1, purpose: "CLASS_ATTENDANCE", organization_id: organizationId, session_id: sessionId, nonce: randomUUID(), issued_at: now, expires_at: now + QR_LIFETIME_SECONDS };
}
