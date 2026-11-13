import { redirect } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { fetchBookingSettings } from "@/lib/booking/staff-actions";
import { BookingSettingsForm } from "@/components/booking/booking-settings-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function BookingSettingsPage() {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/dashboard/bookings");
  }

  const settings = await fetchBookingSettings();

  return (
    <>
      <Link href="/dashboard/bookings" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft size={18} aria-hidden="true" />Bookings
      </Link>
      <div className="page-heading" style={{ marginTop: 8 }}>
        <div>
          <h1>Booking Settings</h1>
          <p className="page-description">Configure how customers can book time slots at your organization.</p>
        </div>
      </div>
      <BookingSettingsForm initial={settings} />
    </>
  );
}
