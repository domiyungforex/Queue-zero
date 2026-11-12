import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import ExcelJS from "exceljs";
import { schoolTime, type SchoolSnapshot } from "./contracts";
export type Register = ReturnType<typeof buildRegister>;
export function buildRegister(data: SchoolSnapshot, classId: string) {
 const session = data.classes.find(item => item.id === classId); if (!session || session.status !== "COMPLETED") throw new Error("Only finalized classes can be exported.");
 const course = data.courses.find(item => item.id === session.course_id); if (!course) throw new Error("Course unavailable."); const department = data.departments.find(item => item.id === course.department_id); const faculty = data.faculties.find(item => item.id === department?.faculty_id);
 const isStandard = session.verification_mode === "STANDARD";
 // For STANDARD mode: use attendance records directly (no roster required)
 // For VERIFIED mode: use enrolled students (roster-based)
 const records = data.attendance.filter(item => item.class_session_id === classId);
 let rows: ReturnType<typeof buildStandardRow>[];
 if (isStandard) {
  rows = records.map((record, index) => buildStandardRow(record, index, session, data, classId));
 } else {
  const students = data.enrollments.filter(item => item.course_id === course.id).map(item => data.students.find(student => student.id === item.student_id));
  rows = students.map((student, index) => {
   if (!student) throw new Error("Register student missing.");
   const record = data.attendance.find(item => item.class_session_id === classId && item.student_id === student.id);
   if (!record) throw new Error("Finalized attendance record missing.");
   return { number: index + 1, name: record.submitted_name ?? student.full_name, matric: record.submitted_matric_number ?? student.matric_number, arrival: schoolTime(record.check_in_at), departure: schoolTime(record.check_out_at), duration: record.check_in_at && record.check_out_at ? `${Math.max(0, Math.round((Date.parse(record.check_out_at) - Date.parse(record.check_in_at)) / 60000))} min` : "—", status: record.status.replaceAll("_", " "), arrived: !!record.check_in_at, late: !!record.check_in_at && Date.parse(record.check_in_at) > Date.parse(session.starts_at!) + session.late_after_minutes * 60000, flagged: data.flags.some(flag => flag.class_session_id === classId && flag.student_id === student.id && !flag.resolved_at), locationVerified: record.location_verified ?? false, verificationMode: record.verification_mode ?? "VERIFIED" };
  });
 }
 const total = rows.length; const present = rows.filter(row => row.arrived).length; const late = rows.filter(row => row.late).length; const absent = rows.filter(row => row.status === "ABSENT").length; const flagged = rows.filter(row => row.flagged).length;
 const verificationMode = session.verification_mode ?? "STANDARD";
 return { school: data.organization.name, faculty: faculty?.name ?? "—", department: department?.name ?? "—", code: course.code, title: course.title, verificationMode, lecturer: data.lecturers.filter(item => item.course_id === course.id).map(item => item.display_name).join(", ") || "Not assigned", start: schoolTime(session.starts_at), plannedEnd: schoolTime(session.planned_ends_at ?? null), end: schoolTime(session.ends_at), date: session.starts_at?.slice(0, 10) ?? "—", rows, totals: { total, present, late, absent, flagged, percentage: verificationMode === "VERIFIED" && total ? `${(present / total * 100).toFixed(1)}%` : verificationMode === "STANDARD" ? `${present} checked in` : "—" } };
}
function buildStandardRow(record: SchoolSnapshot["attendance"][number], index: number, session: SchoolSnapshot["classes"][number], data: SchoolSnapshot, classId: string) {
 const name = record.submitted_name ?? data.students.find(s => s.id === record.student_id)?.full_name ?? "Unknown";
 const matric = record.submitted_matric_number ?? data.students.find(s => s.id === record.student_id)?.matric_number ?? "—";
 return { number: index + 1, name, matric, arrival: schoolTime(record.check_in_at), departure: schoolTime(record.check_out_at), duration: record.check_in_at && record.check_out_at ? `${Math.max(0, Math.round((Date.parse(record.check_out_at) - Date.parse(record.check_in_at)) / 60000))} min` : "—", status: record.status.replaceAll("_", " "), arrived: !!record.check_in_at, late: !!record.check_in_at && !!session.starts_at && Date.parse(record.check_in_at) > Date.parse(session.starts_at) + session.late_after_minutes * 60000, flagged: data.flags.some(flag => flag.class_session_id === classId && flag.student_id === record.student_id && !flag.resolved_at), locationVerified: record.location_verified ?? false, verificationMode: record.verification_mode ?? "STANDARD" };
}
export function safeSpreadsheetCell(value: string) { return /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value; }
function columns(row: Register["rows"][number]) { return [row.number, row.name, row.matric, row.arrival, row.departure, row.duration, row.status, row.locationVerified ? "Location confirmed" : "", row.flagged ? "Review required" : "", row.verificationMode ?? ""]; }
const columnNames = ["Student number", "Student name", "Matric number", "Arrival (UTC)", "Departure (UTC)", "Duration", "Status", "Location", "Verification", "Mode"];
function metadata(register: Register) { return [["School",register.school],["Faculty",register.faculty],["Department",register.department],["Course code",register.code],["Course title",register.title],["Lecturer",register.lecturer],["Date (UTC)",register.date],["Class start",register.start],["Class end",register.end],["Planned end",register.plannedEnd]]; }
function totals(register: Register) { const t = register.totals; return [["Total students",t.total],["Present",t.present],["Late",t.late],["Absent",t.absent],["Flagged for review",t.flagged],["Attendance percentage",t.percentage]]; }
export function attendanceCsv(register: Register) {
 const rows = [...metadata(register), [], columnNames, ...register.rows.map(columns), [], ...totals(register), ["Lecturer signature", "___________________"]];
 return "\uFEFF" + rows.map(row => row.map(value => '"' + safeSpreadsheetCell(String(value)).replaceAll('"', '""') + '"').join(",")).join("\r\n");
}
export async function attendanceXlsx(register: Register) {
 const workbook = new ExcelJS.Workbook(); workbook.creator = "TuRnMaRk"; const sheet = workbook.addWorksheet("Attendance", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
 for (const row of metadata(register)) sheet.addRow(row.map(value => safeSpreadsheetCell(value)));
 sheet.addRow([]); const header = sheet.addRow(columnNames); header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003D32" } };
 for (const row of register.rows) sheet.addRow(columns(row).map(value => typeof value === "string" ? safeSpreadsheetCell(value) : value));
 sheet.addRow([]); for (const row of totals(register)) sheet.addRow(row); sheet.addRow(["Lecturer signature", "___________________"]); sheet.columns.forEach((column, i) => { column.width = [19, 28, 24, 28, 28, 14, 18, 20, 22, 14][i] ?? 14; }); sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; }); return new Uint8Array(await workbook.xlsx.writeBuffer());
}
function wrap(text: string, font: PDFFont, size: number, width: number) { const lines: string[] = []; let line = ""; for (const char of text.replace(/[\r\n\t]/g," ")) { if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line); line = char; } else line += char; } lines.push(line); return lines; }
export async function attendancePdf(register: Register) {
 const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit); const bytes = await readFile(path.join(process.cwd(), "lib/school/fonts/DejaVuSans.ttf")); const font = await pdf.embedFont(bytes, { subset: true }); pdf.setTitle(`${register.code} Attendance Register`); pdf.setAuthor("TuRnMaRk");
 const width = 841.89, height = 595.28, margin = 28; let page: PDFPage; let y = 0; const widths = [22,120,100,105,105,50,75,80,90,80]; const headings = ["No.","Student name","Matric","Arrival (UTC)","Departure (UTC)","Duration","Status","Location","Verification","Mode"];
 function newPage() { page = pdf.addPage([width,height]); y = height - margin; page.drawText("TuRnMaRk · Official attendance register", { x: margin, y, font, size: 14, color: rgb(0,0.24,0.2) }); y -= 24; }
 function line(text: string, size = 9) { for (const part of wrap(text, font, size, width - margin * 2)) { if (y < 40) newPage(); page.drawText(part, { x:margin, y, font, size }); y -= size + 5; } }
 function tableRow(values: (string|number)[], header = false) { const lines = values.map((value,i) => wrap(String(value),font,7,widths[i]-8)); const rowHeight = Math.max(...lines.map(value=>value.length))*10+10; if (y - rowHeight < 32) { newPage(); if (!header) tableRow(headings,true); } let x = margin; if(header) page.drawRectangle({x,y:y-rowHeight+4,width:width-margin*2,height:rowHeight,color:rgb(0.93,0.96,0.94)}); lines.forEach((parts,i)=>{parts.forEach((part,j)=>page.drawText(part,{x:x+4,y:y-8-j*10,font,size:7}));x+=widths[i];}); y-=rowHeight; }
 newPage(); for (const [label,value] of metadata(register)) line(`${label}: ${value}`); y-=8; tableRow(headings,true); register.rows.forEach(row=>tableRow(columns(row))); y-=12; for (const [label,value] of totals(register)) line(`${label}: ${value}`); line("Lecturer signature: ___________________"); line("Present includes late arrivals. Flags are review signals, not proof of misconduct.",8);
 const pages = pdf.getPages(); pages.forEach((p,index)=>p.drawText(`Page ${index+1} of ${pages.length} · All times UTC`,{x:margin,y:14,font,size:7})); return pdf.save();
}
