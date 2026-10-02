"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { requireBusinessOwner } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { getPaidPlan,paystack } from "@/lib/paystack/server";
import { unstable_rethrow } from "next/navigation";
export type CheckoutResult={url?:string;error?:string};
const hostedUrl=z.url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='checkout.paystack.com'||u.hostname==='paystack.com'||u.hostname.endsWith('.paystack.com'))});
export async function startCheckout(plan:unknown):Promise<CheckoutResult>{
 const m=await requireBusinessOwner();const parsed=z.enum(['STARTER','BUSINESS']).safeParse(plan);if(!parsed.success)return {error:'Choose a valid plan.'};
 try{const user=await currentUser();const email=user?.primaryEmailAddress?.emailAddress;if(!email||user?.primaryEmailAddress?.verification?.status!=='verified')return {error:'Add a verified email to your account before upgrading.'};const details=await getPaidPlan(parsed.data);const reference=randomUUID();const db=createJoinSupabaseClient();
 const {error}=await db.from('billing_checkouts').insert({reference,business_id:m.businessId,plan:parsed.data,provider_plan_code:details.plan_code,amount:details.amount,currency:details.currency});if(error)throw new Error();
 const result=z.object({authorization_url:hostedUrl}).parse(await paystack('/transaction/initialize',{email,amount:details.amount,currency:details.currency,plan:details.plan_code,reference,callback_url:new URL('/api/billing/verify',process.env.NEXT_PUBLIC_APP_URL).href,metadata:{reference}}));return {url:result.authorization_url};
 }catch(e){unstable_rethrow(e);return {error:'Checkout is unavailable right now. Your current plan has not changed.'}}
}
export async function manageSubscription():Promise<CheckoutResult>{const m=await requireBusinessOwner();try{const db=createJoinSupabaseClient();const {data}=await db.from('subscriptions').select('provider_subscription_code').eq('business_id',m.businessId).single();if(!data?.provider_subscription_code)return {error:'Subscription management will be available after the provider confirms your subscription.'};const result=z.object({link:hostedUrl}).parse(await paystack('/subscription/'+encodeURIComponent(data.provider_subscription_code)+'/manage/link'));return {url:result.link}}catch(e){unstable_rethrow(e);return {error:'Could not open subscription management. Please try again.'}}}
