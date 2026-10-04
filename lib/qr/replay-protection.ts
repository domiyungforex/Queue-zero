import { z } from "zod";
/** Durable replay enforcement is performed by school_scan in the same transaction
 * as attendance, keyed by authenticated student+nonce and idempotency request ID.
 * A browser must retain this ID when retrying an uncertain network response. */
export const attendanceScanSchema = z.object({ token: z.string().min(1).max(2048), requestId: z.uuid() }).strict();
