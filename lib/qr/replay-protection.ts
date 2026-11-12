import { z } from "zod";
/** Durable replay enforcement is performed by school_attend_accountless in the same
 * transaction as attendance, keyed by roster student and idempotency request ID.
 * A browser must retain this ID when retrying an uncertain network response. */
export const attendanceScanSchema = z.object({
  token: z.string().min(1).max(2048),
  requestId: z.uuid(),
  fullName: z.string().trim().min(1).max(160),
  matricNumber: z.string().trim().min(1).max(80),
  photo: z.string().max(2_000_000).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().min(0).max(100_000).optional().nullable(),
}).strict();
