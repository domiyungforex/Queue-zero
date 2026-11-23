"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  Check,
  Clock3,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { FeedbackNotice } from "@/components/school/feedback-notice";
import type { BookingSettings } from "@/lib/booking/types";
import { saveBookingSettings } from "@/lib/booking/staff-actions";

type Props = {
  initial: BookingSettings;
};

const DAY_LABELS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

export function BookingSettingsForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [enabled, setEnabled] = useState(initial.enabled);
  const [bookingType, setBookingType] = useState(initial.booking_type);
  const [operatingDays, setOperatingDays] = useState<number[]>(initial.operating_days);
  const [openingTime, setOpeningTime] = useState(initial.opening_time.slice(0, 5));
  const [closingTime, setClosingTime] = useState(initial.closing_time.slice(0, 5));
  const [slotInterval, setSlotInterval] = useState(initial.slot_interval_minutes);
  const [maxCapacity, setMaxCapacity] = useState(initial.max_capacity_per_slot);
  const [minAdvance, setMinAdvance] = useState(initial.min_advance_minutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initial.max_advance_days);
  const [gracePeriod, setGracePeriod] = useState(initial.arrival_grace_minutes);
  const [allocationMode, setAllocationMode] = useState(initial.allocation_mode);
  const [walkinReserved, setWalkinReserved] = useState(initial.walkin_reserved_capacity ?? 4);
  const [cancellationAllowed, setCancellationAllowed] = useState(initial.cancellation_allowed);
  const [reschedulingAllowed, setReschedulingAllowed] = useState(initial.rescheduling_allowed);

  function toggleDay(day: number) {
    setOperatingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleSave() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await saveBookingSettings({
        ...initial,
        enabled,
        booking_type: bookingType,
        operating_days: operatingDays,
        opening_time: openingTime.length === 5 ? openingTime + ":00" : openingTime,
        closing_time: closingTime.length === 5 ? closingTime + ":00" : closingTime,
        slot_interval_minutes: slotInterval,
        max_capacity_per_slot: maxCapacity,
        min_advance_minutes: minAdvance,
        max_advance_days: maxAdvanceDays,
        arrival_grace_minutes: gracePeriod,
        allocation_mode: allocationMode,
        walkin_reserved_capacity: walkinReserved,
        cancellation_allowed: cancellationAllowed,
        rescheduling_allowed: reschedulingAllowed,
      });
      if (result.ok) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    });
  }

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #f0e6e1",
    borderRadius: "20px",
    padding: "clamp(20px, 3vw, 28px)",
    boxShadow: "0 8px 30px rgba(72,39,23,.03)",
    display: "grid",
    gap: "20px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderBottom: "1px solid #f3ece8",
    paddingBottom: "12px",
  };

  const inputStyle: React.CSSProperties = {
    minHeight: "44px",
    border: "1.5px solid #e2dad5",
    borderRadius: "12px",
    padding: "0 14px",
    fontSize: "13.5px",
    fontWeight: 600,
    color: "#111318",
    background: "#ffffff",
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 750,
    color: "#111318",
  };

  const helpStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "#73788a",
    margin: "2px 0 0",
    lineHeight: "1.4",
  };

  return (
    <div style={{ display: "grid", gap: "24px", maxWidth: "880px" }}>
      {message && <FeedbackNotice ok={true} message={message} />}
      {error && <FeedbackNotice ok={false} message={error} />}

      {/* SECTION 1: Status & Service Model */}
      <section style={cardStyle} aria-labelledby="booking-status-heading">
        <div style={headerStyle}>
          <span style={{ display: "grid", width: "32px", height: "32px", placeItems: "center", borderRadius: "10px", background: "#fff0e8", color: "#ff6b2b" }}>
            <Calendar size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="booking-status-heading" style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#111318" }}>
              Public Availability & Booking Model
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#73788a" }}>
              Control whether guests can reserve appointments and how arrival windows are honored.
            </p>
          </div>
        </div>

        {/* Master Toggle Banner */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderRadius: "16px",
            background: enabled ? "#f7fcf9" : "#faf9f8",
            border: enabled ? "1.5px solid #a3e0bf" : "1.5px solid #e2dad5",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: "20px", height: "20px", accentColor: "#16855b", cursor: "pointer" }}
            />
            <div>
              <strong style={{ fontSize: "14px", color: enabled ? "#15945f" : "#111318", display: "block" }}>
                {enabled ? "Online Booking System Active" : "Online Bookings Paused"}
              </strong>
              <span style={{ fontSize: "12px", color: "#73788a" }}>
                {enabled ? "Customers can view open slots and confirm arrival times." : "The public booking calendar is hidden from customers."}
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: "999px",
              background: enabled ? "#dcfce7" : "#eee4df",
              color: enabled ? "#14532d" : "#73788a",
            }}
          >
            {enabled ? "ONLINE" : "OFFLINE"}
          </span>
        </label>

        {/* Booking Type + Allocation Mode */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Booking Type</label>
            <select
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value as typeof bookingType)}
              style={inputStyle}
            >
              <option value="SCHEDULED_ARRIVAL">Scheduled Arrival Window</option>
              <option value="SERVICE_APPOINTMENT">Specific Service Appointment</option>
              <option value="FUTURE_QUEUE_RESERVATION">Advance Queue Place Reservation</option>
            </select>
            <span style={helpStyle}>
              {bookingType === "SCHEDULED_ARRIVAL" && "Customers pick an arrival time window and check in directly upon arrival."}
              {bookingType === "SERVICE_APPOINTMENT" && "Customers book a dedicated service duration with an assigned station or staff member."}
              {bookingType === "FUTURE_QUEUE_RESERVATION" && "Customers claim their guaranteed place in a future queue before arriving."}
            </span>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Capacity Allocation Mode</label>
            <select
              value={allocationMode}
              onChange={(e) => setAllocationMode(e.target.value as typeof allocationMode)}
              style={inputStyle}
            >
              <option value="BOOKING_AND_WALK_IN">Hybrid: Advance Bookings + Walk-ins</option>
              <option value="BOOKING_ONLY">Strict: Advance Bookings Only</option>
              <option value="WALK_IN_ONLY">Walk-in Only (No Online Slots)</option>
            </select>
            <span style={helpStyle}>Choose whether on-site visitors can join queues alongside online bookings.</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: Weekly Schedule & Business Hours */}
      <section style={cardStyle} aria-labelledby="schedule-heading">
        <div style={headerStyle}>
          <span style={{ display: "grid", width: "32px", height: "32px", placeItems: "center", borderRadius: "10px", background: "#f0e9ff", color: "#7c3aed" }}>
            <Calendar size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="schedule-heading" style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#111318" }}>
              Operating Schedule & Hours
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#73788a" }}>
              Select which days of the week customers can book and set your daily window.
            </p>
          </div>
        </div>

        {/* Operating Days Selector */}
        <div style={{ display: "grid", gap: "8px" }}>
          <label style={labelStyle}>Open Booking Days</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: "8px" }}>
            {DAY_LABELS.map((day) => {
              const isActive = operatingDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "12px",
                    border: isActive ? "2px solid #ff6b2b" : "1.5px solid #e5ddd7",
                    background: isActive ? "linear-gradient(135deg, #fff2eb 0%, #ffe9de 100%)" : "#ffffff",
                    color: isActive ? "#d94b14" : "#4a4c54",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{day.short}</span>
                  <span style={{ fontSize: "9px", opacity: 0.75, fontWeight: 700 }}>
                    {isActive ? "ACTIVE" : "CLOSED"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Operating Times */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Opening / First Booking Window</label>
            <div style={{ position: "relative" }}>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <span style={helpStyle}>The earliest slot time available each day.</span>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Closing / Last Booking Window</label>
            <div style={{ position: "relative" }}>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <span style={helpStyle}>The time when bookings end each day.</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: Capacity & Slot Rules */}
      <section style={cardStyle} aria-labelledby="capacity-heading">
        <div style={headerStyle}>
          <span style={{ display: "grid", width: "32px", height: "32px", placeItems: "center", borderRadius: "10px", background: "#e8f3ff", color: "#2563eb" }}>
            <Clock3 size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="capacity-heading" style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#111318" }}>
              Slot Durations & Volume Controls
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#73788a" }}>
              Fine-tune booking interval lengths, customer limits, and buffer times.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Slot Interval (Minutes)</label>
            <input
              type="number"
              value={slotInterval}
              onChange={(e) => setSlotInterval(Number(e.target.value))}
              min={5}
              max={240}
              step={5}
              style={inputStyle}
            />
            <span style={helpStyle}>e.g. 15, 30, or 60 minute increments.</span>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Max Capacity per Slot</label>
            <input
              type="number"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(Number(e.target.value))}
              min={1}
              max={500}
              style={inputStyle}
            />
            <span style={helpStyle}>Maximum simultaneous customers allowed in each time slot.</span>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Minimum Advance Notice (Minutes)</label>
            <input
              type="number"
              value={minAdvance}
              onChange={(e) => setMinAdvance(Number(e.target.value))}
              min={0}
              max={1440}
              style={inputStyle}
            />
            <span style={helpStyle}>Lead time required before slot start (prevents last-minute bookings).</span>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Maximum Advance Booking Horizon (Days)</label>
            <input
              type="number"
              value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
              min={1}
              max={90}
              style={inputStyle}
            />
            <span style={helpStyle}>How many days in the future customers can look ahead.</span>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={labelStyle}>Arrival Grace Period (Minutes)</label>
            <input
              type="number"
              value={gracePeriod}
              onChange={(e) => setGracePeriod(Number(e.target.value))}
              min={0}
              max={120}
              style={inputStyle}
            />
            <span style={helpStyle}>Buffer time allowed after a slot starts before a customer is marked late or no-show.</span>
          </div>

          {allocationMode === "BOOKING_AND_WALK_IN" && (
            <div style={{ display: "grid", gap: "6px" }}>
              <label style={labelStyle}>Walk-in Reserved Buffer</label>
              <input
                type="number"
                value={walkinReserved}
                onChange={(e) => setWalkinReserved(Number(e.target.value))}
                min={0}
                max={100}
                style={inputStyle}
              />
              <span style={helpStyle}>Capacity held back from online booking strictly for on-site walk-ins.</span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: Customer Modification Policies */}
      <section style={cardStyle} aria-labelledby="policy-heading">
        <div style={headerStyle}>
          <span style={{ display: "grid", width: "32px", height: "32px", placeItems: "center", borderRadius: "10px", background: "#e8f8ef", color: "#16855b" }}>
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="policy-heading" style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#111318" }}>
              Cancellation & Rescheduling Policies
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#73788a" }}>
              Determine what customer self-service actions are permitted from their confirmation ticket.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px",
              borderRadius: "14px",
              border: "1.5px solid #e5ddd7",
              background: "#faf8f6",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={cancellationAllowed}
              onChange={(e) => setCancellationAllowed(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#ff6b2b", marginTop: "2px" }}
            />
            <div>
              <strong style={{ fontSize: "13px", color: "#111318", display: "block" }}>Allow Customer Cancellations</strong>
              <span style={{ fontSize: "11px", color: "#73788a" }}>
                Customers can cancel their upcoming slot directly from their digital ticket.
              </span>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px",
              borderRadius: "14px",
              border: "1.5px solid #e5ddd7",
              background: "#faf8f6",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={reschedulingAllowed}
              onChange={(e) => setReschedulingAllowed(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#ff6b2b", marginTop: "2px" }}
            />
            <div>
              <strong style={{ fontSize: "13px", color: "#111318", display: "block" }}>Allow Customer Rescheduling</strong>
              <span style={{ fontSize: "11px", color: "#73788a" }}>
                Customers can transfer their appointment to another open date or time window.
              </span>
            </div>
          </label>
        </div>
      </section>

      {/* Save Action Dock */}
      <div
        style={{
          position: "sticky",
          bottom: "16px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid #e2dad5",
          borderRadius: "18px",
          padding: "16px 22px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          zIndex: 10,
        }}
      >
        <div>
          <strong style={{ fontSize: "13.5px", color: "#111318", display: "block" }}>Save Configuration</strong>
          <span style={{ fontSize: "11px", color: "#73788a" }}>
            Changes will take effect immediately on public booking endpoints.
          </span>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="button-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            minHeight: "48px",
            padding: "0 28px",
            fontSize: "14px",
            fontWeight: 800,
            borderRadius: "14px",
          }}
        >
          {isPending ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> Saving Configuration…
            </>
          ) : (
            <>
              <Save size={16} /> Save All Booking Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
