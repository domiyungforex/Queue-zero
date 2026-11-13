"use client";

export default function BookingTokenError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ width: "min(100%,540px)", margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Booking not found</h1>
      <p style={{ color: "#73788a", fontSize: 14, marginBottom: 20 }}>
        We couldn&apos;t load your booking details. Your data is safe — please try again.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "12px 28px",
          borderRadius: 12,
          background: "linear-gradient(135deg,#ff6b2b,#ff4765)",
          color: "#fff",
          border: "none",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
}
