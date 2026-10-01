import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/public", () => ({ createPublicSupabaseClient: () => ({ rpc }) }));
import { getPublicJoinOptions, getTicketReceipt } from "@/lib/queue/join";
import { GET } from "@/app/(public)/q/[slug]/join/start/route";
const token = "72000000-0000-4000-8000-000000000001";
const receipt = { display_number: "A014", business_name: "Clinic", queue_name: "Consultation", status: "waiting" };
beforeEach(() => { rpc.mockResolvedValue({ data: [], error: null }); });
describe("public join boundaries", () => {
  it("rejects malformed public input without database access", async () => {
    expect(await getPublicJoinOptions("../private")).toBeNull();
    expect(await getTicketReceipt("invalid")).toBeNull(); expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a narrow receipt using only its opaque token", async () => {
    rpc.mockResolvedValue({ data: [receipt], error: null });
    expect(await getTicketReceipt(token)).toEqual(receipt);
    expect(rpc).toHaveBeenCalledWith("get_public_ticket_receipt", { p_token: token });
  });
  it("fails closed if a provider accidentally returns private fields", async () => {
    rpc.mockResolvedValue({ data: [{ ...receipt, phone: "PRIVATE_PHONE" }], error: null });
    await expect(getTicketReceipt(token)).rejects.toThrow("Ticket details are temporarily unavailable.");
  });
  it("does not leak provider error details", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "PRIVATE" } });
    await expect(getTicketReceipt(token)).rejects.toThrow("We couldn’t load your ticket. Please try again.");
  });
  it("starts an anonymous HttpOnly session without creating a ticket", async () => {
    const response = await GET(new NextRequest("https://queuezero.example/q/clinic/join/start"), { params: Promise.resolve({ slug: "clinic" }) });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/q/clinic/join?session=ready");
    const cookie = response.cookies.get("queuezero-customer");
    expect(cookie?.httpOnly).toBe(true); expect(cookie?.sameSite).toBe("lax");
    expect(response.headers.get("cache-control")).toBe("no-store"); expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps the browser origin when Next uses a bind address behind a proxy", async () => {
    const response = await GET(new NextRequest("http://0.0.0.0:3000/q/clinic/join/start", { headers: { host: "preview.example" } }), { params: Promise.resolve({ slug: "clinic" }) });
    expect(response.headers.get("location")).toBe("/q/clinic/join?session=ready");
  });
  it("preserves an existing valid session and rejects redirect injection", async () => {
    const response = await GET(new NextRequest("https://queuezero.example/q/clinic/join/start", { headers: { cookie: `queuezero-customer=${token}` } }), { params: Promise.resolve({ slug: "clinic" }) });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await GET(new NextRequest("https://queuezero.example/q/clinic/join/start"), { params: Promise.resolve({ slug: "//evil.example" }) })).status).toBe(404);
  });
});
