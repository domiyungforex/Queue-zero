// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ print: vi.fn(), share: vi.fn(), canShare: vi.fn(), copy: vi.fn() }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,cG5n") } }));
vi.mock("next/image", () => ({ default: ({ unoptimized, ...props }: ComponentProps<"img"> & { unoptimized?: boolean }) => {
  void unoptimized;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt} />;
} }));
vi.mock("@/lib/qr/attendance-artifact", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/qr/attendance-artifact")>(), printAttendanceQr: mocks.print,
}));
import { AttendanceQr } from "@/components/school/attendance-qr";
import { classId } from "./school-fixture";
const url = "https://turnmark.test/attend?token=exact-server-signed-token";
const props = { classId, classLabel: "PHY 201 · Mechanics" };
function response(expires = Date.now() + 3_600_000) { return { ok: true, json: async () => ({ url, expiresAt: new Date(expires).toISOString() }) }; }
beforeEach(() => {
  mocks.print.mockReset().mockResolvedValue(undefined);
  mocks.share.mockReset().mockResolvedValue(undefined);
  mocks.canShare.mockReset().mockReturnValue(true);
  mocks.copy.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: mocks.share });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: mocks.canShare });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copy } });
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => response()));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function ready() {
  const view = render(<AttendanceQr {...props} />);
  fireEvent.load(await screen.findByRole("img"));
  return view;
}

describe("lecturer attendance QR actions", () => {
  it("waits for the image before enabling an exact PNG download", async () => {
    render(<AttendanceQr {...props} />);
    const image = await screen.findByRole("img");
    expect((screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.load(image);
    const link = screen.getByRole("link", { name: "Download PNG" });
    expect(link.getAttribute("href")).toBe(image.getAttribute("src"));
    expect(link.getAttribute("download")).toBe("turnmark-attendance-phy-201-mechanics.png");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("shares a PNG file through the native share sheet without requesting another token", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Share QR" }));
    await screen.findByText("Attendance QR shared.");
    const data = mocks.share.mock.calls[0][0] as ShareData;
    expect(data.files).toHaveLength(1);
    expect(data.files![0]).toMatchObject({ name: "turnmark-attendance-phy-201-mechanics.png", type: "image/png", size: 3 });
    expect(data.text).toContain("Available until");
    expect(data.url).toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("shares the exact signed URL when native file sharing is unavailable", async () => {
    mocks.canShare.mockReturnValue(false);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Share QR" }));
    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ url })));
    expect(mocks.share.mock.calls[0][0].files).toBeUndefined();
  });
  it("copies the link when native sharing is unsupported", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Share QR" }));
    await screen.findByText("Attendance link copied.");
    expect(mocks.copy).toHaveBeenCalledWith(url);
  });
  it("provides a selectable link when both sharing and clipboard are unavailable", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Share QR" }));
    const input = await screen.findByLabelText("Attendance link") as HTMLInputElement;
    expect(input.value).toBe(url);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(url.length);
  });
  it("treats cancellation as cancellation, without claiming successful sharing", async () => {
    mocks.share.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Share QR" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Share QR" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Attendance QR shared.")).toBeNull();
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it("offers manual copy after a native share failure without exposing browser diagnostics", async () => {
    mocks.share.mockRejectedValue(new Error("private details"));
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Share QR" }));
    expect((await screen.findByLabelText("Attendance link") as HTMLInputElement).value).toBe(url);
    expect(screen.queryByText("private details")).toBeNull();
  });
  it("prints the exact QR and class label, with cancellation on unmount", async () => {
    const view = await ready();
    fireEvent.click(screen.getByRole("button", { name: "Print QR" }));
    await screen.findByText(/Print dialog requested/);
    const [artifact, label, signal] = mocks.print.mock.calls[0];
    expect(artifact).toMatchObject({ url, image: "data:image/png;base64,cG5n" });
    expect(label).toBe(props.classLabel);
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it("reports print failure and allows retry", async () => {
    mocks.print.mockRejectedValueOnce(new Error("private print error"));
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Print QR" }));
    expect((await screen.findByRole("alert")).textContent).toContain("couldn’t prepare");
    fireEvent.click(screen.getByRole("button", { name: "Print QR" }));
    await screen.findByText(/Print dialog requested/);
  });
  it("removes the old QR and actions immediately when the class changes", async () => {
    const view = await ready();
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));
    view.rerender(<AttendanceQr {...props} classId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("link", { name: "Download PNG" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share QR" })).toBeNull();
  });
  it("removes expired QR actions without polling for a replacement", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(response(Date.now() + 1_000) as Response);
    await act(async () => { render(<AttendanceQr {...props} />); });
    fireEvent.load(screen.getByRole("img"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/This attendance QR has expired/)).toBeTruthy();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("guards download if expiry passes while browser timers are suspended", async () => {
    await ready();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 7_200_000);
    const link = screen.getByRole("link", { name: "Download PNG" });
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("offers retry instead of actions when the QR image fails to display", async () => {
    render(<AttendanceQr {...props} />);
    fireEvent.error(await screen.findByRole("img"));
    expect(screen.getByRole("button", { name: "Retry QR" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Print QR" })).toBeNull();
  });
});
