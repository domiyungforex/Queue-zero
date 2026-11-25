"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, QrCode, UserCheck, UserPlus } from "lucide-react";

/** Inline WhatsApp icon – replaces lucide's MessageSquare which breaks TSC here. */
function WhatsAppIcon({ size = 13 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

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

  const shareWhatsApp = (path: string, intro: string) => {
    const fullUrl = getFullUrl(path);
    const msg = encodeURIComponent(`${intro}\n\n${fullUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
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
            <button
              type="button"
              onClick={() => shareWhatsApp(registerPath, `Register once at ${organizationName} for smart class attendance:`)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#25D366",
                color: "#ffffff",
                border: "none",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Share registration link on WhatsApp"
            >
              <WhatsAppIcon size={13} />
              <span>WhatsApp</span>
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
            <button
              type="button"
              onClick={() => shareWhatsApp(checkinPath, `Check in for active lecture at ${organizationName}:`)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#25D366",
                color: "#ffffff",
                border: "none",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Share check-in link on WhatsApp"
            >
              <WhatsAppIcon size={13} />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
