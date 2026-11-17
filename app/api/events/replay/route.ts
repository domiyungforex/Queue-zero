import { NextResponse } from "next/server";
import { z } from "zod";
import { replayEvents, type ReplayDomain } from "@/lib/events/replay";
import { createUserSupabaseClient } from "@/lib/db/server";

const querySchema = z.object({
  domain: z.enum(["ticket", "booking", "session"]),
  subject_id: z.string().uuid(),
  organization_id: z.string().uuid(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    domain: url.searchParams.get("domain"),
    subject_id: url.searchParams.get("subject_id"),
    organization_id: url.searchParams.get("organization_id"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid replay parameters." }, { status: 400 });
  }

  const db = await createUserSupabaseClient();
  const { data: membership } = await db
    .from("business_members")
    .select("business_id")
    .eq("business_id", parsed.data.organization_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not authorized for this organization." }, { status: 403 });
  }

  const result = await replayEvents(
    parsed.data.domain as ReplayDomain,
    parsed.data.subject_id,
    parsed.data.organization_id
  );

  if (!result) {
    return NextResponse.json({ error: "Replay failed or subject not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
