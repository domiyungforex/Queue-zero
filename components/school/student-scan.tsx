"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, GraduationCap, ShieldCheck } from "lucide-react";
import { recordAttendance, type ScanResult } from "@/lib/school-student/actions";
import styles from "./attendance-scan.module.css";

type PublicClass = { organization_name: string; course_code: string; course_title: string; starts_at: string | null; planned_ends_at: string | null; attendance_closes_at: string | null; open: boolean };
export function StudentScan({ token, classInfo }: { token: string; classInfo: PublicClass }) {
  const requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const busy = useRef(false);
  async function scan(form: FormData) {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const storageKey = `attendance-request:${token}`;
      // Keep one request across retries/reloads. Never generate a second mutation
      // merely because a response was lost on a slow network.
      try { requestId.current ??= sessionStorage.getItem(storageKey); } catch {}
      requestId.current ??= crypto.randomUUID();
      try { sessionStorage.setItem(storageKey, requestId.current); } catch {}
      const response = await recordAttendance({ token, requestId: requestId.current, fullName: form.get("fullName"), matricNumber: form.get("matricNumber") });
      setResult(response);
      // A confirmed rejection can be corrected; an uncertain network result must
      // keep its request ID so retrying cannot record attendance twice.
      if (!response.ok && response.status !== "UNAVAILABLE") {
        requestId.current = null;
        try { sessionStorage.removeItem(storageKey); } catch {}
      }
    } catch { setResult({ ok: false, status: "UNAVAILABLE", message: "Connection interrupted. Retry this same submission safely." }); }
    finally { busy.current = false; setPending(false); }
  }
  if (result?.ok) return <section className={styles.success} aria-live="polite"><span className={styles.successIcon}><Check size={30} aria-hidden="true" /></span><p>CHECK-IN COMPLETE</p><h2>Attendance marked ✓</h2><span>You’re recorded for {result.course_code}.</span><dl><div><dt>Name</dt><dd>{result.full_name}</dd></div><div><dt>Matric number</dt><dd>{result.matric_number}</dd></div><div><dt>Time</dt><dd>{result.recorded_at ? new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date(result.recorded_at)) : "Recorded"}</dd></div><div><dt>Status</dt><dd data-status={result.status}>{result.status === "LATE" ? "Late" : "Present"}{result.needs_review ? " · Needs review" : ""}</dd></div></dl><p className={styles.noAccount}><ShieldCheck size={15} aria-hidden="true" />You can close this page. No account was created.</p><Link className={styles.optionalAccount} href="/sign-up">Create an optional account <ArrowRight size={16} aria-hidden="true" /></Link></section>;
  return <section className={styles.scanForm}>
    <div className={styles.classCard}><span><GraduationCap size={20} aria-hidden="true" /></span><div><p>{classInfo.organization_name}</p><h2>{classInfo.course_code}</h2><small>{classInfo.course_title}</small></div></div>
    <form action={scan}>
      <label>Full name<input name="fullName" autoComplete="name" maxLength={160} placeholder="Enter your full name" required /></label>
      <label>Matric number<input name="matricNumber" autoCapitalize="characters" autoComplete="off" maxLength={80} placeholder="Enter your matric number" required /></label>
      <button disabled={pending || !classInfo.open} type="submit">{pending ? "Marking attendance…" : "Mark Attendance"}{!pending && <ArrowRight size={18} aria-hidden="true" />}</button>
    </form>
    {result && <div role="alert" className={styles.formError}><strong>{result.message}</strong></div>}
    {!classInfo.open && <p role="alert" className={styles.formError}>Attendance for this class is closed.</p>}
    <p className={styles.privacy}><ShieldCheck size={16} aria-hidden="true" />No account or advance registration needed. Enter your full name and matric number; an existing student record will be matched when available.</p>
  </section>;
}
