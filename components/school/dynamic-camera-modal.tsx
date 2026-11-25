"use client";

/* Interactive dynamic camera modal with retakes, front/rear camera flip, photo quality check, and responsive framing. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, FlipHorizontal, RefreshCw, Sparkles, X } from "lucide-react";
import { clientPhotoQuality } from "@/lib/school/photo-quality";
import { FeedbackNotice } from "./feedback-notice";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPhoto: (photoDataUrl: string) => void;
  title?: string;
  description?: string;
};

export function DynamicCameraModal({
  isOpen,
  onClose,
  onConfirmPhoto,
  title = "Take attendance photograph",
  description = "Center your face in the oval frame with good lighting.",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    stopCamera();
    setError("");
    setCapturedPhoto(null);

    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support camera access. Please use Chrome or Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);

      // Check available devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {}
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name;
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setError("Camera permission was denied. Please allow camera permissions in your browser settings and try again.");
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setError("No camera was found on this device.");
      } else {
        setError("Unable to start the camera stream. Please close other camera apps and retry.");
      }
      setCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
      setCapturedPhoto(null);
      setError("");
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, facingMode, stopCamera]);

  const toggleCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("Camera is still warming up. Wait a second and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    const cropSize = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sx = (video.videoWidth - cropSize) / 2;
    const sy = (video.videoHeight - cropSize) / 2;

    if (facingMode === "user") {
      ctx.translate(480, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 480, 480);
    // Reset transform for sample checks
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
      const quality = clientPhotoQuality(480, 480, variance);
      if (quality) {
        setError(quality);
        return;
      }
    } catch {}

    setError("");
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setError("");
    startCamera(facingMode);
  };

  const handleUsePhoto = () => {
    if (capturedPhoto) {
      onConfirmPhoto(capturedPhoto);
      onClose();
    }
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
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "24px",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
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
            onClick={onClose}
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
        <div style={{ position: "relative", width: "100%", background: "#111318", aspectRatio: "1 / 1", overflow: "hidden" }}>
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
                Live Camera Preview
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
            <>
              {hasMultipleCameras ? (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="button-secondary"
                  style={{ minHeight: "44px", padding: "0 14px", borderRadius: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  title="Switch Camera"
                >
                  <FlipHorizontal size={16} />
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
