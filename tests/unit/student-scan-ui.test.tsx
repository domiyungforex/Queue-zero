// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/school-student/actions", () => ({ recordAttendance: mocks.record }));
import { StudentScan } from "@/components/school/student-scan";
const classInfo = { organization_name: "Test School", course_code: "PHY 101", course_title: "Mechanics", starts_at: null, planned_ends_at: null, attendance_closes_at: null, open: true };
function submit() { fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Akinyele Dominion" } }); fireEvent.change(screen.getByLabelText("Matric number"), { target: { value: "PHY/2026/0142" } }); fireEvent.click(screen.getByRole("button", { name: "Mark Attendance" })); }
beforeEach(() => { sessionStorage.clear(); mocks.record.mockResolvedValue({ ok: true, status: "PRESENT", message: "Attendance marked ✓", full_name: "Akinyele Dominion", matric_number: "PHY/2026/0142", course_code: "PHY 101", recorded_at: "2026-10-04T10:04:00Z" }); });
afterEach(cleanup);
describe("accountless student attendance", () => {
  it("explains that preregistration is optional", () => {
    render(<StudentScan token="signed-token" classInfo={classInfo} />);
    expect(screen.getByText(/No account or advance registration needed/)).toBeTruthy();
  });
  it("allows correcting a rejected name with a fresh request", async () => {
    mocks.record.mockResolvedValueOnce({ ok: false, status: "NAME_MISMATCH", message: "Check your name." });
    render(<StudentScan token="signed-token" classInfo={classInfo} />);
    submit();
    await screen.findByRole("alert");
    const rejectedId = mocks.record.mock.calls[0][0].requestId;
    submit();
    await screen.findByText("Attendance marked ✓");
    expect(mocks.record.mock.calls[1][0].requestId).not.toBe(rejectedId);
  });
  it("submits name and matric only after explicit confirmation", async () => { render(<StudentScan token="signed-token" classInfo={classInfo} />); expect(mocks.record).not.toHaveBeenCalled(); submit(); await screen.findByText("Attendance marked ✓"); expect(mocks.record).toHaveBeenCalledWith({ token: "signed-token", requestId: expect.any(String), fullName: "Akinyele Dominion", matricNumber: "PHY/2026/0142" }); expect(screen.getByText(/No account was created/)).toBeTruthy(); });
  it("reuses its request ID after a lost response and reload", async () => { mocks.record.mockRejectedValueOnce(new Error("connection")); const view = render(<StudentScan token="signed-token" classInfo={classInfo} />); submit(); await screen.findByRole("alert"); const first = mocks.record.mock.calls[0][0]; view.unmount(); render(<StudentScan token="signed-token" classInfo={classInfo} />); submit(); await screen.findByText("Attendance marked ✓"); expect(mocks.record.mock.calls[1][0]).toEqual(first); });
  it("blocks a double submit while the server response is pending", async () => { let finish!: (value: unknown) => void; mocks.record.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })); render(<StudentScan token="signed-token" classInfo={classInfo} />); fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Akinyele Dominion" } }); fireEvent.change(screen.getByLabelText("Matric number"), { target: { value: "PHY/2026/0142" } }); const button=screen.getByRole("button", { name: "Mark Attendance" }); fireEvent.click(button); fireEvent.click(button); expect(mocks.record).toHaveBeenCalledTimes(1); finish({ ok: true, status: "PRESENT", message: "Attendance marked ✓", full_name: "Akinyele Dominion", matric_number: "PHY/2026/0142", course_code: "PHY 101" }); await waitFor(() => expect(screen.getByText("Attendance marked ✓")).toBeTruthy()); });
  it("shows authoritative roster errors and keeps the form available", async () => { mocks.record.mockResolvedValueOnce({ ok: false, status: "NAME_MISMATCH", message: "The name entered does not match the class record." }); render(<StudentScan token="signed-token" classInfo={classInfo} />); submit(); expect((await screen.findByRole("alert")).textContent).toContain("does not match"); expect(screen.getByRole("button", { name: "Mark Attendance" })).toBeTruthy(); });
  it("does not offer submission when attendance is closed", () => { render(<StudentScan token="signed-token" classInfo={{ ...classInfo, open: false }} />); expect(screen.getByRole<HTMLButtonElement>("button", { name: "Mark Attendance" }).disabled).toBe(true); expect(screen.getByRole("alert").textContent).toContain("closed"); });
});
