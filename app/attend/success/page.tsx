"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Brand } from "@/components/ui/brand";
import styles from "@/components/school/attendance-scan.module.css";

type SuccessData = {
  course_code?: string;
  course_title?: string;
  organization_name?: string;
  full_name?: string;
  matric_number?: string;
  status?: string;
  recorded_at?: string;
  photo_url?: string | null;
  verification_mode?: string;
  identity_status?: string;
};

function safeFormatDateTime(val?: string | null): string {
  if (!val) return "Just now";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "Recorded";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "Recorded";
  }
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const [data] = useState<SuccessData>(() => {
    const base: SuccessData = {
      course_code: searchParams.get("course") || "CLASS",
      course_title: searchParams.get("title") || "Class Attendance",
      organization_name: searchParams.get("org") || "TuRnMaRk Attendance",
      full_name: searchParams.get("name") || "Student",
      matric_number: searchParams.get("matric") || "",
      status: searchParams.get("status") || "PRESENT",
      recorded_at: searchParams.get("time") || new Date().toISOString(),
      verification_mode: searchParams.get("mode") || "STANDARD",
    };
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("turnmark_attendance_success");
        if (stored) {
          const parsed = JSON.parse(stored) as SuccessData;
          return {
            ...base,
            ...parsed,
            course_code: parsed.course_code || base.course_code,
            course_title: parsed.course_title || base.course_title,
            organization_name: parsed.organization_name || base.organization_name,
            full_name: parsed.full_name || base.full_name,
            matric_number: parsed.matric_number || base.matric_number,
            status: parsed.status || base.status,
            recorded_at: parsed.recorded_at || base.recorded_at,
            photo_url: parsed.photo_url ?? base.photo_url,
          };
        }
      } catch {
        // Storage access unavailable
      }
    }
    return base;
  });

  const formattedTime = safeFormatDateTime(data.recorded_at);

  return (
    <article className={styles.card}>
      <section className={styles.successCard} aria-live="polite">
        <div className={styles.successBadge}>
          <Check size={32} aria-hidden="true" />
        </div>
        <p className={styles.successEyebrow}>ATTENDANCE RECORDED</p>
        <h1 className={styles.successHeading}>Attendance Confirmed!</h1>
        <span className={styles.successSub}>
          Your presence has been successfully registered for <strong>{data.course_code}</strong>.
        </span>

        {data.photo_url && (
          <div className={styles.selfieResultPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.photo_url}
              alt="Verified attendance selfie"
              width={120}
              height={120}
              className={styles.selfieImage}
            />
            <span className={styles.photoVerifiedBadge}>
              <CheckCircle2 size={13} aria-hidden="true" /> Verified Photo
            </span>
          </div>
        )}

        <dl className={styles.summaryList}>
          <div>
            <dt style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <UserCheck size={14} aria-hidden="true" /> Full Name
            </dt>
            <dd style={{ fontWeight: 700 }}>{data.full_name}</dd>
          </div>
          <div>
            <dt>Matric Number</dt>
            <dd style={{ fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.05em" }}>
              {data.matric_number || "Recorded"}
            </dd>
          </div>
          <div>
            <dt style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <GraduationCap size={14} aria-hidden="true" /> Course
            </dt>
            <dd>
              <strong>{data.course_code}</strong>
              {data.course_title && data.course_title !== data.course_code ? (
                <span style={{ display: "block", fontSize: 11, color: "#73788a" }}>
                  {data.course_title}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock3 size={14} aria-hidden="true" /> Time Recorded
            </dt>
            <dd>{formattedTime}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd data-status={data.status}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: data.status === "LATE" ? "#fef3c7" : "#e8f8f0",
                  color: data.status === "LATE" ? "#92400e" : "#0d7a46",
                  fontWeight: 750,
                  fontSize: 11,
                }}
              >
                <CheckCircle2 size={12} />
                {data.status === "LATE" ? "Late" : "Present & On Time"}
              </span>
              {data.verification_mode === "VERIFIED" ? " · Roster Matched" : " · Instant Check-In"}
            </dd>
          </div>
        </dl>

        <p className={styles.accountNotice}>
          <ShieldCheck size={16} aria-hidden="true" />
          No account required. Your check-in is saved directly to your lecturer’s session records.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
          <Link className={styles.optionalAccountLink} href="/sign-up">
            Create an optional student account <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </article>
  );
}

export default function AttendanceSuccessPage() {
  return (
    <main className={styles.page} id="main">
      <div className={styles.shell}>
        <header className={styles.siteHeader}>
          <Brand priority />
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            Verified Attendance
          </span>
        </header>
        <Suspense
          fallback={
            <article className={styles.card} style={{ padding: "40px 20px", textAlign: "center" }}>
              <p>Loading attendance receipt…</p>
            </article>
          }
        >
          <SuccessContent />
        </Suspense>
        <footer>
          TuRnMaRk Smart Attendance · You may screenshot or save this page as proof of attendance.
        </footer>
      </div>
    </main>
  );
}
