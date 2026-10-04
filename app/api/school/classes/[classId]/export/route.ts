import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSchoolSnapshot } from "@/lib/school/data";
import { attendanceCsv, attendancePdf, attendanceXlsx, buildRegister } from "@/lib/school/exports";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
 try {
  if (!(await auth()).userId) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
  const { classId } = await params; const format = z.enum(["csv","pdf","xlsx"]).safeParse(new URL(request.url).searchParams.get("format"));
  if (!z.uuid().safeParse(classId).success || !format.success) return NextResponse.json({ error: "Invalid export request" }, { status: 400, headers });
  const { snapshot } = await getSchoolSnapshot(undefined, classId);
  if (snapshot.classes.find(item => item.id === classId)?.status !== "COMPLETED") return NextResponse.json({ error: "End the class before exporting its official register." }, { status: 409, headers });
  const register = buildRegister(snapshot,classId); const content = format.data === "csv" ? attendanceCsv(register) : format.data === "pdf" ? new Uint8Array(await attendancePdf(register)) : new Uint8Array(await attendanceXlsx(register));
  const type = format.data === "csv" ? "text/csv; charset=utf-8" : format.data === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return new Response(content, { headers: { ...headers, "Content-Type": type, "Content-Disposition": `attachment; filename="attendance-${classId}.${format.data}"` } });
 } catch { return NextResponse.json({ error: "This register is unavailable or you no longer have access." }, { status: 403, headers }); }
}
