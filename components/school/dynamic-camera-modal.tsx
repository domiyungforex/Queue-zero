"use client";

/* Interactive dynamic camera modal with retakes, front/rear camera flip, photo quality check, and iOS Safari support. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { clientPhotoQuality } from "@/lib/school/photo-quality";
import { FeedbackNotice } from "./feedback-notice";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPhoto: (photoDataUrl: string) => void;
  title?: string;
  description?: string;
};

async function acquireCameraStream(mode: "user" | "environment"): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
      audio: false,
    },
    {
      video: { facingMode: mode },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const name = (err as { name?: string })?.name;
      // Do not retry if permission was explicitly denied or no hardware exists
      if (
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        name === "NotFoundError" ||
        name === "DevicesNotFoundError"
      ) {
        throw err;
      }
    }
  }
  throw lastError;
}

export function DynamicCameraModal({
  isOpen,
  onClose,
  onConfirmPhoto,
  title = "Take attendance photograph",
  description = "Center your face in the oval frame with good lighting.",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingModeRef = useRef<"user" | "environment">("user");
  const requestSeqRef = useRef(0);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopMediaTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  const stopCamera = useCallback(() => {
    requestSeqRef.current += 1;
    stopMediaTracks();
    setCameraActive(false);
  }, [stopMediaTracks]);

  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    try {
      await video.play();
    } catch {
      // Some browsers resolve play() on loadedmetadata
    }
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment" = facingModeRef.current) => {
      const seq = ++requestSeqRef.current;
      stopMediaTracks();
      setError("");
      setCapturedPhoto(null);
      setCameraActive(false);

      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("Camera access requires a secure HTTPS connection. Open this page over HTTPS and retry.");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera capture. Please use Safari on iPhone or Chrome on Android.");
        return;
      }

      try {
        const stream = await acquireCameraStream(mode);
        if (seq !== requestSeqRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setCameraActive(true);
        await attachStreamToVideo(stream);

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          setHasMultipleCameras(videoInputs.length > 1);
        } catch {}
      } catch (err: unknown) {
        if (seq !== requestSeqRef.current) return;
        const errName = (err as { name?: string })?.name;
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setError(
            "Camera permission was denied. Allow camera access in your browser settings (on iPhone Safari: aA → Website Settings → Camera → Allow) and tap Retry Camera.",
          );
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setError("No camera was found on this device. Connect or enable a camera and tap Retry Camera.");
        } else if (errName === "NotReadableError" || errName === "TrackStartError") {
          setError("Camera is currently in use by another app. Close other camera apps and tap Retry Camera.");
        } else {
          setError("Unable to start the camera stream. Tap Retry Camera to try again.");
        }
        setCameraActive(false);
      }
    },
    [attachStreamToVideo, stopMediaTracks],
  );

  // Re-attach active stream when <video> mounts (e.g. right after Retake)
  useEffect(() => {
    if (isOpen && !capturedPhoto && cameraActive && streamRef.current) {
      void attachStreamToVideo(streamRef.current);
    }
  }, [isOpen, capturedPhoto, cameraActive, attachStreamToVideo]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        void startCamera(facingModeRef.current);
      }, 0);
      return () => {
        clearTimeout(timer);
        requestSeqRef.current += 1;
        stopMediaTracks();
      };
    }
    requestSeqRef.current += 1;
    stopMediaTracks();
    return undefined;
  }, [isOpen, startCamera, stopMediaTracks]);

  const toggleCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    facingModeRef.current = nextMode;
    setFacingMode(nextMode);
    void startCamera(nextMode);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2 || video.videoHeight < 2) {
      setError("Camera is still warming up. Wait a moment and tap Capture Photo again.");
      return;
    }

    try {
      const targetSize = 640;
      const canvas = document.createElement("canvas");
      const cropSize = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Photograph capture failed on this browser. Tap Retry Camera and try again.");
        return;
      }

      const sx = (video.videoWidth - cropSize) / 2;
      const sy = (video.videoHeight - cropSize) / 2;

      if (facingMode === "user") {
        ctx.translate(targetSize, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Verify lighting variance
      try {
        const sample = ctx.getImageData(0, 0, 24, 24).data;
        let total = 0;
        const values: number[] = [];
        for (let i = 0; i < sample.length; i += 16) {
          const val = (sample[i] + sample[i + 1] + sample[i + 2]) / 3;
          values.push(val);
          total += val;
        }
        const mean = total / values.length;
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
        const quality = clientPhotoQuality(targetSize, targetSize, variance);
        if (quality) {
          setError(quality);
          return;
        }
      } catch {}

      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      if (!dataUrl || !dataUrl.startsWith("data:image/jpeg;base64,")) {
        setError("Photograph capture failed. Please try again.");
        return;
      }

      setError("");
      setCapturedPhoto(dataUrl);
      stopCamera();
    } catch {
      setError("Photograph capture failed. Please retake your photo.");
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setError("");
    void startCamera(facingModeRef.current);
  };

  const handleUsePhoto = () => {
    if (capturedPhoto) {
      stopCamera();
      onConfirmPhoto(capturedPhoto);
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(17, 19, 24, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overscrollBehavior: "contain",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "24px",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92dvh",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: "1px solid #f3ece8",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#111318" }}>{title}</h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#73788a" }}>{description}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close camera"
            style={{
              display: "grid",
              placeItems: "center",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#f3ece8",
              border: 0,
              color: "#555866",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder area */}
        <div style={{ position: "relative", width: "100%", background: "#111318", aspectRatio: "1 / 1", overflow: "hidden", flexShrink: 0 }}>
          {!capturedPhoto ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none",
                }}
              />
              {/* Face Guide Target Ring */}
              <div
                style={{
                  position: "absolute",
                  inset: "12%",
                  border: "3px dashed rgba(255, 107, 43, 0.9)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "14px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(17, 19, 24, 0.75)",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                <Sparkles size={12} color="#ff6b2b" />
                {cameraActive ? "Live Camera Preview" : "Starting Camera…"}
              </div>
            </>
          ) : (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <img
                src={capturedPhoto}
                alt="Captured attendance selfie"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "14px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(22, 133, 91, 0.9)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800,
                  padding: "6px 14px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                <Check size={14} /> Photo Captured
              </div>
            </div>
          )}
        </div>

        {/* Error notification */}
        {error ? (
          <div style={{ padding: "10px 18px 0" }}>
            <FeedbackNotice ok={false} message={error} />
          </div>
        ) : null}

        {/* Controls footer */}
        <div
          style={{
            padding: "16px 20px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "#ffffff",
          }}
        >
          {!capturedPhoto ? (
            error && !cameraActive ? (
              <button
                type="button"
                onClick={() => void startCamera(facingModeRef.current)}
                className="button-primary"
                style={{
                  width: "100%",
                  minHeight: "48px",
                  borderRadius: "14px",
                  fontSize: "14px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <RefreshCw size={16} />
                Retry Camera
              </button>
            ) : (
              <>
                {hasMultipleCameras ? (
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="button-secondary"
                    style={{ minHeight: "44px", padding: "0 14px", borderRadius: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    title="Switch Camera"
                  >
                    <RotateCcw size={16} />
                    <span style={{ fontSize: "12px" }}>Flip</span>
                  </button>
                ) : (
                  <div style={{ width: "60px" }} />
                )}

                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!cameraActive}
                  className="button-primary"
                  style={{
                    minHeight: "50px",
                    padding: "0 28px",
                    borderRadius: "14px",
                    fontSize: "14px",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 8px 20px rgba(255, 107, 43, 0.3)",
                  }}
                >
                  <Camera size={18} />
                  Capture Photo
                </button>

                <div style={{ width: "60px" }} />
              </>
            )
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%" }}>
              <button
                type="button"
                onClick={handleRetake}
                className="button-secondary"
                style={{ minHeight: "48px", borderRadius: "14px", fontSize: "13.5px", fontWeight: 750, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <RefreshCw size={15} />
                Retake
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="button-primary"
                style={{ minHeight: "48px", borderRadius: "14px", fontSize: "13.5px", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Check size={16} />
                Use Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
