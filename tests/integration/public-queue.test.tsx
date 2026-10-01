import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";
const mocks = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
// Any accidental authentication call is a regression for this customer route.
vi.mock("@clerk/nextjs/server", () => ({ auth: () => { throw new Error("Public page attempted authentication"); } }));
import { getPublicQueue } from "@/lib/queue/public";
import PublicQueuePage from "@/app/(public)/q/[slug]/page";
import { publicQueueFixture as fixture } from "@/tests/fixtures/public-queue";

let responseBody: unknown;
let status: number;
const requests: Request[] = [];
const cacheModes: (RequestCache | undefined)[] = [];
beforeEach(() => {
  responseBody = [fixture]; status = 200; requests.length = 0; cacheModes.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://queuezero.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-never-be-used");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    cacheModes.push(init?.cache);
    return new Response(JSON.stringify(responseBody), { status, headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public queue read boundary", () => {
  it("calls only the public RPC with the anon key and no Clerk identity", async () => {
    expect(await getPublicQueue(fixture.slug)).toEqual(fixture);
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url).pathname).toBe("/rest/v1/rpc/get_public_queue");
    expect(await requests[0].json()).toEqual({ p_slug: fixture.slug });
    expect(requests[0].headers.get("apikey")).toBe("sb_publishable_fixture");
    expect(requests[0].headers.get("authorization")).toBe("Bearer sb_publishable_fixture");
    expect(JSON.stringify([...requests[0].headers])).not.toContain("must-never-be-used");
    expect(cacheModes).toEqual(["no-store"]);
  });
  it("renders a valid queue without requiring a customer account", async () => {
    expect(isValidElement(await PublicQueuePage({ params: Promise.resolve({ slug: fixture.slug }) }))).toBe(true);
  });
  it("rejects invalid slugs without any database request", async () => {
    for (const slug of ["../other", "queue?private=true", "x".repeat(101)]) expect(await getPublicQueue(slug)).toBeNull();
    expect(requests).toHaveLength(0);
  });
  it("maps an unknown or inactive queue to not found", async () => {
    responseBody = [];
    await expect(PublicQueuePage({ params: Promise.resolve({ slug: fixture.slug }) })).rejects.toThrow("NOT_FOUND");
  });
  it("keeps infrastructure failure distinct from not found", async () => {
    status = 503; responseBody = { message: "private-provider-detail" };
    await expect(getPublicQueue(fixture.slug)).rejects.toThrow("couldn’t load this queue");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...fixture, customer_name: "PRIVATE_CUSTOMER" }],
    [{ ...fixture, phone: "PRIVATE_PHONE" }],
    [{ ...fixture, business_id: "PRIVATE_ID" }],
    [{ ...fixture, waiting_count: -1 }],
    [{ ...fixture, estimated_wait_seconds: null }],
    [{ ...fixture, status: "closed", estimated_wait_seconds: 300 }],
    [{ ...fixture, slug: "different-queue" }],
    [fixture, fixture],
    null,
  ].map((body) => ({ body })))("fails closed on unexpected public response %o", async ({ body }) => {
    responseBody = body;
    await expect(getPublicQueue(fixture.slug)).rejects.toThrow("temporarily unavailable");
  });
  it("loads a fresh snapshot on a subsequent request", async () => {
    expect((await getPublicQueue(fixture.slug))?.status).toBe("open");
    responseBody = [{ ...fixture, status: "paused", estimated_wait_seconds: null }];
    expect((await getPublicQueue(fixture.slug))?.status).toBe("paused");
    expect(cacheModes).toEqual(["no-store", "no-store"]);
  });
});
