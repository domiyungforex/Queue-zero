import { getRosterCsvTemplate } from "@/lib/school/validation";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const csv = getRosterCsvTemplate();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance-roster-template.csv"',
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
