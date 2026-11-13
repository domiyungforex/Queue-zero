/**
 * Booking Notification Templates & Delivery Helpers
 * Generates formatted messages for booking confirmation, reminders, rescheduling,
 * cancellation, and queue check-in.
 */

export type BookingNotificationPayload = {
  serviceName: string;
  locationName: string;
  date: string;
  timeWindow: string;
  bookingReference: string;
  ticketNumber?: string;
  peopleAhead?: number;
};

export function getBookingConfirmationMessage(payload: BookingNotificationPayload): string {
  return [
    "Your booking is confirmed.",
    `Service: ${payload.serviceName}`,
    `Location: ${payload.locationName}`,
    `Date: ${payload.date}`,
    `Arrival window: ${payload.timeWindow}`,
    `Booking reference: ${payload.bookingReference}`,
    "Please arrive within your reserved window.",
  ].join("\n");
}

export function getBookingReminderMessage(payload: BookingNotificationPayload): string {
  return [
    "Your appointment is approaching.",
    `Your arrival window begins at ${payload.timeWindow} on ${payload.date}.`,
    `Service: ${payload.serviceName}`,
    `Reference: ${payload.bookingReference}`,
    "Please follow your booking instructions upon arrival.",
  ].join("\n");
}

export function getBookingRescheduledMessage(payload: BookingNotificationPayload): string {
  return [
    "Your booking has been updated.",
    `New date: ${payload.date}`,
    `New arrival window: ${payload.timeWindow}`,
    `Service: ${payload.serviceName}`,
    `Booking reference: ${payload.bookingReference}`,
  ].join("\n");
}

export function getBookingCancellationMessage(payload: BookingNotificationPayload): string {
  return [
    "Your booking has been cancelled.",
    `Service: ${payload.serviceName}`,
    `Date: ${payload.date} (${payload.timeWindow})`,
    `Reference: ${payload.bookingReference}`,
  ].join("\n");
}

export function getBookingCheckInMessage(payload: BookingNotificationPayload): string {
  return [
    "You've checked in successfully.",
    `Your queue ticket is ${payload.ticketNumber || "issued"}.`,
    payload.peopleAhead !== undefined ? `People ahead: ${payload.peopleAhead}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
