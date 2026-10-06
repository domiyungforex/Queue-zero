// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/school-student/actions", () => ({ recordAttendance: mocks.record }));
import { StudentScan } from "@/components/school/student-scan";
beforeEach(() => {
  sessionStorage.clear();
  mocks.record.mockReset().mockResolvedValue({ ok: true, action: "CHECK_IN", message: "Recorded" });
});
afterEach(cleanup);
function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Student" } });
  fireEvent.change(screen.getByLabelText("Matric number"), { target: { value: "PHY/26/001" } });
}
function submit() {
  fill();
  fireEvent.click(screen.getByRole("button", { name: /Mark attendance|Try again/ }));
}
describe("public student attendance scan", () => {
  it("submits name + matric only after explicit action", async () => {
    render(<StudentScan token="signed-token" />);
    expect(mocks.record).not.toHaveBeenCalled();
    submit();
    await screen.findByRole("status");
    expect(mocks.record).toHaveBeenCalledWith({ token: "signed-token", requestId: expect.any(String), fullName: "Ada Student", matricNumber: "PHY/26/001" });
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("reuses the same request ID after a lost response and reload", async () => {
    mocks.record.mockRejectedValueOnce(new Error("connection"));
    const firstView = render(<StudentScan token="signed-token" />);
    submit(); await screen.findByRole("alert");
    const first = mocks.record.mock.calls[0][0];
    firstView.unmount();
    render(<StudentScan token="signed-token" />);
    submit(); await screen.findByRole("status");
    expect(mocks.record.mock.calls[1][0].requestId).toBe(first.requestId);
  });
  it("blocks duplicate submission while a response is pending", async () => {
    let finish!: (value: unknown) => void;
    mocks.record.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<StudentScan token="signed-token" />);
    fill();
    const button = screen.getByRole("button", { name: "Mark attendance" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.record).toHaveBeenCalledTimes(1);
    finish({ ok: true, action: "CHECK_OUT", message: "Recorded" });
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });
  it("never submits a QR already known to be expired", () => {
    render(<StudentScan token="expired-token" expired />);
    expect(screen.getByRole("alert").textContent).toContain("expired");
    expect(screen.queryByRole("button")).toBeNull();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("does not offer retry with the same token when the server reports expiry", async () => {
    mocks.record.mockResolvedValueOnce({ ok: false, expired: true, message: "This QR has expired. Scan the current classroom QR." });
    render(<StudentScan token="signed-token" />);
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain("expired");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
