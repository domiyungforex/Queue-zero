import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression guard for the 2026-11-28 audit: the assignment audience check
// and the attendance/assignment recipient resolver queried a table named
// "course_enrollments" that does not exist in any migration. Enrollment is
// stored in public.course_students (PK course_id + student_id). The broken
// queries always returned no rows, so enrolled students were told they were
// "not registered for this course" and course notifications had no
// recipients.
const sources = {
  guestActions: readFileSync("lib/academic/guest-actions.ts", "utf8"),
  attendanceNotifications: readFileSync("lib/school/attendance-notifications.ts", "utf8"),
  portalData: readFileSync("lib/academic/data.ts", "utf8"),
};

describe("assignment enrollment checks use the real enrollment table", () => {
  it("guest verification checks course_students, not course_enrollments", () => {
    expect(sources.guestActions).not.toContain('from("course_enrollments")');
    expect(sources.guestActions).toContain('from("course_students")');
  });

  it("recipient resolution checks course_students, not course_enrollments", () => {
    expect(sources.attendanceNotifications).not.toContain('from("course_enrollments")');
    expect(sources.attendanceNotifications).toContain('from("course_students")');
  });

  // Step 1 (student view 404): the portal assignment list must not depend on
  // the RLS people<->Clerk link, which roster-imported students often lack.
  it("student portal reads assignments via the membership-scoped service client", () => {
    expect(sources.portalData).toContain("createJoinSupabaseClient");
    expect(sources.portalData).toContain("serviceDb");
  });
});
