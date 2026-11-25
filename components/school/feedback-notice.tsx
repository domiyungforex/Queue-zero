import { AlertCircle, CheckCircle2 } from "lucide-react";

/** Inline Info icon – lucide-react's `Info` export breaks TSC in this project. */
function InfoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
import React from "react";

type Props = {
  type?: "success" | "error" | "info";
  ok?: boolean;
  title?: string;
  message: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function FeedbackNotice({ type, ok, title, message, children, className = "", style }: Props) {
  const resolvedType = type ?? (ok === true ? "success" : ok === false ? "error" : "info");
  const isError = resolvedType === "error";
  const isSuccess = resolvedType === "success";

  const borderColor = isError ? "#fecaca" : isSuccess ? "#bbf7d0" : "#dbeafe";
  const accentColor = isError ? "#e11d48" : isSuccess ? "#16a34a" : "#2563eb";
  const bgGradient = isError
    ? "linear-gradient(135deg, #fffaf9 0%, #fff1ef 100%)"
    : isSuccess
      ? "linear-gradient(135deg, #f7fdf9 0%, #edfcf2 100%)"
      : "linear-gradient(135deg, #f8faff 0%, #edf4fe 100%)";
  const textColor = isError ? "#9f1239" : isSuccess ? "#14532d" : "#1e40af";
  const iconBg = isError ? "#ffe4e6" : isSuccess ? "#dcfce7" : "#dbeafe";
  const defaultTitle = isError ? "Unable to continue" : isSuccess ? "Success" : "Notice";
  const layeredShadow = isError
    ? "0 1px 2px rgba(225, 29, 72, 0.06), 0 4px 10px rgba(225, 29, 72, 0.06), 0 12px 24px rgba(17, 19, 24, 0.04)"
    : isSuccess
      ? "0 1px 2px rgba(22, 163, 74, 0.06), 0 4px 10px rgba(22, 163, 74, 0.06), 0 12px 24px rgba(17, 19, 24, 0.04)"
      : "0 1px 2px rgba(37, 99, 235, 0.05), 0 4px 10px rgba(37, 99, 235, 0.05), 0 12px 24px rgba(17, 19, 24, 0.04)";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={`${isError ? "tm-feedback-error" : isSuccess ? "tm-feedback-success" : "tm-feedback-info"} ${className}`.trim()}
      style={{
        display: "flex",
        alignItems: "flex-start",
        textAlign: "left",
        gap: "14px",
        padding: "14px 20px",
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: "16px",
        boxShadow: layeredShadow,
        margin: "14px 0",
        ...style,
      }}
    >
      <div
        className={isSuccess ? "tm-success-pulse" : undefined}
        style={{
          display: "grid",
          placeItems: "center",
          width: "32px",
          height: "32px",
          borderRadius: "10px",
          background: iconBg,
          color: accentColor,
          flexShrink: 0,
          marginTop: "1px",
        }}
      >
        {isError ? (
          <AlertCircle size={18} aria-hidden="true" />
        ) : isSuccess ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : (
          <InfoIcon size={18} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, color: textColor, fontSize: "13.5px", lineHeight: "1.55" }}>
        {(title || (isError && !title)) && (
          <strong style={{ display: "block", fontSize: "14px", fontWeight: 700, lineHeight: "1.2", marginBottom: "3px", letterSpacing: "-0.01em" }}>
            {title || defaultTitle}
          </strong>
        )}
        <span style={{ fontWeight: 400 }}>{message}</span>
        {children && <div style={{ marginTop: "8px" }}>{children}</div>}
      </div>
    </div>
  );
}
