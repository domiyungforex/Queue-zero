"use client";
import { useRef, useState } from "react";
import { recordAttendance, type ScanResult } from "@/lib/school-student/actions";
import { attendanceConfirmation } from "@/lib/school-student/notifications";

export function StudentScan({ token, expired = false }: { token: string; expired?: boolean }) {
  const requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const busy = useRef(false);
  async function scan() {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const storageKey = `attendance-request:${token}`;
      // Keep one request across retries/reloads. Never generate a second mutation
      // merely because a response was lost on a slow network.
      try { requestId.current ??= sessionStorage.getItem(storageKey); } catch {}
      if (expired && !requestId.current) {
        setResult({ ok: false, expired: true, message: "This QR has expired and there is no previous scan to check. Scan the current classroom QR." });
        return;
      }
      requestId.current ??= crypto.randomUUID();
      try { sessionStorage.setItem(storageKey, requestId.current); } catch {}
      setResult(await recordAttendance({ token, requestId: requestId.current }));
    } catch { setResult({ ok: false, message: "Connection interrupted. Retry to check this same scan safely." }); }
    finally { busy.current = false; setPending(false); }
  }
  return <section className="space-y-5">
    {expired ? <p>This QR has expired. If you already confirmed this scan, you can check its saved result. Otherwise scan the current classroom QR.</p> : <p>Your first valid scan records arrival. A later, fresh QR records departure when your lecturer enables checkout.</p>}
    <p className="text-sm text-muted">A random browser identifier helps your school review possible shared-device attendance. It is not proof of physical presence.</p>
    {result && <div role={result.ok ? "status" : "alert"} className="rounded-2xl border border-line bg-canvas p-4"><strong>{result.ok && result.action ? attendanceConfirmation(result.action) : result.message}</strong>{result.ok && <p className="mt-2 text-sm">You can close this page. Scan the classroom QR again when you leave.</p>}</div>}
    {!result?.ok && !result?.expired && result?.action !== "BLOCKED" && <button className="button-primary w-full" disabled={pending} onClick={scan}>{pending ? "Recording…" : result ? "Retry this scan" : expired ? "Check previous scan" : "Confirm attendance scan"}</button>}
    {result?.expired && <p>Ask your lecturer to show the current QR and scan it again. Your sign-in remains active.</p>}
  </section>;
}
