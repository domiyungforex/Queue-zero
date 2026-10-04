"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { z } from "zod";
const qrResponse = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export function AttendanceQr({ classId }: { classId: string }) {
  const [qr, setQr] = useState<{ image: string; expires: number } | null>(null);
  const [error, setError] = useState(false); const [now, setNow] = useState(() => Date.now()); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false; let busy = false; const controller = new AbortController();
    async function rotate() { if (busy) return; busy = true; try { const response = await fetch(`/api/school/classes/${classId}/qr`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error("QR unavailable"); const value = qrResponse.parse(await response.json()); const expires = Date.parse(value.expiresAt); if (expires <= Date.now()) throw new Error("QR expired"); const image = await QRCode.toDataURL(value.url, { width: 384, margin: 2, errorCorrectionLevel: "M", color: { dark: "#003d32", light: "#ffffff" } }); if (!stopped) { setQr({ image, expires }); setError(false); } } catch { if (!stopped) { setError(true); setQr(null); } } finally { busy = false; } }
    void rotate(); const rotation = setInterval(() => { void rotate(); }, 20_000); const clock = setInterval(() => setNow(Date.now()), 1000); const recover = () => { void rotate(); }; window.addEventListener("online", recover);
    return () => { stopped = true; controller.abort(); clearInterval(rotation); clearInterval(clock); window.removeEventListener("online", recover); };
  }, [classId, retry]);
  const valid = qr && qr.expires > now;
  return <section className="school-qr" aria-label="Rotating attendance QR"><h2 className="text-xl font-semibold">Scan to record attendance</h2>{valid ? <><Image unoptimized src={qr.image} width={320} height={320} alt="Rotating QR for this class attendance" /><p>Refreshes automatically · valid for {Math.max(0, Math.ceil((qr.expires - now) / 1000))} seconds</p></> : <p role="status">{error ? "QR unavailable. Check your connection or class access." : qr ? "Refreshing expired QR…" : "Preparing attendance QR…"}</p>}{(!valid || error) && <button className="button-secondary" onClick={() => setRetry(value => value + 1)}>Retry QR</button>}<p className="text-sm text-muted">Students must use their own verified account. QR and device signals help identify risk; they do not prove physical presence.</p></section>;
}
