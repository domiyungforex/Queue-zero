"use client";

import { useState, useTransition } from "react";

export type DeleteResult = { ok: boolean; message: string };

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

type Props = {
  label: string;
  confirmLabel?: string;
  redirectTo?: string;
  onDelete: () => Promise<DeleteResult>;
  onResult?: (result: DeleteResult) => void;
};

export function DeleteConfirmButton({
  label,
  confirmLabel = "Confirm delete",
  redirectTo,
  onDelete,
  onResult,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const res = await onDelete();
              onResult?.(res);
              setConfirming(false);
              if (res.ok && typeof window !== "undefined") {
                if (redirectTo) {
                  window.location.assign(redirectTo);
                } else {
                  window.location.reload();
                }
              }
            });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            minHeight: "40px",
            padding: "8px 16px",
            borderRadius: "10px",
            border: 0,
            background: "#dc2626",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 700,
            cursor: pending ? "wait" : "pointer",
          }}
        >
          <TrashIcon />
          {pending ? "Deleting…" : confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          style={{
            minHeight: "40px",
            padding: "8px 14px",
            borderRadius: "10px",
            border: "1px solid #dfe5ee",
            background: "#ffffff",
            color: "#4c576c",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        minHeight: "42px",
        padding: "8px 16px",
        borderRadius: "11px",
        border: "1px solid #fecaca",
        background: "#fff5f5",
        color: "#b91c1c",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      <TrashIcon />
      {label}
    </button>
  );
}
