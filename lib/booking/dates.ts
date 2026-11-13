import type { PublicBookingInfo } from "./types";

export type SelectableDate = {
  date: string;
  label: string;
  dayName: string;
  available: boolean;
};

/**
 * Calculates selectable dates within the organization's horizon and operating days.
 * Pure utility function safe for both client and server components.
 */
export function getSelectableDates(info: PublicBookingInfo): SelectableDate[] {
  const dates: SelectableDate[] = [];
  const maxDays = info.max_advance_days || 14;
  const operatingDays = new Set(info.operating_days || [1, 2, 3, 4, 5]);

  // Use timezone from info
  const now = new Date();

  for (let i = 0; i <= maxDays; i++) {
    const target = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    // Format YYYY-MM-DD in target timezone
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: info.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatter.format(target);

    // Compute ISO day of week (1=Mon, 7=Sun)
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: info.timezone || "UTC",
      weekday: "short",
    });
    const dayName = dayFormatter.format(target);

    const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: info.timezone || "UTC",
      month: "short",
      day: "numeric",
    });
    const label = monthDayFormatter.format(target);

    // Get day index
    const weekdayIdx = target.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isoDow = weekdayIdx === 0 ? 7 : weekdayIdx;

    const available = operatingDays.has(isoDow);

    dates.push({
      date: dateStr,
      label,
      dayName,
      available,
    });
  }

  return dates;
}
