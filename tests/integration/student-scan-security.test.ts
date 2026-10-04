import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), device: vi.fn(), network: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/school-student/device", () => ({ attendanceDeviceHash: mocks.device, attendanceNetworkHash: mocks.network }));
import { recordAttendance } from "@/lib/school-student/actions";
import { attendanceSecret } from "@/lib/qr/secret";
import { signAttendanceToken } from "@/lib/qr/signing";
import type { AttendanceToken } from "@/lib/qr/token";
const organization = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", session = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", nonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function input(extra: Record<string, unknown> = {}) { const now = Math.floor(Date.now() / 1000); const payload: AttendanceToken = { version: 1, purpose: "CLASS_ATTENDANCE", organization_id: organization, session_id: session, nonce, issued_at: now - 30, expires_at: now + 3600 }; return { token: signAttendanceToken(payload, attendanceSecret()), requestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", fullName: "Akinyele Dominion", matricNumber: "PHY/2026/0142", ...extra }; }
beforeEach(() => { vi.stubEnv("ATTENDANCE_QR_SECRET", "s".repeat(64)); mocks.device.mockResolvedValue("a".repeat(64)); mocks.network.mockResolvedValue("b".repeat(64)); mocks.rpc.mockResolvedValue({ error: null, data: { ok: true, status: "PRESENT", message: "Attendance marked ✓", full_name: "Akinyele Dominion", matric_number: "PHY/2026/0142", course_code: "PHY 101", recorded_at: "2026-10-04T10:04:00Z" } }); });
describe("accountless attendance identity boundary", () => {
  it("passes only signed class context and entered roster fields to the controlled RPC", async () => { expect((await recordAttendance(input())).ok).toBe(true); expect(mocks.rpc).toHaveBeenCalledWith("school_attend_accountless", { p_organization_id: organization, p_class_id: session, p_nonce: nonce, p_full_name: "Akinyele Dominion", p_matric_number: "PHY/2026/0142", p_device_hash: "a".repeat(64), p_network_hash: "b".repeat(64), p_request_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }); });
  it("rejects browser-supplied student, course, status and timestamp fields", async () => { expect((await recordAttendance(input({ student_id: organization }))).ok).toBe(false); expect((await recordAttendance(input({ attendance_status: "PRESENT" }))).ok).toBe(false); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("rejects expired or cross-session tokens before database mutation", async () => { const now = Math.floor(Date.now() / 1000); const expired: AttendanceToken = { version: 1, purpose: "CLASS_ATTENDANCE", organization_id: organization, session_id: session, nonce, issued_at: now - 3600, expires_at: now - 1 }; expect((await recordAttendance({ ...input(), token: signAttendanceToken(expired, attendanceSecret()) })).status).toBe("CLOSED"); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("does not expose provider errors or invent a successful attendance state", async () => { mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private database details" } }); const result = await recordAttendance(input()); expect(result).toMatchObject({ ok: false, status: "UNAVAILABLE" }); expect(result.message).not.toContain("database details"); });
  it("returns authoritative duplicate and roster failures unchanged", async () => { mocks.rpc.mockResolvedValueOnce({ error: null, data: { ok: false, status: "DUPLICATE", message: "Your attendance has already been recorded for this class." } }); expect(await recordAttendance(input())).toMatchObject({ ok: false, status: "DUPLICATE" }); });
});
