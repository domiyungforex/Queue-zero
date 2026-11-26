// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/school-student/registration", () => ({
  correctStudentProfile: vi.fn(async () => ({ ok: true, message: "Updated" })),
  createStudentByAdmin: vi.fn(async () => ({ ok: true, message: "Created" })),
}));
vi.mock("@/lib/school/actions", () => ({
  deleteStudentProfile: vi.fn(async () => ({ ok: true, message: "Deleted" })),
  deleteClassSession: vi.fn(async () => ({ ok: true, message: "Deleted" })),
  importRoster: vi.fn(async () => ({ ok: true, message: "Imported" })),
  manageSchool: vi.fn(async () => ({ ok: true, message: "Saved" })),
}));

import { StudentManagementWorkspace } from "@/components/school/student-management-workspace";
import { schoolFixture } from "./school-fixture";
import type { EnrichedStudentRecord } from "@/lib/school/student-details";

afterEach(cleanup);

const studentsFixture: EnrichedStudentRecord[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Abass Khalid Olamilekan",
    matric_number: "202660228671ID",
    department_id: schoolFixture().departments[0].id,
    department_name: schoolFixture().departments[0].name,
    faculty_id: schoolFixture().faculties[0].id,
    faculty_name: schoolFixture().faculties[0].name,
    programme: "Agricultural Engineering",
    level: "400",
    phone: "+234 800 000 0000",
    email: "abasskhalid@gmail.com",
    created_at: "2026-01-15T10:00:00Z",
    has_photo: true,
    latest_status: "PRESENT",
    enrolled_courses: ["PHY101"],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    full_name: "Aisha Bello",
    matric_number: "202310445678ID",
    department_id: schoolFixture().departments[0].id,
    department_name: schoolFixture().departments[0].name,
    faculty_id: schoolFixture().faculties[0].id,
    faculty_name: schoolFixture().faculties[0].name,
    programme: "Computer Science",
    level: "300",
    phone: "",
    email: "aisha@university.edu",
    created_at: "2026-02-10T10:00:00Z",
    has_photo: false,
    latest_status: "LATE",
    enrolled_courses: [],
  },
];

describe("StudentManagementWorkspace", () => {
  it("renders profile overview, personal info, and three primary actions", () => {
    render(
      <StudentManagementWorkspace
        snapshot={schoolFixture()}
        students={studentsFixture}
        canManage={true}
      />,
    );

    expect(screen.getByRole("heading", { name: "Student Profile Management" })).toBeTruthy();
    expect(screen.getAllByText("Abass Khalid Olamilekan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("202660228671ID").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("abasskhalid@gmail.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add new student/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Import students/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Share registration link/i })).toBeTruthy();
  });

  it("filters student records by search and resets filters", () => {
    render(
      <StudentManagementWorkspace
        snapshot={schoolFixture()}
        students={studentsFixture}
        canManage={true}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/Search by name or matric number/i);
    fireEvent.change(searchInput, { target: { value: "Aisha" } });
    expect(screen.getByText("(1)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(screen.getByText("(2)")).toBeTruthy();
  });

  it("opens edit profile modal only when canManage is true", () => {
    const { rerender } = render(
      <StudentManagementWorkspace
        snapshot={schoolFixture()}
        students={studentsFixture}
        canManage={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Edit profile$/i })).toBeNull();

    rerender(
      <StudentManagementWorkspace
        snapshot={schoolFixture()}
        students={studentsFixture}
        canManage={true}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit profile$/i })[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save student profile/i })).toBeTruthy();
  });
});
