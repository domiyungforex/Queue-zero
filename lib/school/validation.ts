import { z } from "zod";
const name = z.string().trim().min(1).max(160);
const studentSchema = z.object({
  full_name: name,
  matric_number: z.string().trim().min(1).max(80),
});
export const schoolInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("faculty"), name }),
  z.object({ action: z.literal("department"), name, faculty_id: z.uuid() }),
  z.object({ action: z.literal("course"), code: z.string().trim().min(1).max(40), title: name, department_id: z.uuid() }),
  z.object({ action: z.literal("lecturer"), course_id: z.uuid(), email: z.email().max(254) }),
  z.object({ action: z.literal("remove_lecturer"), course_id: z.uuid(), user_id: z.string().min(1).max(200) }),
  z.object({ action: z.literal("enroll"), course_id: z.uuid(), students: z.array(studentSchema).min(1).max(500) }),
  z.object({
    action: z.literal("class"),
    course_id: z.string({ message: "Select a course" }).uuid({ message: "Select a valid course" }),
    title: z.string().trim().max(200, "Session title cannot exceed 200 characters").nullable().optional(),
    starts_at: z.string({ message: "Start time is required" }).min(1, "Start time is required").datetime({ offset: true, message: "Invalid start date/time format" }),
    planned_ends_at: z.string().datetime({ offset: true, message: "Invalid class end date/time format" }).nullable().optional(),
    attendance_closes_at: z.string({ message: "Attendance close time is required" }).min(1, "Attendance close time is required").datetime({ offset: true, message: "Invalid attendance close date/time format" }),
    late_after_minutes: z.coerce.number({ message: "Late threshold must be a number" }).int("Late threshold must be a whole number").min(0, "Late threshold cannot be negative").max(120, "Late threshold cannot exceed 120 minutes"),
    departure_required: z.boolean().default(false),
    verification_mode: z.enum(["STANDARD", "VERIFIED"], { message: "Select a valid attendance mode (STANDARD or VERIFIED)" }).default("STANDARD"),
    location_lat: z.coerce.number({ message: "Latitude must be a valid number" }).min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90").nullable().optional(),
    location_lng: z.coerce.number({ message: "Longitude must be a valid number" }).min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180").nullable().optional(),
    geofence_radius_meters: z.coerce.number({ message: "Radius must be a number" }).int("Radius must be a whole number").min(10, "Radius must be at least 10 meters").max(5000, "Radius cannot exceed 5000 meters").nullable().optional(),
  }),
  z.object({ action: z.enum(["open", "close_arrival", "finish", "revoke_qr"]), class_id: z.uuid() }),
  z.object({ action: z.literal("resolve_flag"), flag_id: z.uuid(), resolution: z.string().trim().min(5).max(500) }),
]).refine(value => value.action !== "class" || ((!value.planned_ends_at || Date.parse(value.planned_ends_at) > Date.parse(value.starts_at)) && Date.parse(value.attendance_closes_at) > Date.parse(value.starts_at) && (!value.planned_ends_at || Date.parse(value.attendance_closes_at) <= Date.parse(value.planned_ends_at))), { message: "Attendance close and planned end must follow class start." });

export function getRosterCsvTemplate() {
  return "matric_number,student_name,programme,level\r\n";
}

/** Small RFC 4180 reader: bounded input, quoted commas/newlines, no silently skipped rows. */
export function parseStudentCsv(input: string) {
  const preview = parseStudentCsvPreview(input);
  if (preview.invalid || preview.duplicates) throw new Error(`Fix ${preview.invalid} invalid and ${preview.duplicates} duplicate rows before importing.`);
  return preview.students;
}

export function parseStudentCsvPreview(input: string) {
  if (input.length > 100_000) throw new Error("Import at most 500 students at a time.");
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false; let closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) { if (c === '"' && input[i + 1] === '"') { field += '"'; i++; } else if (c === '"') { quoted = false; closed = true; } else field += c; }
    else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ",") { row.push(field); field = ""; closed = false; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && input[i + 1] === "\n") i++; row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = ""; closed = false; }
    else { if (closed || c === '"') throw new Error("Check the CSV quotation marks."); field += c; }
  }
  if (quoted) throw new Error("Check the CSV quotation marks.");
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  const header = rows.shift()?.map(v => v.trim().toLowerCase().replace(/^\uFEFF/, "").replace(/[\s-]+/g, "_"));
  const allowed = new Set(["name","full_name","student_name","student","matric_number","matric","matric_no","mat_no","student_id","programme","program","major","course_of_study","department","level","academic_level","year","email"]);
  const nameIndex = header?.findIndex(v => ["name","full_name","student_name","student"].includes(v)) ?? -1;
  const matricIndex = header?.findIndex(v => ["matric_number","matric","matric_no","mat_no","student_id"].includes(v)) ?? -1;
  const _programmeIndex = header?.findIndex(v => ["programme","program","major","course_of_study","department"].includes(v)) ?? -1;
  const _levelIndex = header?.findIndex(v => ["level","academic_level","year"].includes(v)) ?? -1;
  void _programmeIndex; void _levelIndex;
  const emailIndex = header?.indexOf("email") ?? -1;
  if (!header || nameIndex < 0 || matricIndex < 0 || new Set(header).size !== header.length || header.some(value => !allowed.has(value))) throw new Error("Use required columns matric_number, student_name; programme and level are optional.");
  if (!rows.length || rows.length > 500) throw new Error("Include between 1 and 500 students.");
  const matrics = new Set<string>(); const students: z.infer<typeof studentSchema>[] = []; let duplicates = 0; let invalid = 0;
  rows.forEach(values => {
    if (values.length !== header.length) { invalid++; return; }
    if (emailIndex >= 0 && values[emailIndex].trim() && !z.email().safeParse(values[emailIndex].trim()).success) { invalid++; return; }
    const parsed = studentSchema.safeParse({
      full_name: values[nameIndex].trim(),
      matric_number: values[matricIndex].trim(),
    });
    if (!parsed.success) { invalid++; return; }
    const key = parsed.data.matric_number.toLowerCase().replace(/\s+/g, "");
    if (matrics.has(key)) { duplicates++; return; }
    matrics.add(key); students.push(parsed.data);
  });
  return { students, valid: students.length, duplicates, invalid };
}
