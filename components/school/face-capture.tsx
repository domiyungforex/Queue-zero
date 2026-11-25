"use client";

/* Private camera frames are data URLs, so the image optimizer cannot fetch them. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Camera, Check, RefreshCw } from "lucide-react";
import { DynamicCameraModal } from "./dynamic-camera-modal";

type Props = {
  onAccept: (dataUrl: string) => void;
  busy?: boolean;
};

export function FaceCapture({ onAccept, busy }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleConfirm = (dataUrl: string) => {
    setPhoto(dataUrl);
    onAccept(dataUrl);
  };

  return (
    <div className="school-face-capture" style={{ display: "grid", gap: "12px", justifyItems: "center" }}>
      {photo ? (
        <div style={{ position: "relative", width: "min(100%, 260px)", aspectRatio: "1 / 1", borderRadius: "18px", overflow: "hidden", border: "2px solid #ff6b2b", boxShadow: "0 8px 24px rgba(255, 107, 43, 0.15)" }}>
          <img src={photo} alt="Confirmed reference photograph" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(22, 133, 91, 0.9)", color: "#fff", fontSize: "11px", fontWeight: 750, padding: "4px 12px", borderRadius: "999px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Check size={12} /> Photograph confirmed
          </div>
        </div>
      ) : (
        <div style={{ width: "min(100%, 260px)", aspectRatio: "1 / 1", borderRadius: "18px", background: "#f8f5f3", border: "2px dashed #ded4cd", display: "grid", placeItems: "center", padding: "20px", textAlign: "center" }}>
          <div>
            <div style={{ display: "grid", width: "48px", height: "48px", placeItems: "center", borderRadius: "14px", background: "#fff0e8", color: "#ff6b2b", margin: "0 auto 10px" }}>
              <Camera size={24} />
            </div>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#111318" }}>Reference photograph required</p>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#73788a" }}>Click below to open the camera modal and take your photo.</p>
          </div>
        </div>
      )}

      <p style={{ margin: 0, fontSize: "11px", color: "#73788a", textAlign: "center" }}>
        This photograph is stored privately. It is not checked by an automated biometric service.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          className="button-primary"
          onClick={() => setModalOpen(true)}
          disabled={busy}
          style={{ minHeight: "44px", padding: "0 20px", borderRadius: "12px", fontSize: "13px", fontWeight: 750, display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          {photo ? (
            <>
              <RefreshCw size={14} /> Retake Photograph
            </>
          ) : (
            <>
              <Camera size={15} /> Open Camera
            </>
          )}
        </button>
      </div>

      <DynamicCameraModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirmPhoto={handleConfirm}
        title="Student Reference Photograph"
        description="Hold steady and face the camera with good lighting."
      />
    </div>
  );
}
