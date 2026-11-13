import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .regex(/^pk_(test|live)_[A-Za-z0-9+/]+=*$/, "Set a valid Clerk publishable key")
    .default("pk_test_placeholder_for_build="),
});

// Explicit allowlist: server secrets must never enter a client configuration object.
export const publicEnv = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || undefined,
});
