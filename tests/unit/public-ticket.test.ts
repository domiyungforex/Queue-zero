import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/public", () => ({ createPublicSupabaseClient: () => ({ rpc }) }));
import { getPublicTicket } from "@/lib/queue/ticket";
import { publicTicketSchema } from "@/lib/validation/ticket";
import { publicTicketFixture as fixture } from "@/tests/fixtures/public-ticket";
const token = "82000000-0000-4000-8000-000000000001";
beforeEach(() => { rpc.mockResolvedValue({ data: [fixture], error: null }); });
describe("public ticket projection", () => {
  it("loads the deliberate public shape with only the opaque token", async () => {
    expect(await getPublicTicket(token)).toEqual(fixture);
    expect(rpc).toHaveBeenCalledWith("get_public_ticket", { p_token: token });
  });
  it("rejects malformed tokens before querying", async () => {
    expect(await getPublicTicket("../private")).toBeNull(); expect(rpc).not.toHaveBeenCalled();
  });
  it("handles unknown tokens without exposing provider details", async () => {
    rpc.mockResolvedValue({ data: [], error: null }); expect(await getPublicTicket(token)).toBeNull();
    rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE_DETAIL" } });
    await expect(getPublicTicket(token)).rejects.toThrow("We couldn’t load your ticket. Please try again.");
  });
  it.each(["customer_name", "phone", "id", "business_id", "customer_key"])("fails closed on accidental %s exposure", async (field) => {
    rpc.mockResolvedValue({ data: [{ ...fixture, [field]: "PRIVATE" }], error: null });
    await expect(getPublicTicket(token)).rejects.toThrow("Ticket details are temporarily unavailable.");
  });
  it("rejects inconsistent waiting position and misleading estimates", () => {
    expect(publicTicketSchema.safeParse({ ...fixture, people_ahead: null }).success).toBe(false);
    expect(publicTicketSchema.safeParse({ ...fixture, status: "completed" }).success).toBe(false);
    expect(publicTicketSchema.safeParse({ ...fixture, queue_status: "paused" }).success).toBe(false);
    expect(publicTicketSchema.safeParse({ ...fixture, people_ahead: -1 }).success).toBe(false);
    expect(publicTicketSchema.safeParse({ ...fixture, location_timezone: "invalid" }).success).toBe(false);
    expect(publicTicketSchema.safeParse({ ...fixture, queue_status: "paused", estimated_wait_seconds: null }).success).toBe(true);
  });
});
