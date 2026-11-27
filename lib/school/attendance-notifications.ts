import "server-only";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import {
  buildAttendanceNotificationMessage,
  deduplicateRecipients,
  formatAttendanceLocalTime,
  type AttendanceNotificationEventType,
  type EligibleAttendanceRecipient,
} from "./attendance-notification-format";

export {
  buildAttendanceNotificationMessage,
  deduplicateRecipients,
  formatAttendanceLocalTime,
  type AttendanceNotificationEventType,
  type EligibleAttendanceRecipient,
};

export type AttendanceRecipientMode =
  | "COURSE_ENROLLED"
  | "DEPARTMENT_LEVEL"
  | "SELECTED_STUDENTS"
  | "CUSTOM_GROUP";

export type AttendanceNotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";

export interface AttendanceNotificationSummary {
  eligibleStudents: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  missingContact: number;
}

type QueryResponse = Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
type SingleResponse = Promise<{ data: Record<string, unknown> | null; error: unknown }>;

type FilterChain = QueryResponse & {
  eq: (col: string, val: unknown) => FilterChain;
  in: (col: string, vals: unknown[]) => QueryResponse;
  maybeSingle: () => SingleResponse;
};

type UntypedDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => FilterChain;
      in: (col: string, vals: unknown[]) => QueryResponse;
    };
    insert: (rows: unknown) => Promise<{ error: unknown }>;
    update: (row: unknown) => {
      eq: (col: string, val: unknown) => FilterChain;
    };
  };
};

function getUntypedDb(): UntypedDb {
  return createJoinSupabaseClient() as unknown as UntypedDb;
}

export async function resolveEligibleAttendanceRecipients(params: {
  organizationId: string;
  courseId: string;
  recipientMode?: AttendanceRecipientMode;
  departmentId?: string | null;
  level?: string | null;
  selectedStudentIds?: string[];
}): Promise<EligibleAttendanceRecipient[]> {
  const db = getUntypedDb();
  const mode = params.recipientMode ?? "COURSE_ENROLLED";
  let candidateIds: string[] = [];

  if (mode === "SELECTED_STUDENTS" || mode === "CUSTOM_GROUP") {
    candidateIds = Array.from(new Set((params.selectedStudentIds ?? []).filter(Boolean)));
  } else if (mode === "DEPARTMENT_LEVEL") {
    const { data: people } = await db
      .from("people")
      .select("id,full_name,email,phone,clerk_user_id,department_id")
      .eq("organization_id", params.organizationId)
      .eq("person_type", "STUDENT");

    const rows = (people ?? []) as Array<Record<string, unknown>>;
    const filteredPeople = params.departmentId
      ? rows.filter((p) => String(p.department_id ?? "") === params.departmentId)
      : rows;
    candidateIds = filteredPeople.map((p) => String(p.id));
  } else {
    // Default: all students enrolled in the selected course (never restricted to prior attendees)
    const { data: enrollments } = await db
      .from("course_enrollments")
      .select("student_id")
      .eq("organization_id", params.organizationId)
      .eq("course_id", params.courseId);
    candidateIds = ((enrollments ?? []) as Array<{ student_id: string }>).map((e) => String(e.student_id));
  }

  if (candidateIds.length === 0) return [];

  const [peopleRes, profilesRes] = await Promise.all([
    db
      .from("people")
      .select("id,full_name,email,phone,clerk_user_id,department_id")
      .eq("organization_id", params.organizationId)
      .in("id", candidateIds),
    db
      .from("school_profiles")
      .select("id,level")
      .eq("organization_id", params.organizationId)
      .in("id", candidateIds),
  ]);

  const profileMap = new Map<string, string | null>(
    ((profilesRes.data ?? []) as Array<{ id: string; level?: string | null }>).map((p) => [
      String(p.id),
      p.level ?? null,
    ]),
  );

  const recipients: EligibleAttendanceRecipient[] = [];
  for (const row of (peopleRes.data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.id);
    const level = profileMap.get(id) ?? null;
    if (mode === "DEPARTMENT_LEVEL" && params.level && level !== params.level) {
      continue;
    }
    recipients.push({
      studentId: id,
      fullName: String(row.full_name ?? "Student"),
      email: row.email ? String(row.email).trim() : null,
      phone: row.phone ? String(row.phone).trim() : null,
      clerkUserId: row.clerk_user_id ? String(row.clerk_user_id) : null,
      departmentId: row.department_id ? String(row.department_id) : null,
      level,
    });
  }

  return deduplicateRecipients(recipients);
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, error: "Email provider (RESEND_API_KEY / RESEND_FROM_EMAIL) is not configured." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !json.id) {
      return { ok: false, error: json.message ?? `Email API returned ${res.status}` };
    }
    return { ok: true, messageId: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email request failed." };
  }
}

