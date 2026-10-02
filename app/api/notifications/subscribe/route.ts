import { readLimitedBody, RequestBodyTooLarge } from "@/lib/security/request-body";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { allowedPushEndpoint } from "@/lib/notifications/provider";
import { scheduleNotifications } from "@/lib/notifications/schedule";
const schema=z.object({token:z.uuid(),endpoint:z.string().max(4096).refine(allowedPushEndpoint),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]+$/).min(40).max(512),auth:z.string().regex(/^[A-Za-z0-9_-]+$/).min(10).max(512)}).strict()}).strict();
export async function POST(request:Request){
 if(request.headers.get('origin')!==process.env.NEXT_PUBLIC_APP_URL)return NextResponse.json({error:'Invalid origin'},{status:403});
 try{const raw=await readLimitedBody(request,8192);const body=schema.parse(JSON.parse(raw));const db=createJoinSupabaseClient();const {error}=await db.rpc('register_ticket_push',{p_token:body.token,p_endpoint:body.endpoint,p_p256dh:body.keys.p256dh,p_auth:body.keys.auth});if(error)throw new Error('Registration failed');scheduleNotifications();return NextResponse.json({ok:true});}
 catch(error){if(error instanceof RequestBodyTooLarge)return NextResponse.json({error:'Request too large'},{status:413});return NextResponse.json({error:'Could not enable alerts. Keep your ticket open and try again.'},{status:400})}
}
