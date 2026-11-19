const allowed = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

export function decodeAttendancePhoto(dataUrl: string) {
  const match = dataUrl.match(allowed);
  if (!match) return { ok: false as const, message: "Use a JPEG, PNG or WebP photograph." };
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 12_000) return { ok: false as const, message: "The photograph is too small to use. Move closer and retake it." };
  if (buffer.length > 450_000) return { ok: false as const, message: "The photograph must be under 450 KB. Retake it." };
  const mime = match[1];
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { ok: true as const, mime, ext, buffer };
}

export function clientPhotoQuality(width: number, height: number, variance: number) {
  if (width < 320 || height < 320) return "Move closer so your face fills more of the frame.";
  if (variance < 12) return "The picture looks blank or too dark. Use more light and retake it.";
  return null;
}
