import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const ticketSchema = z.object({
  org: z.uuid(),
  student: z.uuid(),
  classes: z.array(z.uuid()).max(12),
  exp: z.number().int(),
});

export type IdentityTicket = z.infer<typeof ticketSchema>;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`turnmark:identity:v1:${payload}`).digest();
}

export function issueIdentityTicket(ticket: Omit<IdentityTicket, "exp">, secret: string, now = Date.now()) {
  const body = ticketSchema.parse({ ...ticket, exp: now + 10 * 60 * 1000 });
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${encoded}.${sign(encoded, secret).toString("base64url")}`;
}

export function readIdentityTicket(token: string, secret: string, now = Date.now()): IdentityTicket {
  if (token.length > 4000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error("Restart identification.");
  const [encoded, supplied] = token.split(".");
  const expected = sign(encoded, secret);
  const received = Buffer.from(supplied, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Restart identification.");
  const parsed = ticketSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  if (parsed.exp <= now) throw new Error("This check timed out. Enter your matriculation number again.");
  return parsed;
}
