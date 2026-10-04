import { z } from "zod";
const name = z.string().trim().min(1).max(160);
const studentSchema = z.object({ full_name: name, email: z.email().max(254).transform(value => value.toLowerCase()), matric_number: z.string().trim().min(1).max(80), department_id: z.uuid(), level: z.string().trim().min(1).max(40) });
export const schoolInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("faculty"), name }),
  z.object({ action: z.literal("department"), name, faculty_id: z.uuid() }),
  z.object({ action: z.literal("course"), code: z.string().trim().min(1).max(40), title: name, department_id: z.uuid() }),
  z.object({ action: z.literal("lecturer"), course_id: z.uuid(), email: z.email().max(254) }),
  z.object({ action: z.literal("remove_lecturer"), course_id: z.uuid(), user_id: z.string().min(1).max(200) }),
  z.object({ action: z.literal("enroll"), course_id: z.uuid(), students: z.array(studentSchema).min(1).max(200) }),
  z.object({ action: z.literal("class"), course_id: z.uuid(), starts_at: z.iso.datetime({ offset: true }), planned_ends_at: z.iso.datetime({ offset: true }).nullable().optional(), late_after_minutes: z.coerce.number().int().min(0).max(120), departure_required: z.boolean() }),
  z.object({ action: z.enum(["open", "close_arrival", "enable_checkout", "finish"]), class_id: z.uuid() }),
  z.object({ action: z.literal("resolve_flag"), flag_id: z.uuid(), resolution: z.string().trim().min(5).max(500) }),
]).refine(value => value.action !== "class" || !value.planned_ends_at || Date.parse(value.planned_ends_at) > Date.parse(value.starts_at), { message: "Planned end must follow class start." });

/** Small RFC 4180 reader: bounded input, quoted commas/newlines, no silently skipped rows. */
export function parseStudentCsv(input: string, departmentId: string) {
  if (input.length > 100_000) throw new Error("Import at most 200 students at a time.");
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
  const header = rows.shift()?.map(v => v.trim().toLowerCase().replace(/^\uFEFF/, ""));
  if (header?.join(",") !== "full_name,email,matric_number,level") throw new Error("Use the header: full_name,email,matric_number,level");
  if (!rows.length || rows.length > 200) throw new Error("Include between 1 and 200 students.");
  const emails = new Set<string>(); const matrics = new Set<string>();
  return rows.map((values, index) => {
    if (values.length !== 4) throw new Error(`Row ${index + 2} must contain four columns.`);
    const parsed = studentSchema.safeParse({ full_name: values[0].trim(), email: values[1].trim(), matric_number: values[2].trim(), level: values[3].trim(), department_id: departmentId });
    if (!parsed.success) throw new Error(`Check the name, email, matric number and level on row ${index + 2}.`);
    if (emails.has(parsed.data.email) || matrics.has(parsed.data.matric_number.toLowerCase())) throw new Error(`Duplicate student on row ${index + 2}.`);
    emails.add(parsed.data.email); matrics.add(parsed.data.matric_number.toLowerCase()); return parsed.data;
  });
}
