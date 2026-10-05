import { z } from "zod";

/** Durable replay enforcement is performed in the attendance scan RPC in the same
 * transaction as attendance. A browser retains one request ID when retrying an
 * uncertain network response. */
export const attendanceScanSchema = z.object({
  token: z.string().min(1).max(2048),
  requestId: z.uuid(),
  fullName: z.string().trim().min(1).max(160),
  matricNumber: z.string().trim().min(1).max(80),
}).strict();
