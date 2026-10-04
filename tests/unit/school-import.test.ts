import {describe,it,expect} from "vitest";
import {parseStudentCsv,schoolInputSchema} from "@/lib/school/validation";
import {departmentId,courseId} from "./school-fixture";
const header="full_name,email,matric_number,level\n";
describe("student register import",()=>{
 it("parses quoted names and resolves normalized verified email invitations",()=>{expect(parseStudentCsv(header+'"Johnson, Akin",AKIN@example.org,PHY/1,100',departmentId)).toEqual([{full_name:"Johnson, Akin",email:"akin@example.org",matric_number:"PHY/1",level:"100",department_id:departmentId}]);});
 it("rejects malformed, duplicate and oversized imports without dropping records",()=>{for(const csv of [header+'"Unclosed,x@y.org,A,100',header+'Name,x@y.org,A',header+'Name,x@y.org,A,100\nOther,x@y.org,B,100',header+'Name,x@y.org,A,100\nOther,z@y.org,a,100',"wrong,header\nA,B", "x".repeat(100001)])expect(()=>parseStudentCsv(csv,departmentId)).toThrow();});
 it("rejects a planned class end before its start",()=>{expect(schoolInputSchema.safeParse({action:"class",course_id:courseId,starts_at:"2026-10-03T10:00:00Z",planned_ends_at:"2026-10-03T09:00:00Z",late_after_minutes:10,departure_required:true}).success).toBe(false);});
 it("rejects browser identity proof, unsupported actions and invalid session timing",()=>{expect(schoolInputSchema.safeParse({action:"lecturer",course_id:courseId,user_id:"someone"}).success).toBe(false);expect(schoolInputSchema.safeParse({action:"student",student_id:courseId}).success).toBe(false);expect(schoolInputSchema.safeParse({action:"class",course_id:courseId,starts_at:"invalid",late_after_minutes:121,departure_required:false}).success).toBe(false);});
});
