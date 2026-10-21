"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { z } from "zod";
import { Clock3, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import styles from "./attendance-qr.module.css";
const qrResponse = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
const qrErrorResponse = z.object({ error: z.string().min(1).max(160), code: z.string().max(60).optional() });
export function AttendanceQr({ classId }: { classId: string }) {
  const [qr, setQr] = useState<{ image: string; expires: number } | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false; let busy = false; const controller = new AbortController();
    async function load() { if (busy) return; busy = true; try { const response = await fetch(`/api/school/classes/${classId}/qr`, { cache: "no-store", signal: controller.signal }); const body: unknown = await response.json(); if (!response.ok) { const failure = qrErrorResponse.safeParse(body); throw new Error(failure.success ? failure.data.error : "We couldn’t create this attendance QR."); } const value = qrResponse.parse(body); const expires = Date.parse(value.expiresAt); if (expires <= Date.now()) throw new Error("This attendance QR expired before it could be displayed. Try again."); const image = await QRCode.toDataURL(value.url, { width: 512, margin: 3, errorCorrectionLevel: "M", color: { dark: "#111318", light: "#ffffff" } }); if (!stopped) { setQr({ image, expires }); setError(""); } } catch (cause) { if (!stopped && !controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "We couldn’t create this attendance QR."); setQr(null); } } finally { busy = false; } }
    void load(); const recover = () => { void load(); }; window.addEventListener("online", recover);
    return () => { stopped = true; controller.abort(); window.removeEventListener("online", recover); };
  }, [classId, retry]);
  return <section className={styles.card} aria-label="Class attendance QR">
    <header><span className={styles.icon}><ScanLine size={23} aria-hidden="true" /></span><div><p>LIVE ATTENDANCE</p><h2>Scan to mark attendance</h2><span>Students use their phone camera. No app needed.</span></div></header>
    {qr ? <div className={styles.qrArea}><div className={styles.qrFrame}><Image unoptimized src={qr.image} width={512} height={512} alt="QR code for this class attendance form" /><span><ScanLine size={16} aria-hidden="true" /> Scan here</span></div><div className={styles.instructions}><h3>Three quick steps</h3><ol><li><b>1</b>Open the camera</li><li><b>2</b>Scan this code</li><li><b>3</b>Enter name and matric number</li></ol><p><Clock3 size={15} aria-hidden="true" />Available until {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(qr.expires))}</p><p><ShieldCheck size={15} aria-hidden="true" />No TuRnMaRk account is required.</p></div></div> : <div className={styles.state} role="status"><span className={error ? styles.errorIcon : styles.loader} aria-hidden="true" /> <strong>{error ? "QR unavailable" : "Preparing attendance QR…"}</strong><p>{error || "Creating a secure link for this open class."}</p></div>}
    {(!qr || error) && <button className={styles.retry} onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Retry QR</button>}
    {qr && <footer>This code remains stable while attendance is open. Revoke it from class controls whenever access should stop.</footer>}
  </section>;
}
