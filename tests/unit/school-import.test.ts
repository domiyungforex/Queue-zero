import { describe, it, expect } from "vitest";
import { parseStudentCsv, parseStudentCsvPreview, schoolInputSchema } from "@/lib/school/validation";
import { courseId } from "./school-fixture";
const header = "name,matric_number\n";
describe("student register import", () => {
  it("parses the two required roster fields including quoted names", () => { expect(parseStudentCsv(header + '"Johnson, Akin",PHY/1')).toEqual([{ full_name: "Johnson, Akin", matric_number: "PHY/1" }]); });
  it("accepts optional roster columns without making them attendance credentials", () => { expect(parseStudentCsv("name,matric_number,email,department,level\nAkin,PHY/1,akin@example.edu,Physics,100")).toEqual([{ full_name: "Akin", matric_number: "PHY/1" }]); });
  it("previews duplicate and invalid rows before confirmation", () => { expect(parseStudentCsvPreview(header + "Akin,PHY/1\nDuplicate, phy/1 \n,PHY/2")).toMatchObject({ valid: 1, duplicates: 1, invalid: 1 }); });
  it("rejects malformed imports instead of silently dropping records", () => { for (const csv of [header + '"Unclosed,PHY/1', "wrong,header\nA,B", "x".repeat(100001)]) expect(() => parseStudentCsv(csv)).toThrow(); });
  it("defaults new classes to Standard and supports optional Verified mode", () => { const base = { action: "class" as const, course_id: courseId, starts_at: "2026-10-03T10:00:00Z", attendance_closes_at: "2026-10-03T10:30:00Z", planned_ends_at: "2026-10-03T12:00:00Z", late_after_minutes: 10, departure_required: false }; expect(schoolInputSchema.parse(base)).toMatchObject({ verification_mode: "STANDARD" }); expect(schoolInputSchema.parse({ ...base, verification_mode: "VERIFIED" })).toMatchObject({ verification_mode: "VERIFIED" }); expect(schoolInputSchema.safeParse({ ...base, verification_mode: "UNKNOWN" }).success).toBe(false); });
  it("requires a valid attendance close time after class start", () => { expect(schoolInputSchema.safeParse({ action: "class", course_id: courseId, starts_at: "2026-10-03T10:00:00Z", attendance_closes_at: "2026-10-03T10:30:00Z", planned_ends_at: "2026-10-03T12:00:00Z", late_after_minutes: 10, departure_required: false }).success).toBe(true); expect(schoolInputSchema.safeParse({ action: "class", course_id: courseId, starts_at: "2026-10-03T10:00:00Z", attendance_closes_at: "2026-10-03T09:30:00Z", late_after_minutes: 10, departure_required: false }).success).toBe(false); });
  it("provides specific friendly validation errors for create class inputs", () => {
    const missingCourse = schoolInputSchema.safeParse({ action: "class", course_id: "not-a-uuid", starts_at: "2026-10-03T10:00:00Z", attendance_closes_at: "2026-10-03T10:30:00Z", late_after_minutes: 10 });
    expect(missingCourse.success).toBe(false);
    if (!missingCourse.success) expect(missingCourse.error.issues[0].message).toBe("Select a valid course");

    const missingStart = schoolInputSchema.safeParse({ action: "class", course_id: courseId, starts_at: "", attendance_closes_at: "2026-10-03T10:30:00Z", late_after_minutes: 10 });
    expect(missingStart.success).toBe(false);
    if (!missingStart.success) expect(missingStart.error.issues[0].message).toBe("Start time is required");

    const missingClose = schoolInputSchema.safeParse({ action: "class", course_id: courseId, starts_at: "2026-10-03T10:00:00Z", attendance_closes_at: "", late_after_minutes: 10 });
    expect(missingClose.success).toBe(false);
    if (!missingClose.success) expect(missingClose.error.issues[0].message).toBe("Attendance close time is required");
  });
});
