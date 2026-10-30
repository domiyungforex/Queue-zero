"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { z } from "zod";
import { RefreshCw, ScanLine } from "lucide-react";
import styles from "./attendance-qr.module.css";
import { AttendanceQrContent } from "./attendance-qr-content";
import type { AttendanceQrArtifact } from "@/lib/qr/attendance-artifact";
const qrResponse = z.object({ url: z.url(), expiresAt: z.iso.datetime({ offset: true }) });
const qrErrorResponse = z.object({ error: z.string().min(1).max(160), code: z.string().max(60).optional() });
const unavailableMessage = "We couldn’t create this attendance QR. Try again.";
const expiredMessage = "This attendance QR has expired. Try again to check whether attendance is still open.";
export function AttendanceQr({ classId, classLabel = "Class attendance" }: { classId: string; classLabel?: string }) {
  const [qr, setQr] = useState<(AttendanceQrArtifact & { classId: string }) | null>(null);
  const [failure, setFailure] = useState<{ classId: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const currentQr = qr?.classId === classId ? qr : null;
  const error = failure?.classId === classId ? failure.message : "";
  useEffect(() => {
    if (!qr || qr.classId !== classId) return;
    const expire = () => {
      if (qr.expires <= Date.now()) {
        setQr(null);
        setFailure({ classId, message: expiredMessage });
      }
    };
    const timer = setTimeout(expire, Math.min(Math.max(0, qr.expires - Date.now()), 2_147_483_647));
    document.addEventListener("visibilitychange", expire);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", expire); };
  }, [classId, qr]);
  useEffect(() => {
    let stopped = false; let busy = false; const controller = new AbortController();
    function fail(message: string) {
      if (!stopped && !controller.signal.aborted) { setFailure({ classId, message }); setQr(null); }
    }
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/school/classes/${classId}/qr`, { cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok) {
          const failure = qrErrorResponse.safeParse(body);
          fail(failure.success ? failure.data.error : unavailableMessage);
          return;
        }
        const parsed = qrResponse.safeParse(body);
        if (!parsed.success) { fail(unavailableMessage); return; }
        const expires = Date.parse(parsed.data.expiresAt);
        if (!Number.isFinite(expires)) { fail(unavailableMessage); return; }
        if (expires <= Date.now()) { fail("This attendance QR expired before it could be displayed. Try again."); return; }
        const image = await QRCode.toDataURL(parsed.data.url, { width: 1024, margin: 4, errorCorrectionLevel: "M", color: { dark: "#111318", light: "#ffffff" } });
        if (expires <= Date.now()) { fail(expiredMessage); return; }
        if (!stopped) { setQr({ classId, image, url: parsed.data.url, expires }); setFailure(null); }
      } catch {
        fail(unavailableMessage);
      } finally {
        busy = false;
      }
    }
    void load(); const recover = () => { void load(); }; window.addEventListener("online", recover);
    return () => { stopped = true; controller.abort(); window.removeEventListener("online", recover); };
  }, [classId, retry]);
  return <section className={styles.card} aria-label="Class attendance QR">
    <header><span className={styles.icon}><ScanLine size={23} aria-hidden="true" /></span><div><p>LIVE ATTENDANCE</p><h2>Scan to mark attendance</h2><span>Students use their phone camera. No app needed.</span></div></header>
    {currentQr ? <AttendanceQrContent key={`${classId}:${retry}:${currentQr.url}`} qr={currentQr} classLabel={classLabel}
      onExpired={() => { setQr(null); setFailure({ classId, message: expiredMessage }); }}
      onImageError={() => { setQr(null); setFailure({ classId, message: "We couldn’t display the QR code. Try again." }); }} />
      : <div className={styles.state} role="status"><span className={error ? styles.errorIcon : styles.loader} aria-hidden="true" /> <strong>{error ? "QR unavailable" : "Preparing attendance QR…"}</strong><p>{error || "Creating a secure link for this open class."}</p></div>}
    {!currentQr && <button className={styles.retry} type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Retry QR</button>}
  </section>;
}
