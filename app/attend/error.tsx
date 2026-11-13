"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import styles from "@/components/school/attendance-scan.module.css";

export default function AttendanceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.siteHeader}>
          <Brand priority />
        </header>
        <article className={styles.card} style={{ padding: "36px 24px", textAlign: "center" }}>
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fff2eb",
              color: "#d94814",
              margin: "0 auto 16px",
              boxShadow: "0 4px 12px rgba(255, 107, 43, 0.2)",
            }}
          >
            <AlertCircle size={28} />
          </div>
          <p
            style={{
              color: "#e05318",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            ATTENDANCE CHECK-IN
          </p>
          <h1
            style={{
              fontSize: "clamp(22px, 5vw, 28px)",
              fontWeight: 800,
              margin: "8px 0 10px",
              color: "#111318",
              letterSpacing: "-0.02em",
            }}
          >
            A small interruption
          </h1>
          <p
            style={{
              color: "#73788a",
              fontSize: 13,
              maxWidth: 380,
              margin: "0 auto 24px",
              lineHeight: 1.5,
            }}
          >
            We couldn’t complete this check-in step. Please tap try again to retry your submission.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 320,
              margin: "0 auto",
              width: "100%",
            }}
          >
            <button type="button" onClick={() => reset()} className={styles.primaryButton}>
              <RefreshCw size={16} /> Try Again
            </button>
            <Link href="/" className={styles.secondaryButton}>
              <RotateCcw size={16} /> Return Home
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
