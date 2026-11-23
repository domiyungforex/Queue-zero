import { AlertCircle, CheckCircle2 } from "lucide-react";
import React from "react";

type Props = {
  type?: "success" | "error" | "info";
  ok?: boolean;
  message: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function FeedbackNotice({ type, ok, message, children, className = "", style }: Props) {
  const resolvedType = type ?? (ok === true ? "success" : ok === false ? "error" : "info");
  const isError = resolvedType === "error";
  const isSuccess = resolvedType === "success";

  const borderColor = isError ? "#fecaca" : isSuccess ? "#bbf7d0" : "#bfdbfe";
  const accentColor = isError ? "#dc2626" : isSuccess ? "#16a34a" : "#2563eb";
  const bgGradient = isError
    ? "linear-gradient(135deg, #fffaf9 0%, #fff1ef 100%)"
    : isSuccess
      ? "linear-gradient(135deg, #f7fdf9 0%, #edfcf2 100%)"
      : "linear-gradient(135deg, #f8faff 0%, #edf4fe 100%)";
  const textColor = isError ? "#991b1b" : isSuccess ? "#14532d" : "#1e40af";
  const iconBg = isError ? "#fee2e2" : isSuccess ? "#dcfce7" : "#dbeafe";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 18px",
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: "14px",
        boxShadow: isError ? "0 4px 14px rgba(220, 38, 38, 0.06)" : "0 4px 14px rgba(22, 163, 74, 0.06)",
        margin: "12px 0",
        ...style,
      }}
    >
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          background: iconBg,
          color: accentColor,
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        {isError ? (
          <AlertCircle size={16} aria-hidden="true" />
        ) : isSuccess ? (
          <CheckCircle2 size={16} aria-hidden="true" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, color: textColor, fontSize: "13.5px", lineHeight: "1.5", fontWeight: 600 }}>
        <span>{message}</span>
        {children && <div style={{ marginTop: "6px" }}>{children}</div>}
      </div>
    </div>
  );
}
