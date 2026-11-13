"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  RefreshCw,
  Ticket,
  User,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { PublicBooking } from "@/lib/booking/types";
import {
  checkInCustomerBooking,
  cancelCustomerBooking,
} from "@/lib/booking/actions";
import styles from "./booking.module.css";

type Props = { booking: PublicBooking };

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "Pending",     color: "#9a6700", bg: "#fff8e1" },
  CONFIRMED:   { label: "Confirmed",   color: "#166534", bg: "#dcfce7" },
  CHECKED_IN:  { label: "Checked In",  color: "#0369a1", bg: "#e0f2fe" },
  WAITING:     { label: "In Queue",    color: "#7c3aed", bg: "#f5f3ff" },
  CALLED:      { label: "Called",      color: "#e05318", bg: "#fff2eb" },
  IN_SERVICE:  { label: "Being Served",color: "#0891b2", bg: "#ecfeff" },
  COMPLETED:   { label: "Completed",   color: "#166534", bg: "#dcfce7" },
  CANCELLED:   { label: "Cancelled",   color: "#dc2626", bg: "#fef2f2" },
  RESCHEDULED: { label: "Rescheduled", color: "#9333ea", bg: "#faf5ff" },
  EXPIRED:     { label: "Expired",     color: "#78716c", bg: "#f5f5f4" },
  NO_SHOW:     { label: "No Show",     color: "#dc2626", bg: "#fef2f2" },
};

export function BookingConfirmation({ booking }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const status = STATUS_LABELS[booking.status] ?? { label: booking.status, color: "#6b7280", bg: "#f3f4f6" };
  const isTerminal = ["COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"].includes(booking.status);
  const canCheckIn = booking.can_check_in && booking.status === "CONFIRMED";
  const hasTicket = booking.ticket && booking.ticket.id;

  function handleCheckIn() {
    setErrorMsg("");
    startTransition(async () => {
      const result = await checkInCustomerBooking(booking.management_token);
      if (!result.ok) {
        setErrorMsg(result.message || "Could not complete check-in.");
        return;
      }
      if (result.ticket?.public_token) {
        router.push(`/ticket/${result.ticket.public_token}`);
      } else {
        router.refresh();
      }
    });
  }

  function handleCancel() {
    setErrorMsg("");
    startTransition(async () => {
      const result = await cancelCustomerBooking(booking.management_token, "Cancelled by customer");
      if (!result.ok) {
        setErrorMsg(result.message || "Could not cancel booking.");
        return;
      }
      setShowCancel(false);
      router.refresh();
    });
  }

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.badge}>
          <Calendar size={13} aria-hidden="true" />
          Booking Confirmation
        </span>
        <h1 className={styles.title}>{booking.service_name || booking.queue_name}</h1>
        <p className={styles.subtitle}>
          {booking.business_name} · {booking.location_name}
        </p>
      </header>

      <div className={styles.body}>
        {errorMsg && (
          <div className={styles.errorBanner} role="alert">
            {errorMsg}
          </div>
        )}

        {/* Status Pill */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 16px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 750,
              color: status.color,
              background: status.bg,
              border: `1px solid ${status.color}22`,
            }}
          >
            {booking.status === "CONFIRMED" && <CheckCircle2 size={14} />}
            {booking.status === "CANCELLED" && <XCircle size={14} />}
            {booking.status === "NO_SHOW" && <AlertTriangle size={14} />}
            {status.label}
          </span>
        </div>

        {/* Ticket Card after Check-in */}
        {hasTicket && (
          <div className={styles.ticketCard}>
            <p className={styles.ticketBadge}>Your Queue Ticket</p>
            <p className={styles.ticketNumber}>{booking.ticket!.display_number}</p>
            {booking.ticket!.people_ahead != null && (
              <p style={{ fontSize: 13, color: "#73788a" }}>
                {booking.ticket!.people_ahead === 0
                  ? "You're next!"
                  : `${booking.ticket!.people_ahead} ${booking.ticket!.people_ahead === 1 ? "person" : "people"} ahead of you`}
              </p>
            )}
            <a
              href={`/ticket/${booking.ticket!.public_token}`}
              className={styles.primaryButton}
              style={{ marginTop: 14, textDecoration: "none" }}
            >
              <Ticket size={16} /> Track live position
            </a>
          </div>
        )}

        {/* Booking Details */}
        <div className={styles.summaryBox}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              <Calendar size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
              Reference
            </span>
            <span className={styles.summaryValue}>{booking.booking_reference}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              <Calendar size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
              Date
            </span>
            <span className={styles.summaryValue}>{booking.booking_date}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              <Clock3 size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
              Arrival Window
            </span>
            <span className={styles.summaryValue}>
              {booking.start_time} – {booking.end_time}
            </span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              <MapPin size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
              Location
            </span>
            <span className={styles.summaryValue}>{booking.location_name}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              <User size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
              Name
            </span>
            <span className={styles.summaryValue}>{booking.customer_name}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              <Phone size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
              Phone
            </span>
            <span className={styles.summaryValue}>{booking.customer_phone}</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Timezone</span>
            <span className={styles.summaryValue}>{booking.timezone}</span>
          </div>
        </div>

        {/* Arrival Policy */}
        {!isTerminal && (
          <div
            style={{
              padding: "12px 14px",
              background: "#fff2eb",
              borderRadius: 12,
              border: "1px solid #ffd5c2",
              marginBottom: 20,
              fontSize: 12,
              color: "#9a3412",
              lineHeight: 1.6,
            }}
          >
            <strong>Arrival Policy:</strong> Please arrive during your booking window. You have a{" "}
            {booking.arrival_grace_minutes}-minute grace period to check in and receive your live
            queue ticket.
          </div>
        )}

        {/* Check-In Button */}
        {canCheckIn && !hasTicket && (
          <button
            className={styles.primaryButton}
            disabled={isPending}
            onClick={handleCheckIn}
            style={{ marginBottom: 12 }}
          >
            {isPending ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Checking in…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Check In Now
              </>
            )}
          </button>
        )}

        {/* Cancel Button */}
        {!isTerminal && !hasTicket && (
          <>
            {!showCancel ? (
              <button
                className={styles.dangerButton}
                disabled={isPending}
                onClick={() => setShowCancel(true)}
              >
                <XCircle size={16} /> Cancel Booking
              </button>
            ) : (
              <div
                style={{
                  border: "1px solid #fecaca",
                  borderRadius: 14,
                  padding: 16,
                  background: "#fef2f2",
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  Are you sure you want to cancel?
                </p>
                <p style={{ fontSize: 12, color: "#73788a", marginBottom: 14 }}>
                  This action cannot be undone. Your time slot will be released.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className={styles.secondaryButton}
                    disabled={isPending}
                    onClick={() => setShowCancel(false)}
                  >
                    Keep Booking
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={isPending}
                    onClick={handleCancel}
                  >
                    {isPending ? "Cancelling…" : "Yes, Cancel"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Terminal status message */}
        {isTerminal && (
          <div style={{ textAlign: "center", padding: "12px 0", fontSize: 13, color: "#73788a" }}>
            This booking is {booking.status.toLowerCase().replace("_", " ")}. No further actions available.
          </div>
        )}
      </div>
    </article>
  );
}