async function sendViaTwilioSms(params: {
  to: string;
  body: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) {
    return { ok: false, error: "SMS provider is not configured." };
  }
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({ To: params.to, From: from, Body: params.body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok || !json.sid) {
      return { ok: false, error: json.message ?? `SMS API returned ${res.status}` };
    }
    return { ok: true, messageId: json.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMS request failed." };
  }
}

async function sendViaWhatsApp(params: {
  to: string;
  body: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp Business API is not configured." };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to.replace(/[^\d+]/g, ""),
        type: "text",
        text: { body: params.body },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    const messageId = json.messages?.[0]?.id;
    if (!res.ok || !messageId) {
      return { ok: false, error: json.error?.message ?? `WhatsApp API returned ${res.status}` };
    }
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "WhatsApp request failed." };
  }
}

export async function dispatchAttendanceSessionNotifications(params: {
  organizationId: string;
  classSessionId: string;
  eventType: AttendanceNotificationEventType;
  recipientMode?: AttendanceRecipientMode;
  departmentId?: string | null;
  level?: string | null;
  selectedStudentIds?: string[];
  channels?: AttendanceNotificationChannel[];
  venue?: string | null;
  lecturerName?: string;
}): Promise<{ dispatched: number; failed: number; skippedNoContact: number }> {
  const db = getUntypedDb();
  const { data: session } = await db
    .from("class_sessions")
    .select("id,course_id,title,status,starts_at,attendance_closes_at,qr_token")
    .eq("id", params.classSessionId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!session) return { dispatched: 0, failed: 0, skippedNoContact: 0 };

  const sessionStatus = String(session.status ?? "DRAFT");
  if (sessionStatus === "DRAFT") {
    return { dispatched: 0, failed: 0, skippedNoContact: 0 };
  }
  if (
    (params.eventType === "SESSION_OPENED" || params.eventType === "SESSION_REOPENED") &&
    sessionStatus !== "OPEN"
  ) {
    return { dispatched: 0, failed: 0, skippedNoContact: 0 };
  }

  const [{ data: org }, { data: course }] = await Promise.all([
    db.from("businesses").select("name,timezone").eq("id", params.organizationId).maybeSingle(),
    db.from("courses").select("code,title").eq("id", session.course_id).maybeSingle(),
  ]);

  const recipients = await resolveEligibleAttendanceRecipients({
    organizationId: params.organizationId,
    courseId: String(session.course_id),
    recipientMode: params.recipientMode,
    departmentId: params.departmentId,
    level: params.level,
    selectedStudentIds: params.selectedStudentIds,
  });

  if (recipients.length === 0) return { dispatched: 0, failed: 0, skippedNoContact: 0 };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://turnmark.conchportal.com";
  const attendancePath = `/attend/${encodeURIComponent(String(session.qr_token ?? session.id))}`;
  const msg = buildAttendanceNotificationMessage({
    institutionName: String(org?.name ?? "TuRnMaRk"),
    courseCode: String(course?.code ?? "COURSE"),
    courseTitle: String(course?.title ?? ""),
    lecturerName: params.lecturerName ?? "",
    sessionTitle: session.title ? String(session.title) : null,
    venue: params.venue ?? null,
    startsAt: session.starts_at ? String(session.starts_at) : null,
    closesAt: session.attendance_closes_at ? String(session.attendance_closes_at) : null,
    timezone: String(org?.timezone ?? "Africa/Lagos"),
    attendanceUrl: `${baseUrl}${attendancePath}`,
    eventType: params.eventType,
  });

  const { data: existingDeliveries } = await db
    .from("attendance_notification_deliveries")
    .select("student_id,channel,status")
    .eq("class_session_id", params.classSessionId)
    .eq("event_type", params.eventType);

  const alreadySentKeys = new Set<string>();
  for (const row of (existingDeliveries ?? []) as Array<{ student_id?: string; channel?: string; status?: string }>) {
    if (row.student_id && row.channel && ["SENT", "DELIVERED", "QUEUED"].includes(String(row.status))) {
      alreadySentKeys.add(`${row.student_id}:${row.channel}`);
    }
  }

  const channels: AttendanceNotificationChannel[] = params.channels ?? ["IN_APP", "EMAIL"];
  let dispatched = 0;
  let failed = 0;
  let skippedNoContact = 0;

  for (const student of recipients) {
    for (const channel of channels) {
      if (alreadySentKeys.has(`${student.studentId}:${channel}`)) continue;

      const nowIso = new Date().toISOString();
      let status: "SENT" | "FAILED" | "SKIPPED_NO_CONTACT" = "FAILED";
      let provider = channel.toLowerCase();
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (channel === "IN_APP") {
        if (!student.clerkUserId) {
          status = "SKIPPED_NO_CONTACT";
          errorMessage = "Student has no registered in-app account.";
          skippedNoContact += 1;
        } else {
          const { error: notifErr } = await db.from("workspace_notifications").insert({
            business_id: params.organizationId,
            type: "attendance_session",
            title: msg.title,
            message: msg.shortMessage,
            href: attendancePath,
          });
          if (notifErr) {
            status = "FAILED";
            errorMessage = "Could not create in-app notification.";
            failed += 1;
          } else {
            status = "SENT";
            provider = "workspace_notifications";
            dispatched += 1;
          }
        }
      } else if (channel === "EMAIL") {
        if (!student.email) {
          status = "SKIPPED_NO_CONTACT";
          errorMessage = "Student has no email address on file.";
          skippedNoContact += 1;
        } else {
          const res = await sendViaResend({ to: student.email, subject: msg.subject, text: msg.body });
          provider = "resend";
          if (res.ok) {
            status = "SENT";
            providerMessageId = res.messageId;
            dispatched += 1;
          } else {
            status = "FAILED";
            errorMessage = res.error;
            failed += 1;
          }
        }
      } else if (channel === "SMS") {
        if (!student.phone) {
          status = "SKIPPED_NO_CONTACT";
          errorMessage = "Student has no phone number on file.";
          skippedNoContact += 1;
        } else {
          const res = await sendViaTwilioSms({ to: student.phone, body: msg.body });
          provider = "twilio";
          if (res.ok) {
            status = "SENT";
            providerMessageId = res.messageId;
            dispatched += 1;
          } else {
            status = "FAILED";
            errorMessage = res.error;
            failed += 1;
          }
        }
      } else if (channel === "WHATSAPP") {
        if (!student.phone) {
          status = "SKIPPED_NO_CONTACT";
          errorMessage = "Student has no WhatsApp phone number on file.";
          skippedNoContact += 1;
        } else {
          const res = await sendViaWhatsApp({ to: student.phone, body: msg.body });
          provider = "whatsapp_cloud";
          if (res.ok) {
            status = "SENT";
            providerMessageId = res.messageId;
            dispatched += 1;
          } else {
            status = "FAILED";
            errorMessage = res.error;
            failed += 1;
          }
        }
      }

      await db.from("attendance_notification_deliveries").insert({
        organization_id: params.organizationId,
        class_session_id: params.classSessionId,
        student_id: student.studentId,
        recipient_name: student.fullName,
        recipient_email: student.email,
        recipient_phone: student.phone,
        channel,
        event_type: params.eventType,
        status,
        provider,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
        attempts: 1,
        sent_at: status === "SENT" ? nowIso : null,
        updated_at: nowIso,
      });
    }
  }

  return { dispatched, failed, skippedNoContact };
}

