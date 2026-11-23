"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import Link from "next/link";
import { ArrowRight, AlertCircle, RefreshCw, MapPin } from "lucide-react";
import { FeedbackNotice } from "./feedback-notice";
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
  return <form action={run} className="school-form">
    {title && <h2>{title}</h2>}
    <input type="hidden" name="action" value={action} />
    {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    {children}
    <button disabled={pending} className="button-primary" type="submit">{pending ? "Saving…" : submit}</button>
    {state.message && (
      <FeedbackNotice ok={state.ok} message={state.message}>
        {state.ok && state.id && action === "class" && (
          <Link href={`/dashboard/attendance/${state.id}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "inherit", fontWeight: 700, textDecoration: "underline" }}>
            Open class attendance <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </FeedbackNotice>
    )}
  </form>;
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
        const denied = err.code === 1;
        alert(denied
          ? "Location permission was denied. Allow location for this site, then try again."
          : `Could not get the current GPS reading: ${err.message}`);
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
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
        <FeedbackNotice ok={false} message={errorMessage} style={{ margin: "16px 22px 0" }} />
      )}

      {isSuccess && (
        <FeedbackNotice ok={true} message="Session created. Opening attendance…" style={{ margin: "16px 22px 0" }} />
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
  const input = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [state, run, pending] = useActionState(importRoster, { ok: false, message: "" });

  return (
    <form action={run} className="school-form" style={{ display: "grid", gap: "20px" }}>
      <div style={{ borderBottom: "1px solid #f3ece8", paddingBottom: "14px" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 850, color: "#111318" }}>Import Course Roster</h2>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#73788a" }}>
          Batch enroll students from a spreadsheet or comma-separated list.
        </p>
      </div>

      {courseId ? (
        <input type="hidden" name="course_id" value={courseId} />
      ) : (
        <SelectField
          name="course_id"
          label="Select Target Course"
          options={snapshot.courses.map((course) => ({
            id: course.id,
            name: `${course.code} · ${course.title}`,
          }))}
        />
      )}

      {/* CSV upload card */}
      <div
        style={{
          border: "2px dashed #e5ddd7",
          borderRadius: "16px",
          padding: "20px",
          background: "#fcfaf8",
          textAlign: "center",
          display: "grid",
          gap: "10px",
          justifyItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d94b14" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <strong style={{ fontSize: "14px", color: "#111318" }}>Upload CSV Document</strong>
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#73788a", maxWidth: "420px" }}>
          Upload a <code style={{ background: "#eee4df", padding: "2px 6px", borderRadius: "4px" }}>.csv</code> file with headers: <code style={{ color: "#d94b14" }}>matric_number, student_name, programme, level</code>
        </p>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#ffffff",
              border: "1.5px solid #dcd5d0",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#111318",
              cursor: "pointer",
            }}
          >
            <span>{fileName ? `File: ${fileName}` : "Choose CSV file"}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={async (event) => {
                setError("");
                const file = event.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                if (file.size > 100000) {
                  setError("Import a CSV smaller than 100 KB.");
                  return;
                }
                try {
                  if (input.current) input.current.value = await file.text();
                } catch {
                  setError("We couldn’t read the file. Paste the CSV manually below.");
                }
              }}
            />
          </label>
          <a
            href="/api/school/roster-template"
            download="attendance-roster-template.csv"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ff6b2b",
              textDecoration: "underline",
            }}
          >
            Download CSV template
          </a>
        </div>
      </div>

      {/* Manual CSV editor box */}
      <div style={{ display: "grid", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>
            Student CSV Data
          </label>
          <span style={{ fontSize: "11px", color: "#8a8d9b" }}>
            One row per student
          </span>
        </div>
        <textarea
          ref={input}
          name="csv"
          required
          rows={6}
          maxLength={100000}
          placeholder={"matric_number,student_name,programme,level\nCSC/2022/001,Dominion Akinyele,Computer Science,400L\nCSC/2022/002,Sarah Adebayo,Computer Science,400L"}
          style={{
            width: "100%",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "12.5px",
            lineHeight: "1.5",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1.5px solid #e2dad5",
            background: "#fffefd",
          }}
        />
      </div>

      {error && <FeedbackNotice ok={false} message={error} />}

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <button className="button-secondary" disabled={pending} type="submit" style={{ minHeight: "44px", borderRadius: "12px", fontWeight: 800 }}>
          {pending ? "Analyzing CSV…" : "Preview import"}
        </button>
      </div>

      {state.preview && (
        <div
          style={{
            background: "#f7faf8",
            border: "1px solid #c9e4d5",
            borderRadius: "14px",
            padding: "16px 18px",
            display: "grid",
            gap: "8px",
          }}
          role="status"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "grid", width: "24px", height: "24px", placeItems: "center", borderRadius: "6px", background: "#dcfce7", color: "#166534" }}>
              ✓
            </span>
            <strong style={{ fontSize: "14px", color: "#14532d" }}>
              {state.preview.valid} students ready to import
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#4b5563" }}>
            {state.preview.duplicates} duplicate rows · {state.preview.invalid} invalid rows · {state.preview.existing} already enrolled
          </p>
        </div>
      )}

      {state.message && <FeedbackNotice ok={state.ok} message={state.message} />}

      {state.preview && !state.imported && state.preview.duplicates === 0 && state.preview.invalid === 0 && (
        <button
          className="button-primary"
          name="confirm"
          value="yes"
          disabled={pending}
          type="submit"
          style={{ minHeight: "46px", borderRadius: "12px", fontWeight: 800 }}
        >
          Confirm & Save {state.preview.valid} Students to Course
        </button>
      )}
    </form>
  );
}
export function ClassControls({ session }: { session: SchoolSnapshot["classes"][number] }) {
  const [confirm, setConfirm] = useState(false);
  if (session.status === "COMPLETED") return <p role="status">This class has ended. The register is available to export.</p>;
  return <div className="school-grid">{session.status === "DRAFT" && <SchoolForm action="open" title="Ready to begin?" submit="Open attendance" fields={{ class_id: session.id }} />}{session.status === "OPEN" && <>{session.arrival_open && <SchoolForm action="close_arrival" submit="Stop new check-ins" fields={{ class_id: session.id }}><p>This keeps the class open. Students can no longer check in, and the register is not finalized.</p></SchoolForm>}{session.arrival_open && <SchoolForm action="revoke_qr" submit="Revoke class QR" fields={{ class_id: session.id }}><p>Students can no longer use the displayed QR after revocation.</p></SchoolForm>}{confirm ? <SchoolForm action="finish" title="Close this class?" submit="Close class" fields={{ class_id: session.id }}><p>This ends the class, records students who did not check in as absent, and keeps every existing attendance record.</p><button type="button" onClick={() => setConfirm(false)} className="button-secondary">Keep class open</button></SchoolForm> : <button type="button" className="button-primary" onClick={() => setConfirm(true)}>Close class</button>}</>}</div>;
}
