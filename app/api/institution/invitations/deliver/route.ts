import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverInstitutionInvitations } from "@/lib/institution/invitation-delivery";
export async function GET(request: Request) {
 const secret = process.env.CRON_SECRET, input = request.headers.get('authorization') ?? '', expected = `Bearer ${secret}`;
 if (!secret || Buffer.byteLength(input) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(input), Buffer.from(expected))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 try { return NextResponse.json(await deliverInstitutionInvitations(), { headers: { 'Cache-Control': 'no-store' } }); }
 catch { return NextResponse.json({ error: 'Invitation delivery unavailable' }, { status: 503 }); }
}
