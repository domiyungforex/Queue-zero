"use client";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { publicPaths } from "@/lib/site/metadata";
const key = "turnmark-analytics-consent";
function subscribe(callback: () => void) { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); }
function snapshot() { try { return localStorage.getItem(key); } catch { return "denied"; } }
export function MarketingAnalytics({ id }: { id: string }) {
  const path = usePathname();
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  const [choice, setChoice] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const consent = preferencesOpen ? null : choice || stored;
  const eligible = publicPaths.some(value => value === path);
  function decide(value: string) { try { localStorage.setItem(key, value); } catch {} setChoice(value); setPreferencesOpen(false); }
  if (!eligible) return null;
  return <>{consent === "granted" && <iframe key={path} title="Optional public page analytics" hidden sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><head><script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config',${JSON.stringify(id)},{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});gtag('event','page_view',{page_location:${JSON.stringify(window.location.origin + path)},page_referrer:'',page_title:${JSON.stringify(document.title)}});</script></head><body></body></html>`} />}{consent === null ? <aside className="fixed bottom-24 left-4 right-4 z-50 max-w-md rounded-xl border bg-white p-5 text-sm text-slate-900 shadow-lg" aria-label="Analytics preference"><p>Allow optional Google Analytics on public pages? Private workspace and ticket activity are excluded.</p><div className="mt-3 flex gap-5"><button onClick={() => decide("granted")} className="font-semibold">Allow analytics</button><button onClick={() => decide("denied")}>Decline</button></div></aside> : <button className="m-4 text-sm underline" onClick={() => consent === "granted" ? decide("denied") : setPreferencesOpen(true)}>Analytics: {consent === "granted" ? "on — turn off" : "off"}</button>}</>;
}
