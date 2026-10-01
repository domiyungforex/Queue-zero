import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_COOKIE, customerSessionSchema } from "@/lib/security/customer-session";
import { publicQueueSlugSchema } from "@/lib/validation/public-queue";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!publicQueueSlugSchema.safeParse(slug).success) return new NextResponse("Queue unavailable", { status: 404 });
  // This creates only a browser identifier, never a ticket. Disable prefetch/cache.
  // Relative Location preserves the browser origin behind workspace/Vercel proxies.
  const response = new NextResponse(null, { status: 303, headers: {
    Location: `/q/${slug}/join?session=ready`, "Cache-Control": "no-store",
  } });
  if (!customerSessionSchema.safeParse(request.cookies.get(CUSTOMER_COOKIE)?.value).success) {
    response.cookies.set(CUSTOMER_COOKIE, randomUUID(), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
