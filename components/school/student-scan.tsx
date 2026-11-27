"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  GraduationCap,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  loadAttendanceDirectory,
  lookupVerifiedStudent,
  recordAttendance,
  registerForAttendanceSession,
  type ScanResult,
} from "@/lib/school-student/actions";
import { FaceCapture } from "./face-capture";
import { DynamicCameraModal } from "./dynamic-camera-modal";
import { FeedbackNotice } from "./feedback-notice";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { assessAttendanceLocation, geolocationFailureMessage } from "@/lib/school/location";
import styles from "./attendance-scan.module.css";

export type PublicClass = {
  organization_name: string;
  course_code: string;
  course_title: string;
  session_title?: string | null;
  starts_at: string | null;
  planned_ends_at: string | null;
  attendance_closes_at: string | null;
  verification_mode: "STANDARD" | "VERIFIED";
  location_required?: boolean;
  location_lat?: number | null;
  location_lng?: number | null;
  geofence_radius_meters?: number | null;
  open: boolean;
};

type LocationState = {
  status: "idle" | "requesting" | "verified" | "error";
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  capturedAt?: string;
  distanceMeters?: number;
  message?: string;
};

function safeFormatTime(val?: string | null): string {
  if (!val) return "Just now";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "Recorded";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      dateStyle: "medium",
    }).format(d);
  } catch {
    return "Recorded";
  }
}

