import { redirect } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { fetchStaffBookings, fetchStaffBookingMetrics } from "@/lib/booking/staff-actions";
import { StaffBookingTable } from "@/components/booking/staff-booking-table";
import { StatCard } from "@/components/ui/workspace";
import { Calendar, CheckCircle2, Clock3, UserX, XCircle } from "lucide-react";
import Link from "next/link";

export default async function BookingsDashboardPage({ searchParams }: { searchParams: Promise<{ date?: string; status?: string; q?: string }> }) {
  const membership = await requireBusinessMembership();
  if (membership.role === "student") redirect("/attend");

  const sp = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = sp.date || today;

  const [{ bookings, total }, metrics] = await Promise.all([
    fetchStaffBookings({
      date: sp.date || undefined,
      status: sp.status || undefined,
      search: sp.q || undefined,
      limit: 50,
      offset: 0,
    }),
    fetchStaffBookingMetrics(date),
  ]);

  const manager = membership.role === "owner" || membership.role === "admin";

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Bookings</h1>
          <p className="page-description">Manage customer advance bookings and scheduled arrivals.</p>
        </div>
        {manager && (
          <Link href="/dashboard/bookings/settings" className="button-primary" style={{ textDecoration: "none" }}>
            Booking Settings
          </Link>
        )}
      </div>

      <div className="metrics-grid">
        <StatCard label="Total today" value={metrics.total} icon={<Calendar size={18} />} />
        <StatCard label="Confirmed" value={metrics.confirmed} icon={<Clock3 size={18} />} />
        <StatCard label="Checked in" value={metrics.checked_in} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Cancelled" value={metrics.cancelled} icon={<XCircle size={18} />} />
        <StatCard label="No-shows" value={metrics.no_show} icon={<UserX size={18} />} />
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#73788a" }}>Date</label>
          <input
            type="date"
            name="date"
            defaultValue={sp.date || ""}
            style={{ minHeight: 40, border: "1.5px solid #dcd5d0", borderRadius: 10, padding: "0 10px", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#73788a" }}>Status</label>
          <select
            name="status"
            defaultValue={sp.status || ""}
            style={{ minHeight: 40, border: "1.5px solid #dcd5d0", borderRadius: 10, padding: "0 10px", fontSize: 13 }}
          >
            <option value="">All statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No-Show</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#73788a" }}>Search</label>
          <input
            type="text"
            name="q"
            defaultValue={sp.q || ""}
            placeholder="Name or reference"
            style={{ minHeight: 40, border: "1.5px solid #dcd5d0", borderRadius: 10, padding: "0 10px", fontSize: 13, minWidth: 180 }}
          />
        </div>
        <button
          type="submit"
          className="button-secondary"
          style={{ minHeight: 40, padding: "0 18px", fontSize: 12 }}
        >
          Filter
        </button>
      </form>

      <div className="panel" style={{ borderRadius: 16, border: "1px solid #eee7e3", overflow: "hidden" }}>
        <StaffBookingTable bookings={bookings} total={total} />
      </div>
    </>
  );
}
