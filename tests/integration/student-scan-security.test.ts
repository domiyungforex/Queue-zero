import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), rpc: vi.fn(), device: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: mocks.user }));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/school-student/device", () => ({ attendanceDeviceHash: mocks.device }));
import { recordAttendance } from "@/lib/school-student/actions";
import { attendanceSecret } from "@/lib/qr/secret";
import { newAttendanceToken } from "@/lib/qr/rotation";
import { signAttendanceToken } from "@/lib/qr/signing";
const organization = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", session = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function input(now?: number) { const payload = newAttendanceToken(organization,session,now); return { token: signAttendanceToken(payload,attendanceSecret()), requestId: payload.nonce }; }
beforeEach(() => {
  vi.stubEnv("ATTENDANCE_QR_SECRET", "s".repeat(64));
  mocks.auth.mockResolvedValue({ userId: "user_verified" });
  mocks.user.mockResolvedValue({ id: "user_verified", emailAddresses: [{emailAddress:"student@school.test",verification:{status:"verified"}}] });
  mocks.device.mockResolvedValue("opaque-device");
  mocks.rpc.mockImplementation(async (name: string) => ({ error:null,data:name === "school_claim_student" ? {id:"student-db"} : {ok:true,action:"CHECK_IN",status:"PRESENT",message:"Recorded"} }));
});
describe("attendance identity boundary", () => {
  it("uses only authenticated identity and verified email in privileged calls", async () => {
    const request = input();
    expect((await recordAttendance(request)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1,"school_claim_student",{p_organization_id:organization,p_user_id:"user_verified",p_verified_email:"student@school.test"});
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"school_scan",expect.objectContaining({p_class_id:session,p_user_id:"user_verified",p_device_hash:"opaque-device",p_request_id:request.requestId}));
  });
  it("rejects unauthenticated, unverified and impersonated users before service writes", async () => {
    mocks.auth.mockResolvedValueOnce({userId:null}); expect((await recordAttendance(input())).ok).toBe(false);
    mocks.user.mockResolvedValueOnce({id:"user_other",emailAddresses:[]}); expect((await recordAttendance(input())).ok).toBe(false);
    mocks.user.mockResolvedValueOnce({id:"user_verified",emailAddresses:[{emailAddress:"student@school.test",verification:{status:"unverified"}}]}); expect((await recordAttendance(input())).ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects malicious identity fields and only reads exact expired replay", async () => {
    expect((await recordAttendance({...input(),student_id:organization})).ok).toBe(false);
    mocks.rpc.mockResolvedValueOnce({data:null,error:null});
    expect((await recordAttendance(input(1000))).expired).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("school_replay");
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.device).not.toHaveBeenCalled();
  });
  it("recovers committed success after token expiry without any mutation", async () => {
    const request=input(1000);
    mocks.rpc.mockResolvedValueOnce({error:null,data:{ok:true,action:"CHECK_IN",status:"PRESENT",message:"Recorded"}});
    expect(await recordAttendance(request)).toEqual({ok:true,action:"CHECK_IN",status:"PRESENT",message:"Recorded"});
    expect(mocks.rpc).toHaveBeenCalledWith("school_replay",expect.objectContaining({p_user_id:"user_verified",p_request_id:request.requestId,p_class_id:session,p_organization_id:organization}));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.device).not.toHaveBeenCalled();
  });
  it("does not scan if enrollment claim fails", async () => {
    mocks.rpc.mockResolvedValue({data:null,error:{message:"private database details"}});
    const result=await recordAttendance(input()); expect(result.ok).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(result.message).not.toContain("database details");
  });
  it("returns authoritative duplicate/checkout results without inventing another action", async () => {
    mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="school_claim_student"?{id:"x"}:{ok:false,action:"BLOCKED",status:"FLAGGED",message:"Already scanned"}}));
    expect(await recordAttendance(input())).toEqual({ok:false,action:"BLOCKED",status:"FLAGGED",message:"Already scanned"});
  });
});
