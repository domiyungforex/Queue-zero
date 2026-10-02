import { createHash } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { verifyPaystackSignature } from "@/lib/paystack/signature";
import { paystack,verifyCheckout } from "@/lib/paystack/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
const eventSchema=z.object({event:z.string(),data:z.object({reference:z.string().optional(),subscription_code:z.string().optional(),subscription:z.object({subscription_code:z.string()}).optional()}).passthrough()});
const subSchema=z.object({subscription_code:z.string(),status:z.string(),customer:z.object({customer_code:z.string()}),plan:z.object({plan_code:z.string()}),next_payment_date:z.string().nullable().optional()});
export async function POST(request:Request){const secret=process.env.PAYSTACK_SECRET_KEY;if(!secret)return NextResponse.json({error:'Not configured'},{status:503});const raw=await request.text();if(raw.length>131072)return NextResponse.json({error:'Too large'},{status:413});if(!verifyPaystackSignature(raw,request.headers.get('x-paystack-signature'),secret))return NextResponse.json({error:'Invalid signature'},{status:401});
 try{const event=eventSchema.parse(JSON.parse(raw));if(event.event==='charge.success'&&event.data.reference){if(!z.uuid().safeParse(event.data.reference).success)return NextResponse.json({received:true});await verifyCheckout(event.data.reference)}else if(['subscription.create','subscription.disable','subscription.not_renew','invoice.payment_failed','invoice.update'].includes(event.event)){
  const code=event.data.subscription_code??event.data.subscription?.subscription_code;if(!code)return NextResponse.json({received:true});
  // Read the provider's current state: late webhooks cannot resurrect a cancelled plan.
  const sub=subSchema.parse(await paystack('/subscription/'+encodeURIComponent(code)));const status=sub.status==='active'?'active':sub.status==='attention'?'past_due':sub.status==='non-renewing'?'active':'cancelled';
  const db=createJoinSupabaseClient();const {error}=await db.rpc('sync_subscription_event',{p_event_id:createHash('sha256').update(raw).digest('hex'),p_event_type:event.event,p_customer_code:sub.customer.customer_code,p_subscription_code:sub.subscription_code,p_plan_code:sub.plan.plan_code,p_status:status,p_event_at:new Date().toISOString(),p_period_end:sub.next_payment_date??new Date().toISOString()});if(error)throw new Error('Retry event');
 }return NextResponse.json({received:true});}catch{return NextResponse.json({error:'Processing unavailable. Retry delivery.'},{status:503})}
}
