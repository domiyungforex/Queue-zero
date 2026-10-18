import type { SchoolSnapshot } from "@/lib/school/contracts";

const ATTENDED_STATUSES = new Set(["PRESENT", "LATE", "EARLY_LEAVE", "INCOMPLETE", "FLAGGED"]);

export function buildEducationDashboard(snapshot: SchoolSnapshot, today: string) {
  const classes = snapshot.classes
    .filter((session) => session.starts_at?.slice(0, 10) === today)
    .sort((left, right) => (left.starts_at ?? "").localeCompare(right.starts_at ?? ""));
  const classIds = new Set(classes.map((session) => session.id));
  const attendance = snapshot.attendance.filter((row) => classIds.has(row.class_session_id));
  const presentStudentIds = new Set(
    attendance.filter((row) => row.check_in_at || ATTENDED_STATUSES.has(row.status)).map((row) => row.student_id),
  );
  const absentStudentIds = new Set(
    attendance.filter((row) => row.status === "ABSENT").map((row) => row.student_id),
  );
  const recentAttendance = attendance
    .slice()
    .sort((left, right) => (right.check_in_at ?? "").localeCompare(left.check_in_at ?? ""))
    .slice(0, 6)
    .map((record) => ({
      ...record,
      student: snapshot.students.find((student) => student.id === record.student_id) ?? null,
    }));
  const attendanceTrend = snapshot.classes
    .filter((session) => session.status === "COMPLETED")
    .slice()
    .sort((left, right) => (left.starts_at ?? "").localeCompare(right.starts_at ?? ""))
    .slice(-7)
    .map((session) => {
      const records = snapshot.attendance.filter((row) => row.class_session_id === session.id);
      const attended = records.filter((row) => row.check_in_at || ATTENDED_STATUSES.has(row.status)).length;
      return {
        id: session.id,
        date: session.starts_at?.slice(0, 10) ?? "",
        rate: records.length ? Math.round((attended / records.length) * 100) : null,
      };
    });

  return {
    classes,
    recentAttendance,
    attendanceTrend,
    metrics: {
      totalStudents: snapshot.students.length,
      presentToday: presentStudentIds.size,
      absentToday: absentStudentIds.size,
      classesToday: classes.length,
    },
  };
}
