import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  if (!booking) notFound();

  return (
    <main className={styles.container}>
      <BookingConfirmation booking={booking} />
      <footer style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#9ca3af" }}>
        Powered by <strong>TuRnMaRk</strong>
      </footer>
    </main>
  );
}
