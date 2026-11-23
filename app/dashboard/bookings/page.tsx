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

      {/* Refined Unified Filters Bar */}
      <form
        method="GET"
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "20px",
          alignItems: "center",
          background: "#ffffff",
          border: "1px solid #f0e6e1",
          borderRadius: "18px",
          padding: "14px 18px",
          boxShadow: "0 6px 20px rgba(72,39,23,.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 200px" }}>
          <span style={{ color: "#9295a1", display: "grid", placeItems: "center" }}>
            <Calendar size={17} aria-hidden="true" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#8a8d9b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</span>
            <input
              type="date"
              name="date"
              defaultValue={sp.date || ""}
              style={{
                width: "100%",
                minHeight: "36px",
                border: "0",
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                fontWeight: 650,
                color: "#111318",
                padding: "2px 0",
              }}
            />
          </div>
        </div>

        <div style={{ width: "1px", height: "32px", background: "#f0e6e1" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 180px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#8a8d9b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
            <select
              name="status"
              defaultValue={sp.status || ""}
              style={{
                width: "100%",
                minHeight: "36px",
                border: "0",
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                fontWeight: 650,
                color: "#111318",
                padding: "2px 0",
                cursor: "pointer",
              }}
            >
              <option value="">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-Show</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div style={{ width: "1px", height: "32px", background: "#f0e6e1" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "2 1 240px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#8a8d9b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Search</span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q || ""}
              placeholder="Name or booking reference…"
              style={{
                width: "100%",
                minHeight: "36px",
                border: "0",
                outline: "none",
                background: "transparent",
                fontSize: "13px",
                fontWeight: 650,
                color: "#111318",
                padding: "2px 0",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="button-primary"
          style={{
            minHeight: "42px",
            padding: "0 20px",
            fontSize: "13px",
            fontWeight: 800,
            borderRadius: "12px",
            flexShrink: 0,
          }}
        >
          Apply Filters
        </button>
      </form>

      <div className="panel" style={{ borderRadius: 16, border: "1px solid #eee7e3", overflow: "hidden" }}>
        <StaffBookingTable bookings={bookings} total={total} />
      </div>
    </>
  );
}
