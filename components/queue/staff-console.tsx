"use client";
import { Confirmation } from "@/components/ui/confirmation";
import { useCallback,useEffect,useRef,useState } from "react";
import { ArrowRight,Bell,Check,Clock3,Pause,Play,RefreshCw,UserRound,Users,X,Volume2 } from "lucide-react";
import { useLive } from "@/lib/realtime/use-live";
import { consoleSchema,operationSchema,type QueueConsole,type OperationInput } from "@/lib/validation/operations";
import { runQueueOperation } from "@/app/dashboard/queues/[queueId]/actions";
import { StatCard,StatusPill,duration } from "@/components/ui/workspace";
export function StaffConsole({initial,manager,demo=false}:{initial:QueueConsole;manager:boolean;demo?:boolean}){
 const [queue,setQueue]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState<OperationInput|null>(null),[confirm,setConfirm]=useState<{operation:'no_show'|'cancel';ticketId:string;number:string}|null>(null);
 const running=useRef(false);const storageKey=`queuezero-action:${initial.queue_id}`;const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;let saved:string|null=null;try{saved=sessionStorage.getItem(storageKey)}catch{/* Storage may be disabled. */}if(saved){try{const value:unknown=JSON.parse(saved);const parsed=operationSchema.safeParse(value);if(parsed.success&&parsed.data.queueId===initial.queue_id)queueMicrotask(()=>{if(mounted.current)setRetry(parsed.data)})}catch{try{sessionStorage.removeItem(storageKey)}catch{/* Storage may be disabled. */}}}return()=>{mounted.current=false}},[storageKey,initial.queue_id]);
 const refresh=useCallback(async()=>{if(demo)return;try{const response=await fetch(`/api/queues/${initial.queue_id}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const parsed=consoleSchema.parse(await response.json());if(mounted.current){setQueue(parsed);setError('')}}catch{if(mounted.current)setError('Live connection interrupted. Your last snapshot is shown. Reconnecting…')}},[initial.queue_id,demo]);
 const live=useLive(`queue:${initial.queue_id}`,()=>{void refresh()},true,!demo);
 async function operate(operation:OperationInput['operation'],ticketId?:string,saved?:OperationInput){
  if(running.current)return;running.current=true;setBusy(true);setMessage('');setConfirm(null);
  if(demo){
   setQueue(q=>{const next={...q,waiting:[...q.waiting]};
    if(operation==='call_next'&&!q.serving&&q.waiting.length){const first=next.waiting.shift()!;next.serving={...first,status:'serving',called_at:new Date().toISOString()};}
    else if(operation==='complete'){next.serving=null;next.served_today++;}
    else if(operation==='no_show'||operation==='cancel'){if(next.serving?.id===ticketId)next.serving=null;else next.waiting=next.waiting.filter(t=>t.id!==ticketId);if(operation==='no_show')next.no_shows_today++;}
    else if(operation==='open'||operation==='paused'||operation==='closed')next.status=operation;
    next.waiting=next.waiting.map((t,i)=>({...t,estimated_wait_seconds:i*300}));return next;
   });setMessage(operation==='recall'?'Demo: the customer would receive a recall alert.':'Demo updated. No real customer data was changed.');running.current=false;setBusy(false);return;
  }
  const input=saved??{queueId:queue.queue_id,requestId:crypto.randomUUID(),operation,...(ticketId?{ticketId}:{})};
  try{sessionStorage.setItem(storageKey,JSON.stringify(input))}catch{/* In-memory nonce still protects this session's retries. */}
  try{const r=await runQueueOperation(input);setMessage(r.message);if(r.retry)setRetry(input);else{setRetry(null);try{sessionStorage.removeItem(storageKey)}catch{/* The acknowledged operation is complete. */}};await refresh()}
  catch{setRetry(input);setMessage('We couldn’t confirm that action. Retry it safely using the button below.')}
  finally{running.current=false;setBusy(false)}
 }
 const blocked=busy||!!retry;
 return <div className="staff-console"><div className="console-toolbar"><StatusPill status={queue.status}/><span className="live-indicator"><i className={live?'connected':''}/>{demo?'Interactive demo':live?'Live · synced':'Checking every 15 seconds'}</span><button className="button-quiet" onClick={()=>void refresh()} aria-label="Refresh queue"><RefreshCw size={17}/></button></div>
 {error&&<p role="alert" className="notice warning">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
 {retry&&<div className="notice warning"><p>An action is waiting for confirmation. Retrying will not call another customer.</p><button className="button-primary" disabled={busy} onClick={()=>void operate(retry.operation,retry.ticketId,retry)}>{busy?'Checking…':'Retry last action'}</button></div>}
 <div className="metrics-grid"><StatCard label="Waiting now" value={queue.waiting.length} icon={<Users size={18}/>}/><StatCard label="Served today" value={queue.served_today} icon={<Check size={18}/>}/><StatCard label="Service estimate" value={duration(queue.average_service_seconds)} icon={<Clock3 size={18}/>}/><StatCard label="No-shows today" value={queue.no_shows_today} icon={<UserRound size={18}/>}/></div>
 <div className="console-grid"><section className="serving-card"><p className="eyebrow">{queue.serving?'NOW SERVING':'READY WHEN YOU ARE'}</p><div className="serving-number">{queue.serving?.display_number??'—'}</div><h2>{queue.serving?.customer_name??'Your next customer awaits.'}</h2><p>{queue.serving?'Give them your full attention. Complete their visit before calling next.':queue.waiting.length?'Call the first person in the waiting line.':'Share your queue QR code to welcome your first customer.'}</p>
 <button className="call-next" onClick={()=>void operate('call_next')} disabled={blocked||!!queue.serving||queue.status!=='open'||!queue.waiting.length}><span>{busy?'Updating…':'Call next'}</span><ArrowRight size={26}/></button>
 {queue.serving&&<button className="complete-button" disabled={blocked} onClick={()=>void operate('complete',queue.serving!.id)}><Check size={20}/>Complete service</button>}
 <div className="serving-secondary"><button disabled={blocked||!queue.serving} onClick={()=>void operate('recall',queue.serving!.id)}><Volume2 size={17}/>Recall</button><button disabled={blocked||!queue.serving} onClick={()=>setConfirm({operation:'no_show',ticketId:queue.serving!.id,number:queue.serving!.display_number})}><UserRound size={17}/>No-show</button></div>
 <div className="queue-controls"><button className="button-secondary" disabled={blocked} onClick={()=>void operate(queue.status==='open'?'paused':'open')}>{queue.status==='open'?<Pause size={16}/>:<Play size={16}/>} {queue.status==='open'?'Pause queue':'Open queue'}</button>{manager&&queue.status!=='closed'&&<button className="button-quiet" disabled={blocked} onClick={()=>void operate('closed')}>Close to new joins</button>}</div></section>
 <section className="waiting-panel"><div className="panel-heading"><h2>Waiting line <span>{queue.waiting.length}</span></h2><span>Arrival order</span></div>{queue.waiting.length?<ol className="waiting-list">{queue.waiting.map((ticket,index)=><li key={ticket.id}><span className="waiting-number">{ticket.display_number}</span><div className="waiting-person"><strong>{ticket.customer_name}</strong><span>{index===0?'Next in line':`${index} ahead`} · {duration(ticket.estimated_wait_seconds??0)}</span></div><details><summary aria-label={`Actions for ${ticket.display_number}`}>•••</summary><div className="row-menu"><button disabled={blocked} onClick={()=>setConfirm({operation:'no_show',ticketId:ticket.id,number:ticket.display_number})}>Mark no-show</button><button disabled={blocked} onClick={()=>setConfirm({operation:'cancel',ticketId:ticket.id,number:ticket.display_number})}>Remove from queue</button></div></details></li>)}</ol>:<div className="empty-state"><Bell size={30}/><h3>All caught up.</h3><p>New arrivals appear here automatically.</p></div>}<p className="panel-footnote">Customer details are visible only to your authorized team.</p></section></div>
 {confirm&&<Confirmation onDismiss={()=>setConfirm(null)}><section aria-labelledby="confirm-title" className="confirmation-card"><button className="close-dialog" aria-label="Dismiss confirmation" onClick={()=>setConfirm(null)}><X/></button><h2 id="confirm-title">{confirm.operation==='cancel'?'Remove':'Mark no-show for'} {confirm.number}?</h2><p>This ends their place in the queue. Their ticket remains in your history.</p><div className="button-row"><button autoFocus className="button-secondary" onClick={()=>setConfirm(null)}>Keep ticket</button><button className="button-danger" onClick={()=>void operate(confirm.operation,confirm.ticketId)}>Confirm</button></div></section></Confirmation>}
 </div>
}
