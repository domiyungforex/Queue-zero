"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { BookingAvailabilitySlot, PublicBookingInfo } from "@/lib/booking/types";
import { getSelectableDates } from "@/lib/booking/dates";
import { createBooking } from "@/lib/booking/actions";
import styles from "./booking.module.css";

type Props = {
  info: PublicBookingInfo;
  initialSlots?: BookingAvailabilitySlot[];
};

export function CustomerBookingFlow({ info }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Multi-step: 1 = Date & Time, 2 = Customer Details, 3 = Review & Submit
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Available selectable dates
  const selectableDates = getSelectableDates(info);
  const firstAvailable = selectableDates.find((d) => d.available)?.date || selectableDates[0]?.date || "";

  // Selected values
  const [selectedDate, setSelectedDate] = useState<string>(firstAvailable);
  const [slots, setSlots] = useState<BookingAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingAvailabilitySlot | null>(null);

  // Customer Details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Load slots when date changes
  const handleSelectDate = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/booking/availability?slug=${encodeURIComponent(info.queue_slug)}&date=${encodeURIComponent(dateStr)}`);
      if (!res.ok) throw new Error("Could not load slots");
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setErrorMsg("Failed to load time windows. Please try again.");
    } finally {
      setLoadingSlots(false);
    }
  };

  // Step 1 to Step 2
  const handleProceedToDetails = () => {
    if (!selectedDate || !selectedSlot) {
      setErrorMsg("Please select a date and an available time window.");
      return;
    }
    setErrorMsg("");
    setStep(2);
  };

  // Step 2 to Step 3
  const handleProceedToReview = () => {
    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }
    setErrorMsg("");
    setStep(3);
  };

  // Final Submission
  const handleConfirmBooking = () => {
    if (!selectedSlot) return;
    setErrorMsg("");

    startTransition(async () => {
      const result = await createBooking({
        slug: info.queue_slug,
        date: selectedDate,
        startTime: selectedSlot.start_time,
        customerName: fullName,
        phone: phone,
        email: email || undefined,
      });

      if (!result.ok) {
        setErrorMsg(result.message);
        return;
      }

      router.push(`/booking/${result.managementToken}`);
    });
  };

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.badge}>
          <Calendar size={13} aria-hidden="true" />
          Advance Booking
        </span>
        <h1 className={styles.title}>{info.service_name || info.queue_name}</h1>
        <p className={styles.subtitle}>
          {info.business_name} · {info.location_name}
        </p>
      </header>

      {/* Progress Stepper */}
      <div className={styles.stepper} aria-label="Booking steps">
        <div className={`${styles.stepNode} ${step >= 1 ? styles.stepNodeActive : ""}`}>
          <span className={`${styles.stepNumber} ${step >= 1 ? styles.stepNumberActive : ""}`}>
            1
          </span>
          <span className={styles.stepLabel}>Time</span>
        </div>
        <div className={`${styles.stepConnector} ${step >= 2 ? styles.stepConnectorActive : ""}`} />
        <div className={`${styles.stepNode} ${step >= 2 ? styles.stepNodeActive : ""}`}>
          <span className={`${styles.stepNumber} ${step >= 2 ? styles.stepNumberActive : ""}`}>
            2
          </span>
          <span className={styles.stepLabel}>Details</span>
        </div>
        <div className={`${styles.stepConnector} ${step >= 3 ? styles.stepConnectorActive : ""}`} />
        <div className={`${styles.stepNode} ${step >= 3 ? styles.stepNodeActive : ""}`}>
          <span className={`${styles.stepNumber} ${step >= 3 ? styles.stepNumberActive : ""}`}>
            3
          </span>
          <span className={styles.stepLabel}>Confirm</span>
        </div>
      </div>

      <div className={styles.body}>
        {errorMsg && (
          <div className={styles.errorBanner} role="alert">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: DATE & TIME WINDOW */}
        {step === 1 && (
          <div>
            <h2 className={styles.sectionHeading}>1. Select Date</h2>
            <p className={styles.sectionHelp}>
              Choose an available day within the next {info.max_advance_days} days.
            </p>

            <div className={styles.dateScroll} role="radiogroup" aria-label="Available dates">
              {selectableDates.map((item) => (
                <button
                  type="button"
                  key={item.date}
                  disabled={!item.available}
                  className={`${styles.dateTile} ${
                    selectedDate === item.date ? styles.dateTileSelected : ""
                  }`}
                  onClick={() => handleSelectDate(item.date)}
                >
                  <span className={styles.dateDay}>{item.dayName}</span>
                  <span className={styles.dateLabel}>{item.label}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 className={styles.sectionHeading}>2. Select Arrival Window</h2>
                {loadingSlots && (
                  <span style={{ fontSize: 12, color: "#73788a", display: "flex", alignItems: "center", gap: 4 }}>
                    <RefreshCw size={12} className="animate-spin" /> Loading…
                  </span>
                )}
              </div>
              <p className={styles.sectionHelp}>
                Pick a time window. Your arrival window includes a {info.arrival_grace_minutes}-minute grace period.
              </p>

              {slots.length === 0 && !loadingSlots ? (
                <div style={{ textAlign: "center", padding: "28px 16px", background: "#fffaf7", borderRadius: 14, border: "1px dashed #dcd5d0" }}>
                  <p style={{ fontSize: 13, color: "#73788a", margin: 0 }}>
                    Please tap a date above to display available time slots.
                  </p>
                </div>
              ) : (
                <div className={styles.slotGrid}>
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start_time === slot.start_time;
                    return (
                      <button
                        type="button"
                        key={slot.start_time}
                        disabled={!slot.is_available}
                        className={`${styles.slotButton} ${
                          isSelected ? styles.slotButtonSelected : ""
                        }`}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setErrorMsg("");
                        }}
                      >
                        <span className={styles.slotTime}>
                          {slot.start_time} - {slot.end_time}
                        </span>
                        <span
                          className={`${styles.slotCap} ${
                            !slot.is_available ? styles.slotCapFull : ""
                          }`}
                        >
                          {slot.is_available
                            ? `${slot.available_capacity} left`
                            : "Full"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                disabled={!selectedSlot || !selectedSlot.is_available}
                className={styles.primaryButton}
                onClick={handleProceedToDetails}
              >
                Continue to Details <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMER DETAILS */}
        {step === 2 && (
          <div>
            <h2 className={styles.sectionHeading}>Your Details</h2>
            <p className={styles.sectionHelp}>
              Provide your details for your booking reservation and arrival check-in. No password required.
            </p>

            <div className={styles.formGroup}>
              <label htmlFor="customerName" className={styles.label}>
                Full Name *
              </label>
              <input
                id="customerName"
                type="text"
                className={styles.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Samuel Adekunle"
                autoComplete="name"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="customerPhone" className={styles.label}>
                Phone Number *
              </label>
              <input
                id="customerPhone"
                type="tel"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 803 123 4567"
                autoComplete="tel"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="customerEmail" className={styles.label}>
                Email Address (Optional)
              </label>
              <input
                id="customerEmail"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="samuel@example.com"
                autoComplete="email"
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setErrorMsg("");
                  setStep(1);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleProceedToReview}
              >
                Review Booking <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & CONFIRM */}
        {step === 3 && (
          <div>
            <h2 className={styles.sectionHeading}>Review & Confirm</h2>
            <p className={styles.sectionHelp}>
              Verify your booking details before confirming your arrival slot.
            </p>

            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Service</span>
                <span className={styles.summaryValue}>{info.service_name || info.queue_name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Location</span>
                <span className={styles.summaryValue}>{info.location_name}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Date</span>
                <span className={styles.summaryValue}>{selectedDate}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Arrival Window</span>
                <span className={styles.summaryValue}>
                  {selectedSlot?.start_time} - {selectedSlot?.end_time} ({info.timezone})
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Customer</span>
                <span className={styles.summaryValue}>{fullName}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Phone</span>
                <span className={styles.summaryValue}>{phone}</span>
              </div>
              {email && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Email</span>
                  <span className={styles.summaryValue}>{email}</span>
                </div>
              )}
            </div>

            <div style={{ padding: "12px 14px", background: "#fff2eb", borderRadius: 12, border: "1px solid #ffd5c2", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <ShieldCheck size={18} style={{ color: "#e05318", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.5 }}>
                  <strong>Arrival Policy:</strong> Please arrive during your window. You have a {info.arrival_grace_minutes}-minute grace period after your slot to check in and receive your live queue ticket.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isPending}
                onClick={() => {
                  setErrorMsg("");
                  setStep(2);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                disabled={isPending}
                className={styles.primaryButton}
                onClick={handleConfirmBooking}
              >
                {isPending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Reserving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirm Booking
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
