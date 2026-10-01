"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QueueQrArtifact } from "@/lib/queue/qr";
import styles from "@/components/queue/queue-qr.module.css";

const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-xl border border-black/20 px-5 py-3 text-sm font-semibold disabled:opacity-50";

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
    className={sheet ? "" : "mt-8 rounded-2xl border border-black/10 bg-white p-6 sm:p-8"}>
    {sheet ? <>
      <style media="print">{"@page { size: auto; margin: 12mm; }"}</style>
      <div className={styles.sheet}>
        <p className="text-2xl font-bold tracking-tight">Queue<span className="text-primary">Zero</span></p>
        <p className={`mt-6 break-words text-xl font-medium ${styles.businessName}`}>{businessName}</p>
        <h1 className={`mt-3 break-words text-3xl font-semibold ${styles.queueName}`}>{queueName}</h1>
        <div className="my-5">{qrImage}</div>
        <h2 className="text-2xl font-semibold">Scan to join the queue</h2>
        <p className="mt-3 text-muted">No app. No account.</p>
        <p className="mt-1 text-muted">Scan. Join. Leave the line.</p>
        <p className={`mt-6 break-all text-sm text-muted ${styles.publicUrl}`}>{artifact.publicUrl}</p>
      </div>
    </> : <>
      <h2 className="text-xl font-semibold">Share this queue</h2>
      <p className="mt-2 text-sm text-muted">Download the QR or print a sheet for your counter.</p>
      <div className="my-5 max-w-64">{qrImage}</div>
    </>}
    <div className={`${styles.screenOnly} ${sheet ? "mx-auto mt-6 max-w-3xl" : ""}`}>
      {!ready && !imageFailed && <p role="status" className="mb-4 text-sm text-muted">Preparing QR preview…</p>}
      {imageFailed && <div role="alert" className="mb-4 text-red-800"><p>We couldn’t display the QR code.</p><button type="button" disabled={retrying} onClick={() => { setImageFailed(false); setReady(false); setImageAttempt((attempt) => attempt + 1); startRetry(() => router.refresh()); }} className={`${buttonClass} mt-2`}>{retrying ? "Retrying…" : "Reload QR code"}</button></div>}
      <div className="flex flex-wrap gap-3">
        {ready && !imageFailed
          ? <a href={artifact.pngDataUrl} download={artifact.filename} className={`${buttonClass} bg-primary text-white`}
              onClick={() => { setError(""); setMessage("PNG download requested."); }}>Download PNG</a>
          : <button disabled className={`${buttonClass} bg-primary text-white`}>Download PNG</button>}
        {sheet
          ? <button type="button" disabled={!ready || imageFailed || printing} onClick={printSheet} className={buttonClass}>{printing ? "Preparing print…" : "Print"}</button>
          : <Link href={`/dashboard/queues/${queueId}/qr`} className={buttonClass}>Print sheet</Link>}
        <button type="button" disabled={copying} onClick={copyLink} className={buttonClass}>{copying ? "Copying…" : "Copy link"}</button>
        <a href={artifact.publicUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>Open public queue<span className="sr-only"> (new tab)</span></a>
      </div>
      <label htmlFor="public-queue-link" className="mt-5 block text-sm font-medium">Public queue link</label>
      <input ref={linkInput} id="public-queue-link" readOnly value={artifact.publicUrl}
        onFocus={(event) => event.currentTarget.select()} className="mt-2 min-h-12 w-full min-w-0 rounded-lg border border-black/20 bg-white px-3 text-sm" />
      <p role="status" aria-live="polite" className="mt-3 text-sm text-primary">{message}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </div>
  </section>;
}

export function QueueQrUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div role="alert" className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
    <h2 className="text-xl font-semibold">QR code unavailable</h2>
    <p className="mt-3 text-muted">We couldn’t prepare this queue’s QR code. Please try again in a moment.</p>
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={`${buttonClass} mt-4`}>{pending ? "Retrying…" : "Retry QR generation"}</button>
  </div>;
}
