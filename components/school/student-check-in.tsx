"use client";

/* Reference photographs use short-lived signed storage URLs. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { identifyStudent, recordIdentifiedAttendance } from "@/lib/school-student/registration";
import { FaceCapture } from "./face-capture";

type Session = { id: string; code: string; title: string; sessionTitle: string | null; startsAt: string | null };
type Profile = {
  ticket: string;
  fullName: string;
  matricNumber: string;
  faculty: string;
  department: string;
  level: string;
  photoUrl: string | null;
  sessions: Session[];
};

function deviceId() {
  const key = "turnmark-attendance-device";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

export function StudentCheckIn({ organizationId, institution }: { organizationId: string; institution: string }) {
  const [matric, setMatric] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classId, setClassId] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setProfile(null);
    setMessage("");
    const result = await identifyStudent(organizationId, matric, deviceId());
    setPending(false);
    if (!result.ok) {
      setOk(false);
      setMessage(result.message);
      return;
    }
    setProfile(result);
    setClassId(result.sessions.length === 1 ? result.sessions[0].id : "");
    if (result.sessions.length === 0) {
      setOk(false);
      setMessage("There is no active attendance session for your enrollments. Ask your lecturer if the class is open and you were enrolled before it opened.");
    }
  }

  async function finish(method: "LIVE_PHOTO" | "MANUAL_DECLARED", photo?: string) {
    if (!profile) return;
    const selected = profile.sessions.length === 1 ? profile.sessions[0].id : classId;
    if (!selected) {
      setOk(false);
      setMessage("More than one class is open. Choose the session that matches where you are.");
      return;
    }
    setPending(true);
    const result = await recordIdentifiedAttendance({ ticket: profile.ticket, classId: selected, deviceId: deviceId(), photo, method });
    setPending(false);
    setOk(result.ok);
    setMessage(result.ok ? `${result.message} ${result.courseCode} · ${result.status}.` : result.message);
  }

  return (
    <div className="school-form">
      <form onSubmit={lookup}>
        <p>Check in at {institution}. Enter only your matriculation number. Faculty, department and level stay on your registration.</p>
        <label>Matriculation number<input value={matric} onChange={(event) => setMatric(event.target.value)} required maxLength={80} autoComplete="off" /></label>
        <button className="button-primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Find my session"}</button>
      </form>
      {profile ? (
        <section aria-label="Registered profile">
          <h2>{profile.fullName}</h2>
          <dl>
            <div><dt>Matric</dt><dd>{profile.matricNumber}</dd></div>
            <div><dt>Faculty</dt><dd>{profile.faculty}</dd></div>
            <div><dt>Department</dt><dd>{profile.department}</dd></div>
            <div><dt>Level</dt><dd>{profile.level}</dd></div>
          </dl>
          {profile.photoUrl ? <img src={profile.photoUrl} alt="" width={96} height={96} /> : <p>No reference photograph is stored yet. A lecturer can still see this live capture.</p>}
          {profile.sessions.length > 1 ? (
            <fieldset>
              <legend>More than one of your classes is open. Choose the correct session.</legend>
              {profile.sessions.map((session) => (
                <label key={session.id} className="school-check">
                  <input type="radio" name="session" checked={classId === session.id} onChange={() => setClassId(session.id)} />
                  {session.code} · {session.sessionTitle || session.title}
                </label>
              ))}
            </fieldset>
          ) : null}
          {profile.sessions.length === 1 ? <p>Session selected automatically: {profile.sessions[0].code} · {profile.sessions[0].sessionTitle || profile.sessions[0].title}.</p> : null}
          {profile.sessions.length > 0 ? <>
            <FaceCapture busy={pending} onAccept={(photo) => finish("LIVE_PHOTO", photo)} />
            <button type="button" className="button-secondary" disabled={pending} onClick={() => finish("MANUAL_DECLARED")}>Manual confirmation, not biometric</button>
          </> : null}
        </section>
      ) : null}
      {message ? <p role={ok ? "status" : "alert"}>{message}</p> : null}
    </div>
  );
}
