import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ member: vi.fn(), protect: vi.fn(), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect: mocks.protect } }));
vi.mock("@/lib/business/membership", () => ({ requireBusinessMembership: mocks.member }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import { isValidElement } from "react";
import QueueQrPage from "@/app/dashboard/queues/[queueId]/qr/page";
import { getManagedQueue } from "@/lib/queue/management";
const queueId = "30000000-0000-4000-8000-000000000002";
let rows: { id: string; name: string }[];
let responseStatus: number;
let request: URL | undefined;
beforeEach(() => {
  rows = [{ id: queueId, name: "Consultation" }]; responseStatus = 200; request = undefined;
  mocks.member.mockResolvedValue({ businessId: "verified-business", role: "owner" });
  mocks.protect.mockResolvedValue({ userId: "user_verified", getToken: async () => "clerk-session" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://queuezero.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    request = new URL(new Request(input, init).url);
    return new Response(JSON.stringify(responseStatus === 200 ? rows : { message: "Unavailable" }), { status: responseStatus, headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("queue detail data boundary", () => {
  it("uses both the validated queue ID and current authorized tenant", async () => {
    expect((await getManagedQueue(queueId)).name).toBe("Consultation");
    expect(request?.searchParams.get("id")).toBe(`eq.${queueId}`);
    expect(request?.searchParams.get("business_id")).toBe("eq.verified-business");
  });
  it("rejects malformed IDs before querying the database", async () => {
    await expect(getManagedQueue("malformed")).rejects.toThrow("NOT_FOUND");
    expect(request).toBeUndefined();
  });
  it("treats inaccessible and missing queues identically", async () => {
    rows = [];
    await expect(getManagedQueue(queueId)).rejects.toThrow("NOT_FOUND");
  });
  it("does not confuse infrastructure failures with missing queues", async () => {
    responseStatus = 503;
    await expect(getManagedQueue(queueId)).rejects.toThrow("couldn’t load this queue");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe("authorized QR print route", () => {
  it("loads its queue through the same tenant-scoped boundary", async () => {
    expect(isValidElement(await QueueQrPage({ params: Promise.resolve({ queueId }) }))).toBe(true);
    expect(request?.searchParams.get("id")).toBe(`eq.${queueId}`);
    expect(request?.searchParams.get("business_id")).toBe("eq.verified-business");
  });
  it("returns not found for an inaccessible queue before rendering QR content", async () => {
    rows = [];
    await expect(QueueQrPage({ params: Promise.resolve({ queueId }) })).rejects.toThrow("NOT_FOUND");
  });
  it("requires membership before reading any queue data", async () => {
    mocks.member.mockRejectedValueOnce(new Error("Authentication required"));
    await expect(QueueQrPage({ params: Promise.resolve({ queueId }) })).rejects.toThrow("Authentication required");
    expect(request).toBeUndefined();
  });
});
