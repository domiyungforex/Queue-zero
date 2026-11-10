import type { SchoolSnapshot } from "@/lib/school/contracts";
export const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const courseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const classId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const studentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const departmentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const facultyId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
export function schoolFixture(): SchoolSnapshot { return { organization:{id:org,name:"Test institution",mode:"SCHOOL"}, faculties:[{id:facultyId,name:"Science"}],departments:[{id:departmentId,faculty_id:facultyId,name:"Physics"}],courses:[{id:courseId,department_id:departmentId,code:"PHY101",title:"Mechanics"}],students:[{id:studentId,full_name:"Àkín Johnson",matric_number:"PHY/26/1",department_id:departmentId,level:"100"}],enrollments:[{course_id:courseId,student_id:studentId}],lecturers:[{course_id:courseId,clerk_user_id:"user_lecturer",display_name:"Test lecturer"}],classes:[{id:classId,course_id:courseId,status:"COMPLETED",starts_at:"2026-10-03T10:00:00Z",ends_at:"2026-10-03T11:00:00Z",late_after_minutes:10,verification_mode:"VERIFIED",checkout_enabled:true,arrival_open:false,departure_required:true}],attendance:[{id:"11111111-1111-4111-8111-111111111111",class_session_id:classId,student_id:studentId,check_in_at:"2026-10-03T10:03:00Z",check_out_at:"2026-10-03T11:00:00Z",status:"PRESENT",flag_reason:null}],flags:[]}; }
