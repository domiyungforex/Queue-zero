import { z } from "zod";

export const attendanceTokenSchema = z.object({
  version: z.literal(1),
  purpose: z.literal("CLASS_ATTENDANCE"),
  organization_id: z.uuid(),
  session_id: z.uuid(),
  nonce: z.uuid(),
  issued_at: z.number().int().nonnegative(),
  expires_at: z.number().int().positive(),
}).strict();
export type AttendanceToken = z.infer<typeof attendanceTokenSchema>;
export const QR_LIFETIME_SECONDS = 30;
export const MAX_CLASS_QR_LIFETIME_SECONDS = 18 * 60 * 60;
