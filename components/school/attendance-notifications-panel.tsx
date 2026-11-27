"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { retryAttendanceNotificationsAction } from "@/lib/school/actions";
import type { AttendanceNotificationSummary } from "@/lib/school/attendance-notifications";

export function AttendanceNotificationsPanel({
  classId,
  summary,
}: {
  classId: string;
  summary: AttendanceNotificationSummary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRetry() {
    setBusy(true);
    setMessage("");
    try {
      const res = await retryAttendanceNotificationsAction(classId);
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      setMessage(res.message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5 space-y-4" aria-label="Attendance Notification Delivery">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#111318]">Student Notification Delivery</h2>
          <p className="text-xs text-neutral-600">
            Automatic alerts sent when the session opened. Notification failures never block student check-in.
          </p>
        </div>
        {summary.failed > 0 ? (
          <button type="button" disabled={busy} onClick={() => void handleRetry()} className="button-secondary">
            <RefreshCw size={15} aria-hidden="true" />
            {busy ? "Retrying…" : `Retry Failed (${summary.failed})`}
          </button>
        ) : null}
      </div>

      {message ? <p className="notice">{message}</p> : null}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-black/10 bg-[#fffaf7] p-3">
          <div className="text-xs font-semibold text-neutral-500">Eligible</div>
          <div className="mt-1 text-xl font-bold text-[#111318]">{summary.eligibleStudents}</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="text-xs font-semibold text-neutral-500">Queued</div>
          <div className="mt-1 text-xl font-bold text-[#111318]">{summary.queued}</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="text-xs font-semibold text-neutral-500">Sent</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{summary.sent}</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="text-xs font-semibold text-neutral-500">Delivered</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{summary.delivered}</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="text-xs font-semibold text-neutral-500">Failed</div>
          <div className="mt-1 text-xl font-bold text-red-700">{summary.failed}</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-3">
          <div className="text-xs font-semibold text-neutral-500">No Contact</div>
          <div className="mt-1 text-xl font-bold text-amber-700">{summary.missingContact}</div>
        </div>
      </div>
    </section>
  );
}
