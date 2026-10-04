import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),snapshot:vi.fn()}));
vi.mock("@clerk/nextjs/server",()=>({auth:mocks.auth}));vi.mock("@/lib/school/data",()=>({getSchoolSnapshot:mocks.snapshot}));
import {GET} from "@/app/api/school/classes/[classId]/export/route";
import {schoolFixture,classId} from "../unit/school-fixture";
const request=(format="csv")=>GET(new Request(`https://queuezero.test/api/export?format=${format}`),{params:Promise.resolve({classId})});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({userId:"lecturer"});mocks.snapshot.mockResolvedValue({snapshot:schoolFixture()});});
describe("attendance export authorization",()=>{
 it("denies anonymous, cross-tenant and revoked access without returning PII",async()=>{mocks.auth.mockResolvedValueOnce({userId:null});expect((await request()).status).toBe(401);expect(mocks.snapshot).not.toHaveBeenCalled();mocks.snapshot.mockRejectedValueOnce(new Error("hidden student name"));const response=await request();expect(response.status).toBe(403);expect(await response.text()).not.toContain("hidden student");});
 it("reauthorizes every request and returns private no-store attachments",async()=>{for(let i=0;i<2;i++){const response=await request();expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toContain("no-store");expect(response.headers.get("Content-Disposition")).toContain("attachment;");expect(await response.text()).toContain("Àkín");}expect(mocks.snapshot).toHaveBeenCalledTimes(2);expect(mocks.snapshot).toHaveBeenCalledWith(undefined,classId);});
 it("rejects unsupported formats and unfinished class export",async()=>{expect((await request("html")).status).toBe(400);const data=schoolFixture();data.classes[0].status="OPEN";mocks.snapshot.mockResolvedValue({snapshot:data});expect((await request()).status).toBe(409);});
});
