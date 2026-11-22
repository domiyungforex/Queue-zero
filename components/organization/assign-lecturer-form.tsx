"use client";

import { useState, useTransition } from "react";
import { UserCheck, X } from "lucide-react";
import { assignLecturerAction } from "@/lib/organization/cms-actions";

type Props = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  onClose?: () => void;
};

export function AssignLecturerForm({ courseId, courseCode, courseTitle, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    setMessage(null);
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("userId", userId.trim());
    formData.set("displayName", displayName.trim());

    startTransition(async () => {
      const res = await assignLecturerAction(formData);
      if (res.ok) {
        setMessage({ ok: true, text: res.message });
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      } else {
        setMessage({ ok: false, text: res.message });
      }
    });
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #ffd2bf",
        borderRadius: "20px",
        padding: "clamp(16px, 4vw, 24px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        maxWidth: "460px",
        width: "100%",
        maxHeight: "min(90dvh, 600px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserCheck size={18} style={{ color: "#ff5c1a" }} />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Assign Lecturer</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8c827b" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#70665e" }}>
        Assign an instructor to <strong>{courseCode}</strong> ({courseTitle}). They will manage classes and attendance in their delegated workspace.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "13px", fontWeight: 600 }}>
          Lecturer User ID (Clerk ID)
          <input
            type="text"
            required
            placeholder="user_2..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{
              height: "44px",
              padding: "0 12px",
              borderRadius: "10px",
              border: "1px solid #dcd5d0",
              fontFamily: "monospace",
              fontSize: "13px",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "13px", fontWeight: 600 }}>
          Display Name / Title
          <input
            type="text"
            required
            placeholder="e.g. Dr. Adeleke Adebayo"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{
              height: "44px",
              padding: "0 12px",
              borderRadius: "10px",
              border: "1px solid #dcd5d0",
              fontSize: "13px",
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          {onClose && (
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={isPending}
              style={{ minHeight: "40px" }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="button-primary"
            disabled={isPending}
            style={{ minHeight: "40px" }}
          >
            {isPending ? "Assigning…" : "Confirm Assignment"}
          </button>
        </div>

        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            style={{
              margin: "8px 0 0",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              background: message.ok ? "#e8f8f0" : "#fee2e2",
              color: message.ok ? "#0d7a46" : "#b91c1c",
              fontWeight: 600,
            }}
          >
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
