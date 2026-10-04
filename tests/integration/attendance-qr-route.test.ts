import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));
vi.mock("@/lib/db/server",()=>({createUserSupabaseClient:async()=>({rpc:mocks.rpc})}));
import { GET } from "@/app/api/school/classes/[classId]/qr/route";
import {validateAttendanceToken} from "@/lib/qr/validation";
import {attendanceSecret} from "@/lib/qr/secret";
const classId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",org="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request=()=>GET(new Request("http://localhost:3000/api/qr"),{params:Promise.resolve({classId})});
beforeEach(()=>{vi.stubEnv("ATTENDANCE_QR_SECRET","s".repeat(64));mocks.auth.mockResolvedValue({userId:"lecturer"});mocks.rpc.mockResolvedValue({error:null,data:{organization_id:org,session_id:classId}})});
describe("authorized rotating QR route",()=>{
  it("issues no-store 30-second signed token after DB authorization",async()=>{const response=await request();expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");const body=await response.json();const payload=validateAttendanceToken(new URL(body.url).searchParams.get("token")!,attendanceSecret());expect(payload.organization_id).toBe(org);expect(payload.session_id).toBe(classId);expect(payload.expires_at-payload.issued_at).toBe(30);expect(mocks.rpc).toHaveBeenCalledWith("school_issue_qr",expect.objectContaining({p_class_id:classId,p_nonce:payload.nonce}));});
  it("does not issue for anonymous or unauthorized users",async()=>{mocks.auth.mockResolvedValueOnce({userId:null});expect((await request()).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"denied"}});expect((await request()).status).toBe(403);});
  it("rejects cross-site QR issuance without consuming nonce quota",async()=>{const response=await GET(new Request("http://localhost:3000/api/qr",{headers:{origin:"https://other.test","sec-fetch-site":"cross-site"}}),{params:Promise.resolve({classId})});expect(response.status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();});
  it("rejects mismatched database class and malformed identifiers",async()=>{mocks.rpc.mockResolvedValueOnce({error:null,data:{organization_id:org,session_id:org}});expect((await request()).status).toBe(403);expect((await GET(new Request("http://localhost"),{params:Promise.resolve({classId:"bad"})})).status).toBe(400);});
});
