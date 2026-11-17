import type { Metadata } from "next";
import Link from "next/link";
import { getBookingByToken } from "@/lib/booking/actions";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import styles from "@/components/booking/booking.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your Booking — TuRnMaRk",
  robots: { index: false, follow: false },
};

export default async function BookingTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const booking = await getBookingByToken(token);

  if (!booking) {
    return (
      <main className={styles.container}>
        <article className={styles.card} style={{ maxWidth: 480, margin: "40px auto", padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Booking not found</h1>
          <p style={{ color: "#5e6d69", marginBottom: 24 }}>
            This booking link is invalid, has expired, or could not be loaded. Please check the link or contact the organization.
          </p>
          <Link href="/" className="button-primary" style={{ display: "inline-flex" }}>
            Back to home
          </Link>
        </article>
        <footer style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#9ca3af" }}>
          Powered by <strong>TuRnMaRk</strong>
        </footer>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <BookingConfirmation booking={booking} />
      <footer style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#9ca3af" }}>
        Powered by <strong>TuRnMaRk</strong>
      </footer>
    </main>
  );
}
