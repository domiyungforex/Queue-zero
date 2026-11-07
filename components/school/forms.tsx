"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { importRoster, manageSchool } from "@/lib/school/actions";
import type { SchoolSnapshot } from "@/lib/school/contracts";

export function SchoolForm({ action, title, children, submit = "Save", fields = {} }: { action: string; title?: string; children?: React.ReactNode; submit?: string; fields?: Record<string, string> }) {
  const [state, run, pending] = useActionState(manageSchool, { ok: false, message: "" });
  const trackedResult = useRef<string | null>(null);
  useEffect(() => {
    if (!state.ok) return;
    const key = `${action}:${state.id ?? state.message}`;
    if (trackedResult.current === key) return;
    trackedResult.current = key;
    if (action === "course") captureAnalytics(ANALYTICS_EVENTS.courseCreated);
    if (action === "open") captureAnalytics(ANALYTICS_EVENTS.classSessionStarted);
    if (action === "finish") captureAnalytics(ANALYTICS_EVENTS.attendanceSessionClosed);
  }, [action, state]);
  return <form action={run} className="school-form">{title && <h2>{title}</h2>}<input type="hidden" name="action" value={action} />{Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}{children}<button disabled={pending} className="button-primary" type="submit">{pending ? "Saving…" : submit}</button>{state.message && <p role={state.ok ? "status" : "alert"}>{state.message}{state.ok && state.id && action === "class" && <> <Link href={`/dashboard/attendance/${state.id}`}>Open class attendance <ArrowRight size={16} aria-hidden="true" /></Link></>}</p>}</form>;
}
export function TextField({ name, label, type = "text", maxLength = 160, required = true }: { name: string; label: string; type?: string; maxLength?: number; required?: boolean }) { return <label>{label}<input name={name} type={type} maxLength={maxLength} required={required} /></label>; }
export function SelectField({ name, label, options }: { name: string; label: string; options: { id: string; name: string }[] }) { return <label>{label}<select name={name} required defaultValue=""><option value="" disabled>Select {label.toLowerCase()}</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>; }
export function SetupForms({ snapshot, canManage = true }: { snapshot: SchoolSnapshot; canManage?: boolean }) { return <div className="school-grid">{canManage && <><SchoolForm action="faculty" title="Add faculty"><TextField name="name" label="Faculty name" /></SchoolForm><SchoolForm action="department" title="Add department"><SelectField name="faculty_id" label="Faculty" options={snapshot.faculties} /><TextField name="name" label="Department name" /></SchoolForm></>}<SchoolForm action="course" title="Create course"><SelectField name="department_id" label="Department" options={snapshot.departments} /><TextField name="code" label="Course code" maxLength={40} /><TextField name="title" label="Course title" /></SchoolForm></div>; }
export function CreateClassForm({ courseId }: { courseId: string }) { return <SchoolForm action="class" title="Create class" submit="Create class" fields={{ course_id: courseId }}><TextField name="starts_at" label="Class start (UTC)" type="datetime-local" /><TextField name="attendance_closes_at" label="Attendance closes (UTC)" type="datetime-local" /><TextField name="planned_ends_at" label="Class end (UTC, optional)" type="datetime-local" required={false} /><label>Late after (minutes)<input type="number" name="late_after_minutes" min="0" max="120" defaultValue="10" required /></label><p className="text-sm text-muted">Students scan the class QR and enter only their name and matric number. No account or checkout scan is required.</p></SchoolForm>; }
export function EnrollmentForm({ snapshot, courseId }: { snapshot: SchoolSnapshot; courseId?: string }) {
  const input = useRef<HTMLTextAreaElement>(null); const [error, setError] = useState("");
  const [state, run, pending] = useActionState(importRoster, { ok: false, message: "" });
  return <form action={run} className="school-form"><h2>Import course roster</h2>{courseId ? <input type="hidden" name="course_id" value={courseId} /> : <SelectField name="course_id" label="Course" options={snapshot.courses.map(course => ({ id: course.id, name: `${course.code} · ${course.title}` }))} />}<p className="text-sm text-muted">Required columns are name and matric number. Student email, account, department and level are not required for attendance.</p><label>CSV file (optional)<input type="file" accept=".csv,text/csv" onChange={async event => { setError(""); const file = event.target.files?.[0]; if (!file) return; if (file.size > 100000) { setError("Import a CSV smaller than 100 KB."); return; } try { if (input.current) input.current.value = await file.text(); } catch { setError("We couldn’t read the file. Paste the CSV below."); } }} /></label><label>Student CSV<textarea ref={input} name="csv" required rows={7} maxLength={100000} placeholder={"name,matric_number\nAkinyele Dominion,PHY/2026/0142"} /></label><p className="text-sm text-muted">Header: name,matric_number. Preview is required before import.</p>{error && <p role="alert">{error}</p>}<button className="button-secondary" disabled={pending} type="submit">{pending ? "Checking…" : "Preview import"}</button>{state.preview && <div className="notice" role="status"><strong>{state.preview.valid} valid</strong><p>{state.preview.duplicates} duplicate rows · {state.preview.invalid} invalid rows · {state.preview.existing} already enrolled</p></div>}{state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}{state.preview && !state.imported && state.preview.duplicates === 0 && state.preview.invalid === 0 && <button className="button-primary" name="confirm" value="yes" disabled={pending} type="submit">Confirm import</button>}</form>;
}
export function ClassControls({ session }: { session: SchoolSnapshot["classes"][number] }) {
  const [confirm, setConfirm] = useState(false);
  if (session.status === "COMPLETED") return <p role="status">This class has ended. The register is available to export.</p>;
  return <div className="school-grid">{session.status === "DRAFT" && <SchoolForm action="open" title="Ready to begin?" submit="Open attendance" fields={{ class_id: session.id }} />}{session.status === "OPEN" && <>{session.arrival_open && <SchoolForm action="close_arrival" submit="Close attendance" fields={{ class_id: session.id }} />}{session.arrival_open && <SchoolForm action="revoke_qr" submit="Revoke class QR" fields={{ class_id: session.id }}><p>Students can no longer use the displayed QR after revocation.</p></SchoolForm>}{confirm ? <SchoolForm action="finish" title="End this class?" submit="Confirm end session" fields={{ class_id: session.id }}><p>This closes attendance, records absent students and finalizes the register.</p><button type="button" onClick={() => setConfirm(false)} className="button-secondary">Keep class open</button></SchoolForm> : <button type="button" className="button-secondary" onClick={() => setConfirm(true)}>End session</button>}</>}</div>;
}
