import { describe, expect, it } from "vitest";
import { buildEducationDashboard } from "@/lib/school/dashboard";
import { classId, courseId, schoolFixture, studentId } from "./school-fixture";

describe("education dashboard projection", () => {
  it("uses only actual roster and same-day attendance records", () => {
    const snapshot = schoolFixture();
    const dashboard = buildEducationDashboard(snapshot, "2026-10-03");
    expect(dashboard.metrics).toEqual({ totalStudents: 1, presentToday: 1, absentToday: 0, classesToday: 1 });
    expect(dashboard.classes.map((session) => session.id)).toEqual([classId]);
    expect(dashboard.recentAttendance[0]?.student?.id).toBe(studentId);
  });

  it("shows real zeros instead of inventing activity", () => {
    const snapshot = schoolFixture();
    snapshot.classes = [];
    snapshot.attendance = [];
    const dashboard = buildEducationDashboard(snapshot, "2026-10-03");
    expect(dashboard.metrics).toEqual({ totalStudents: 1, presentToday: 0, absentToday: 0, classesToday: 0 });
    expect(dashboard.attendanceTrend).toEqual([]);
  });

  it("keeps completed-class trend values tied to recorded attendance", () => {
    const snapshot = schoolFixture();
    snapshot.attendance.push({ id: "22222222-2222-4222-8222-222222222222", class_session_id: classId, student_id: "eeeeeeee-1111-4111-8111-111111111111", check_in_at: null, check_out_at: null, status: "ABSENT", flag_reason: null });
    expect(buildEducationDashboard(snapshot, "2026-10-03").attendanceTrend).toEqual([{ id: classId, date: "2026-10-03", rate: 50 }]);
    expect(snapshot.courses[0]?.id).toBe(courseId);
  });
});
