"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import Link from "next/link";
import { ArrowRight, AlertCircle, RefreshCw, MapPin } from "lucide-react";
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
export function CreateClassForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Form values state to guarantee preservation across failed attempts
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [attendanceClosesAt, setAttendanceClosesAt] = useState("");
  const [plannedEndsAt, setPlannedEndsAt] = useState("");
  const [lateAfterMinutes, setLateAfterMinutes] = useState("10");
  const [verificationMode, setVerificationMode] = useState<"STANDARD" | "VERIFIED">("STANDARD");

  // Geofence state
  const [useGeofence, setUseGeofence] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [geofenceRadius, setGeofenceRadius] = useState("100");

  const handleCaptureCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setDetectingLocation(false);
      },
      (err) => {
        alert(`Could not get current location: ${err.message}`);
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending || isSuccess) return;

    setErrorMessage("");

    const formData = new FormData();
    formData.set("action", "class");
    formData.set("course_id", courseId);
    if (title.trim()) formData.set("title", title.trim());
    formData.set("starts_at", startsAt);
    formData.set("attendance_closes_at", attendanceClosesAt);
    if (plannedEndsAt) formData.set("planned_ends_at", plannedEndsAt);
    formData.set("late_after_minutes", lateAfterMinutes);
    formData.set("verification_mode", verificationMode);

    if (useGeofence && lat && lng) {
      formData.set("location_lat", lat);
      formData.set("location_lng", lng);
      formData.set("geofence_radius_meters", geofenceRadius);
    }

    startTransition(async () => {
      try {
        const result = await manageSchool({ ok: false, message: "" }, formData);
        if (result.ok && result.id) {
          setIsSuccess(true);
          captureAnalytics(ANALYTICS_EVENTS.classSessionStarted);
          router.push(`/dashboard/attendance/${result.id}`);
        } else {
          setErrorMessage(result.message || "Failed to create class attendance session.");
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Connection failed. Please retry.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="school-form school-create-class-form">
      <header className="school-create-head">
        <p>ATTENDANCE</p>
        <h2>Create a class session</h2>
        <p>Choose when this class meets, how students are checked, and whether they must be at the location.</p>
      </header>

      {errorMessage && (
        <div className="school-form-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isSuccess && (
        <div className="school-form-success" role="status">
          <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
          <span>Session created. Opening attendance…</span>
        </div>
      )}

      <div className="school-create-layout">
        <div className="school-create-fields">
          <fieldset>
            <legend>Session</legend>
            <label>
              Session title (optional)
              <input
                name="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lecture 4: Database Indexing"
                maxLength={200}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Schedule</legend>
            <div className="school-form-row">
              <label>
                Class start (UTC)
                <input name="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
              </label>
              <label>
                Attendance closes (UTC)
                <input name="attendance_closes_at" type="datetime-local" value={attendanceClosesAt} onChange={(e) => setAttendanceClosesAt(e.target.value)} required />
              </label>
            </div>
            <div className="school-form-row">
              <label>
                Class end (UTC, optional)
                <input name="planned_ends_at" type="datetime-local" value={plannedEndsAt} onChange={(e) => setPlannedEndsAt(e.target.value)} />
              </label>
              <label>
                Late after (minutes)
                <input type="number" name="late_after_minutes" min="0" max="120" value={lateAfterMinutes} onChange={(e) => setLateAfterMinutes(e.target.value)} required />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Verification</legend>
            <label>
              Attendance verification mode
              <select name="verification_mode" value={verificationMode} onChange={(e) => setVerificationMode(e.target.value as "STANDARD" | "VERIFIED")}>
                <option value="STANDARD">Standard mode (Default) — instant scanning, no advance CSV needed</option>
                <option value="VERIFIED">Verified mode — validate against uploaded course roster</option>
              </select>
            </label>
            <p className="text-sm text-muted">Standard mode lets students sign in without a prior roster. Verified mode checks each student against the official roster.</p>
            <div className="school-geofence-card">
              <label className="school-geofence-toggle">
                <input type="checkbox" checked={useGeofence} onChange={(e) => setUseGeofence(e.target.checked)} />
                <span>Enable classroom location verification (Geofencing)</span>
              </label>
              {useGeofence && (
                <div className="school-geofence-fields">
                  <p className="text-sm text-muted">Students must be inside this radius to mark attendance.</p>
                  <div className="school-geofence-inputs">
                    <label>
                      Latitude
                      <input type="number" step="any" name="location_lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 6.524379" required={useGeofence} />
                    </label>
                    <label>
                      Longitude
                      <input type="number" step="any" name="location_lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 3.379206" required={useGeofence} />
                    </label>
                  </div>
                  <button type="button" className="button-secondary school-location-btn" onClick={handleCaptureCurrentLocation} disabled={detectingLocation}>
                    <MapPin size={16} aria-hidden="true" />
                    {detectingLocation ? "Detecting location…" : "Use current device location"}
                  </button>
                  <label>
                    Permitted radius (meters)
                    <input type="number" name="geofence_radius_meters" min="10" max="5000" value={geofenceRadius} onChange={(e) => setGeofenceRadius(e.target.value)} required={useGeofence} />
                  </label>
                </div>
              )}
            </div>
          </fieldset>

          <div className="school-create-actions">
            <button disabled={isPending || isSuccess} className="button-primary" type="submit">
              {isPending ? <><RefreshCw size={16} className="animate-spin" aria-hidden="true" /><span>Creating class session…</span></> : "Create class & open attendance"}
            </button>
          </div>
        </div>

        <aside className="school-create-summary" aria-label="Session summary">
          <h3>This session</h3>
          <dl>
            <div><dt>Title</dt><dd>{title.trim() || "Untitled session"}</dd></div>
            <div><dt>Starts</dt><dd>{startsAt || "Not set"}</dd></div>
            <div><dt>Closes</dt><dd>{attendanceClosesAt || "Not set"}</dd></div>
            <div><dt>Ends</dt><dd>{plannedEndsAt || "Not set"}</dd></div>
            <div><dt>Late after</dt><dd>{lateAfterMinutes || "0"} minutes</dd></div>
            <div><dt>Check</dt><dd>{verificationMode === "VERIFIED" ? "Roster required" : "Standard scan"}</dd></div>
            <div><dt>Location</dt><dd>{useGeofence ? (lat && lng ? `${geofenceRadius} m radius` : "Waiting for coordinates") : "Not required"}</dd></div>
          </dl>
        </aside>
      </div>
    </form>
  );
}
export function EnrollmentForm({ snapshot, courseId }: { snapshot: SchoolSnapshot; courseId?: string }) {
  const input = useRef<HTMLTextAreaElement>(null); const [error, setError] = useState("");
  const [state, run, pending] = useActionState(importRoster, { ok: false, message: "" });
  return <form action={run} className="school-form"><h2>Import course roster</h2>{courseId ? <input type="hidden" name="course_id" value={courseId} /> : <SelectField name="course_id" label="Course" options={snapshot.courses.map(course => ({ id: course.id, name: `${course.code} · ${course.title}` }))} />}<p className="text-sm text-muted">Required columns: matric_number, student_name. Optional: programme, level.</p><p className="text-sm"><a href="/api/school/roster-template" download="attendance-roster-template.csv" style={{ color: "#003d32", textDecoration: "underline", fontWeight: 600 }}>Download CSV roster template</a></p><label>CSV file (optional)<input type="file" accept=".csv,text/csv" onChange={async event => { setError(""); const file = event.target.files?.[0]; if (!file) return; if (file.size > 100000) { setError("Import a CSV smaller than 100 KB."); return; } try { if (input.current) input.current.value = await file.text(); } catch { setError("We couldn’t read the file. Paste the CSV below."); } }} /></label><label>Student CSV<textarea ref={input} name="csv" required rows={7} maxLength={100000} placeholder={"matric_number,student_name,programme,level\nCSC/2022/001,Dominion Akinyele,Computer Science,400L"} /></label><p className="text-sm text-muted">Columns: matric_number, student_name, programme, level. Preview is required before import.</p>{error && <p role="alert">{error}</p>}<button className="button-secondary" disabled={pending} type="submit">{pending ? "Checking…" : "Preview import"}</button>{state.preview && <div className="notice" role="status"><strong>{state.preview.valid} valid</strong><p>{state.preview.duplicates} duplicate rows · {state.preview.invalid} invalid rows · {state.preview.existing} already enrolled</p></div>}{state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}{state.preview && !state.imported && state.preview.duplicates === 0 && state.preview.invalid === 0 && <button className="button-primary" name="confirm" value="yes" disabled={pending} type="submit">Confirm import</button>}</form>;
}
export function ClassControls({ session }: { session: SchoolSnapshot["classes"][number] }) {
  const [confirm, setConfirm] = useState(false);
  if (session.status === "COMPLETED") return <p role="status">This class has ended. The register is available to export.</p>;
  return <div className="school-grid">{session.status === "DRAFT" && <SchoolForm action="open" title="Ready to begin?" submit="Open attendance" fields={{ class_id: session.id }} />}{session.status === "OPEN" && <>{session.arrival_open && <SchoolForm action="close_arrival" submit="Close attendance" fields={{ class_id: session.id }} />}{session.arrival_open && <SchoolForm action="revoke_qr" submit="Revoke class QR" fields={{ class_id: session.id }}><p>Students can no longer use the displayed QR after revocation.</p></SchoolForm>}{confirm ? <SchoolForm action="finish" title="End this class?" submit="Confirm end session" fields={{ class_id: session.id }}><p>This closes attendance, records absent students and finalizes the register.</p><button type="button" onClick={() => setConfirm(false)} className="button-secondary">Keep class open</button></SchoolForm> : <button type="button" className="button-secondary" onClick={() => setConfirm(true)}>End session</button>}</>}</div>;
}