export function StudentScan({
  token,
  classInfo,
}: {
  token: string;
  classInfo: PublicClass;
}) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);

  // Stepper state: 1: Details, 2: Selfie, 3: Submit
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Details
  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [verifiedStudent, setVerifiedStudent] = useState<{
    full_name: string;
    matric_number: string;
    programme?: string;
    level?: string;
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [selfRegistration, setSelfRegistration] = useState(false);
  const [directory, setDirectory] = useState<{ faculties: { id: string; name: string }[]; departments: { id: string; faculty_id: string; name: string }[] } | null>(null);
  const [facultyId, setFacultyId] = useState("");
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [firstRegistration, setFirstRegistration] = useState(false);

  // Location
  const isLocationRequired = Boolean(
    classInfo.location_required &&
      classInfo.location_lat != null &&
      classInfo.location_lng != null
  );
  const [locationState, setLocationState] = useState<LocationState>({ status: "idle" });

  // Camera / Selfie
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [sessionRejected, setSessionRejected] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  // Request location when required (with automatic low-accuracy fallback indoors on timeout/unavailable)
  const requestLocation = useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationState({
        status: "error",
        message: "Location can only be read on a secure connection. Open the attendance page over HTTPS and try again.",
      });
      return;
    }
    if (!navigator.geolocation) {
      setLocationState({
        status: "error",
        message: "This browser does not support GPS location. Try Chrome or Safari on the phone you are attending with.",
      });
      return;
    }
    setLocationState({ status: "requesting" });

    const handleSuccess = (pos: GeolocationPosition) => {
      const assessment = assessAttendanceLocation({
        sessionLatitude: classInfo.location_lat,
        sessionLongitude: classInfo.location_lng,
        radiusMeters: classInfo.geofence_radius_meters,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
      });
      const capturedAt = new Date(pos.timestamp || Date.now()).toISOString();
      setLocationState({
        status: assessment.verified ? "verified" : "error",
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        capturedAt,
        distanceMeters: assessment.distanceMeters ?? undefined,
        message: assessment.message,
      });
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        // On iOS Safari / Android indoors, high-accuracy GPS can time out (3) or be unavailable (2).
        // Fall back once to network/Wi-Fi-assisted positioning before failing.
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (fallbackErr) => {
              setLocationState({ status: "error", message: geolocationFailureMessage(fallbackErr.code) });
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
          );
          return;
        }
        setLocationState({ status: "error", message: geolocationFailureMessage(err.code) });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [classInfo.location_lat, classInfo.location_lng, classInfo.geofence_radius_meters]);

  // Auto trigger location if required and idle — deferred to avoid setState-in-effect
  useEffect(() => {
    if (isLocationRequired && locationState.status === "idle") {
      const id = setTimeout(() => { requestLocation(); }, 0);
      return () => clearTimeout(id);
    }
  }, [isLocationRequired, locationState.status, requestLocation]);

  // Verified mode lookup handler
  const handleLookup = async (inputMatric?: string) => {
    const matric = (inputMatric ?? matricNumber).trim();
    if (!matric) {
      setLookupError("Enter your matriculation number.");
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    try {
      const res = await lookupVerifiedStudent(token, matric);
      if (res.ok && res.found) {
        setVerifiedStudent({
          full_name: res.full_name || "",
          matric_number: res.matric_number || matric,
          programme: res.department || res.programme,
          level: res.level,
        });
        setFullName(res.full_name || "");
        setSelfRegistration(false);
      } else if (res.selfRegistration) {
        setVerifiedStudent(null);
        setSelfRegistration(true);
        setLookupError(res.message || "Register once to continue. No account is required.");
        const directoryResult = await loadAttendanceDirectory(token);
        if (directoryResult.ok) {
          setDirectory({ faculties: directoryResult.faculties, departments: directoryResult.departments });
          setFacultyId(directoryResult.faculties[0]?.id ?? "");
        } else {
          setDirectory(null);
          setLookupError(directoryResult.message);
        }
      } else {
        setVerifiedStudent(null);
        setSelfRegistration(false);
        setDirectory(null);
        setLookupError(res.message || "Student not found. Ask your lecturer to add you.");
      }
    } catch {
      setLookupError("Unable to verify student roster at this moment.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Step 1 Validation & Proceed to Step 2
  const registerFirstTime = async (formData: FormData) => {
    if (!referencePhoto) {
      setLookupError("Capture and confirm a reference photograph before registering.");
      return;
    }
    setRegistering(true);
    setLookupError("");
    formData.set("photo", referencePhoto);
    formData.set("matricNumber", matricNumber.trim());
    try {
      const result = await registerForAttendanceSession(token, formData);
      if (!result.ok) {
        setLookupError(result.message);
        return;
      }
      const registeredName = String(formData.get("fullName") ?? "").trim();
      const registeredMatric = result.matricNumber || matricNumber.trim();
      setFullName(registeredName);
      setVerifiedStudent({ full_name: registeredName, matric_number: registeredMatric });
      setFirstRegistration(true);
      setSelfRegistration(false);
      setLookupError("");
    } catch {
      setLookupError("Registration could not be saved. Your details are still on this page — try again.");
    } finally {
      setRegistering(false);
    }
  };

  const handleProceedToSelfie = () => {
    if (!verifiedStudent) {
      setLookupError(selfRegistration ? "Finish registration before continuing." : "Find your matriculation number before continuing.");
      return;
    }

    if (isLocationRequired && locationState.status !== "verified") {
      setLookupError("Location verification is required to continue. Please verify location.");
      return;
    }

    setLookupError("");
    setStep(2);
    setCapturedPhoto(null);
    // Open the dynamic camera modal automatically
    setCameraModalOpen(true);
  };

  // Upload selfie to private storage. Never send the image bytes as the attendance record.
  const uploadPhoto = async (
    classId: string,
    nonce: string,
    photoDataUrl: string,
  ): Promise<{ ok: true; path: string } | { ok: false; error: string; terminal?: boolean }> => {
    try {
      const res = await fetch(`/api/school/classes/${classId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nonce, photo: photoDataUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as { path?: string; url?: string; error?: string };
      if (!res.ok) {
        const terminal = res.status === 410 || res.status === 401 || res.status === 403;
        return { ok: false, error: json.error || "Photograph upload failed. Please retry.", terminal };
      }
      if (json.path && !json.path.startsWith("data:") && !json.path.includes("..")) {
        return { ok: true, path: json.path };
      }
      if (json.url && !json.url.startsWith("data:")) {
        return { ok: true, path: json.url };
      }
      return { ok: false, error: "Photograph storage did not return a valid reference. Please retry." };
    } catch {
      return { ok: false, error: "Network error while uploading photograph. Check your connection and try again." };
    }
  };

  // Submit attendance to backend
  const handleFinalSubmit = async () => {
    if (submitting) return;
    if (!capturedPhoto) {
      setLookupError("Please capture and confirm your attendance photograph before submitting.");
      return;
    }
    if (isLocationRequired && locationState.status !== "verified") {
      setLookupError("Location verification is required before submitting attendance.");
      return;
    }

    setSubmitting(true);
    setLookupError("");

    try {
      const storageKey = `attendance-request:${token}`;
      try {
        requestId.current ??= sessionStorage.getItem(storageKey);
      } catch {}
      requestId.current ??= crypto.randomUUID();
      try {
        sessionStorage.setItem(storageKey, requestId.current);
      } catch {}

      const effectiveName = verifiedStudent?.full_name || fullName;
      const effectiveMatric = verifiedStudent?.matric_number || matricNumber;

      // Signed attendance token format is: base64url(payload).base64url(signature)
      let sessionId: string | undefined;
      let nonce: string | undefined;
      try {
        const payloadB64 = token.split(".")[0];
        if (payloadB64) {
          const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
          const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
          const payload = JSON.parse(atob(padded)) as { session_id?: string; nonce?: string };
          sessionId = payload.session_id;
          nonce = payload.nonce;
        }
      } catch {
        sessionId = undefined;
        nonce = undefined;
      }

      if (!sessionId || !nonce) {
        setLookupError("Invalid attendance QR token. Please scan the classroom QR again.");
        setSubmitting(false);
        return;
      }

      const uploaded = await uploadPhoto(sessionId, nonce, capturedPhoto);
      if (!uploaded.ok) {
        if (uploaded.terminal) setSessionRejected(true);
        setLookupError(uploaded.error);
        setSubmitting(false);
        return;
      }
      const photoToSubmit = uploaded.path;

      const response = await recordAttendance({
        token,
        requestId: requestId.current,
        fullName: effectiveName,
        matricNumber: effectiveMatric,
        photo: photoToSubmit,
        latitude: locationState.status === "verified" ? locationState.latitude ?? null : null,
        longitude: locationState.status === "verified" ? locationState.longitude ?? null : null,
        accuracy: locationState.status === "verified" ? locationState.accuracy ?? null : null,
        capturedAt: locationState.status === "verified" ? locationState.capturedAt ?? null : null,
      });

      setResult(response);
      setStep(3);
      captureAnalytics(
        response.ok
          ? ANALYTICS_EVENTS.attendanceQrCheckinSucceeded
          : ANALYTICS_EVENTS.attendanceQrCheckinFailed
      );

      if (response.ok) {
        try {
          const successData = {
            course_code: response.course_code || classInfo.course_code,
            course_title: classInfo.course_title,
            organization_name: classInfo.organization_name,
            full_name: response.full_name || effectiveName,
            matric_number: response.matric_number || effectiveMatric,
            status: response.status || "PRESENT",
            recorded_at: response.recorded_at || new Date().toISOString(),
            photo_url: capturedPhoto || (response.photo_url?.startsWith("data:") || response.photo_url?.startsWith("http") ? response.photo_url : null),
            verification_mode: classInfo.verification_mode,
            identity_status: response.identity_status,
          };
          sessionStorage.setItem("turnmark_attendance_success", JSON.stringify(successData));

          const query = new URLSearchParams();
          if (successData.course_code) query.set("course", successData.course_code);
          if (successData.course_title) query.set("title", successData.course_title);
          if (successData.organization_name) query.set("org", successData.organization_name);
          if (successData.full_name) query.set("name", successData.full_name);
          if (successData.matric_number) query.set("matric", successData.matric_number);
          if (successData.status) query.set("status", successData.status);
          if (successData.recorded_at) query.set("time", successData.recorded_at);
          if (successData.verification_mode) query.set("mode", successData.verification_mode);

          router.push(`/attend/success?${query.toString()}`);
          return;
        } catch {
          // If navigation throws, fallback to inline success card
        }
      }
    } catch {
      setResult({
        ok: false,
        status: "UNAVAILABLE",
        message: "Connection interrupted. Retry this same submission safely.",
      });
      setStep(3);
      captureAnalytics(ANALYTICS_EVENTS.attendanceQrCheckinFailed);
    } finally {
      setSubmitting(false);
    }
  };

  // Success / Final Result Screen (STEP 3)
  if (result) {
    if (result.ok) {
      return (
        <section className={styles.successCard} aria-live="polite">
          <div className={styles.successBadge}>
            <Check size={28} aria-hidden="true" />
          </div>
          <p className={styles.successEyebrow}>ATTENDANCE RECORDED</p>
          <h2 className={styles.successHeading}>Attendance recorded!</h2>
          <span className={styles.successSub}>
            Your presence has been successfully confirmed for {result.course_code || classInfo.course_code}.
          </span>

          {result.photo_url && (result.photo_url.startsWith("data:image/") || result.photo_url.startsWith("https://")) && (
            <div className={styles.selfieResultPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.photo_url}
                alt="Captured attendance selfie"
                width={120}
                height={120}
                className={styles.selfieImage}
              />
              <span className={styles.photoVerifiedBadge}>
                <CheckCircle2 size={14} /> Verified Photo
              </span>
            </div>
          )}

          <dl className={styles.summaryList}>
            <div>
              <dt>Full Name</dt>
              <dd>{result.full_name || fullName}</dd>
            </div>
            <div>
              <dt>Matric Number</dt>
              <dd>{result.matric_number || matricNumber}</dd>
            </div>
            <div>
              <dt>Course</dt>
              <dd>{result.course_code || classInfo.course_code}</dd>
            </div>
            <div>
              <dt>Time Recorded</dt>
              <dd>{safeFormatTime(result.recorded_at)}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd data-status={result.status}>
                {result.status === "LATE" ? "Late" : "Present"}
                {result.identity_status === "STUDENT_FOUND" ? " · Roster Matched" : " · Standard"}
                {result.needs_review ? " · Under Review" : ""}
              </dd>
            </div>
          </dl>

          <p className={styles.accountNotice}>
            <ShieldCheck size={16} aria-hidden="true" />
            No account was created. Your check-in is recorded without a TuRnMaRk login.
          </p>
          {firstRegistration ? <p>This is a first registration. Your lecturer can review it before treating it as a confirmed roster identity.</p> : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <Link
              className={styles.primaryButton}
              href={`/attend/success?course=${encodeURIComponent(result.course_code || classInfo.course_code)}&name=${encodeURIComponent(result.full_name || fullName)}&matric=${encodeURIComponent(result.matric_number || matricNumber)}&status=${encodeURIComponent(result.status || "PRESENT")}`}
            >
              View Full Attendance Receipt <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      );
    }

    // Already Recorded / Duplicate State
    if (result.status === "DUPLICATE") {
      return (
        <section className={styles.duplicateCard} role="alert">
          <div className={styles.duplicateBadge}>
            <ShieldAlert size={28} aria-hidden="true" />
          </div>
          <p className={styles.duplicateEyebrow}>ALREADY RECORDED</p>
          <h2 className={styles.duplicateHeading}>Already recorded</h2>
          <p className={styles.duplicateText}>
            Your attendance for this class has already been submitted and stored. Duplicate entries
            are prevented.
          </p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setResult(null);
              setStep(1);
            }}
          >
            Review Details
          </button>
        </section>
      );
    }

    // Failure / Error state with retry
    return (
      <section className={styles.errorCard} role="alert">
        <div className={styles.errorBadge}>
          <ShieldAlert size={28} aria-hidden="true" />
        </div>
        <p className={styles.errorEyebrow}>SUBMISSION FAILED</p>
        <h2 className={styles.errorHeading}>Could not record attendance</h2>
        <p className={styles.errorText}>{result.message}</p>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setResult(null);
              setStep(1);
            }}
          >
            <RotateCcw size={16} /> Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.guidedFlow}>
      {/* 3-Step Progress Indicator */}
      <div className={styles.progressStepper} aria-label="Attendance progress">
        <div className={`${styles.stepNode} ${step >= 1 ? styles.stepActive : ""}`}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Details</span>
        </div>
        <div className={`${styles.stepConnector} ${step >= 2 ? styles.connectorActive : ""}`} />
        <div className={`${styles.stepNode} ${step >= 2 ? styles.stepActive : ""}`}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Selfie</span>
        </div>
        <div className={`${styles.stepConnector} ${step >= 3 ? styles.connectorActive : ""}`} />
        <div className={`${styles.stepNode} ${step >= 3 ? styles.stepActive : ""}`}>
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Submit</span>
        </div>
      </div>

      {/* Class Overview Header */}
      <div className={styles.classInfoBar}>
        <div className={styles.classIcon}>
          <GraduationCap size={22} aria-hidden="true" />
        </div>
        <div className={styles.classMeta}>
          <p className={styles.orgName}>{classInfo.organization_name}</p>
          <h2 className={styles.courseCode}>{classInfo.course_code}</h2>
          <span className={styles.courseTitle}>
            {classInfo.session_title ? `${classInfo.session_title} · ` : ""}
            {classInfo.course_title}
          </span>
          <span className={styles.modePill}>
            {classInfo.verification_mode === "VERIFIED"
              ? "Roster check · no account"
              : "Matric check-in · no account"}
          </span>
        </div>
      </div>

      {/* STEP 1: DETAILS */}
      {step === 1 && (
        <div className={`${styles.stepContainer} tm-step-prev`}>
          <div className={styles.stepHeader}>
            <h3 className={styles.stepHeading}>Enter your matric number</h3>
            <p className={styles.stepDescription}>No account or sign-in is required. We look up the details already registered for you.</p>
          </div>

          <div className={styles.formFields}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="matricInput" className={styles.fieldLabel}>
                    Matriculation number
                  </label>
                  <div className={styles.inputWithAction}>
                    <input
                      id="matricInput"
                      name="matricNumber"
                      type="text"
                      className={styles.textInput}
                      value={matricNumber}
                      onChange={(e) => {
                        setMatricNumber(e.target.value);
                        setVerifiedStudent(null);
                        setSelfRegistration(false);
                        setDirectory(null);
                        setLookupError("");
                      }}
                      placeholder="e.g. CSC/2022/045"
                      autoCapitalize="characters"
                      autoComplete="off"
                      enterKeyHint="search"
                      required
                    />
                    <button
                      type="button"
                      className={styles.lookupButton}
                      disabled={lookupLoading || !matricNumber.trim()}
                      onClick={() => handleLookup()}
                    >
                      {lookupLoading ? (
                        <RefreshCw size={15} className={styles.spinner} />
                      ) : (
                        "Find me"
                      )}
                    </button>
                  </div>
                </div>

                {verifiedStudent && (
                  <div className={styles.studentFoundBanner} role="status">
                    <div className={styles.verifiedBadge}>
                      <UserCheck size={18} />
                      <strong>STUDENT FOUND</strong>
                    </div>
                    <div className={styles.verifiedDetails}>
                      <p className={styles.verifiedName}>{verifiedStudent.full_name}</p>
                      <div className={styles.verifiedMeta}>
                        <span>Matric: {verifiedStudent.matric_number}</span>
                        {verifiedStudent.programme && <span>· {verifiedStudent.programme}</span>}
                        {verifiedStudent.level && <span>· {verifiedStudent.level}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {selfRegistration && !verifiedStudent && directory && directory.faculties.length > 0 && (
                  <form action={registerFirstTime} className={styles.formFields}>
                    <p>First visit for this institution. Your lecturer can review this registration. It does not create a login.</p>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="registerName" className={styles.fieldLabel}>Full name</label>
                      <input id="registerName" name="fullName" className={styles.textInput} required maxLength={160} autoComplete="name" />
                    </div>
                    <div className={styles.fieldGroup}>
                      <CustomDropdown
                        name="facultyId"
                        label="Faculty"
                        value={facultyId}
                        onChange={setFacultyId}
                        options={directory.faculties.map((faculty) => ({ value: faculty.id, label: faculty.name }))}
                        required
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <CustomDropdown
                        name="departmentId"
                        label="Department"
                        key={facultyId}
                        defaultValue={directory.departments.find((d) => d.faculty_id === facultyId)?.id ?? ""}
                        options={directory.departments
                          .filter((department) => department.faculty_id === facultyId)
                          .map((department) => ({ value: department.id, label: department.name }))}
                        required
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="registerLevel" className={styles.fieldLabel}>Academic level</label>
                      <input id="registerLevel" name="level" className={styles.textInput} inputMode="numeric" required maxLength={40} placeholder="e.g. 300" />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="registerEmail" className={styles.fieldLabel}>Email</label>
                      <input id="registerEmail" name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={styles.textInput} maxLength={254} autoComplete="email" />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="registerPhone" className={styles.fieldLabel}>Phone</label>
                      <input id="registerPhone" name="phone" type="tel" inputMode="tel" className={styles.textInput} maxLength={20} autoComplete="tel" />
                    </div>
                    <p>Provide an email or a phone number. The photograph is a reference, not biometric proof.</p>
                    <label className={styles.fieldLabel}>
                      <input type="checkbox" name="consent" value="yes" required /> I agree this photograph may be stored privately for attendance reference.
                    </label>
                    <FaceCapture onAccept={setReferencePhoto} busy={registering} />
                    <button type="submit" className={styles.secondaryButton} disabled={registering || !referencePhoto}>{registering ? "Saving registration…" : "Save registration"}</button>
                  </form>
                )}

            {/* Geofence Location Verification */}
            {isLocationRequired && (
              <div className={styles.locationSection}>
                <div className={styles.locationHeader}>
                  <MapPin size={18} className={styles.locationIcon} />
                  <div>
                    <strong>Class location</strong>
                    <p>This session checks that your GPS reading is inside the lecturer’s attendance zone. Location is requested once, only for this check-in, and is not tracked in the background.</p>
                  </div>
                </div>

                {locationState.status === "requesting" && (
                  <div className={styles.locationStateBox}>
                    <RefreshCw size={16} className={styles.spinner} />
                    <span>Detecting current GPS coordinates…</span>
                  </div>
                )}

                {locationState.status === "verified" && (
                  <div className={styles.locationVerifiedBox}>
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>GPS reading accepted</strong>
                      <p>{locationState.message}</p>
                    </div>
                  </div>
                )}

                {locationState.status === "error" && (
                  <div className={styles.locationErrorBox}>
                    <ShieldAlert size={18} />
                    <div>
                      <strong>Location check failed</strong>
                      <p>{locationState.message}</p>
                      <button
                        type="button"
                        className={styles.retryLocationButton}
                        onClick={requestLocation}
                      >
                        <RefreshCw size={14} /> Retry Location
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {lookupError && (
              <FeedbackNotice ok={false} message={lookupError} />
            )}

            <button
              type="button"
              className={styles.primaryButton}
              disabled={!classInfo.open || !verifiedStudent || (isLocationRequired && locationState.status !== "verified")}
              onClick={handleProceedToSelfie}
            >
              Continue to Selfie <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELFIE CAPTURE & REVIEW */}
      {step === 2 && (
        <div className={`${styles.stepContainer} tm-step-next`}>
          <div className={styles.stepHeader}>
            <h3 className={styles.stepHeading}>
              {!capturedPhoto ? "Take attendance selfie" : "Review and submit attendance"}
            </h3>
            <p className={styles.stepDescription}>
              {!capturedPhoto
                ? "Position your face in the camera frame with good lighting."
                : "Confirm your details and photograph before submitting your attendance."}
            </p>
          </div>

          <DynamicCameraModal
            isOpen={cameraModalOpen}
            onClose={() => setCameraModalOpen(false)}
            onConfirmPhoto={(photo) => {
              setCapturedPhoto(photo);
              setCameraModalOpen(false);
            }}
            title="Take attendance selfie"
            description="Center your face in the oval frame with good lighting."
          />

          <div className={styles.cameraBox}>
            {!capturedPhoto ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "24px 16px" }}>
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: "#fff0e8",
                    display: "grid",
                    placeItems: "center",
                    color: "#ff6b2b",
                  }}
                >
                  <Camera size={36} />
                </div>
                <div style={{ textAlign: "center", maxWidth: "340px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 750, color: "#111318" }}>
                    Attendance photograph required
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#73788a", lineHeight: 1.5 }}>
                    Open the camera to take a clear live photograph. You can flip between front and back cameras and retake as many times as you need.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setCameraModalOpen(true)}
                  style={{ width: "100%", maxWidth: "320px", marginTop: "8px" }}
                >
                  <Camera size={18} /> Open Camera
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%" }}>
                {/* Photo Thumbnail */}
                <div className={styles.photoPreviewWrapper}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedPhoto}
                    alt="Captured Selfie"
                    width={240}
                    height={240}
                    className={styles.capturedPhoto}
                  />
                  <span className={styles.capturedConfirmBadge}>
                    <CheckCircle2 size={16} /> Photo confirmed
                  </span>
                </div>

                {/* Review Details Card */}
                <div
                  style={{
                    background: "#fffaf7",
                    border: "1px solid #ffd9ca",
                    borderRadius: "16px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#d94b14", letterSpacing: "0.08em" }}>
                      CHECK-IN SUMMARY
                    </span>
                    <button
                      type="button"
                      onClick={() => setCameraModalOpen(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ff6b2b",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <RotateCcw size={13} /> Retake
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                    <div>
                      <span style={{ display: "block", fontSize: "11px", color: "#8a7d76" }}>Full Name</span>
                      <strong style={{ color: "#111318" }}>{verifiedStudent?.full_name || fullName}</strong>
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: "11px", color: "#8a7d76" }}>Matric Number</span>
                      <strong style={{ color: "#111318" }}>{verifiedStudent?.matric_number || matricNumber}</strong>
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: "11px", color: "#8a7d76" }}>Course</span>
                      <strong style={{ color: "#111318" }}>{classInfo.course_code}</strong>
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: "11px", color: "#8a7d76" }}>Institution</span>
                      <strong style={{ color: "#111318" }}>{classInfo.organization_name}</strong>
                    </div>
                  </div>
                  {isLocationRequired && locationState.status === "verified" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#15945f", marginTop: "4px" }}>
                      <CheckCircle2 size={14} />
                      <span>GPS location confirmed within class zone</span>
                    </div>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: "12px", color: "var(--tm-gray-500)", lineHeight: 1.5, textAlign: "left" }}>
                  This photograph is stored privately for lecturer verification only.
                </p>

                {lookupError && (
                  <FeedbackNotice ok={false} message={lookupError} />
                )}

                <div className={styles.twoButtonRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={submitting || sessionRejected}
                    onClick={() => setCameraModalOpen(true)}
                  >
                    <RotateCcw size={16} /> Retake
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={submitting || sessionRejected}
                    onClick={handleFinalSubmit}
                  >
                    {submitting ? "Submitting…" : sessionRejected ? "Session Closed" : "Confirm & Submit"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className={styles.flowFooter}>
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          TuRnMaRk Smart Attendance · Secure real-time verification · Privacy protected
        </span>
      </footer>
    </section>
  );
}
