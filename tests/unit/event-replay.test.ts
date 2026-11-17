import { describe, it, expect } from "vitest";

// Pure reconstruction helpers for unit testing (no DB)
const TICKET_TRANSITIONS: Record<string, string> = {
  joined: "waiting",
  called: "called",
  recalled: "called",
  completed: "completed",
  no_show: "no_show",
  cancelled: "cancelled",
};

function reconstructTicket(events: { type: string; at: string }[]) {
  let status = "unknown";
  let last = "";
  for (const e of events) {
    status = TICKET_TRANSITIONS[e.type] ?? status;
    last = e.type;
  }
  return { status, last_event: last, count: events.length };
}

describe("Event replay reconstruction", () => {
  it("replays a normal ticket lifecycle", () => {
    const result = reconstructTicket([
      { type: "joined", at: "t1" },
      { type: "called", at: "t2" },
      { type: "completed", at: "t3" },
    ]);
    expect(result.status).toBe("completed");
    expect(result.last_event).toBe("completed");
    expect(result.count).toBe(3);
  });

  it("handles recall after call", () => {
    const result = reconstructTicket([
      { type: "joined", at: "t1" },
      { type: "called", at: "t2" },
      { type: "recalled", at: "t3" },
    ]);
    expect(result.status).toBe("called");
    expect(result.last_event).toBe("recalled");
  });

  it("ends on cancellation", () => {
    const result = reconstructTicket([
      { type: "joined", at: "t1" },
      { type: "cancelled", at: "t2" },
    ]);
    expect(result.status).toBe("cancelled");
  });
});
