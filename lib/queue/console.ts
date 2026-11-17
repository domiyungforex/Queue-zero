import "server-only";
import { createUserSupabaseClient } from "@/lib/db/server";
import { getManagedQueue } from "@/lib/queue/management";
import { consoleSchema,metricsSchema } from "@/lib/validation/operations";
import { requireBusinessMembership } from "@/lib/business/membership";
export async function getQueueConsole(id:string){
 await getManagedQueue(id);
 const db=await createUserSupabaseClient();const {data,error}=await db.rpc("get_queue_console",{p_queue_id:id});
 if(error)throw new Error("We couldn’t load the queue. Try again.");return consoleSchema.parse(data);
}
export async function getBusinessMetrics(days=7){
 const m=await requireBusinessMembership();const db=await createUserSupabaseClient();
 const {data,error}=await db.rpc("business_metrics",{p_business_id:m.businessId,p_days:days});
 if(error){
  console.error("business_metrics failed",{code:error.code,message:error.message});
  throw new Error("We couldn’t load your metrics.");
 }
 const parsed=metricsSchema.safeParse(data);
 if(!parsed.success){
  console.error("business_metrics schema mismatch",parsed.error.issues.slice(0,8));
  throw new Error("We couldn’t load your metrics.");
 }
 return parsed.data;
}
