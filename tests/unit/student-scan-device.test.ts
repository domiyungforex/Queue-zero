import {beforeEach,describe,expect,it,vi} from "vitest";
const jar=vi.hoisted(()=>({get:vi.fn(),set:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("next/headers",()=>({cookies:async()=>jar}));
import {attendanceDeviceHash} from "@/lib/school-student/device";
beforeEach(()=>{vi.stubEnv("ATTENDANCE_QR_SECRET","x".repeat(64));jar.get.mockReturnValue({value:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"})});
describe("privacy-conscious device signal",()=>{
 it("is stable within school and unlinkable across organizations",async()=>{const first=await attendanceDeviceHash("school-a");expect(first).toBe(await attendanceDeviceHash("school-a"));expect(first).not.toBe(await attendanceDeviceHash("school-b"));expect(first).toMatch(/^[a-f0-9]{64}$/);expect(first).not.toContain("aaaaaaaa")});
 it("issues HttpOnly SameSite random cookie without fingerprint collection",async()=>{jar.get.mockReturnValue(undefined);await attendanceDeviceHash("school-a");expect(jar.set).toHaveBeenCalledWith("turnmark-attendance-device",expect.stringMatching(/^[a-f0-9-]{36}$/),expect.objectContaining({httpOnly:true,sameSite:"lax",maxAge:2592000,path:"/"}))});
});
