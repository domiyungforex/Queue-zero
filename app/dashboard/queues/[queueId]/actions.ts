"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getManagedQueue } from "@/lib/queue/management";
import { createUserSupabaseClient } from "@/lib/db/server";
import { callNext } from "@/lib/queue/call-next";
import { operationSchema,type OperationResult } from "@/lib/validation/operations";
import { scheduleNotifications } from "@/lib/notifications/schedule";
export async function runQueueOperation(input:unknown):Promise<OperationResult>{
 const parsed=operationSchema.safeParse(input);if(!parsed.success)return {ok:false,message:'Invalid operation. Reload the queue.'};
 const value=parsed.data;
 try{
  await getManagedQueue(value.queueId);
  if(value.operation==='call_next'){
   const r=await callNext({queueId:value.queueId,requestId:value.requestId});if(!r.ok)return {ok:false,message:r.message,retry:r.code==='retry'};
   scheduleNotifications();
   return {ok:true,message:r.result.outcome==='empty'?'Nobody is waiting.':r.result.outcome==='already_serving'?'Complete the current customer before calling next.':r.result.replayed?'This call was already recorded.':`${r.result.display_number} has been called.`};
  }
  const db=await createUserSupabaseClient();
  const {error}=['open','paused','closed'].includes(value.operation)
   ?await db.rpc('operate_queue',{p_queue_id:value.queueId,p_request_id:value.requestId,p_status:value.operation as 'open'|'paused'|'closed'})
   :value.ticketId?await db.rpc('operate_ticket',{p_queue_id:value.queueId,p_ticket_id:value.ticketId,p_request_id:value.requestId,p_operation:value.operation}):{error:{code:'22023'}};
  if(error)return {ok:false,message:error.code==='QZ007'?'This ticket changed. Refresh the queue and try again.':error.code==='42501'?'You no longer have access to this queue.':'We couldn’t confirm the change. Retry the same request.',retry:!['QZ007','42501','22023'].includes(error.code??'')};
  revalidatePath('/dashboard');scheduleNotifications();return {ok:true,message:'Queue updated.'};
 }catch(error){unstable_rethrow(error);return {ok:false,message:'Connection interrupted. Retry the same request safely.',retry:true}}
}