export async function cancelPendingAttendanceReminders(classSessionId: string) {
  try {
    const db = getUntypedDb();
    await db
      .from("attendance_notification_deliveries")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("class_session_id", classSessionId)
      .eq("status", "QUEUED");
  } catch {
    // Non-blocking
  }
}

export async function retryFailedAttendanceNotifications(organizationId: string, classSessionId: string) {
  const db = getUntypedDb();
  const { data: failedRows } = await db
    .from("attendance_notification_deliveries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("class_session_id", classSessionId)
    .eq("status", "FAILED");

  const rows = (failedRows ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return { retried: 0, succeeded: 0, failed: 0 };

  const { data: session } = await db
    .from("class_sessions")
    .select("id,course_id,title,starts_at,attendance_closes_at,qr_token")
    .eq("id", classSessionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!session) return { retried: 0, succeeded: 0, failed: 0 };

  const [{ data: org }, { data: course }] = await Promise.all([
    db.from("businesses").select("name,timezone").eq("id", organizationId).maybeSingle(),
    db.from("courses").select("code,title").eq("id", session.course_id).maybeSingle(),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://turnmark.conchportal.com";
  const attendanceUrl = `${baseUrl}/attend/${encodeURIComponent(String(session.qr_token ?? session.id))}`;
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const channel = String(row.channel) as AttendanceNotificationChannel;
    const eventType = String(row.event_type) as AttendanceNotificationEventType;
    const msg = buildAttendanceNotificationMessage({
      institutionName: String(org?.name ?? "TuRnMaRk"),
      courseCode: String(course?.code ?? "COURSE"),
      courseTitle: String(course?.title ?? ""),
      lecturerName: "",
      sessionTitle: session.title ? String(session.title) : null,
      venue: null,
      startsAt: session.starts_at ? String(session.starts_at) : null,
      closesAt: session.attendance_closes_at ? String(session.attendance_closes_at) : null,
      timezone: String(org?.timezone ?? "Africa/Lagos"),
      attendanceUrl,
      eventType,
    });

    let result: { ok: true; messageId: string } | { ok: false; error: string } = {
      ok: false,
      error: "Unsupported channel",
    };

    if (channel === "EMAIL" && row.recipient_email) {
      result = await sendViaResend({ to: String(row.recipient_email), subject: msg.subject, text: msg.body });
    } else if (channel === "SMS" && row.recipient_phone) {
      result = await sendViaTwilioSms({ to: String(row.recipient_phone), body: msg.body });
    } else if (channel === "WHATSAPP" && row.recipient_phone) {
      result = await sendViaWhatsApp({ to: String(row.recipient_phone), body: msg.body });
    }

    const nowIso = new Date().toISOString();
    if (result.ok) {
      succeeded += 1;
      await db
        .from("attendance_notification_deliveries")
        .update({
          status: "SENT",
          provider_message_id: result.messageId,
          error_message: null,
          attempts: Number(row.attempts ?? 1) + 1,
          sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", row.id);
    } else {
      failed += 1;
      await db
        .from("attendance_notification_deliveries")
        .update({
          error_message: result.error,
          attempts: Number(row.attempts ?? 1) + 1,
          updated_at: nowIso,
        })
        .eq("id", row.id);
    }
  }

  return { retried: rows.length, succeeded, failed };
}

export async function getAttendanceNotificationSummary(
  organizationId: string,
  classSessionId: string,
): Promise<AttendanceNotificationSummary> {
  try {
    const db = getUntypedDb();
    const { data } = await db
      .from("attendance_notification_deliveries")
      .select("student_id,status")
      .eq("organization_id", organizationId)
      .eq("class_session_id", classSessionId);

    const rows = (data ?? []) as Array<{ student_id?: string | null; status?: string }>;
    const uniqueStudents = new Set(rows.map((r) => r.student_id).filter(Boolean));
    return {
      eligibleStudents: uniqueStudents.size,
      queued: rows.filter((r) => r.status === "QUEUED").length,
      sent: rows.filter((r) => r.status === "SENT").length,
      delivered: rows.filter((r) => r.status === "DELIVERED").length,
      failed: rows.filter((r) => r.status === "FAILED").length,
      missingContact: rows.filter((r) => r.status === "SKIPPED_NO_CONTACT").length,
    };
  } catch {
    return { eligibleStudents: 0, queued: 0, sent: 0, delivered: 0, failed: 0, missingContact: 0 };
  }
}
