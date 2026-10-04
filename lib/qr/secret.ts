import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
export function attendanceSecret() {
  const configured = process.env.ATTENDANCE_QR_SECRET ?? process.env.QUEUE_JOIN_SECRET;
  const parsed = z.string().min(32).safeParse(configured);
  if (!parsed.success) throw new Error("Attendance signing is not configured.");
  return createHmac("sha256", parsed.data).update("turnmark:attendance:signing-key:v1").digest("hex");
}
