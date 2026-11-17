import "server-only";
import { createUserSupabaseClient } from "@/lib/db/server";

export type ReplayDomain = "ticket" | "booking" | "session";

export type ReplayEvent = {
  id: string;
  domain: ReplayDomain;
  subject_id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type ReplayResult = {
  domain: ReplayDomain;
  subject_id: string;
  events: ReplayEvent[];
  reconstructed_state: Record<string, unknown>;
};

const TICKET_STATE_TRANSITIONS: Record<string, string> = {
  joined: "waiting",
  called: "called",
  recalled: "called",
  completed: "completed",
  no_show: "no_show",
  cancelled: "cancelled",
};

const BOOKING_STATE_TRANSITIONS: Record<string, string> = {
  created: "CONFIRMED",
  confirmed: "CONFIRMED",
  checked_in: "CHECKED_IN",
  ticket_assigned: "WAITING",
  rescheduled: "CONFIRMED",
  cancelled: "CANCELLED",
  no_show: "NO_SHOW",
  completed: "COMPLETED",
  updated: "CONFIRMED",
};

function applyTicketEvent(state: Record<string, unknown>, event: ReplayEvent) {
  const next = TICKET_STATE_TRANSITIONS[event.event_type];
  if (next) state.status = next;
  state.last_event = event.event_type;
  state.last_event_at = event.occurred_at;
  if (event.event_type === "called") state.called_at = event.occurred_at;
  if (event.event_type === "completed") state.completed_at = event.occurred_at;
  return state;
}

function applyBookingEvent(state: Record<string, unknown>, event: ReplayEvent) {
  const next = BOOKING_STATE_TRANSITIONS[event.event_type];
  if (next) state.status = next;
  state.last_event = event.event_type;
  state.last_event_at = event.occurred_at;
  if (event.event_type === "checked_in") state.checked_in_at = event.occurred_at;
  if (event.event_type === "cancelled") state.cancelled_at = event.occurred_at;
  if (event.metadata && typeof event.metadata === "object") {
    Object.assign(state, event.metadata);
  }
  return state;
}

function applySessionEvent(state: Record<string, unknown>, event: ReplayEvent) {
  state.last_event = event.event_type;
  state.last_event_at = event.occurred_at;
  if (event.event_type === "ARRIVED" || event.event_type === "CHECKED_IN") {
    state.present = true;
    state.arrived_at = event.occurred_at;
  }
  if (event.event_type === "CHECKED_OUT" || event.event_type === "LEFT") {
    state.departed_at = event.occurred_at;
  }
  if (event.event_type === "FLAGGED") state.flagged = true;
  return state;
}

function reconstruct(domain: ReplayDomain, events: ReplayEvent[]): Record<string, unknown> {
  let state: Record<string, unknown> = { domain, event_count: events.length };
  for (const event of events) {
    if (domain === "ticket") state = applyTicketEvent(state, event);
    else if (domain === "booking") state = applyBookingEvent(state, event);
    else state = applySessionEvent(state, event);
  }
  return state;
}

export async function replayEvents(
  domain: ReplayDomain,
  subjectId: string,
  organizationId: string
): Promise<ReplayResult | null> {
  const db = await createUserSupabaseClient();

  let events: ReplayEvent[] = [];

  if (domain === "ticket") {
    const { data, error } = await db
      .from("ticket_events")
      .select("id, ticket_id, type, actor_type, actor_id, metadata, created_at")
      .eq("ticket_id", subjectId)
      .order("created_at", { ascending: true });
    if (error || !data) return null;
    events = data.map((row) => ({
      id: row.id,
      domain: "ticket",
      subject_id: row.ticket_id,
      event_type: row.type,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      occurred_at: row.created_at,
    }));
  } else if (domain === "booking") {
    const { data, error } = await db
      .from("booking_events")
      .select("id, booking_id, event_type, actor_type, actor_id, payload, created_at, organization_id")
      .eq("booking_id", subjectId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    if (error || !data) return null;
    events = data.map((row) => ({
      id: row.id,
      domain: "booking",
      subject_id: row.booking_id,
      event_type: row.event_type,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      metadata: (row.payload as Record<string, unknown>) ?? {},
      occurred_at: row.created_at,
    }));
  } else {
    const { data, error } = await db
      .from("presence_events")
      .select("id, session_id, event_type, actor_type, actor_id, metadata, occurred_at, organization_id")
      .eq("session_id", subjectId)
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: true });
    if (error || !data) return null;
    events = data.map((row) => ({
      id: row.id,
      domain: "session",
      subject_id: row.session_id ?? subjectId,
      event_type: row.event_type,
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      occurred_at: row.occurred_at,
    }));
  }

  return {
    domain,
    subject_id: subjectId,
    events,
    reconstructed_state: reconstruct(domain, events),
  };
}
