"use client";
import { useRouter } from "next/navigation";
import { realtimeCadence } from "@/lib/realtime/cadence";
import { useLive } from "@/lib/realtime/use-live";
export function LiveRefresh({ topic, authenticated = false }: { topic: string; authenticated?: boolean }) {
  const router = useRouter();
  const cadence = realtimeCadence(topic);
  const live = useLive(topic, () => router.refresh(), authenticated, true, cadence);
  const seconds = Math.round(cadence.pollMs / 1000);
  return <span className="live-indicator"><i className={live ? "connected" : ""} />{live ? "Live updates" : `Updates every ${seconds} seconds`}</span>;
}
