import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), device: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/school-student/device", () => ({ attendanceDeviceHash: mocks.device }));
import { recordAttendance } from "@/lib/school-student/actions";
import { attendanceSecret } from "@/lib/qr/secret";
import { newAttendanceToken } from "@/lib/qr/rotation";
import { signAttendanceToken } from "@/lib/qr/signing";
const organization = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const session = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function input(now?: number) {
  const payload = newAttendanceToken(organization, session, now);
  return { token: signAttendanceToken(payload, attendanceSecret()), requestId: payload.nonce, fullName: "Ada Student", matricNumber: "PHY/26/001" };
}
beforeEach(() => {
  vi.stubEnv("ATTENDANCE_QR_SECRET", "s".repeat(64));
  mocks.device.mockReset().mockResolvedValue("opaque-device");
  mocks.rpc.mockReset().mockResolvedValue({ error: null, data: { ok: true, action: "CHECK_IN", status: "PRESENT", message: "Recorded" } });
});
describe("public attendance identity boundary", () => {
  it("uses signed QR scope plus supplied name and matric in the attendance RPC", async () => {
    const request = input();
    expect((await recordAttendance(request)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("school_scan_open", expect.objectContaining({
      p_organization_id: organization, p_class_id: session, p_full_name: "Ada Student",
      p_matric_number: "PHY/26/001", p_device_hash: "opaque-device", p_request_id: request.requestId,
    }));
  });
  it("rejects unexpected browser identity fields before database access", async () => {
    expect((await recordAttendance({ ...input(), student_id: organization })).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects expired QR before device or database work", async () => {
    const result = await recordAttendance(input(1000));
    expect(result.expired).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.device).not.toHaveBeenCalled();
  });
  it("sanitizes database failures", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const result = await recordAttendance(input());
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("database details");
  });
  it("returns authoritative blocked results without inventing another action", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { ok: false, action: "BLOCKED", status: "FLAGGED", message: "Already scanned" } });
    expect(await recordAttendance(input())).toEqual({ ok: false, action: "BLOCKED", status: "FLAGGED", message: "Already scanned" });
  });
});
