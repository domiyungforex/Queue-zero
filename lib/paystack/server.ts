import "server-only";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
export function billingConfigured(){return !!process.env.PAYSTACK_SECRET_KEY}
import type { Plan } from "./plans";
// Every paid catalog plan is billed through a Paystack subscription plan.
// Plan codes are configured per plan (and per interval) in the environment:
// PAYSTACK_<PLAN>_PLAN_CODE / PAYSTACK_<PLAN>_ANNUAL_PLAN_CODE.
export type PaystackPlanCode = Exclude<Plan, "FREE" | "ENTERPRISE">;
const PLAN_ENV_PREFIX: Record<PaystackPlanCode, string> = {
  STARTER: "PAYSTACK_STARTER",
  GROWTH: "PAYSTACK_GROWTH",
  PROFESSIONAL: "PAYSTACK_PROFESSIONAL",
  EDUCATION: "PAYSTACK_EDUCATION",
  EVENTS: "PAYSTACK_EVENTS",
  BUSINESS: "PAYSTACK_BUSINESS",
};
export function paystackPlanEnvName(plan: PaystackPlanCode, interval: "monthly" | "annual" = "monthly"): string {
  return `${PLAN_ENV_PREFIX[plan]}${interval === "annual" ? "_ANNUAL" : ""}_PLAN_CODE`;
}
export function paystackPlanConfigured(plan: PaystackPlanCode, interval: "monthly" | "annual" = "monthly"): boolean {
  const code = process.env[paystackPlanEnvName(plan, interval)];
  return !!code && /^PLN_[A-Za-z0-9]+$/.test(code);
}
export async function paystack(path:string,body?:unknown){
 const key=process.env.PAYSTACK_SECRET_KEY;if(!key)throw new Error('Billing is not configured');
 const response=await fetch('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const json:unknown=await response.json();const envelope=z.object({status:z.boolean(),data:z.unknown()}).parse(json);if(!response.ok||!envelope.status)throw new Error('Payment provider unavailable');return envelope.data;
}
const planSchema=z.object({plan_code:z.string(),amount:z.number().int().positive(),currency:z.string().regex(/^[A-Z]{3}$/),interval:z.enum(['monthly','annually'])});
export async function getPaidPlan(plan: PaystackPlanCode, interval: "monthly" | "annual" = "monthly"){
 const code=process.env[paystackPlanEnvName(plan,interval)];if(!code||!/^PLN_[A-Za-z0-9]+$/.test(code))throw new Error('Plan is not configured');
 const data=planSchema.parse(await paystack('/plan/'+code));const expectedInterval=interval==='annual'?'annually':'monthly';if(data.plan_code!==code||data.interval!==expectedInterval||data.currency!==(process.env.PAYSTACK_CURRENCY??'NGN'))throw new Error('Plan configuration mismatch');return data;
}
const transactionSchema=z.object({id:z.number(),reference:z.string(),status:z.string(),amount:z.number(),currency:z.string(),paid_at:z.string().nullable(),customer:z.object({customer_code:z.string()}),plan:z.union([z.string(),z.object({plan_code:z.string()}),z.null()]).optional(),subscription:z.object({subscription_code:z.string()}).nullish()});
export async function verifyCheckout(reference:string,businessId?:string){
 if(!z.uuid().safeParse(reference).success)throw new Error('Invalid reference');const db=createJoinSupabaseClient();let query=db.from('billing_checkouts').select('*').eq('reference',reference);if(businessId)query=query.eq('business_id',businessId);const {data:checkout,error}=await query.single();if(error||!checkout)throw new Error('Checkout unavailable');
 const paid=transactionSchema.parse(await paystack('/transaction/verify/'+encodeURIComponent(reference)));
 if(paid.status!=='success')return false;
 const plan=typeof paid.plan==='string'?paid.plan:paid.plan?.plan_code;
 if(paid.reference!==reference||paid.amount!==checkout.amount||paid.currency!==checkout.currency||plan!==checkout.provider_plan_code||!paid.paid_at)throw new Error('Payment verification mismatch');
 const paidDate=new Date(paid.paid_at);if(!Number.isFinite(paidDate.getTime()))throw new Error('Invalid payment timestamp');
 // The paid period follows the plan interval (monthly/annually) fetched from
 // Paystack; provider subscription events refine it afterwards.
 let planInterval:'monthly'|'annually'='monthly';
 try{const planData=z.object({interval:z.enum(['monthly','annually'])}).parse(await paystack('/plan/'+encodeURIComponent(checkout.provider_plan_code)));planInterval=planData.interval;}catch{/* default to monthly */}
 const periodEnd=new Date(paidDate);if(planInterval==='annually')periodEnd.setUTCFullYear(periodEnd.getUTCFullYear()+1);else periodEnd.setUTCMonth(periodEnd.getUTCMonth()+1);
 const result=await db.rpc('confirm_checkout',{p_reference:reference,p_event_id:`charge:${paid.id}`,p_customer_code:paid.customer.customer_code,p_subscription_code:paid.subscription?.subscription_code??'',p_paid_at:paidDate.toISOString(),p_period_end:periodEnd.toISOString()});if(result.error)throw new Error('Could not record payment');return true;
}
