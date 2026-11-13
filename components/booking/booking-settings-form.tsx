"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Save } from "lucide-react";
import type { BookingSettings } from "@/lib/booking/types";
import { saveBookingSettings } from "@/lib/booking/staff-actions";

type Props = {
  initial: BookingSettings;
};

const DAY_LABELS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
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

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 20,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 750,
    color: "#111318",
  };

  const helpStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#73788a",
    marginTop: 2,
  };

  const inputStyle: React.CSSProperties = {
    minHeight: 44,
    border: "1.5px solid #dcd5d0",
    borderRadius: 10,
    padding: "0 12px",
    fontSize: 14,
    color: "#111318",
    background: "#fff",
    width: "100%",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "auto" as React.CSSProperties["appearance"],
  };

  return (
    <div className="settings-form" style={{ maxWidth: 640 }}>
      {message && (
        <p role="status" style={{ padding: "10px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 16, fontSize: 13, color: "#166534" }}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" style={{ padding: "10px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
          {error}
        </p>
      )}

      {/* Enabled Toggle */}
      <div style={fieldStyle}>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "#ff6b2b" }}
          />
          Online Booking Enabled
        </label>
        <span style={helpStyle}>When enabled, customers can book time slots from your public queue page.</span>
      </div>

      {/* Booking Type */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Booking Type</label>
        <select value={bookingType} onChange={(e) => setBookingType(e.target.value as typeof bookingType)} style={selectStyle}>
          <option value="SCHEDULED_ARRIVAL">Scheduled Arrival</option>
          <option value="SERVICE_APPOINTMENT">Service Appointment</option>
          <option value="FUTURE_QUEUE_RESERVATION">Future Queue Reservation</option>
        </select>
        <span style={helpStyle}>
          {bookingType === "SCHEDULED_ARRIVAL" && "Customers reserve an arrival window and check in on arrival."}
          {bookingType === "SERVICE_APPOINTMENT" && "Customers book a specific service time with optional staff."}
          {bookingType === "FUTURE_QUEUE_RESERVATION" && "Customers reserve capacity in a future queue."}
        </span>
      </div>

      {/* Operating Days */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Operating Days</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAY_LABELS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: operatingDays.includes(day.value) ? "2px solid #ff6b2b" : "1.5px solid #dcd5d0",
                background: operatingDays.includes(day.value) ? "#fff2eb" : "#fff",
                color: operatingDays.includes(day.value) ? "#e05318" : "#111318",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hours */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Opening Time</label>
          <input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Closing Time</label>
          <input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* Slot Interval + Capacity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Slot Interval (minutes)</label>
          <input type="number" value={slotInterval} onChange={(e) => setSlotInterval(Number(e.target.value))} min={5} max={240} step={5} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Max Capacity per Slot</label>
          <input type="number" value={maxCapacity} onChange={(e) => setMaxCapacity(Number(e.target.value))} min={1} max={500} style={inputStyle} />
          <span style={helpStyle}>How many customers can book the same time window.</span>
        </div>
      </div>

      {/* Advance booking */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Min Advance (minutes)</label>
          <input type="number" value={minAdvance} onChange={(e) => setMinAdvance(Number(e.target.value))} min={0} max={1440} style={inputStyle} />
          <span style={helpStyle}>Earliest booking before slot start time.</span>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Max Advance (days)</label>
          <input type="number" value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(Number(e.target.value))} min={1} max={90} style={inputStyle} />
          <span style={helpStyle}>How far ahead customers can book.</span>
        </div>
      </div>

      {/* Grace Period */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Arrival Grace Period (minutes)</label>
        <input type="number" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))} min={0} max={120} style={inputStyle} />
        <span style={helpStyle}>Extra time after slot starts for the customer to check in.</span>
      </div>

      {/* Allocation Mode */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Allocation Mode</label>
        <select value={allocationMode} onChange={(e) => setAllocationMode(e.target.value as typeof allocationMode)} style={selectStyle}>
          <option value="BOOKING_AND_WALK_IN">Booking + Walk-in</option>
          <option value="BOOKING_ONLY">Booking Only</option>
          <option value="WALK_IN_ONLY">Walk-in Only</option>
        </select>
      </div>

      {allocationMode === "BOOKING_AND_WALK_IN" && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Walk-in Reserved Capacity</label>
          <input type="number" value={walkinReserved} onChange={(e) => setWalkinReserved(Number(e.target.value))} min={0} max={100} style={inputStyle} />
          <span style={helpStyle}>Slots reserved per window for walk-in customers (not bookable).</span>
        </div>
      )}

      {/* Cancellation & Rescheduling */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={cancellationAllowed} onChange={(e) => setCancellationAllowed(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#ff6b2b" }} />
          Allow Cancellation
        </label>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={reschedulingAllowed} onChange={(e) => setReschedulingAllowed(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#ff6b2b" }} />
          Allow Rescheduling
        </label>
      </div>

      {/* Save */}
      <button
        type="button"
        disabled={isPending}
        onClick={handleSave}
        className="button-primary"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          minHeight: 48,
          fontSize: 15,
          fontWeight: 750,
        }}
      >
        {isPending ? (
          <>
            <RefreshCw size={16} className="animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Save size={16} /> Save Booking Settings
          </>
        )}
      </button>
    </div>
  );
}
