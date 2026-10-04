"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { recordAttendance, type ScanResult } from "@/lib/school-student/actions";

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
      setResult(await recordAttendance({ token, requestId: requestId.current, fullName: form.get("fullName"), matricNumber: form.get("matricNumber") }));
    } catch { setResult({ ok: false, status: "UNAVAILABLE", message: "Connection interrupted. Retry this same submission safely." }); }
    finally { busy.current = false; setPending(false); }
  }
  if (result?.ok) return <section className="space-y-5" aria-live="polite"><div className="rounded-2xl border border-line bg-canvas p-5"><strong className="text-xl text-primary">Attendance marked ✓</strong><dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Name</dt><dd>{result.full_name}</dd><dt>Matric</dt><dd>{result.matric_number}</dd><dt>Course</dt><dd>{result.course_code}</dd><dt>Time</dt><dd>{result.recorded_at ? new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date(result.recorded_at)) : "Recorded"}</dd><dt>Status</dt><dd>{result.status === "LATE" ? "Late" : "Present"}{result.needs_review ? " · Needs review" : ""}</dd></dl></div><p className="text-sm text-muted">You can close this page. No account was created.</p><Link className="button-secondary w-full" href="/sign-up">Optional: create an account for future campus services</Link></section>;
  return <section className="space-y-5">
    <div><p className="eyebrow">{classInfo.organization_name}</p><h2 className="text-xl font-semibold">{classInfo.course_code}</h2><p>{classInfo.course_title}</p></div>
    <form action={scan} className="school-form !p-0 !border-0 !shadow-none">
      <label>Full name<input name="fullName" autoComplete="name" maxLength={160} required /></label>
      <label>Matric number<input name="matricNumber" autoCapitalize="characters" autoComplete="off" maxLength={80} required /></label>
      <button className="button-primary w-full" disabled={pending || !classInfo.open} type="submit">{pending ? "Marking attendance…" : "Mark Attendance"}</button>
    </form>
    {result && <div role="alert" className="rounded-2xl border border-line bg-canvas p-4"><strong>{result.message}</strong></div>}
    {!classInfo.open && <p role="alert">Attendance for this class is closed.</p>}
    <p className="text-sm text-muted">Your details are checked against the official class roster. A privacy-conscious browser signal may be used for lecturer review; it does not prove identity or location.</p>
  </section>;
}
