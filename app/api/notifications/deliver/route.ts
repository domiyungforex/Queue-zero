import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverNotifications } from "@/lib/notifications/deliver";
export async function GET(request:Request){const expected=process.env.CRON_SECRET;const input=request.headers.get('authorization')??'';const value=`Bearer ${expected}`;if(!expected||Buffer.byteLength(input)!==Buffer.byteLength(value)||!timingSafeEqual(Buffer.from(input),Buffer.from(value)))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await deliverNotifications())}
