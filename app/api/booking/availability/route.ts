import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingAvailability } from "@/lib/booking/availability";
import { checkRateLimit, clientIpFromRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  slug: z.string().min(3).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = checkRateLimit(`availability:${ip}`, { limit: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      slug: searchParams.get("slug"),
      date: searchParams.get("date"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const slots = await getBookingAvailability(parsed.data.slug, parsed.data.date);
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Could not load availability" }, { status: 500 });
  }
}
