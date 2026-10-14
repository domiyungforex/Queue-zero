import { z } from "zod";
export const inquirySchema = z.object({ name: z.string().trim().min(1).max(100), email: z.email().max(254).transform(value => value.toLowerCase()), message: z.string().trim().min(10).max(4000), requestId: z.uuid() }).strict();
