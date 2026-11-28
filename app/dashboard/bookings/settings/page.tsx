import { redirect } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { fetchBookingSettings } from "@/lib/booking/staff-actions";
import { BookingSettingsForm } from "@/components/booking/booking-settings-form";
import { PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";

export default async function BookingSettingsPage() {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/dashboard/bookings");
  }

  const settings = await fetchBookingSettings();

  return (
    <>
      <Breadcrumbs items={[{ label: "Bookings", href: "/dashboard/bookings" }, { label: "Booking Settings" }]} />
      <PageHeading
        eyebrow="BOOKINGS"
        title="Booking Settings"
        description="Configure how customers can book time slots at your organization."
      />
      <BookingSettingsForm initial={settings} />
    </>
  );
}
