"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { z } from "zod";
import {
  Clock3,
  Maximize2,
  Minimize2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import styles from "./attendance-qr.module.css";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

const qrResponse = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime({ offset: true }),
});
const qrErrorResponse = z.object({
  error: z.string().min(1).max(160),
  code: z.string().max(60).optional(),
});
const unavailableMessage = "We couldn’t create this attendance QR. Try again.";

export function AttendanceQr({
  classId,
  courseCode,
  sessionTitle,
}: {
  classId: string;
  courseCode?: string;
  sessionTitle?: string;
}) {
  const [qr, setQr] = useState<{ image: string; expires: number; url: string } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [projectorMode, setProjectorMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const displayed = useRef(false);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    const controller = new AbortController();

    function fail(message: string) {
      if (!stopped && !controller.signal.aborted) {
        setError(message);
        setQr(null);
      }
    }

    async function load() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/school/classes/${classId}/qr`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (!response.ok) {
          const failure = qrErrorResponse.safeParse(body);
          fail(failure.success ? failure.data.error : unavailableMessage);
          return;
        }
        const parsed = qrResponse.safeParse(body);
        if (!parsed.success) {
          fail(unavailableMessage);
          return;
        }
        const expires = Date.parse(parsed.data.expiresAt);
        if (!Number.isFinite(expires)) {
          fail(unavailableMessage);
          return;
        }
        if (expires <= Date.now()) {
          fail("This attendance QR expired before it could be displayed. Try again.");
          return;
        }
        const image = await QRCode.toDataURL(parsed.data.url, {
          width: 600,
          margin: 3,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!stopped) {
          setQr({ image, expires, url: parsed.data.url });
          setError("");
          if (!displayed.current) {
            displayed.current = true;
            captureAnalytics(ANALYTICS_EVENTS.attendanceQrDisplayed);
          }
        }
      } catch {
        fail(unavailableMessage);
      } finally {
        busy = false;
      }
    }

    void load();
    const recover = () => {
      void load();
    };
    window.addEventListener("online", recover);
    return () => {
      stopped = true;
      controller.abort();
      window.removeEventListener("online", recover);
    };
  }, [classId, retry]);

  // Expiry countdown timer
  useEffect(() => {
    if (!qr) return;
    const updateCountdown = () => {
      const diff = qr.expires - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs < 10 ? "0" : ""}${secs}s`);
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [qr]);

  return (
    <>
      <section className={styles.card} aria-label="Class attendance QR">
        <header className={styles.cardHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.icon}>
              <ScanLine size={24} aria-hidden="true" />
            </span>
            <div>
              <p className={styles.eyebrow}>LIVE ATTENDANCE</p>
              <h2 className={styles.cardTitle}>Scan to mark attendance</h2>
              <span className={styles.cardSubtitle}>
                Students use their phone camera. No mobile app required.
              </span>
            </div>
          </div>
          {qr && (
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.projectorButton}
                onClick={() => setProjectorMode(true)}
                title="Open Classroom Projector View"
              >
                <Maximize2 size={16} /> Projector View
              </button>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => setRetry((v) => v + 1)}
                title="Refresh QR Code"
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          )}
        </header>

        {qr ? (
          <div className={styles.qrArea}>
            <div className={styles.qrFrame}>
              <Image
                unoptimized
                src={qr.image}
                width={512}
                height={512}
                alt="QR code for this class attendance form"
                className={styles.qrImage}
              />
              <span className={styles.scanBadge}>
                <ScanLine size={15} aria-hidden="true" /> Ready to scan
              </span>
            </div>
            <div className={styles.instructions}>
              <h3>Quick classroom check-in</h3>
              <ol>
                <li>
                  <b>1</b> Open phone camera or browser
                </li>
                <li>
                  <b>2</b> Scan this projected QR code
                </li>
                <li>
                  <b>3</b> Enter matric number & snap quick selfie
                </li>
              </ol>
              <div className={styles.metaRow}>
                <p className={styles.expiryBadge}>
                  <Clock3 size={15} aria-hidden="true" />
                  Closes in: <strong>{timeLeft || "Active"}</strong>
                </p>
                <p className={styles.privacyBadge}>
                  <ShieldCheck size={15} aria-hidden="true" />
                  Accountless & secure
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.state} role="status">
            <span className={error ? styles.errorIcon : styles.loader} aria-hidden="true" />
            <strong>{error ? "QR unavailable" : "Preparing attendance QR…"}</strong>
            <p>{error || "Creating a secure link for this open class."}</p>
          </div>
        )}

        {(!qr || error) && (
          <button className={styles.retry} onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={17} aria-hidden="true" /> Retry QR
          </button>
        )}

        {qr && (
          <footer className={styles.footerNote}>
            This code remains stable while attendance is open. Revoke it from class controls whenever access should stop.
          </footer>
        )}
      </section>

      {/* Classroom Projector / Presentation Modal */}
      {projectorMode && qr && (
        <div className={styles.projectorOverlay} role="dialog" aria-modal="true">
          <div className={styles.projectorContainer}>
            <header className={styles.projectorHeader}>
              <div className={styles.projectorTitle}>
                <div className={styles.projectorIcon}>
                  <ScanLine size={28} />
                </div>
                <div>
                  <span className={styles.projectorEyebrow}>CLASS ATTENDANCE</span>
                  <h1>{courseCode ? `${courseCode} · ` : ""}Mark Attendance</h1>
                  {sessionTitle && <p>{sessionTitle}</p>}
                </div>
              </div>
              <div className={styles.projectorControls}>
                <button
                  type="button"
                  className={styles.projectorActionBtn}
                  onClick={() => setRetry((v) => v + 1)}
                >
                  <RefreshCw size={16} /> Refresh
                </button>
                <button
                  type="button"
                  className={styles.projectorCloseBtn}
                  onClick={() => setProjectorMode(false)}
                >
                  <Minimize2 size={16} /> Exit Projector
                </button>
              </div>
            </header>

            <div className={styles.projectorBody}>
              <div className={styles.projectorQrCard}>
                <Image
                  unoptimized
                  src={qr.image}
                  width={560}
                  height={560}
                  alt="Classroom projection attendance QR code"
                  className={styles.projectorQrImage}
                />
                <span className={styles.projectorScanTag}>
                  <ScanLine size={18} /> Point your phone camera here to check in
                </span>
              </div>

              <div className={styles.projectorInstructions}>
                <div className={styles.projectorSteps}>
                  <div className={styles.pStep}>
                    <span className={styles.pStepNum}>1</span>
                    <div>
                      <strong>Scan the Code</strong>
                      <p>Open your default camera app and tap the link.</p>
                    </div>
                  </div>
                  <div className={styles.pStep}>
                    <span className={styles.pStepNum}>2</span>
                    <div>
                      <strong>Enter Your Matric</strong>
                      <p>Provide your official matriculation number.</p>
                    </div>
                  </div>
                  <div className={styles.pStep}>
                    <span className={styles.pStepNum}>3</span>
                    <div>
                      <strong>Take a Quick Selfie</strong>
                      <p>Look at the camera to complete verification.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.projectorFooterCard}>
                  <div className={styles.projectorCountdown}>
                    <Clock3 size={20} />
                    <span>Time remaining: <strong>{timeLeft || "Active"}</strong></span>
                  </div>
                  <p className={styles.projectorSecText}>
                    <ShieldCheck size={16} /> Verified instantly. No app installation required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
