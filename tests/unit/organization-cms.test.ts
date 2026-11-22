import { describe, expect, it } from "vitest";
import { getOrganizationTerminology } from "@/lib/organization/terminology";
import { cmsOverviewSchema, attendanceOversightSchema } from "@/lib/organization/contracts";

describe("Organization CMS Architecture & Terminology", () => {
  it("adapts terminology accurately for Higher Education / University institutions", () => {
    const terms = getOrganizationTerminology("UNIVERSITY", null);
    expect(terms.level1).toBe("Faculty");
    expect(terms.level1Plural).toBe("Faculties");
    expect(terms.level2).toBe("Department");
    expect(terms.operationalItem).toBe("Course");
    expect(terms.assignedPersonnel).toBe("Lecturer");
    expect(terms.participant).toBe("Student");
    expect(terms.session).toBe("Class Session");
  });

  it("adapts terminology accurately for Healthcare / Hospital organizations", () => {
    const terms = getOrganizationTerminology(null, "HOSPITAL_CLINIC");
    expect(terms.level1).toBe("Facility");
    expect(terms.level2).toBe("Department");
    expect(terms.operationalItem).toBe("Service");
    expect(terms.assignedPersonnel).toBe("Practitioner");
    expect(terms.participant).toBe("Patient");
    expect(terms.session).toBe("Visit Session");
  });

  it("adapts terminology accurately for Event / Conference organizations", () => {
    const terms = getOrganizationTerminology(null, "CONFERENCE_EVENT");
    expect(terms.level1).toBe("Stage");
    expect(terms.level2).toBe("Track");
    expect(terms.operationalItem).toBe("Session");
    expect(terms.assignedPersonnel).toBe("Coordinator");
    expect(terms.participant).toBe("Participant");
    expect(terms.session).toBe("Check-in Session");
  });

  it("adapts terminology accurately for Corporate / Business organizations", () => {
    const terms = getOrganizationTerminology(null, "BUSINESS");
    expect(terms.level1).toBe("Division");
    expect(terms.level2).toBe("Department");
    expect(terms.operationalItem).toBe("Service");
    expect(terms.assignedPersonnel).toBe("Lead / Manager");
    expect(terms.participant).toBe("Member");
  });

  it("validates CMS Overview statistics schema correctly", () => {
    const validData = {
      organization_id: "a0000000-0000-4000-8000-000000000001",
      total_faculties: 4,
      total_departments: 12,
      total_units: 14,
      total_courses: 48,
      total_lecturers: 16,
      total_students: 1250,
      total_personnel: 24,
      active_sessions: 3,
      today_checkins: 420,
      total_queues: 5,
      total_bookings: 38,
    };
    const parsed = cmsOverviewSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.total_faculties).toBe(4);
      expect(parsed.data.total_courses).toBe(48);
      expect(parsed.data.active_sessions).toBe(3);
    }
  });

  it("validates Institutional Attendance Oversight schema correctly", () => {
    const validOversight = {
      summary: {
        total_recorded: 150,
        present_count: 140,
        late_count: 8,
        flagged_count: 2,
        active_classes: 2,
      },
      records: [
        {
          id: "b0000000-0000-4000-8000-000000000001",
          class_session_id: "c0000000-0000-4000-8000-000000000001",
          course_id: "d0000000-0000-4000-8000-000000000001",
          course_code: "PHY 201",
          course_title: "General Physics I",
          department_name: "Mechanical Engineering",
          faculty_name: "Faculty of Engineering",
          student_name: "Chukwuemeka Okafor",
          matric_number: "ENG/2024/042",
          student_level: "200L",
          status: "PRESENT",
          check_in_at: "2026-11-22T10:05:00Z",
          verification_mode: "VERIFIED",
          has_photo: true,
          has_geofence: true,
          lecturer_name: "Dr. Adeleke Adebayo",
        },
      ],
      departments: [
        { id: "e0000000-0000-4000-8000-000000000001", name: "Mechanical Engineering" },
      ],
      courses: [
        {
          id: "d0000000-0000-4000-8000-000000000001",
          code: "PHY 201",
          title: "General Physics I",
          department_id: "e0000000-0000-4000-8000-000000000001",
        },
      ],
    };
    const parsed = attendanceOversightSchema.safeParse(validOversight);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.records).toHaveLength(1);
      expect(parsed.data.records[0].course_code).toBe("PHY 201");
      expect(parsed.data.records[0].lecturer_name).toBe("Dr. Adeleke Adebayo");
      expect(parsed.data.records[0].department_name).toBe("Mechanical Engineering");
    }
  });
});
