"use client";
import { useCallback,useRef,useState } from "react";
import { useLive } from "@/lib/realtime/use-live";
import { publicTicketSchema,type PublicTicket,type CancelTicketAction } from "@/lib/validation/ticket";
import { PublicTicketView } from "./public-ticket";
import { TicketAlerts } from "./alerts";
export function LiveTicket({initial,token,cancelAction}:{initial:PublicTicket;token:string;cancelAction:CancelTicketAction}){
 const [ticket,setTicket]=useState(initial),[error,setError]=useState('');const last=useRef(initial.status);
 const refresh=useCallback(async()=>{try{const response=await fetch(`/api/tickets/${token}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();const next=publicTicketSchema.parse(await response.json());setTicket(next);setError('');if(next.status==='serving'&&last.current!=='serving'&&'vibrate'in navigator)navigator.vibrate([200,100,200]);last.current=next.status}catch{setError('Connection interrupted. Your last ticket is shown. Reconnecting…')}},[token]);
 const active=['waiting','serving'].includes(ticket.status);const live=useLive(`ticket:${token}`,()=>{void refresh()},false,active);
 return <PublicTicketView ticket={ticket} cancelAction={cancelAction} extra={<><div className="ticket-sync" aria-live="polite"><span className="live-indicator"><i className={live?'connected':''}/>{!active?'Ticket complete':live?'Your ticket is live':'Reconnecting to live updates'}</span>{error&&<p role="alert">{error}</p>}</div>{active&&<TicketAlerts token={token}/>}</>}/>;
}
