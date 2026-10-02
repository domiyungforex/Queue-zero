"use client";
import { useEffect,useRef,useState } from "react";
import { createClient } from "@supabase/supabase-js";
/** Broadcast invalidates; HTTP always supplies authoritative state. */
export function useLive(topic:string,onChange:()=>void,authenticated=false,enabled=true){
 const callback=useRef(onChange);useEffect(()=>{callback.current=onChange},[onChange]);
 const [connected,setConnected]=useState(false);
 useEffect(()=>{
  if(!enabled)return;
  let stopped=false;let debounce:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{if(stopped)return;clearTimeout(debounce);debounce=setTimeout(()=>callback.current(),180)};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},accessToken:authenticated?async()=>{const r=await fetch('/api/realtime',{cache:'no-store'});if(!r.ok)return null;const d:unknown=await r.json();return typeof d==='object'&&d!==null&&'token'in d&&typeof d.token==='string'?d.token:null}:undefined}):null;
  const channel=client?.channel(topic,{config:{private:true}}).on('broadcast',{event:'changed'},refresh).subscribe(status=>{if(stopped)return;setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED')refresh()});
  // Reconnect, tab focus and bounded fallback polling recover lost events.
  const interval=setInterval(refresh,15000);
  const visibility=()=>{if(document.visibilityState==='visible')refresh()};
  window.addEventListener('online',refresh);document.addEventListener('visibilitychange',visibility);
  const renew=authenticated?setInterval(()=>{void client?.realtime.setAuth().catch(()=>setConnected(false))},45000):null;
  return()=>{stopped=true;clearInterval(interval);if(renew)clearInterval(renew);clearTimeout(debounce);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visibility);if(client&&channel)void client.removeChannel(channel)};
 },[topic,authenticated,enabled]);
 return connected;
}
