import { z } from "zod";
import { PERMISSIONS, type InstitutionUnit } from "./contracts";
export const STAFF_ROLES = ["UNIT_ADMIN", "STAFF", "LECTURER"] as const;
export const staffInvitationSchema = z.object({ request_id: z.uuid(), unit_id: z.uuid(), email: z.email().max(254).transform(v => v.toLowerCase()), role: z.enum(STAFF_ROLES), staff_title: z.string().trim().max(100), permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length) });
export type StaffInvitation = z.infer<typeof staffInvitationSchema>;
export type ImportRow = { row: number; name: string; email: string; unit: string; role: string; status: "READY" | "EXISTING" | "INVALID_EMAIL" | "UNKNOWN_UNIT" | "INVALID_ROLE" | "INVALID_NAME" | "DUPLICATE" | "NO_PERMISSION"; input?: Omit<StaffInvitation, "request_id"> };
const lecturerPermissions = ["course.create", "course.manage", "attendance.start", "attendance.manage", "attendance.export", "reports.view"] as const;
export function staffRole(value: string): { role: typeof STAFF_ROLES[number]; title: string; permissions: (typeof PERMISSIONS[number])[] } | null {
 const normalized = value.trim().toUpperCase().replace(/[ -]+/g, "_");
 if (normalized === "UNIT_ADMIN" || normalized === "DEPARTMENT_ADMIN" || normalized === "FACULTY_ADMIN") return { role: "UNIT_ADMIN", title: normalized, permissions: [...PERMISSIONS] };
 if (normalized === "LECTURER") return { role: "LECTURER", title: "LECTURER", permissions: [...lecturerPermissions] };
 if (["STAFF", "COUNSELOR", "DOCTOR", "NURSE", "RECEPTIONIST", "BURSARY_STAFF", "ADMISSIONS_STAFF", "STUDENT_AFFAIRS_STAFF", "ICT_STAFF", "LIBRARY_STAFF", "QUEUE_OPERATOR", "OTHER_STAFF"].includes(normalized)) return { role: "STAFF", title: normalized, permissions: ["queue.serve"] };
 return null;
}
/** Bounded RFC4180 parser; invalid rows remain visible in the confirmation preview. */
export function previewStaffCsv(csv: string, units: InstitutionUnit[]): ImportRow[] {
 if (csv.length > 120_000) throw new Error("Import at most 200 staff at a time.");
 const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
 for (let i = 0; i < csv.length; i++) {
  const c = csv[i];
  if (quoted) { if (c === '"' && csv[i + 1] === '"') { field += '"'; i++; } else if (c === '"') { quoted = false; closed = true; } else field += c; }
  else if (c === '"' && !field && !closed) quoted = true;
  else if (c === ',') { row.push(field); field = ''; closed = false; }
  else if (c === '\r' || c === '\n') { if (c === '\r' && csv[i + 1] === '\n') i++; row.push(field); if (row.some(x => x.trim())) rows.push(row); row = []; field = ''; closed = false; }
  else { if (closed || c === '"') throw new Error("Check the CSV quotation marks."); field += c; }
 }
 if (quoted) throw new Error("Check the CSV quotation marks.");
 row.push(field); if (row.some(x => x.trim())) rows.push(row);
 if (rows.shift()?.map(v => v.trim().toLowerCase().replace(/^\uFEFF/, '')).join(',') !== 'name,email,unit,role') throw new Error("Use the header: name,email,unit,role");
 if (!rows.length || rows.length > 200) throw new Error("Include between 1 and 200 staff.");
 const seen = new Set<string>();
 return rows.map((values, i) => {
  if (values.length !== 4) throw new Error(`Row ${i + 2} must contain four columns.`);
  const [name, email, unitName, roleName] = values.map(v => v.trim());
  const item: ImportRow = { row: i + 2, name: name.slice(0,160), email: email.slice(0,254), unit: unitName.slice(0,160), role: roleName.slice(0,100), status: 'READY' };
  if (!name || name.length > 160) return { ...item, status: 'INVALID_NAME' };
  if (!z.email().max(254).safeParse(email).success) return { ...item, status: 'INVALID_EMAIL' };
  const matches = units.filter(v => v.status === 'active' && (v.slug === unitName || v.name.toLowerCase() === unitName.toLowerCase()));
  if (matches.length !== 1) return { ...item, status: 'UNKNOWN_UNIT' };
  const unit = matches[0], role = staffRole(roleName);
  if (!role) return { ...item, status: 'INVALID_ROLE' };
  if (!unit.permissions.includes('unit.staff.manage') || role.permissions.some(p => !unit.permissions.includes(p))) return { ...item, status: 'NO_PERMISSION' };
  const identity = `${unit.id}:${email.toLowerCase()}`;
  if (seen.has(identity)) return { ...item, status: 'DUPLICATE' }; seen.add(identity);
  return { ...item, input: { unit_id: unit.id, email: email.toLowerCase(), role: role.role, staff_title: role.title, permissions: role.permissions } };
 });
}
