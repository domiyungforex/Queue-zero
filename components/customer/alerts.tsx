"use client";
import { useState } from "react";
import { Bell,BellRing } from "lucide-react";
export function TicketAlerts({token}:{token:string}){
 const [busy,setBusy]=useState(false),[enabled,setEnabled]=useState(false),[message,setMessage]=useState('');
 async function enable(){
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){setMessage('Alerts are not supported in this browser. On iPhone, add QueueZero to your Home Screen and open it there. Keep your ticket open for updates.');return}
  const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key){setMessage('Browser alerts are not available yet. Keep this ticket open for live updates.');return}
  setBusy(true);
  try{const permission=await Notification.requestPermission();if(permission!=='granted'){setMessage('Notifications are off. You can enable them in your browser settings.');return}
   await navigator.serviceWorker.register('/sw.js');const reg=await navigator.serviceWorker.ready;
   const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   const subscription=await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});const value=subscription.toJSON();
   const response=await fetch('/api/notifications/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,endpoint:value.endpoint,keys:value.keys})});if(!response.ok)throw new Error();setEnabled(true);setMessage('Alerts enabled. We’ll notify you when your turn is close.');
  }catch{setMessage('Could not enable alerts. Please try again and keep your ticket open.')}finally{setBusy(false)}
 }
 return <section className="ticket-alerts"><div>{enabled?<BellRing size={21}/>:<Bell size={21}/>}<div><strong>A heads-up, right when you need it.</strong><p>Enable browser alerts for your turn.</p></div></div><button className="button-secondary" disabled={busy||enabled} onClick={()=>void enable()}>{busy?'Enabling…':enabled?'Alerts enabled':'Enable alerts'}</button>{message&&<p role="status">{message}</p>}</section>
}
