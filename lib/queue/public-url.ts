import { z } from "zod";

const originSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol)
    && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
});
const slugSchema = z.string().min(3).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export function buildPublicQueueUrl(appOrigin: string, slug: string): string {
  if (!originSchema.safeParse(appOrigin).success) {
    throw new Error("Configure NEXT_PUBLIC_APP_URL as an HTTP or HTTPS origin without credentials, a path, or query parameters.");
  }
  if (!slugSchema.safeParse(slug).success) throw new Error("Invalid public queue slug.");
  // Never derive printed destinations from request headers or a dashboard URL.
  return new URL(`/q/${slug}`, appOrigin).href;
}
