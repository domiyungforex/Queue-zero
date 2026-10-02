"use client";
import { useRouter } from "next/navigation";
import { useLive } from "@/lib/realtime/use-live";
export function LiveRefresh({topic,authenticated=false}:{topic:string;authenticated?:boolean}){const router=useRouter();const live=useLive(topic,()=>router.refresh(),authenticated);return <span className="live-indicator"><i className={live?'connected':''}/>{live?'Live updates':'Updates every 15 seconds'}</span>}
