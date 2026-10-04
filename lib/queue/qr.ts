import "server-only";
import QRCode from "qrcode";
import { buildPublicQueueUrl } from "@/lib/queue/public-url";

export type QueueQrArtifact = { publicUrl: string; pngDataUrl: string; filename: string };

export async function generateQueueQr(appOrigin: string, slug: string): Promise<QueueQrArtifact> {
  const publicUrl = buildPublicQueueUrl(appOrigin, slug);
  const pngDataUrl = await QRCode.toDataURL(publicUrl, {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 4,
    scale: 16,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
  return { publicUrl, pngDataUrl, filename: `turnmark-${slug}.png` };
}
