// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), writeText: vi.fn(), print: vi.fn(), decode: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next/image", () => ({ default: ({ unoptimized, ...props }: ComponentProps<"img"> & { unoptimized?: boolean }) => {
  void unoptimized;
  // Test the application's load/error handling without Next image internals.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt} />;
} }));
import { QueueQrCard, QueueQrUnavailable } from "@/components/queue/queue-qr-card";
const artifact = { publicUrl: "https://queuezero.vercel.app/q/consultation-abc", pngDataUrl: "data:image/png;base64,fixture", filename: "turnmark-consultation-abc.png" };
const props = { artifact, queueId: "private-queue-id", businessName: "Main Clinic", queueName: "Doctor Consultation" };
beforeEach(() => {
  mocks.writeText.mockReset().mockResolvedValue(undefined);
  mocks.decode.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.writeText } });
  vi.stubGlobal("print", mocks.print);
  Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: mocks.decode });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function readyImage() { fireEvent.load(screen.getByRole("img")); }

describe("queue QR controls", () => {
  it("enables the correct PNG export after loading and opens only the public URL", async () => {
    render(<QueueQrCard {...props} />);
    expect((screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(true);
    readyImage();
    const download = screen.getByRole("link", { name: "Download PNG" });
    expect(download.getAttribute("href")).toBe(artifact.pngDataUrl);
    expect(download.getAttribute("download")).toBe(artifact.filename);
    const publicLink = screen.getByRole("link", { name: /Open public queue/ });
    expect(publicLink.getAttribute("href")).toBe(artifact.publicUrl);
    expect(publicLink.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: "Print sheet" }).getAttribute("href")).toBe("/dashboard/queues/private-queue-id/qr");
  });
  it("reports successful copy and shows progress while the clipboard is pending", async () => {
    let finish!: () => void;
    mocks.writeText.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<QueueQrCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect((screen.getByRole("button", { name: "Copying…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish());
    expect(mocks.writeText).toHaveBeenCalledWith(artifact.publicUrl);
    expect(await screen.findByText("Queue link copied.")).toBeTruthy();
  });
  it("provides a selected manual-copy fallback when permission is denied", async () => {
    mocks.writeText.mockRejectedValue(new Error("Denied"));
    render(<QueueQrCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await screen.findByRole("alert");
    const input = screen.getByLabelText("Public queue link") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(artifact.publicUrl.length);
  });
  it("provides the same fallback when the Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<QueueQrCard {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
  it("blocks print until the image is ready, decodes it, and requests printing", async () => {
    render(<QueueQrCard {...props} sheet />);
    expect((screen.getByRole("button", { name: "Print" }) as HTMLButtonElement).disabled).toBe(true);
    readyImage();
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => expect(mocks.print).toHaveBeenCalledOnce());
    expect(mocks.decode).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Doctor Consultation", level: 1 })).toBeTruthy();
    expect(screen.getByText("Main Clinic")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Scan to join the queue" })).toBeTruthy();
  });
  it("does not print an undecodable image", async () => {
    mocks.decode.mockRejectedValue(new Error("Decode failed"));
    render(<QueueQrCard {...props} sheet />);
    readyImage();
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    await screen.findByRole("alert");
    expect(mocks.print).not.toHaveBeenCalled();
  });
  it("recovers from image errors by remounting the image and requesting fresh data", () => {
    render(<QueueQrCard {...props} />);
    const previousImage = screen.getByRole("img");
    fireEvent.error(previousImage);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload QR code" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("img")).not.toBe(previousImage);
    readyImage();
    expect(screen.getByRole("link", { name: "Download PNG" })).toBeTruthy();
  });
  it("renders business-controlled text as text, not markup", () => {
    render(<QueueQrCard {...props} businessName={'<img src=x onerror="alert(1)">'} sheet />);
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
  it("offers retry when server-side QR generation fails", () => {
    render(<QueueQrUnavailable />);
    fireEvent.click(screen.getByRole("button", { name: "Retry QR generation" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
