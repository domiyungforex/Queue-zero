"use client";

/* Reference photographs use short-lived signed storage URLs. */
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { identifyStudent, recordIdentifiedAttendance } from "@/lib/school-student/registration";
import { assessAttendanceLocation, geolocationFailureMessage } from "@/lib/school/location";
import { FaceCapture } from "./face-capture";

type Session = {
  id: string;
  code: string;
  title: string;
  sessionTitle: string | null;
  startsAt: string | null;
  locationRequired: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
};
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
type GpsFix = { latitude: number; longitude: number; accuracy: number; capturedAt: string };

function deviceId() {
  const key = "turnmark-attendance-device";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function readGps() {
  return new Promise<GpsFix>((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("Location can only be read on a secure connection. Open this page over HTTPS and try again."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support GPS location. Try Chrome or Safari."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
      }),
      (error) => reject(new Error(geolocationFailureMessage(error.code))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export function StudentCheckIn({ organizationId, institution }: { organizationId: string; institution: string }) {
  const [matric, setMatric] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classId, setClassId] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [locating, setLocating] = useState(false);

  const selected = useMemo(() => {
    if (!profile) return null;
    const id = profile.sessions.length === 1 ? profile.sessions[0].id : classId;
    return profile.sessions.find((session) => session.id === id) ?? null;
  }, [profile, classId]);

  const assessment = selected?.locationRequired && gps
    ? assessAttendanceLocation({
      sessionLatitude: selected.latitude,
      sessionLongitude: selected.longitude,
      radiusMeters: selected.radiusMeters,
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracyMeters: gps.accuracy,
    })
    : null;

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setProfile(null);
    setGps(null);
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
    } else if (result.sessions.some((session) => session.locationRequired)) {
      setMessage("This attendance check uses your location once to compare it with the class zone. It is not tracked in the background.");
    }
  }

  async function captureLocation() {
    setLocating(true);
    setOk(false);
    try {
      const fix = await readGps();
      setGps(fix);
      setMessage("GPS reading received. Review it before you submit attendance.");
    } catch (error) {
      setGps(null);
      setMessage(error instanceof Error ? error.message : "Location could not be read.");
    } finally {
      setLocating(false);
    }
  }

  async function finish(method: "LIVE_PHOTO" | "MANUAL_DECLARED", photo?: string) {
    if (!profile || !selected) {
      setOk(false);
      setMessage(profile && profile.sessions.length > 1 ? "More than one class is open. Choose the session that matches where you are." : "There is no eligible session to confirm.");
      return;
    }
    if (selected.locationRequired && (!gps || !assessment?.verified)) {
      setOk(false);
      setMessage(assessment?.message ?? "Allow location access so this session can record where you checked in.");
      return;
    }
    setPending(true);
    const result = await recordIdentifiedAttendance({
      ticket: profile.ticket,
      classId: selected.id,
      deviceId: deviceId(),
      photo,
      method,
      latitude: selected.locationRequired ? gps?.latitude ?? null : null,
      longitude: selected.locationRequired ? gps?.longitude ?? null : null,
      accuracy: selected.locationRequired ? gps?.accuracy ?? null : null,
      capturedAt: selected.locationRequired ? gps?.capturedAt ?? null : null,
    });
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
                  {session.locationRequired ? " · location required" : ""}
                </label>
              ))}
            </fieldset>
          ) : null}
          {profile.sessions.length === 1 ? <p>Session selected automatically: {profile.sessions[0].code} · {profile.sessions[0].sessionTitle || profile.sessions[0].title}.</p> : null}
          {selected?.locationRequired ? (
            <div>
              <p>The lecturer set an attendance zone of {selected.radiusMeters ?? 100} metres. Your coordinates are saved with this check-in only.</p>
              <button type="button" className="button-secondary" disabled={locating || pending} onClick={captureLocation}>{locating ? "Reading GPS…" : gps ? "Read location again" : "Use my location"}</button>
              {assessment ? <p role="status">{assessment.message}</p> : null}
            </div>
          ) : selected ? <p>Location is not required for this session. The record will say location was not requested.</p> : null}
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
