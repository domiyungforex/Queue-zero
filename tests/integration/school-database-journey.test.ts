import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { afterEach, expect, test, vi } from "vitest";
import type { Database } from "@/lib/db/database.types";

// This fixture is opt-in and may only target scripts/preview.mjs containers.
// Real PostgREST JWT validation, SQL authorization, RLS and mutations are exercised;
// Clerk, Next request cookies/cache and browser transport are test boundaries.
const state = vi.hoisted(() => ({ userId: "", organizationId: "", role: "owner", email: "", lecturerId: "", userClient: null as SupabaseClient<Database> | null, serviceClient: null as SupabaseClient<Database> | null, cookies: new Map<string,string>() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn(), notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (key:string) => state.cookies.has(key) ? {value:state.cookies.get(key)} : undefined, set: (key:string,value:string) => state.cookies.set(key,value) }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({userId:state.userId}), currentUser: async () => ({id:state.userId,fullName:"Integration Identity",emailAddresses:[{emailAddress:state.email,verification:{status:"verified"}}]}), clerkClient: async () => ({users:{getUserList:async()=>({data:[{id:state.lecturerId,fullName:"Integration Lecturer",emailAddresses:[{emailAddress:"lecturer@integration.invalid",verification:{status:"verified"}}]}]})}}) }));
vi.mock("@/lib/business/membership", () => ({ requireBusinessMembership: async () => ({businessId:state.organizationId,role:state.role,organizationMode:"SCHOOL"}) }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: async () => state.userClient }));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => state.serviceClient }));
import { manageSchool } from "@/lib/school/actions";
import { getSchoolSnapshot } from "@/lib/school/data";
import { recordAttendance } from "@/lib/school-student/actions";
import { GET as issueQr } from "@/app/api/school/classes/[classId]/qr/route";
import { GET as exportRegister } from "@/app/api/school/classes/[classId]/export/route";

