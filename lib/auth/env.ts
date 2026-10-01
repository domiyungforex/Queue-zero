import "server-only";
import { z } from "zod";

const schema = z.object({
  CLERK_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_.+$/, "Set a valid Clerk secret key"),
});

export function getClerkServerEnv() {
  return schema.parse({ CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY });
}
