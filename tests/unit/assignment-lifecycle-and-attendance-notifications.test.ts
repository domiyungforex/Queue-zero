import { describe, expect, it } from "vitest";
import {
  createAssignmentSchema,
  deleteAssignmentSchema,
  updateAssignmentSchema,
} from "@/lib/academic/types";
import {
  buildAttendanceNotificationMessage,
  deduplicateRecipients,
  formatAttendanceLocalTime,
} from "@/lib/school/attendance-notification-format";

describe("assignment creation & editing validation", () => {
  const validCourseId = "11111111-1111-4111-8111-111111111111";

  it("accepts existing catalog course selection with typed questions", () => {
    const parsed = createAssignmentSchema.safeParse({
      title: "Algorithms Lab 1",
      courseId: validCourseId,
      questions: [{ questionType: "SHORT_ANSWER", prompt: "Explain Big-O notation.", marks: 10 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts manually entered course name and code without courseId", () => {
    const parsed = createAssignmentSchema.safeParse({
      title: "Thermodynamics Problem Set",
      courseId: "",
      manualCourseName: "Engineering Thermodynamics",
      manualCourseCode: "MEE 201",
      manualDepartment: "Mechanical Engineering",
      manualFaculty: "Engineering",
      manualLevel: "200 Level",
      questions: [{ questionType: "MATH", prompt: "Derive the first law for a closed system.", marks: 20 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.courseId).toBeNull();
      expect(parsed.data.manualCourseName).toBe("Engineering Thermodynamics");
    }
  });

  it("accepts manually entered course name with no course code and no deadline", () => {
    const parsed = createAssignmentSchema.safeParse({
      title: "General Essay",
      courseId: null,
      manualCourseName: "Use of English",
      manualCourseCode: "",
      description: "",
      dueAt: "",
      questions: [{ questionType: "ESSAY", prompt: "Discuss academic integrity.", marks: 15 }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dueAt).toBeNull();
      expect(parsed.data.description).toBe("");
    }
  });

  it("accepts instruction-only or uploaded-document assignments with blank placeholder question", () => {
    const parsed = createAssignmentSchema.safeParse({
      title: "Attached PDF Worksheet",
      courseId: validCourseId,
      instructions: "Download the attached PDF and submit your scanned solution.",
      questions: [{ questionType: "SHORT_ANSWER", prompt: "", marks: 10 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("reports precise field-level errors when title or course is missing", () => {
    const missingTitle = createAssignmentSchema.safeParse({
      title: "   ",
      courseId: validCourseId,
      questions: [{ questionType: "SHORT_ANSWER", prompt: "Q1" }],
    });
    expect(missingTitle.success).toBe(false);
    if (!missingTitle.success) {
      expect(missingTitle.error.issues[0]?.path).toContain("title");
    }

    const missingCourse = createAssignmentSchema.safeParse({
      title: "Valid Title",
      courseId: "",
      manualCourseName: "",
      manualCourseCode: "",
      questions: [{ questionType: "SHORT_ANSWER", prompt: "Q1" }],
    });
    expect(missingCourse.success).toBe(false);
    if (!missingCourse.success) {
      expect(missingCourse.error.issues[0]?.path).toContain("manualCourseName");
    }
  });

  it("validates updateAssignmentSchema and deleteAssignmentSchema confirmation", () => {
    const updated = updateAssignmentSchema.safeParse({
      assignmentId: validCourseId,
      title: "Updated Title",
      manualCourseName: "Physics 101",
      instructions: "Updated instructions",
      changeSummary: "Extended deadline",
      notifyStudents: true,
      questions: [],
    });
    expect(updated.success).toBe(true);

    const unconfirmedDelete = deleteAssignmentSchema.safeParse({
      assignmentId: validCourseId,
      confirmed: false,
    });
    expect(unconfirmedDelete.success).toBe(false);
  });
});

describe("automated attendance session notifications", () => {
  it("deduplicates eligible student recipients by studentId", () => {
    const deduped = deduplicateRecipients([
      {
        studentId: "stu-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        phone: null,
        clerkUserId: "user_1",
        departmentId: null,
        level: "200",
      },
      {
        studentId: "stu-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        phone: null,
        clerkUserId: "user_1",
        departmentId: null,
        level: "200",
      },
      {
        studentId: "stu-2",
        fullName: "Alan Turing",
        email: null,
        phone: "+2348000000000",
        clerkUserId: null,
        departmentId: null,
        level: "200",
      },
    ]);
    expect(deduped).toHaveLength(2);
  });

  it("formats local attendance window and omits open link for scheduled/cancelled sessions", () => {
    const formatted = formatAttendanceLocalTime("2026-11-27T09:00:00.000Z", "Africa/Lagos");
    expect(formatted).not.toBe("TBA");

    const openMsg = buildAttendanceNotificationMessage({
      institutionName: "OOU",
      courseCode: "PHY 201",
      courseTitle: "Optics",
      lecturerName: "Dr. Bello",
      sessionTitle: "Morning Lecture",
      venue: "Lecture Hall 2",
      startsAt: "2026-11-27T09:00:00.000Z",
      closesAt: "2026-11-27T10:00:00.000Z",
      timezone: "Africa/Lagos",
      attendanceUrl: "https://turnmark.conchportal.com/attend/abc",
      eventType: "SESSION_OPENED",
    });
    expect(openMsg.body).toContain("is now open");
    expect(openMsg.body).toContain("https://turnmark.conchportal.com/attend/abc");
    expect(openMsg.body).toContain("Lecture Hall 2");

    const scheduledMsg = buildAttendanceNotificationMessage({
      institutionName: "OOU",
      courseCode: "PHY 201",
      courseTitle: "Optics",
      lecturerName: "Dr. Bello",
      sessionTitle: null,
      venue: "Lecture Hall 2",
      startsAt: "2026-11-27T09:00:00.000Z",
      closesAt: "2026-11-27T10:00:00.000Z",
      timezone: "Africa/Lagos",
      attendanceUrl: "https://turnmark.conchportal.com/attend/abc",
      eventType: "SESSION_SCHEDULED",
    });
    expect(scheduledMsg.body).toContain("has been scheduled");
    expect(scheduledMsg.body).not.toContain("https://turnmark.conchportal.com/attend/abc");
  });
});
