// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attendanceQrFilename, printAttendanceQr } from "@/lib/qr/attendance-artifact";

const decode = vi.fn();
const print = vi.fn();
const focus = vi.fn();
const qr = () => ({ image: "data:image/png;base64,cG5n", url: "https://turnmark.test/attend?token=signed", expires: Date.now() + 60_000 });
beforeEach(() => {
  decode.mockReset().mockResolvedValue(undefined);
  print.mockReset(); focus.mockReset();
  const append = document.body.append;
  vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
    append.apply(document.body, nodes);
    for (const node of nodes) {
      if (node instanceof HTMLIFrameElement) {
        const target = node.contentWindow!;
        Object.defineProperty(target, "print", { configurable: true, value: print });
        Object.defineProperty(target, "focus", { configurable: true, value: focus });
        // Iframes have their own image prototype and decoding lifecycle.
        const image = node.contentDocument!.createElement("img");
        Object.defineProperty(Object.getPrototypeOf(image), "decode", { configurable: true, value: decode });
      }
    }
  });
});
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("attendance-only print document", () => {
  it("prints a separate sheet with the exact QR, expiry and no student register", async () => {
    document.body.innerHTML = "<h1>Student register</h1><p>Private student name and matric</p>";
    const artifact = qr();
    await printAttendanceQr(artifact, "PHY 201 · Mechanics", new AbortController().signal);
    const frame = document.querySelector("iframe")!;
    const doc = frame.contentDocument!;
    expect(doc.querySelector("h1")?.textContent).toBe("PHY 201 · Mechanics");
    expect(doc.querySelector("img")?.src).toBe(artifact.image);
    expect(doc.body.textContent).toContain("Available until");
    expect(doc.body.textContent).toContain("No account or advance registration required");
    expect(doc.body.textContent).not.toContain("Private student");
    expect(doc.body.textContent).not.toContain("Student register");
    expect(doc.body.textContent).not.toContain(artifact.url);
    expect(decode).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("renders user-controlled class names as text and sanitizes filenames", async () => {
    const label = '<script>alert("x")</script>';
    await printAttendanceQr(qr(), label, new AbortController().signal);
    const doc = document.querySelector("iframe")!.contentDocument!;
    expect(doc.querySelector("h1")?.textContent).toBe(label);
    expect(doc.querySelector("script")).toBeNull();
    expect(attendanceQrFilename('../../PHY 201 / Mechanics')).toBe("turnmark-attendance-phy-201-mechanics.png");
  });
  it("keeps the hidden frame out of tab order and restores the print button's focus", async () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    await printAttendanceQr(qr(), "Class", new AbortController().signal);
    const frame = document.querySelector("iframe")!;
    expect(frame.tabIndex).toBe(-1);
    frame.focus();
    expect(document.activeElement).toBe(frame);
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(document.activeElement).toBe(button);
  });
  it("does not move focus back when the user has focused another control", async () => {
    const trigger = document.createElement("button");
    const other = document.createElement("button");
    document.body.append(trigger, other);
    trigger.focus();
    await printAttendanceQr(qr(), "Class", new AbortController().signal);
    other.focus();
    document.querySelector("iframe")!.contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(document.activeElement).toBe(other);
  });
  it("does not print or leave a frame when decoding fails", async () => {
    decode.mockRejectedValue(new Error("bad image"));
    await expect(printAttendanceQr(qr(), "Class", new AbortController().signal)).rejects.toThrow();
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("cancels a pending print on unmount or class change", async () => {
    decode.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = printAttendanceQr(qr(), "Class", controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow("Printing cancelled");
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("times out a stalled image so printing can be retried", async () => {
    vi.useFakeTimers();
    decode.mockReturnValue(new Promise(() => {}));
    const pending = printAttendanceQr(qr(), "Class", new AbortController().signal);
    const rejected = expect(pending).rejects.toThrow("QR image unavailable");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("rechecks expiry after decoding before invoking the print dialog", async () => {
    let resolve!: () => void;
    decode.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const pending = printAttendanceQr(qr(), "Class", new AbortController().signal);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120_000);
    resolve();
    await expect(pending).rejects.toThrow("Attendance QR unavailable");
    expect(print).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
