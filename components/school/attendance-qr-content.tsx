"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Clock3, Copy, Download, Printer, ScanLine, Share2, ShieldCheck } from "lucide-react";
import { attendanceQrExpiry, attendanceQrFile, attendanceQrFilename, printAttendanceQr, type AttendanceQrArtifact } from "@/lib/qr/attendance-artifact";
import styles from "./attendance-qr.module.css";

export function AttendanceQrContent({ qr, classLabel, onExpired, onImageError }: {
  qr: AttendanceQrArtifact; classLabel: string; onExpired: () => void; onImageError: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"share" | "print" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const printController = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; printController.current?.abort(); };
  }, []);
  useEffect(() => {
    if (manualCopy) { input.current?.focus(); input.current?.select(); }
  }, [manualCopy]);

  function usable() {
    if (qr.expires <= Date.now()) { onExpired(); return false; }
    return ready;
  }

  async function copyLink() {
    if (!usable()) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(qr.url);
      if (mounted.current) { setMessage("Attendance link copied."); setError(""); }
    } catch {
      if (mounted.current) { setManualCopy(true); setError("Select and copy the attendance link below."); input.current?.focus(); input.current?.select(); }
    }
  }

  async function share() {
    if (!usable()) return;
    setBusy("share"); setMessage(""); setError("");
    try {
      if (!navigator.share) { await copyLink(); return; }
      const file = attendanceQrFile(qr, classLabel);
      const details = { title: `${classLabel} — Attendance`, text: `Scan to mark attendance. Available until ${attendanceQrExpiry(qr.expires)}. Attendance may close earlier.` };
      // File creation is synchronous so native sharing retains the click gesture.
      await navigator.share(navigator.canShare?.({ files: [file] })
        ? { ...details, files: [file] }
        : { ...details, url: qr.url });
      if (mounted.current) setMessage("Attendance QR shared.");
    } catch (cause) {
      const cancelled = typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError";
      if (mounted.current && !cancelled) {
        setError("Sharing couldn’t open. Copy the attendance link instead."); setManualCopy(true);
      }
    } finally { if (mounted.current) setBusy(null); }
  }

  async function print() {
    if (!usable()) return;
    setBusy("print"); setMessage(""); setError("");
    printController.current?.abort();
    const controller = new AbortController();
    printController.current = controller;
    try {
      await printAttendanceQr(qr, classLabel, controller.signal);
      if (mounted.current) setMessage("Print dialog requested. Choose a printer or Save as PDF.");
    } catch {
      if (mounted.current && !controller.signal.aborted) setError("We couldn’t prepare the print sheet. Try again.");
    } finally { if (mounted.current) setBusy(null); }
  }

  return <>
    <div className={styles.qrArea}>
      <div className={styles.qrFrame}><Image unoptimized loading="eager" src={qr.image} width={1024} height={1024} alt="QR code for this class attendance form" onLoad={() => setReady(true)} onError={onImageError} /><span><ScanLine size={16} aria-hidden="true" /> Scan here</span></div>
      <div className={styles.instructions}><h3>Three quick steps</h3><ol><li><b>1</b>Open the camera</li><li><b>2</b>Scan this code</li><li><b>3</b>Enter name and matric number</li></ol><p><Clock3 size={15} aria-hidden="true" />Available until {attendanceQrExpiry(qr.expires)}</p><p><ShieldCheck size={15} aria-hidden="true" />No TuRnMaRk account is required.</p></div>
    </div>
    <div className={styles.tools}>
      <div className={styles.actions} aria-label="Attendance QR actions">
        {ready && !busy ? <a className={styles.primaryAction} href={qr.image} download={attendanceQrFilename(classLabel)} onClick={event => {
          if (!usable()) { event.preventDefault(); return; }
          setError(""); setMessage("PNG download requested.");
        }}><Download size={18} aria-hidden="true" />Download PNG</a> : <button className={styles.primaryAction} type="button" disabled><Download size={18} aria-hidden="true" />Download PNG</button>}
        <button className={styles.action} type="button" disabled={!ready || Boolean(busy)} onClick={() => void share()}><Share2 size={18} aria-hidden="true" />{busy === "share" ? "Sharing…" : "Share QR"}</button>
        <button className={styles.action} type="button" disabled={!ready || Boolean(busy)} onClick={() => void print()}><Printer size={18} aria-hidden="true" />{busy === "print" ? "Preparing print…" : "Print QR"}</button>
      </div>
      {manualCopy && <div className={styles.copyFallback}><label htmlFor={inputId}>Attendance link</label><div><input ref={input} id={inputId} readOnly value={qr.url} onFocus={event => event.currentTarget.select()} /><button className={styles.action} type="button" onClick={() => void copyLink()}><Copy size={17} aria-hidden="true" />Copy link</button></div></div>}
      <p className={styles.message} role="status" aria-live="polite">{!ready ? "Preparing QR actions…" : message}</p>
      {error && <p className={styles.actionError} role="alert">{error}</p>}
    </div>
    <footer>Downloaded, shared and printed codes stop working when attendance closes, expires or is revoked.</footer>
  </>;
}
