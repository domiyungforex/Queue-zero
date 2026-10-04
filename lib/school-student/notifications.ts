/** Attendance confirmations stay separate from queue templates. Delivery is in-app;
 * future channel providers must report their actual delivery outcome. */
export type AttendanceNotice = "CHECK_IN" | "CHECK_OUT" | "BLOCKED";
export function attendanceConfirmation(action: AttendanceNotice) {
  return { CHECK_IN: "Your arrival has been recorded.", CHECK_OUT: "Your departure has been recorded.", BLOCKED: "This scan was not recorded. Ask your lecturer to review it." }[action];
}
export interface AttendanceVerificationProvider {
  kind: "webauthn";
  verify(input: { userId: string; classId: string; challenge: string; response: unknown }): Promise<{ verified: boolean }>;
}
