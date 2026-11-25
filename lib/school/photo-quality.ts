const allowed = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

export function imageBytesMatchType(buffer: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => buffer[index] === byte);
  if (mime === "image/webp") {
    const text = new TextDecoder().decode(buffer.subarray(0, 12));
    return buffer.length >= 12 && text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  }
  return false;
}

export function decodeAttendancePhoto(dataUrl: string) {
  const match = dataUrl.match(allowed);
  if (!match) return { ok: false as const, message: "Use a JPEG, PNG or WebP photograph." };
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 10_000) return { ok: false as const, message: "The photograph is too small to use. Move closer and retake it." };
  if (buffer.length > 1_500_000) return { ok: false as const, message: "The photograph must be under 1.5 MB. Retake it." };
  const mime = match[1];
  if (!imageBytesMatchType(buffer, mime)) return { ok: false as const, message: "The file is not a valid JPEG, PNG or WebP photograph." };
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { ok: true as const, mime, ext: ext as "jpg" | "png" | "webp", buffer };
}

export function clientPhotoQuality(width: number, height: number, variance: number) {
  if (width < 320 || height < 320) return "Move closer so your face fills more of the frame.";
  if (variance < 12) return "The picture looks blank or too dark. Use more light and retake it.";
  return null;
}
