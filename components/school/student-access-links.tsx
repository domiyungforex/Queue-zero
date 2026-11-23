"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, QrCode, UserCheck, UserPlus } from "lucide-react";

type Props = {
  organizationId: string;
  organizationName: string;
};

export function StudentAccessLinks({ organizationId, organizationName }: Props) {
  const [copiedRegister, setCopiedRegister] = useState(false);
  const [copiedCheckin, setCopiedCheckin] = useState(false);

  const getFullUrl = (path: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

  const registerPath = `/attend/register?org=${organizationId}`;
  const checkinPath = `/attend/check?org=${organizationId}`;

  const copyToClipboard = async (path: string, type: "register" | "checkin") => {
    const fullUrl = getFullUrl(path);
    try {
      await navigator.clipboard.writeText(fullUrl);
      if (type === "register") {
        setCopiedRegister(true);
        setTimeout(() => setCopiedRegister(false), 2000);
      } else {
        setCopiedCheckin(true);
        setTimeout(() => setCopiedCheckin(false), 2000);
      }
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = fullUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      if (type === "register") {
        setCopiedRegister(true);
        setTimeout(() => setCopiedRegister(false), 2000);
      } else {
        setCopiedCheckin(true);
        setTimeout(() => setCopiedCheckin(false), 2000);
      }
    }
  };

  return (
    <section
      aria-labelledby="student-access-links-title"
      style={{
        background: "#ffffff",
        border: "1px solid #e3ebe4",
        borderRadius: "20px",
        padding: "clamp(18px, 3vw, 24px)",
        boxShadow: "0 10px 30px rgba(72,39,23,.04)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#e25516", fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", marginBottom: "6px" }}>
            <QrCode size={14} aria-hidden="true" />
            <span>STUDENT ACCESS & ONBOARDING</span>
          </div>
          <h2 id="student-access-links-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#111318" }}>
            Student Self-Service Links
          </h2>
          <p style={{ margin: "6px 0 0", color: "#73788a", fontSize: "13px", lineHeight: "1.5" }}>
            Students register once with their matriculation number, then check in for every session. These links are dedicated to <strong>{organizationName}</strong>.
          </p>
        </div>
      </div>

      {/* Two Interactive Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Card 1: One-time Registration */}
        <div
          style={{
            border: "1px solid #ffd9ca",
            background: "#fffaf7",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#fff0e8",
                  color: "#d94b14",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 750,
                }}
              >
                <UserPlus size={13} aria-hidden="true" />
                Step 1 · One-time only
              </span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 800, color: "#111318" }}>
              Student Registration
            </h3>
            <p style={{ margin: 0, color: "#73788a", fontSize: "12px", lineHeight: "1.5" }}>
              New students register their name, matriculation/JAMB number, and department once to create their permanent profile.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
            <a
              href={registerPath}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#ff6b2b",
                color: "#ffffff",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 750,
                textDecoration: "none",
                flex: "1 1 auto",
                justifyContent: "center",
              }}
            >
              <span>Open Registration</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(registerPath, "register")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: copiedRegister ? "#e8f8ef" : "#ffffff",
                color: copiedRegister ? "#15945f" : "#111318",
                border: copiedRegister ? "1px solid #a3e0bf" : "1px solid #d5e0d8",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Copy registration link to share with students"
            >
              {copiedRegister ? (
                <>
                  <Check size={13} aria-hidden="true" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} aria-hidden="true" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Attendance Check-In */}
        <div
          style={{
            border: "1px solid #d0ebd8",
            background: "#f7fcf9",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#e8f8ef",
                  color: "#15945f",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 750,
                }}
              >
                <UserCheck size={13} aria-hidden="true" />
                Step 2 · For every class
              </span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 800, color: "#111318" }}>
              Attendance Check-In
            </h3>
            <p style={{ margin: 0, color: "#73788a", fontSize: "12px", lineHeight: "1.5" }}>
              Registered students enter only their matriculation number to verify and record their presence during active lectures.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
            <a
              href={checkinPath}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#16855b",
                color: "#ffffff",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 750,
                textDecoration: "none",
                flex: "1 1 auto",
                justifyContent: "center",
              }}
            >
              <span>Open Check-In</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(checkinPath, "checkin")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: copiedCheckin ? "#e8f8ef" : "#ffffff",
                color: copiedCheckin ? "#15945f" : "#111318",
                border: copiedCheckin ? "1px solid #a3e0bf" : "1px solid #d5e0d8",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Copy check-in link to share with students"
            >
              {copiedCheckin ? (
                <>
                  <Check size={13} aria-hidden="true" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} aria-hidden="true" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
