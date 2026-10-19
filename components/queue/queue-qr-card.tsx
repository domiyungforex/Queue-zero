"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, Printer, QrCode, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import type { QueueQrArtifact } from "@/lib/queue/qr";
import styles from "@/components/queue/queue-qr.module.css";

export function QueueQrCard({ artifact, queueId, businessName, queueName, sheet = false }: {
  artifact: QueueQrArtifact;
  queueId: string;
  businessName: string;
  queueName: string;
  sheet?: boolean;
}) {
  const [copying, setCopying] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  async function copyLink() {
    setCopying(true);
    setMessage("");
    setError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(artifact.publicUrl);
      setMessage("Queue link copied.");
    } catch {
      setError("Couldn’t copy automatically. Select and copy the public queue link below.");
      linkInput.current?.focus();
      linkInput.current?.select();
    } finally {
      setCopying(false);
    }
  }

  async function printSheet() {
    setPrinting(true);
    setError("");
    setMessage("");
    try {
      // Prevent a blank image in the print dialog, including cached-image loads.
      if (!imageRef.current) throw new Error("QR image unavailable");
      await imageRef.current.decode();
      window.print();
      setMessage("Print dialog requested. Choose your printer or Save as PDF.");
    } catch {
      setError("Couldn’t open the print sheet. Reload this page and try again.");
    } finally {
      setPrinting(false);
    }
  }

  const qrImage = <Image key={imageAttempt} ref={imageRef} unoptimized src={artifact.pngDataUrl} width={1024} height={1024}
    alt={`QR code for ${queueName}`} className={styles.qrImage} loading="eager"
    onLoad={() => { setReady(true); setImageFailed(false); }}
    onError={() => { setReady(false); setImageFailed(true); }} />;

  return <section aria-label={sheet ? "Queue print sheet" : "Share this queue"} data-queue-print-sheet={sheet ? "true" : undefined}
    className={sheet ? styles.sheetPage : styles.card}>
    {sheet ? <>
      <style media="print">{"@page { size: auto; margin: 12mm; }"}</style>
      <div className={styles.sheet}>
        <header className={styles.sheetBrand}><span className={styles.brandMark}><QrCode size={24} aria-hidden="true" /></span><p>TuRn<strong>MaRk</strong></p></header>
        <p className={styles.sheetEyebrow}>JOIN THIS QUEUE</p>
        <p className={styles.businessName}>{businessName}</p>
        <h1 className={styles.queueName}>{queueName}</h1>
        <div className={styles.qrFrame}>{qrImage}<span className={styles.scanBadge}><ScanLine size={17} aria-hidden="true" /> Point your camera here</span></div>
        <h2>Scan to join the queue</h2>
        <p className={styles.sheetLead}>No app. No account. Your private place in line opens in the browser.</p>
        <div className={styles.sheetSteps}><span><b>1</b>Scan</span><span><b>2</b>Join</span><span><b>3</b>Track your turn</span></div>
        <p className={styles.publicUrl}>{artifact.publicUrl}</p>
        <p className={styles.sheetPrivacy}><ShieldCheck size={15} aria-hidden="true" /> Powered securely by TuRnMaRk</p>
      </div>
    </> : <>
      <header className={styles.cardHeader}><span className={styles.cardIcon}><QrCode size={22} aria-hidden="true" /></span><div><p>QUEUE QR CODE</p><h2>Share this queue</h2><span>Customers scan once to join from their phone.</span></div></header>
      <div className={styles.previewGrid}><div className={styles.qrFrame}>{qrImage}<span className={styles.scanBadge}><ScanLine size={17} aria-hidden="true" /> Scan to join</span></div><div className={styles.previewCopy}><p className={styles.previewBusiness}>{businessName}</p><h3>{queueName}</h3><ol><li><span>1</span>Open the phone camera</li><li><span>2</span>Scan this code</li><li><span>3</span>Join and track the queue</li></ol><p><ShieldCheck size={15} aria-hidden="true" /> No app or customer account required</p></div></div>
    </>}
    <div className={`${styles.screenOnly} ${sheet ? styles.sheetControls : ""}`}>
      {!ready && !imageFailed && <p role="status" className={styles.preparing}>Preparing QR preview…</p>}
      {imageFailed && <div role="alert" className={styles.error}><p>We couldn’t display the QR code.</p><button type="button" disabled={retrying} onClick={() => { setImageFailed(false); setReady(false); setImageAttempt((attempt) => attempt + 1); startRetry(() => router.refresh()); }} className={styles.secondaryButton}><RefreshCw size={17} aria-hidden="true" />{retrying ? "Retrying…" : "Reload QR code"}</button></div>}
      <div className={styles.actions}>
        {ready && !imageFailed
          ? <a href={artifact.pngDataUrl} download={artifact.filename} className={styles.primaryButton}
              onClick={() => { setError(""); setMessage("PNG download requested."); }}><Download size={17} aria-hidden="true" />Download PNG</a>
          : <button disabled className={styles.primaryButton}><Download size={17} aria-hidden="true" />Download PNG</button>}
        {sheet
          ? <button type="button" disabled={!ready || imageFailed || printing} onClick={printSheet} className={styles.secondaryButton}><Printer size={17} aria-hidden="true" />{printing ? "Preparing print…" : "Print"}</button>
          : <Link href={`/dashboard/queues/${queueId}/qr`} className={styles.secondaryButton}><Printer size={17} aria-hidden="true" />Print sheet</Link>}
        <button type="button" disabled={copying} onClick={copyLink} className={styles.secondaryButton}><Copy size={17} aria-hidden="true" />{copying ? "Copying…" : "Copy link"}</button>
        <a href={artifact.publicUrl} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}><ExternalLink size={17} aria-hidden="true" />Preview customer experience<span className="sr-only"> (new tab)</span></a>
      </div>
      <label htmlFor="public-queue-link" className={styles.linkLabel}>Public queue link</label>
      <input ref={linkInput} id="public-queue-link" readOnly value={artifact.publicUrl}
        onFocus={(event) => event.currentTarget.select()} className={styles.linkInput} />
      <p role="status" aria-live="polite" className={styles.message}>{message}</p>
      {error && <p role="alert" className={styles.errorText}>{error}</p>}
    </div>
  </section>;
}

export function QueueQrUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div role="alert" className={styles.unavailable}>
    <span><QrCode size={24} aria-hidden="true" /></span><h2>QR code unavailable</h2>
    <p>We couldn’t prepare this queue’s QR code. Please try again in a moment.</p>
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={styles.secondaryButton}><RefreshCw size={17} aria-hidden="true" />{pending ? "Retrying…" : "Retry QR generation"}</button>
  </div>;
}
