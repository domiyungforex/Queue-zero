import { beforeEach, expect, it, vi } from "vitest";
const generate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queue/qr", () => ({ generateQueueQr: generate }));
vi.mock("@/components/queue/queue-qr-card", () => ({ QueueQrCard: () => null, QueueQrUnavailable: () => null }));
import { QueueQr } from "@/components/queue/queue-qr";
import { QueueQrCard, QueueQrUnavailable } from "@/components/queue/queue-qr-card";
const props = { queueId: "private-id", slug: "public-slug", businessName: "Clinic", queueName: "Consultation" };
beforeEach(() => { generate.mockReset(); });
it("encodes only the configured app origin and public slug", async () => {
  generate.mockResolvedValue({ publicUrl: "http://localhost:3000/q/public-slug", pngDataUrl: "data:image/png;base64,fixture", filename: "queuezero-public-slug.png" });
  expect((await QueueQr(props)).type).toBe(QueueQrCard);
  expect(generate).toHaveBeenCalledWith("http://localhost:3000", "public-slug");
});
it("contains encoding failures so the staff queue page stays usable", async () => {
  generate.mockRejectedValue(new Error("Encoding failed"));
  expect((await QueueQr(props)).type).toBe(QueueQrUnavailable);
});
