import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBookingInfo } from "@/lib/booking/availability";
import { getPublicQueue } from "@/lib/queue/public";
import { CustomerBookingFlow } from "@/components/booking/customer-booking-flow";
import styles from "@/components/booking/booking.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a Time — TuRnMaRk",
  robots: { index: false, follow: false },
};

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const info = await getPublicBookingInfo(slug);

  // Soft failure: queue may exist but booking is disabled or info is temporarily unavailable
  if (!info) {
    const queue = await getPublicQueue(slug);
    if (!queue) notFound();

    return (
      <main className={styles.container}>
        <article className={styles.card} style={{ maxWidth: 480, margin: "40px auto", padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Booking not available</h1>
          <p style={{ color: "#5e6d69", marginBottom: 12 }}>
            This queue does not currently accept advance bookings, or booking information could not be loaded.
          </p>
          <p style={{ color: "#5e6d69", marginBottom: 24, fontSize: 13 }}>
            Organization administrators can enable booking in Dashboard → Bookings → Settings.
          </p>
          <Link href={`/q/${slug}`} className="button-primary" style={{ display: "inline-flex" }}>
            Join the queue instead
          </Link>
        </article>
        <footer style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#9ca3af" }}>
          Powered by <strong>TuRnMaRk</strong>
        </footer>
      </main>
    );
  }

  if (!info.booking_enabled) {
    return (
      <main className={styles.container}>
        <article className={styles.card} style={{ maxWidth: 480, margin: "40px auto", padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Booking is currently closed</h1>
          <p style={{ color: "#5e6d69", marginBottom: 24 }}>
            {info.business_name} has turned off advance bookings for this service. You can still join the live queue.
          </p>
          <Link href={`/q/${slug}`} className="button-primary" style={{ display: "inline-flex" }}>
            Join the queue instead
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
      <CustomerBookingFlow info={info} />
      <footer style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#9ca3af" }}>
        Powered by <strong>TuRnMaRk</strong>
      </footer>
    </main>
  );
}
