"use client";

import { useRef, useState } from "react";
import { recordAttendance, type ScanResult } from "@/lib/school-student/actions";
import { attendanceConfirmation } from "@/lib/school-student/notifications";

export function StudentScan({ token, expired = false }: { token: string; expired?: boolean }) {
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");

  async function scan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || expired) return;

    const name = fullName.trim();
    const matric = matricNumber.trim();
    if (!name || !matric) {
      setResult({ ok: false, message: "Enter your full name and matric number." });
      return;
    }

    busy.current = true;
    setPending(true);
    setResult(null);

    try {
      const identityKey = name.toLowerCase() + "|" + matric.toUpperCase();
      const storageKey = "attendance-request:" + token + ":" + identityKey;
      try {
        requestId.current ??= sessionStorage.getItem(storageKey);
      } catch {}

      requestId.current ??= crypto.randomUUID();

      try {
        sessionStorage.setItem(storageKey, requestId.current);
      } catch {}

      setResult(
        await recordAttendance({
          token,
          requestId: requestId.current,
          fullName: name,
          matricNumber: matric,
        }),
      );
    } catch {
      setResult({ ok: false, message: "Connection interrupted. Try this scan again." });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (expired) {
    return (
      <section className="space-y-4">
        <p role="alert">This QR has expired. Scan the current classroom QR to mark attendance.</p>
      </section>
    );
  }

  return (
    <form className="space-y-5" onSubmit={scan}>
      <div>
        <label htmlFor="attendance-name" className="block text-sm font-semibold">Full name</label>
        <input
          id="attendance-name"
          name="fullName"
          className="mt-2 min-h-12 w-full rounded-xl border border-line px-3"
          autoComplete="name"
          maxLength={160}
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            requestId.current = null;
          }}
          placeholder="Your full name"
          required
        />
      </div>

      <div>
        <label htmlFor="attendance-matric" className="block text-sm font-semibold">Matric number</label>
        <input
          id="attendance-matric"
          name="matricNumber"
          className="mt-2 min-h-12 w-full rounded-xl border border-line px-3 uppercase"
          autoCapitalize="characters"
          maxLength={80}
          value={matricNumber}
          onChange={(event) => {
            setMatricNumber(event.target.value);
            requestId.current = null;
          }}
          placeholder="e.g. PHY/26/001"
          required
        />
      </div>

      <p className="text-sm leading-relaxed text-muted">
        Your first valid scan records arrival. If your class uses checkout, scan a fresh QR later with the same name and matric number.
      </p>

      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className="rounded-2xl border border-line bg-canvas p-4"
        >
          <strong>{result.ok && result.action ? attendanceConfirmation(result.action) : result.message}</strong>
          {result.ok && <p className="mt-2 text-sm">Attendance is saved. You can close this page.</p>}
        </div>
      )}

      {!result?.ok && result?.action !== "BLOCKED" && (
        <button className="button-primary w-full" disabled={pending} type="submit">
          {pending ? "Recording…" : result ? "Try again" : "Mark attendance"}
        </button>
      )}
    </form>
  );
}
