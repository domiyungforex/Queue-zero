// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn(), lookup: vi.fn(), directory: vi.fn(), register: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/school-student/actions", () => ({
  recordAttendance: mocks.record,
  lookupVerifiedStudent: mocks.lookup,
  loadAttendanceDirectory: mocks.directory,
  registerForAttendanceSession: mocks.register,
}));
import { StudentScan } from "@/components/school/student-scan";

const classInfo = { verification_mode: "STANDARD" as const, organization_name: "Test School", course_code: "PHY 101", course_title: "Mechanics", starts_at: null, planned_ends_at: null, attendance_closes_at: null, open: true };

beforeEach(() => {
  sessionStorage.clear();
  mocks.lookup.mockResolvedValue({ ok: true, found: true, full_name: "Akinyele Dominion", matric_number: "PHY/2026/0142", department: "Physics", level: "100" });
  mocks.directory.mockResolvedValue({ ok: true, faculties: [], departments: [] });
});
afterEach(cleanup);

describe("accountless student attendance", () => {
  it("looks up a matric number without asking for a name or a login", async () => {
    render(<StudentScan token="signed-token" classInfo={classInfo} />);
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.queryByRole("link", { name: /sign in|create account|create an optional account/i })).toBeNull();
    expect(screen.getByText(/No account or sign-in is required/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Matriculation number"), { target: { value: "phy/2026/0142" } });
    fireEvent.click(screen.getByRole("button", { name: "Find me" }));
    expect(await screen.findByText("Akinyele Dominion")).toBeTruthy();
    expect(mocks.lookup).toHaveBeenCalledWith("signed-token", "phy/2026/0142");
    expect(mocks.record).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Continue to Selfie/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not continue until the matric number is found", () => {
    render(<StudentScan token="signed-token" classInfo={classInfo} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: /Continue to Selfie/ }).disabled).toBe(true);
  });

  it("offers first-time registration without a sign-up link when the class allows it", async () => {
    mocks.lookup.mockResolvedValueOnce({ ok: true, found: false, selfRegistration: true, message: "Register once for this class." });
    mocks.directory.mockResolvedValueOnce({
      ok: true,
      faculties: [{ id: "11111111-1111-4111-8111-111111111111", name: "Science" }],
      departments: [{ id: "22222222-2222-4222-8222-222222222222", faculty_id: "11111111-1111-4111-8111-111111111111", name: "Physics" }],
    });
    render(<StudentScan token="signed-token" classInfo={classInfo} />);
    fireEvent.change(screen.getByLabelText("Matriculation number"), { target: { value: "NEW/1" } });
    fireEvent.click(screen.getByRole("button", { name: "Find me" }));
    expect(await screen.findByLabelText("Full name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save registration" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in|sign up|create account/i })).toBeNull();
  });

  it("tells an unknown verified student to contact the lecturer", async () => {
    mocks.lookup.mockResolvedValueOnce({ ok: true, found: false, selfRegistration: false, message: "Ask your lecturer to add you. No account is required." });
    render(<StudentScan token="signed-token" classInfo={{ ...classInfo, verification_mode: "VERIFIED" }} />);
    fireEvent.change(screen.getByLabelText("Matriculation number"), { target: { value: "MISSING" } });
    fireEvent.click(screen.getByRole("button", { name: "Find me" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/lecturer/);
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.queryByRole("link", { name: /sign/i })).toBeNull();
  });

  it("does not offer attendance when the class is closed", () => {
    render(<StudentScan token="signed-token" classInfo={{ ...classInfo, open: false }} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: /Continue to Selfie/ }).disabled).toBe(true);
  });
});
