export type AttendanceNotificationEventType =
  | "SESSION_OPENED"
  | "SESSION_SCHEDULED"
  | "SESSION_REOPENED"
  | "SESSION_RESCHEDULED"
  | "SESSION_CANCELLED"
  | "REMINDER_BEFORE_OPEN"
  | "REMINDER_BEFORE_CLOSE";

export interface EligibleAttendanceRecipient {
  studentId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  clerkUserId: string | null;
  departmentId: string | null;
  level: string | null;
}

export function formatAttendanceLocalTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBA";
  try {
    return new Intl.DateTimeFormat("en-NG", {
      timeZone: timeZone || "Africa/Lagos",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-NG", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  }
}

export function buildAttendanceNotificationMessage(params: {
  institutionName: string;
  courseCode: string;
  courseTitle: string;
  lecturerName: string;
  sessionTitle: string | null;
  venue: string | null;
  startsAt: string | null;
  closesAt: string | null;
  timezone: string;
  attendanceUrl: string;
  eventType: AttendanceNotificationEventType;
}) {
  const startText = formatAttendanceLocalTime(params.startsAt, params.timezone);
  const closeText = formatAttendanceLocalTime(params.closesAt, params.timezone);
  const label = params.sessionTitle ? `${params.courseCode} (${params.sessionTitle})` : params.courseCode;

  let headline = `Your ${label} attendance session is now open.`;
  if (params.eventType === "SESSION_SCHEDULED") {
    headline = `Your ${label} attendance session has been scheduled.`;
  } else if (params.eventType === "SESSION_REOPENED") {
    headline = `Your ${label} attendance session has been reopened.`;
  } else if (params.eventType === "SESSION_RESCHEDULED") {
    headline = `Your ${label} attendance session time or venue has been updated.`;
  } else if (params.eventType === "SESSION_CANCELLED") {
    headline = `Your ${label} attendance session has been cancelled.`;
  } else if (params.eventType === "REMINDER_BEFORE_OPEN") {
    headline = `Reminder: Your ${label} attendance session opens soon.`;
  } else if (params.eventType === "REMINDER_BEFORE_CLOSE") {
    headline = `Reminder: Your ${label} attendance session closes soon.`;
  }

  const lines = [
    `TuRnMaRk Attendance Notification — ${params.institutionName}`,
    "",
    headline,
    `Course: ${params.courseCode} — ${params.courseTitle}`,
    params.lecturerName ? `Lecturer: ${params.lecturerName}` : null,
    params.venue ? `Venue: ${params.venue}` : null,
    `Window: ${startText} – ${closeText} (${params.timezone || "Africa/Lagos"})`,
    params.eventType !== "SESSION_CANCELLED" && params.eventType !== "SESSION_SCHEDULED"
      ? `Check-in link: ${params.attendanceUrl}`
      : null,
  ].filter(Boolean);

  return {
    subject: `${params.courseCode} Attendance: ${
      params.eventType === "SESSION_CANCELLED"
        ? "Session Cancelled"
        : params.eventType === "SESSION_SCHEDULED"
          ? "Session Scheduled"
          : "Attendance Open"
    }`,
    title: `${params.courseCode} Attendance`,
    shortMessage: headline,
    body: lines.join("\n"),
  };
}

export function deduplicateRecipients(
  recipients: EligibleAttendanceRecipient[],
): EligibleAttendanceRecipient[] {
  const seen = new Set<string>();
  const unique: EligibleAttendanceRecipient[] = [];
  for (const r of recipients) {
    if (!r.studentId || seen.has(r.studentId)) continue;
    seen.add(r.studentId);
    unique.push(r);
  }
  return unique;
}
