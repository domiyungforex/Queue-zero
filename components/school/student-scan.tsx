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
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  lookupVerifiedStudent,
  recordAttendance,
  type ScanResult,
} from "@/lib/school-student/actions";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
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

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
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

  // Location
  const isLocationRequired = Boolean(
    classInfo.location_required &&
      classInfo.location_lat != null &&
      classInfo.location_lng != null
  );
  const [locationState, setLocationState] = useState<LocationState>({
    status: isLocationRequired ? "idle" : "verified",
  });

  // Camera / Selfie
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const [imageQualityGood, setImageQualityGood] = useState<boolean | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Request location when required
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState({
        status: "error",
        message: "Geolocation is not supported by your browser.",
      });
      return;
    }
    setLocationState({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const studentLat = pos.coords.latitude;
        const studentLng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        if (classInfo.location_lat != null && classInfo.location_lng != null) {
          const dist = calculateDistanceMeters(
            studentLat,
            studentLng,
            classInfo.location_lat,
            classInfo.location_lng
          );
          const maxRadius = classInfo.geofence_radius_meters ?? 100;
          const accuracyOk = accuracy <= Math.max(maxRadius / 2, 50);

          if (!accuracyOk) {
            setLocationState({
              status: "error",
              latitude: studentLat,
              longitude: studentLng,
              accuracy,
              distanceMeters: dist,
              message: `Location accuracy is too low (±${accuracy}m). Please move to an open area and retry.`,
            });
          } else if (dist <= maxRadius) {
            setLocationState({
              status: "verified",
              latitude: studentLat,
              longitude: studentLng,
              accuracy,
              distanceMeters: dist,
              message: `Within class zone (${dist}m away, ±${accuracy}m accuracy)`,
            });
          } else {
            setLocationState({
              status: "error",
              latitude: studentLat,
              longitude: studentLng,
              accuracy,
              distanceMeters: dist,
              message: `You are outside the permitted area (${dist}m away; maximum ${maxRadius}m permitted).`,
            });
          }
        } else {
          setLocationState({
            status: "verified",
            latitude: studentLat,
            longitude: studentLng,
            accuracy,
            message: `Location recorded (±${accuracy}m accuracy)`,
          });
        }
      },
      (err) => {
        let msg = "Location permission denied. Please allow location access to continue.";
        if (err.code === err.POSITION_UNAVAILABLE) msg = "Location information unavailable.";
        if (err.code === err.TIMEOUT) msg = "Location request timed out. Please retry.";
        setLocationState({ status: "error", message: msg });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
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
    const matric = (inputMatric ?? matricNumber).trim().toUpperCase();
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
          programme: res.programme,
          level: res.level,
        });
        setFullName(res.full_name || "");
      } else {
        setVerifiedStudent(null);
        setLookupError(res.message || "Student not found in this course roster. Please contact your lecturer.");
      }
    } catch {
      setLookupError("Unable to verify student roster at this moment.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Step 1 Validation & Proceed to Step 2
  const handleProceedToSelfie = () => {
    if (classInfo.verification_mode === "VERIFIED") {
      if (!verifiedStudent) {
        setLookupError("Please verify your matriculation number before continuing.");
        return;
      }
    } else {
      if (!fullName.trim() || !matricNumber.trim()) {
        setLookupError("Please provide both your full name and matriculation number.");
        return;
      }
    }

    if (isLocationRequired && locationState.status !== "verified") {
      setLookupError("Location verification is required to continue. Please verify location.");
      return;
    }

    setLookupError("");
    setStep(2);
    startCamera();
  };

  // Camera initialization
  const startCamera = async () => {
    setCameraError("");
    setCapturedPhoto(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access is not supported by your browser or device.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("Camera permission denied. Please allow camera access to take your selfie.");
    }
  };

  // Capture photo from video stream — declared before quality-check effect so the ref is stable
  const captureSelfie = useCallback(() => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const sx = ((video.videoWidth || 400) - size) / 2;
      const sy = ((video.videoHeight || 400) - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedPhoto(dataUrl);
      setAutoCaptureCountdown(null);
      stopCamera();
    } catch {
      setCameraError("Failed to capture image. Please retry.");
    }
  }, []);

  // Live quality check loop & optional automatic capture
  useEffect(() => {
    if (step !== 2 || capturedPhoto || !streamRef.current) return;

    let active = true;
    let steadyCount = 0;

    const interval = setInterval(() => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64).data;

        // Compute brightness
        let totalBrightness = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          totalBrightness += (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
        }
        const avgBrightness = totalBrightness / (64 * 64);
        const goodLight = avgBrightness > 40 && avgBrightness < 230;
        setImageQualityGood(goodLight);

        if (goodLight) {
          steadyCount++;
          if (steadyCount >= 3) {
            setAutoCaptureCountdown((prev) => {
              if (prev === null) return 2;
              if (prev > 1) return prev - 1;
              // Auto capture trigger
              captureSelfie();
              return null;
            });
          }
        } else {
          steadyCount = 0;
          setAutoCaptureCountdown(null);
        }
      } catch {
        // canvas analysis fallback
      }
    }, 600);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, capturedPhoto, captureSelfie]);

  const retakeSelfie = () => {
    setCapturedPhoto(null);
    setAutoCaptureCountdown(null);
    startCamera();
  };

  // Upload selfie to server storage, returning a URL (falls back to base64 on error)
  const uploadPhoto = async (classId: string, nonce: string, photoDataUrl: string): Promise<string> => {
    try {
      const res = await fetch(`/api/school/classes/${classId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nonce, photo: photoDataUrl }),
      });
      if (!res.ok) return photoDataUrl;
      const json = (await res.json()) as { url?: string };
      return json.url ?? photoDataUrl;
    } catch {
      return photoDataUrl;
    }
  };

  // Submit attendance to backend
  const handleFinalSubmit = async () => {
    if (submitting) return;
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

      const effectiveName =
        classInfo.verification_mode === "VERIFIED"
          ? verifiedStudent?.full_name ?? fullName
          : fullName;
      const effectiveMatric =
        classInfo.verification_mode === "VERIFIED"
          ? verifiedStudent?.matric_number ?? matricNumber
          : matricNumber;

      // Extract classId and nonce from token (they are base64-encoded JSON parts)
      let photoToSubmit = capturedPhoto;
      if (capturedPhoto) {
        try {
          // Parse token: format is base64url(header).base64url(payload).signature
          const payloadB64 = token.split(".")[1];
          if (payloadB64) {
            const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))) as {
              session_id?: string;
              nonce?: string;
            };
            if (payload.session_id && payload.nonce) {
              photoToSubmit = await uploadPhoto(payload.session_id, payload.nonce, capturedPhoto);
            }
          }
        } catch {
          // Keep base64 as fallback
        }
      }

      const response = await recordAttendance({
        token,
        requestId: requestId.current,
        fullName: effectiveName,
        matricNumber: effectiveMatric,
        photo: photoToSubmit,
        latitude: locationState.latitude ?? null,
        longitude: locationState.longitude ?? null,
        accuracy: locationState.accuracy ?? null,
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
            photo_url: response.photo_url || capturedPhoto || null,
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
      stopCamera();
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

          {result.photo_url && (
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
            No account required. Your verified check-in has been securely recorded.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <Link
              className={styles.primaryButton}
              href={`/attend/success?course=${encodeURIComponent(result.course_code || classInfo.course_code)}&name=${encodeURIComponent(result.full_name || fullName)}&matric=${encodeURIComponent(result.matric_number || matricNumber)}&status=${encodeURIComponent(result.status || "PRESENT")}`}
            >
              View Full Attendance Receipt <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className={styles.optionalAccountLink} href="/sign-up">
              Create an optional account
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
              ? "Verified Attendance · Course Roster Check"
              : "Standard Attendance · Instant Check-In"}
          </span>
        </div>
      </div>

      {/* STEP 1: DETAILS */}
      {step === 1 && (
        <div className={styles.stepContainer}>
          <div className={styles.stepHeader}>
            <h3 className={styles.stepHeading}>Sign your attendance</h3>
            <p className={styles.stepDescription}>Complete all steps to record your presence.</p>
          </div>

          <div className={styles.formFields}>
            {classInfo.verification_mode === "VERIFIED" ? (
              <>
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
                        const val = e.target.value.toUpperCase();
                        setMatricNumber(val);
                        setVerifiedStudent(null);
                        setLookupError("");
                      }}
                      placeholder="e.g. CSC/2022/045"
                      autoCapitalize="characters"
                      autoComplete="off"
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
                        "Verify"
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
              </>
            ) : (
              <>
                <div className={styles.fieldGroup}>
                  <label htmlFor="fullNameInput" className={styles.fieldLabel}>
                    Full name
                  </label>
                  <input
                    id="fullNameInput"
                    name="fullName"
                    type="text"
                    className={styles.textInput}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="matricInputStd" className={styles.fieldLabel}>
                    Matriculation number
                  </label>
                  <input
                    id="matricInputStd"
                    name="matricNumber"
                    type="text"
                    className={styles.textInput}
                    value={matricNumber}
                    onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                    placeholder="Enter your matric number"
                    autoCapitalize="characters"
                    autoComplete="off"
                    required
                  />
                </div>
              </>
            )}

            {/* Geofence Location Verification */}
            {isLocationRequired && (
              <div className={styles.locationSection}>
                <div className={styles.locationHeader}>
                  <MapPin size={18} className={styles.locationIcon} />
                  <div>
                    <strong>Location Verification</strong>
                    <p>Required by lecturer to verify presence in classroom.</p>
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
                      <strong>Location Confirmed</strong>
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
              <div className={styles.formErrorNotice} role="alert">
                <strong>{lookupError}</strong>
              </div>
            )}

            <button
              type="button"
              className={styles.primaryButton}
              disabled={
                !classInfo.open ||
                (classInfo.verification_mode === "VERIFIED" && !verifiedStudent) ||
                (classInfo.verification_mode === "STANDARD" &&
                  (!fullName.trim() || !matricNumber.trim())) ||
                (isLocationRequired && locationState.status !== "verified")
              }
              onClick={handleProceedToSelfie}
            >
              Continue to Selfie <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELFIE CAPTURE */}
      {step === 2 && (
        <div className={styles.stepContainer}>
          <div className={styles.stepHeader}>
            <h3 className={styles.stepHeading}>Face the camera</h3>
            <p className={styles.stepDescription}>
              Hold your phone close to your face. Your photo will be captured automatically.
            </p>
          </div>

          <div className={styles.cameraBox}>
            {!capturedPhoto ? (
              <div className={styles.cameraPreviewFrame}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={styles.cameraVideo}
                />
                {/* Circular face overlay with green scanning ring */}
                <div className={styles.faceTargetRing}>
                  <div className={styles.scanningPulseLine} />
                </div>

                {autoCaptureCountdown !== null && (
                  <div className={styles.countdownBadge}>
                    <span>Hold still… capturing in {autoCaptureCountdown}</span>
                  </div>
                )}

                {imageQualityGood !== null && (
                  <div
                    className={`${styles.qualityBadge} ${
                      imageQualityGood ? styles.qualityGood : styles.qualityPoor
                    }`}
                  >
                    <Sparkles size={13} />
                    {imageQualityGood ? "Good lighting" : "Adjust lighting or angle"}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.photoPreviewWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedPhoto}
                  alt="Captured Selfie"
                  width={320}
                  height={320}
                  className={styles.capturedPhoto}
                />
                <span className={styles.capturedConfirmBadge}>
                  <CheckCircle2 size={16} /> Photo captured
                </span>
              </div>
            )}

            {cameraError && (
              <div className={styles.cameraErrorNotice} role="alert">
                <p>{cameraError}</p>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={startCamera}
                >
                  <RefreshCw size={15} /> Retry Camera
                </button>
              </div>
            )}

            <div className={styles.cameraActions}>
              {!capturedPhoto ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={captureSelfie}
                >
                  <Camera size={18} /> Capture Photo
                </button>
              ) : (
                <div className={styles.twoButtonRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={retakeSelfie}
                  >
                    <RotateCcw size={16} /> Retake
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={submitting}
                    onClick={handleFinalSubmit}
                  >
                    {submitting ? "Submitting…" : "Confirm & Submit"}
                  </button>
                </div>
              )}
            </div>
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
