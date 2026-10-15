import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: async () => ({ rpc: mocks.rpc }) }));
import { GET } from "@/app/api/school/classes/[classId]/qr/route";
import { validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceSecret } from "@/lib/qr/secret";
const classId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const issuedAt = "2026-10-04T10:00:00.000+00:00", expiresAt = "2026-10-04T12:00:00.000+00:00";
const request = () => GET(new Request("http://localhost:3000/api/qr"), { params: Promise.resolve({ classId }) });
beforeEach(() => { vi.stubEnv("ATTENDANCE_QR_SECRET", "s".repeat(64)); vi.setSystemTime(new Date("2026-10-04T10:01:00Z")); mocks.auth.mockResolvedValue({ userId: "lecturer" }); mocks.rpc.mockResolvedValue({ error: null, data: { organization_id: org, session_id: classId, nonce, issued_at: issuedAt, expires_at: expiresAt } }); });
describe("authorized stable class QR route", () => {
  it("signs the database-issued stable class token after staff authorization", async () => { const response = await request(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store"); const body = await response.json(); const payload = validateAttendanceToken(new URL(body.url).searchParams.get("token")!, attendanceSecret()); expect(payload).toMatchObject({ organization_id: org, session_id: classId, nonce }); expect(payload.expires_at - payload.issued_at).toBe(7200); expect(body.expiresAt).toBe(expiresAt); });
  it("does not issue for anonymous, unauthorized or cross-site callers", async () => { mocks.auth.mockResolvedValueOnce({ userId: null }); expect((await request()).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled(); mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } }); expect((await request()).status).toBe(403); const cross = await GET(new Request("http://localhost:3000/api/qr", { headers: { origin: "https://other.test", "sec-fetch-site": "cross-site" } }), { params: Promise.resolve({ classId }) }); expect(cross.status).toBe(403); });
  it("rejects mismatched database class and malformed identifiers", async () => { mocks.rpc.mockResolvedValueOnce({ error: null, data: { organization_id: org, session_id: org, nonce, issued_at: issuedAt, expires_at: expiresAt } }); expect((await request()).status).toBe(403); expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ classId: "bad" }) })).status).toBe(400); });
});
