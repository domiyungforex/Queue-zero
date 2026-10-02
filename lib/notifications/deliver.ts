import "server-only";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { WebPushProvider } from "./provider";
/** Outbox leases isolate delivery from committed queue operations. */
export async function deliverNotifications(){
 if(!process.env.VAPID_PRIVATE_KEY)return {processed:0};
 const db=createJoinSupabaseClient();const {data:jobs,error}=await db.rpc('claim_notifications',{p_limit:8});
 if(error||!jobs)return {processed:0};const provider=new WebPushProvider();
 await Promise.all(jobs.map(async job=>{
  const {data:t}=await db.from('tickets').select('public_token,status,queues(name,status)').eq('id',job.ticket_id).single();
  const {data:targets}=await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('ticket_id',job.ticket_id);
  const relevant=t&&(job.type==='your_turn'?t.status==='serving':job.type==='almost_your_turn'?t.status==='waiting':t.queues?.status==='paused'&&['waiting','serving'].includes(t.status));
  if(!relevant||!targets?.length){await db.from('notifications').update({status:'skipped',lease_until:null,lease_token:null}).eq('id',job.id).eq('lease_token',job.lease_token!);return}
  let successes=0;let failed=0;
  await Promise.all(targets.map(async target=>{
   const notice={title:job.type==='your_turn'?"It’s your turn":job.type==='almost_your_turn'?'Almost your turn':'Queue paused',body:job.type==='your_turn'?`Please return to ${t.queues?.name??'the service area'}.`:job.type==='almost_your_turn'?'Please start returning to the service area.':'Check your ticket or speak to staff for updates.',url:`/ticket/${t.public_token}`,tag:job.id};
   try{if(job.type==='your_turn')await provider.sendCalledNotification(target,notice);else if(job.type==='almost_your_turn')await provider.sendAlmostTurnNotification(target,notice);else await provider.sendQueuePausedNotification(target,notice);successes++}
   catch(error){failed++;if(typeof error==='object'&&error!==null&&'statusCode'in error&&[404,410].includes(Number(error.statusCode)))await db.from('push_subscriptions').delete().eq('id',target.id)}
  }));
  await db.from('notifications').update({status:successes?'sent':job.attempts>=5?'failed':'pending',sent_at:successes?new Date().toISOString():null,error_message:failed?'Some push delivery attempts failed.':null,lease_token:null,lease_until:null,next_attempt_at:new Date(Date.now()+Math.min(3600,60*2**job.attempts)*1000).toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token!);
 }));
 return {processed:jobs.length};
}
