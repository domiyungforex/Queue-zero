"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { z } from "zod";
const qrResponse = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export function AttendanceQr({ classId }: { classId: string }) {
  const [qr, setQr] = useState<{ image: string; expires: number } | null>(null);
  const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false; let busy = false; const controller = new AbortController();
    async function load() { if (busy) return; busy = true; try { const response = await fetch(`/api/school/classes/${classId}/qr`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error("QR unavailable"); const value = qrResponse.parse(await response.json()); const expires = Date.parse(value.expiresAt); if (expires <= Date.now()) throw new Error("QR expired"); const image = await QRCode.toDataURL(value.url, { width: 384, margin: 2, errorCorrectionLevel: "M", color: { dark: "#003d32", light: "#ffffff" } }); if (!stopped) { setQr({ image, expires }); setError(false); } } catch { if (!stopped) { setError(true); setQr(null); } } finally { busy = false; } }
    void load(); const recover = () => { void load(); }; window.addEventListener("online", recover);
    return () => { stopped = true; controller.abort(); window.removeEventListener("online", recover); };
  }, [classId, retry]);
  return <section className="school-qr" aria-label="Class attendance QR"><h2 className="text-xl font-semibold">Scan to mark attendance</h2>{qr ? <><Image unoptimized src={qr.image} width={320} height={320} alt="QR code for this class attendance form" /><p>This QR remains stable while attendance is open.</p></> : <p role="status">{error ? "QR unavailable. Check your connection or class access." : "Preparing attendance QR…"}</p>}{(!qr || error) && <button className="button-secondary" onClick={() => setRetry(value => value + 1)}>Retry QR</button>}<p className="text-sm text-muted">Students enter their name and matric number. No TuRnMaRk account is required.</p></section>;
}
