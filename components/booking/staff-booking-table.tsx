"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  CheckCircle2,
  Eye,
  MoreHorizontal,
  UserX,
  XCircle,
} from "lucide-react";
import type { StaffBookingItem } from "@/lib/booking/staff-actions";
import { FeedbackNotice } from "@/components/school/feedback-notice";
import {
  staffCheckInBooking,
  staffCancelBooking,
  staffMarkNoShow,
} from "@/lib/booking/staff-actions";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PENDING:     { color: "#9a6700", bg: "#fff8e1" },
  CONFIRMED:   { color: "#166534", bg: "#dcfce7" },
  CHECKED_IN:  { color: "#0369a1", bg: "#e0f2fe" },
  WAITING:     { color: "#7c3aed", bg: "#f5f3ff" },
  COMPLETED:   { color: "#166534", bg: "#dcfce7" },
  CANCELLED:   { color: "#dc2626", bg: "#fef2f2" },
  EXPIRED:     { color: "#78716c", bg: "#f5f5f4" },
  NO_SHOW:     { color: "#dc2626", bg: "#fef2f2" },
};

type Props = {
  bookings: StaffBookingItem[];
  total: number;
};

export function StaffBookingTable({ bookings: initial, total }: Props) {
  const [bookings, setBookings] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleAction(action: "check_in" | "cancel" | "no_show", bookingId: string) {
    setMessage("");
    startTransition(async () => {
      let result: { ok: boolean; message: string };
      if (action === "check_in") {
        result = await staffCheckInBooking(bookingId);
      } else if (action === "cancel") {
        result = await staffCancelBooking(bookingId, "Cancelled by staff");
      } else {
        result = await staffMarkNoShow(bookingId);
      }
      setMessage(result.message);
      if (result.ok) {
        setExpandedId(null);
        // Optimistic update
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  status:
                    action === "check_in" ? "CHECKED_IN" :
                    action === "cancel" ? "CANCELLED" : "NO_SHOW",
                }
              : b
          )
        );
      }
    });
  }

  if (!bookings.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#73788a" }}>
        <Calendar size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No bookings found</h3>
        <p style={{ fontSize: 13 }}>Adjust filters or wait for new bookings to arrive.</p>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div style={{ marginBottom: 16 }}>
          <FeedbackNotice ok={!message.toLowerCase().includes("fail") && !message.toLowerCase().includes("error")} message={message} />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #eee7e3",
                textAlign: "left",
                fontSize: 11,
                fontWeight: 700,
                color: "#73788a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th style={{ padding: "10px 12px" }}>Ref</th>
              <th style={{ padding: "10px 12px" }}>Customer</th>
              <th style={{ padding: "10px 12px" }}>Date</th>
              <th style={{ padding: "10px 12px" }}>Window</th>
              <th style={{ padding: "10px 12px" }}>Service</th>
              <th style={{ padding: "10px 12px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Ticket</th>
              <th style={{ padding: "10px 8px", width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const statusStyle = STATUS_COLORS[b.status] ?? { color: "#6b7280", bg: "#f3f4f6" };
              const expanded = expandedId === b.id;
              return (
                <tr
                  key={b.id}
                  style={{
                    borderBottom: "1px solid #f3e6de",
                    verticalAlign: "top",
                  }}
                >
                  <td style={{ padding: "12px", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>
                    {b.booking_reference}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <strong style={{ display: "block" }}>{b.customer_name}</strong>
                    <span style={{ fontSize: 11, color: "#73788a" }}>{b.customer_phone}</span>
                  </td>
                  <td style={{ padding: "12px", whiteSpace: "nowrap" }}>{b.booking_date}</td>
                  <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                    {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ fontSize: 12 }}>{b.service_name || b.queue_name}</span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 700,
                        color: statusStyle.color,
                        background: statusStyle.bg,
                      }}
                    >
                      {b.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: "12px", fontSize: 12 }}>
                    {b.ticket_number || "—"}
                  </td>
                  <td style={{ padding: "12px", position: "relative" }}>
                    <button
                      onClick={() => setExpandedId(expanded ? null : b.id)}
                      aria-label={`Actions for ${b.booking_reference}`}
                      style={{
                        width: 32,
                        height: 32,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 8,
                        border: "1px solid #eee7e3",
                        background: expanded ? "#fff2eb" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {expanded && (
                      <div
                        style={{
                          position: "absolute",
                          right: 12,
                          top: 44,
                          zIndex: 10,
                          width: 180,
                          background: "#fff",
                          border: "1px solid #eee7e3",
                          borderRadius: 10,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                          padding: 6,
                        }}
                      >
                        {b.status === "CONFIRMED" && (
                          <button
                            disabled={isPending}
                            onClick={() => handleAction("check_in", b.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "8px 10px",
                              border: "none",
                              background: "transparent",
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            <CheckCircle2 size={14} /> Check In
                          </button>
                        )}
                        {b.status === "CONFIRMED" && (
                          <button
                            disabled={isPending}
                            onClick={() => handleAction("no_show", b.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "8px 10px",
                              border: "none",
                              background: "transparent",
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: "pointer",
                              color: "#9a3412",
                            }}
                          >
                            <UserX size={14} /> Mark No-Show
                          </button>
                        )}
                        {!["CANCELLED", "COMPLETED", "NO_SHOW", "EXPIRED"].includes(b.status) && (
                          <button
                            disabled={isPending}
                            onClick={() => handleAction("cancel", b.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "8px 10px",
                              border: "none",
                              background: "transparent",
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: "pointer",
                              color: "#dc2626",
                            }}
                          >
                            <XCircle size={14} /> Cancel
                          </button>
                        )}
                        <button
                          onClick={() => {
                            window.open(`/booking/${b.management_token}`, "_blank");
                            setExpandedId(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "8px 10px",
                            border: "none",
                            background: "transparent",
                            borderRadius: 6,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          <Eye size={14} /> View Details
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 0",
          fontSize: 12,
          color: "#73788a",
        }}
      >
        <span>
          Showing {bookings.length} of {total} booking{total !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
