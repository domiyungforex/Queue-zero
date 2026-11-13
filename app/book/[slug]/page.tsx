import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBookingInfo } from "@/lib/booking/availability";
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
  if (!info || !info.booking_enabled) notFound();

  return (
    <main className={styles.container}>
      <CustomerBookingFlow info={info} />
      <footer style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 10, color: "#9ca3af" }}>
        Powered by <strong>TuRnMaRk</strong>
      </footer>
    </main>
  );
}
