import { describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
vi.mock("server-only", () => ({}));
import { buildPublicQueueUrl } from "@/lib/queue/public-url";
import { generateQueueQr } from "@/lib/queue/qr";

const slug = "doctor-consultation-0123456789abcdef0123456789abcdef";
describe("public queue destinations", () => {
  it.each(["https://queuezero.com", "https://queuezero.vercel.app", "http://localhost:3000"])("uses the configured origin %s", (origin) => {
    expect(buildPublicQueueUrl(origin, slug)).toBe(`${origin}/q/${slug}`);
    expect(buildPublicQueueUrl(`${origin}/`, slug)).toBe(`${origin}/q/${slug}`);
  });
  it.each(["not-a-url", "javascript:alert(1)", "ftp://queuezero.com", "https://user:secret@queuezero.com", "https://queuezero.com/dashboard", "https://queuezero.com?tenant=1", "https://queuezero.com#section"])("rejects unsafe or ambiguous origin %s", (origin) => {
    expect(() => buildPublicQueueUrl(origin, slug)).toThrow("Configure NEXT_PUBLIC_APP_URL");
  });
  it.each(["", "../another", "queue?redirect=evil", "queue#section", "https://evil.example", "UPPERCASE", "a".repeat(101)])("rejects invalid slug %s", (value) => {
    expect(() => buildPublicQueueUrl("https://queuezero.com", value)).toThrow("Invalid public queue slug");
  });
});

describe("exported QR images", () => {
  it.each([slug, "a".repeat(100)])("decodes the generated PNG to the exact destination for %s", async (queueSlug) => {
    const artifact = await generateQueueQr("https://queuezero.vercel.app", queueSlug);
    expect(artifact.pngDataUrl).toMatch(/^data:image\/png;base64,/);
    const png = PNG.sync.read(Buffer.from(artifact.pngDataUrl.split(",")[1], "base64"));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(`https://queuezero.vercel.app/q/${queueSlug}`);
    expect(artifact.publicUrl).toBe(decoded?.data);
    expect(artifact.filename).toBe(`queuezero-${queueSlug}.png`);
    expect(png.width).toBe(png.height);
    // Four-module white quiet zone at sixteen pixels per module.
    for (let x = 0; x < png.width; x++) {
      expect([...png.data.subarray(x * 4, x * 4 + 4)]).toEqual([255, 255, 255, 255]);
      expect([...png.data.subarray((63 * png.width + x) * 4, (63 * png.width + x) * 4 + 4)]).toEqual([255, 255, 255, 255]);
    }
  });
  it("generates stable images without depending on queue status or display names", async () => {
    expect(await generateQueueQr("https://queuezero.com", slug)).toEqual(await generateQueueQr("https://queuezero.com", slug));
  });
});
