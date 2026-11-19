"use client";

/* Private camera frames are data URLs, so the image optimizer cannot fetch them. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { clientPhotoQuality } from "@/lib/school/photo-quality";

type Props = {
  onAccept: (dataUrl: string) => void;
  busy?: boolean;
};

export function FaceCapture({ onAccept, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  async function start() {
    setError("");
    setPreview(null);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      setStream(next);
      if (videoRef.current) videoRef.current.srcObject = next;
    } catch {
      setError("Camera permission was denied or no camera is available. You can use the manual confirmation instead of a photograph.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("The camera preview is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth, video.videoHeight, 960);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const sample = ctx.getImageData(0, 0, 24, 24).data;
    let total = 0;
    const values: number[] = [];
    for (let i = 0; i < sample.length; i += 16) {
      const value = (sample[i] + sample[i + 1] + sample[i + 2]) / 3;
      values.push(value);
      total += value;
    }
    const mean = total / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const quality = clientPhotoQuality(size, size, variance);
    if (quality) {
      setError(quality);
      return;
    }
    setError("");
    setPreview(canvas.toDataURL("image/jpeg", 0.82));
  }

  return (
    <div className="school-face-capture">
      {preview ? <img src={preview} alt="Photograph ready to submit" /> : <video ref={videoRef} autoPlay playsInline muted />}
      {error ? <p role="alert">{error}</p> : <p>This photograph is stored privately. It is not checked by a facial-recognition service.</p>}
      <div className="school-actions">
        {!stream && !preview ? <button type="button" className="button-secondary" onClick={start}>Open camera</button> : null}
        {stream && !preview ? <button type="button" className="button-primary" onClick={capture}>Capture</button> : null}
        {preview ? <>
          <button type="button" className="button-secondary" onClick={() => setPreview(null)} disabled={busy}>Retake</button>
          <button type="button" className="button-primary" onClick={() => onAccept(preview)} disabled={busy}>{busy ? "Saving…" : "Use this photograph"}</button>
        </> : null}
      </div>
    </div>
  );
}
