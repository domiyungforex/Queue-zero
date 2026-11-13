import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingAvailability } from "@/lib/booking/availability";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  slug: z.string().min(3).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  try {
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
