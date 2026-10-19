"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { z } from "zod";
import { Clock3, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import styles from "./attendance-qr.module.css";
const qrResponse = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export function AttendanceQr({ classId }: { classId: string }) {
  const [qr, setQr] = useState<{ image: string; expires: number } | null>(null);
  const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false; let busy = false; const controller = new AbortController();
    async function load() { if (busy) return; busy = true; try { const response = await fetch(`/api/school/classes/${classId}/qr`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error("QR unavailable"); const value = qrResponse.parse(await response.json()); const expires = Date.parse(value.expiresAt); if (expires <= Date.now()) throw new Error("QR expired"); const image = await QRCode.toDataURL(value.url, { width: 512, margin: 3, errorCorrectionLevel: "M", color: { dark: "#111318", light: "#ffffff" } }); if (!stopped) { setQr({ image, expires }); setError(false); } } catch { if (!stopped) { setError(true); setQr(null); } } finally { busy = false; } }
    void load(); const recover = () => { void load(); }; window.addEventListener("online", recover);
    return () => { stopped = true; controller.abort(); window.removeEventListener("online", recover); };
  }, [classId, retry]);
  return <section className={styles.card} aria-label="Class attendance QR">
    <header><span className={styles.icon}><ScanLine size={23} aria-hidden="true" /></span><div><p>LIVE ATTENDANCE</p><h2>Scan to mark attendance</h2><span>Students use their phone camera. No app needed.</span></div></header>
    {qr ? <div className={styles.qrArea}><div className={styles.qrFrame}><Image unoptimized src={qr.image} width={512} height={512} alt="QR code for this class attendance form" /><span><ScanLine size={16} aria-hidden="true" /> Scan here</span></div><div className={styles.instructions}><h3>Three quick steps</h3><ol><li><b>1</b>Open the camera</li><li><b>2</b>Scan this code</li><li><b>3</b>Enter name and matric number</li></ol><p><Clock3 size={15} aria-hidden="true" />Available until {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(qr.expires))}</p><p><ShieldCheck size={15} aria-hidden="true" />No TuRnMaRk account is required.</p></div></div> : <div className={styles.state} role="status"><span className={error ? styles.errorIcon : styles.loader} aria-hidden="true" /> <strong>{error ? "QR unavailable" : "Preparing attendance QR…"}</strong><p>{error ? "Check your connection or class access, then try again." : "Creating a secure link for this open class."}</p></div>}
    {(!qr || error) && <button className={styles.retry} onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Retry QR</button>}
    {qr && <footer>This code remains stable while attendance is open. Revoke it from class controls whenever access should stop.</footer>}
  </section>;
}
