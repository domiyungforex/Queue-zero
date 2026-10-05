"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { z } from "zod";

const qrResponse = z.object({ url: z.url(), expiresAt: z.iso.datetime() });

export function AttendanceQr({ classId }: { classId: string }) {
  const [qr, setQr] = useState<{ image: string; expiresAt: string } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadQr() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/school/classes/${classId}/qr`, { cache: "no-store" });
      if (!response.ok) throw new Error("QR unavailable");
      const value = qrResponse.parse(await response.json());
      if (Date.parse(value.expiresAt) <= Date.now()) throw new Error("QR expired");
      const image = await QRCode.toDataURL(value.url, {
        width: 384,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#003d32", light: "#ffffff" },
      });
      setQr({ image, expiresAt: value.expiresAt });
    } catch {
      setQr(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQr();
    // Intentionally no interval/polling: the class QR remains stable until
    // the lecturer explicitly regenerates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  return (
    <section className="school-qr" aria-label="Class attendance QR">
      <h2 className="text-xl font-semibold">Scan to record attendance</h2>

      {qr ? (
        <>
          <Image
            unoptimized
            src={qr.image}
            width={320}
            height={320}
            alt="QR for this class attendance"
          />
          <p className="text-sm text-muted">
            This QR stays the same until you regenerate it or end the class.
          </p>
        </>
      ) : (
        <p role="status">
          {loading
            ? "Preparing attendance QR…"
            : error
              ? "QR unavailable. Check your connection or class access."
              : "Attendance QR unavailable."}
        </p>
      )}

      <button
        className="button-secondary"
        type="button"
        disabled={loading}
        onClick={() => void loadQr()}
      >
        {loading ? "Generating…" : qr ? "Regenerate QR" : "Retry QR"}
      </button>

      <p className="text-sm text-muted">
        Regenerating invalidates the previous QR. Students do not need a QueueZero account; they enter their full name and matric number after scanning.
      </p>
    </section>
  );
}
