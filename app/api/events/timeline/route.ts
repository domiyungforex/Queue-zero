import { NextResponse } from "next/server";
import { z } from "zod";
import { createUserSupabaseClient } from "@/lib/db/server";

const querySchema = z.object({
  organization_id: z.string().uuid(),
  subject_type: z.enum(["TICKET", "BOOKING", "ATTENDANCE", "SESSION"]),
  subject_id: z.string().uuid(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    organization_id: url.searchParams.get("organization_id"),
    subject_type: url.searchParams.get("subject_type"),
    subject_id: url.searchParams.get("subject_id"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timeline parameters." }, { status: 400 });
  }

  const db = await createUserSupabaseClient();
  const { data, error } = await (db.rpc as unknown as (name: string, args: Record<string, unknown>) => ReturnType<typeof db.rpc>)("get_subject_timeline", {
    p_organization_id: parsed.data.organization_id,
    p_subject_type: parsed.data.subject_type,
    p_subject_id: parsed.data.subject_id,
  });

  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not load timeline." }, { status: 500 });
  }

  return NextResponse.json(data);
}
