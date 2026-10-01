import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const CUSTOMER_COOKIE = "queuezero-customer";
export const customerSessionSchema = z.uuid();

export function getJoinSecret(): string {
  const parsed = z.string().min(32).safeParse(process.env.QUEUE_JOIN_SECRET);
  if (!parsed.success) throw new Error("Configure QUEUE_JOIN_SECRET with at least 32 random characters.");
  return parsed.data;
}

export function getJoinKeys(session: string, requestHeaders: Pick<Headers, "get">) {
  customerSessionSchema.parse(session);
  const secret = getJoinSecret();
  // Vercel overwrites this header. On other hosts, fail conservatively into one
  // shared bucket instead of trusting caller-supplied forwarding headers.
  const candidate = process.env.VERCEL === "1"
    ? requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : undefined;
  const address = candidate && isIP(candidate) ? candidate : "unattributed";
  const digest = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  return { customerKey: digest(`customer:${session}`), rateKey: digest(`join-address:${address}`) };
}