const container = process.env.PREVIEW_DB_CONTAINER;
afterEach(() => vi.unstubAllEnvs());
test.skipIf(!container)("school application journey through real isolated PostgREST authorization and SQL", async () => {
  if (!container || !/^queuezero-preview-[a-f0-9]{12}-db$/.test(container)) throw new Error("Disposable preview database container required");
  const restContainer=container.replace(/-db$/,"-rest");
  const inspection: {Config:{Env:string[]}}[]=JSON.parse(execFileSync("docker",["inspect",restContainer],{encoding:"utf8"}));
  const secret=inspection[0].Config.Env.find(value=>value.startsWith("PGRST_JWT_SECRET="))?.slice("PGRST_JWT_SECRET=".length);
  if(!secret || secret.length<32) throw new Error("Local preview JWT configuration unavailable");
  const binding=execFileSync("docker",["port",restContainer,"3000/tcp"],{encoding:"utf8"}).trim();
  if(!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error("PostgREST must bind only loopback");
  const endpoint=`http://${binding}`;
  const realFetch=globalThis.fetch;
  function jwt(role:string,sub?:string){const header=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");const payload=Buffer.from(JSON.stringify({role,...(sub?{sub}:{}),exp:Math.floor(Date.now()/1000)+600})).toString("base64url");return `${header}.${payload}.${createHmac("sha256",secret!).update(`${header}.${payload}`).digest("base64url")}`;}
  function client(role:string,sub?:string){const token=jwt(role,sub);return createClient<Database>(endpoint,token,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:async(input,init)=>{const original=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(original.origin!==endpoint)throw new Error("Nonlocal test request rejected");original.pathname=original.pathname.replace(/^\/rest\/v1/,"");return realFetch(original,init)}}});}
  const runId=randomUUID().replaceAll("-","");
  const owner=`user_owner${runId}`, lecturer=`user_lecturer${runId}`;
  state.lecturerId=lecturer;state.serviceClient=client("service_role");
  vi.stubEnv("ATTENDANCE_QR_SECRET",randomUUID()+randomUUID());
  function identity(id:string,role:string,email="owner@integration.invalid"){state.userId=id;state.role=role;state.email=email;state.userClient=client("authenticated",id)}
  identity(owner,"owner");
  const organization=await state.userClient!.rpc("onboard_organization",{p_business_name:"Integration School",p_industry:"education",p_country_code:"NG",p_timezone:"Africa/Lagos",p_location_name:"Campus",p_location_address:"Local test campus",p_mode:"SCHOOL"});
  expect(organization.error).toBeNull();expect(typeof organization.data).toBe("string");state.organizationId=organization.data!;
  async function manage(action:string,fields:Record<string,string>={}){const form=new FormData();form.set("action",action);for(const [key,value] of Object.entries(fields))form.set(key,value);const result=await manageSchool({ok:false,message:""},form);expect(result.ok,result.message).toBe(true);return result.id!;}
  const faculty=await manage("faculty",{name:"Science"});
  const department=await manage("department",{name:"Physics",faculty_id:faculty});
  const course=await manage("course",{code:"PHY101",title:"Mechanics",department_id:department});
  await manage("lecturer",{course_id:course,email:"lecturer@integration.invalid"});
  identity(lecturer,"lecturer","lecturer@integration.invalid");
  await manage("enroll",{course_id:course,department_id:department,csv:"full_name,email,matric_number,level\nIntegration Student,student@integration.invalid,PHY/001,100\nAbsent Student,absent@integration.invalid,PHY/002,100"});
  const startsAt=new Date(Date.now()-60_000);
  const classId=await manage("class",{course_id:course,starts_at:startsAt.toISOString(),attendance_closes_at:new Date(startsAt.getTime()+30*60_000).toISOString(),planned_ends_at:new Date(startsAt.getTime()+60*60_000).toISOString(),late_after_minutes:"10",departure_required:""});
  await manage("open",{class_id:classId});
  async function qr(){const response=await issueQr(new Request("http://localhost:3000/api/qr"),{params:Promise.resolve({classId})});expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");const body=await response.json();const value=new URL(body.url).searchParams.get("token");expect(value).toBeTruthy();return value!;}
  const arrivalQr=await qr();
  expect((await recordAttendance({token:arrivalQr,requestId:randomUUID(),student_id:randomUUID()})).ok).toBe(false);
  const arrivalRequest={token:arrivalQr,requestId:randomUUID(),fullName:"Integration Student",matricNumber:"PHY/001"};
  const first=await recordAttendance(arrivalRequest);expect(first).toMatchObject({ok:true,status:"PRESENT"});
  expect(await recordAttendance(arrivalRequest)).toEqual(first);
  expect(await recordAttendance({...arrivalRequest,requestId:randomUUID()})).toMatchObject({ok:false,status:"DUPLICATE"});
  expect(await recordAttendance({token:arrivalQr,requestId:randomUUID(),fullName:"Wrong Name",matricNumber:"PHY/002"})).toMatchObject({ok:false,status:"NAME_MISMATCH"});
  state.userId="";
  const deniedExport=await exportRegister(new Request("http://localhost:3000/export?format=csv"),{params:Promise.resolve({classId})});expect(deniedExport.status).toBe(401);
  identity(lecturer,"lecturer","lecturer@integration.invalid");
  const fresh=await getSchoolSnapshot(course,classId);expect(fresh.snapshot.attendance).toHaveLength(1);expect(fresh.snapshot.attendance[0].check_in_at).not.toBeNull();
  await manage("close_arrival",{class_id:classId});
  expect(await recordAttendance({token:arrivalQr,requestId:randomUUID(),fullName:"Absent Student",matricNumber:"PHY/002"})).toMatchObject({ok:false,status:"CLOSED"});
  await manage("finish",{class_id:classId});
  const completed=await getSchoolSnapshot(course,classId);expect(completed.snapshot.attendance).toHaveLength(2);expect(completed.snapshot.attendance.some(row=>row.status==="ABSENT")).toBe(true);
  for(const format of ["csv","pdf","xlsx"]){const response=await exportRegister(new Request(`http://localhost:3000/export?format=${format}`),{params:Promise.resolve({classId})});expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");if(format==="csv"){const csv=await response.text();expect(csv).toContain("PHY/001");expect(csv).toContain("ABSENT");expect(csv).toContain("Integration Lecturer")}else if(format==="pdf"){const pdf=await PDFDocument.load(await response.arrayBuffer());expect(pdf.getPageCount()).toBeGreaterThan(0);expect([Math.round(pdf.getPage(0).getWidth()),Math.round(pdf.getPage(0).getHeight())].sort((a,b)=>a-b)).toEqual([595,842])}else{const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await response.arrayBuffer());expect(workbook.worksheets[0].rowCount).toBeGreaterThan(2)}}
  const otherOwner=`user_other${runId}`;const foreign=await client("authenticated",otherOwner).rpc("onboard_organization",{p_business_name:"Other Integration School",p_industry:"education",p_country_code:"NG",p_timezone:"UTC",p_location_name:"Campus",p_location_address:"Other test campus",p_mode:"SCHOOL"});expect(foreign.error).toBeNull();
  const denied=await state.userClient!.rpc("school_snapshot",{p_organization_id:foreign.data!});expect(denied.error?.code).toBe("42501");
},60_000);
