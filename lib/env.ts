import { z } from "zod";
const schema = z.object({ NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000") });
// Explicit allowlist: server secrets must never enter a client configuration object.
export const publicEnv = schema.parse({ NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined });
