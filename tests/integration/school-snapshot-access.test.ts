import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({membership:vi.fn(),rpc:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/business/membership",()=>({requireBusinessMembership:mocks.membership}));vi.mock("@/lib/db/server",()=>({createUserSupabaseClient:async()=>({rpc:mocks.rpc})}));vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND")}}));
import {getSchoolSnapshot} from "@/lib/school/data";
import {schoolFixture,org,classId,courseId} from "../unit/school-fixture";
beforeEach(()=>{vi.clearAllMocks();mocks.membership.mockResolvedValue({businessId:org,role:"lecturer"});mocks.rpc.mockResolvedValue({data:schoolFixture(),error:null});});
describe("school snapshot tenant and role checks",()=>{
 it("uses membership tenant and authorized database RPC",async()=>{const result=await getSchoolSnapshot(undefined,classId);expect(result.canManage).toBe(false);expect(mocks.rpc).toHaveBeenCalledWith("school_snapshot",{p_organization_id:org,p_class_id:classId,p_course_id:undefined});});
 it("denies student/staff directory, malformed IDs and unauthorized class access",async()=>{for(const role of ["student","staff"]){mocks.membership.mockResolvedValueOnce({businessId:org,role});await expect(getSchoolSnapshot()).rejects.toThrow("NOT_FOUND");}await expect(getSchoolSnapshot("invalid")).rejects.toThrow("NOT_FOUND");expect(mocks.rpc).not.toHaveBeenCalled();mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501"}});await expect(getSchoolSnapshot(courseId)).rejects.toThrow("NOT_FOUND");});
 it("does not render business-only capabilities or nonexistent course records",async()=>{const data=schoolFixture();data.organization.mode="BUSINESS";mocks.rpc.mockResolvedValueOnce({data,error:null});await expect(getSchoolSnapshot()).rejects.toThrow("NOT_FOUND");await expect(getSchoolSnapshot(classId)).rejects.toThrow("NOT_FOUND");});
});
