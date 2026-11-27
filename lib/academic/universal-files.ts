export const UNIVERSAL_ALLOWED_EXTENSIONS = new Set([
  // Documents & Images
  "pdf", "doc", "docx", "ppt", "pptx", "txt", "rtf", "md", "csv",
  "jpg", "jpeg", "png", "webp", "heic", "heif", "gif",
  // Fine Art & Design
  "tiff", "tif", "psd", "svg",
  // Engineering & CAD
  "dwg", "dxf", "step", "stp", "stl", "obj", "fbx",
  // Architecture & 3D
  "skp", "glb",
  // Technical / Code / Presentations / Spreadsheets
  "zip", "xlsx", "xls", "py", "js", "ts", "c", "cpp", "java", "json",
]);

export const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "msi", "dll", "so", "dylib", "com", "scr", "vbs", "ps1", "jar", "apk",
]);

export function inferSafeMimeType(ext: string, rawMime?: string): string {
  const clean = ext.toLowerCase().trim();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    rtf: "application/rtf",
    json: "application/json",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    svg: "image/svg+xml",
    zip: "application/zip",
  };
  if (map[clean]) return map[clean];
  if (rawMime && rawMime !== "application/octet-stream") return rawMime;
  return "application/octet-stream";
}

export function validateUniversalFile(input: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  maxSizeBytes?: number;
  allowedExtensions?: Set<string>;
}): { ok: true; ext: string; previewable: boolean; mimeType: string } | { ok: false; error: string } {
  const maxBytes = input.maxSizeBytes ?? 25 * 1024 * 1024;
  if (input.buffer.byteLength <= 0 || input.buffer.byteLength > maxBytes) {
    return { ok: false, error: `File must be between 1 byte and ${Math.round(maxBytes / (1024 * 1024))} MB.` };
  }

  const ext = input.fileName.split(".").pop()?.toLowerCase().trim() ?? "";
  if (!ext || BLOCKED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return { ok: false, error: `File type '.${ext || "unknown"}' is blocked for security reasons.` };
  }
  const allowlist = input.allowedExtensions ?? UNIVERSAL_ALLOWED_EXTENSIONS;
  if (!allowlist.has(ext)) {
    return { ok: false, error: `File type '.${ext}' is not permitted for this assignment.` };
  }

  // Signature checks for common binary formats
  const b = input.buffer;
  if (ext === "pdf" && b.subarray(0, 4).toString("ascii") !== "%PDF") {
    return { ok: false, error: "File does not have a valid PDF signature." };
  }
  if (ext === "png" && !(b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)) {
    return { ok: false, error: "File does not have a valid PNG signature." };
  }
  if ((ext === "jpg" || ext === "jpeg") && !(b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) {
    return { ok: false, error: "File does not have a valid JPEG signature." };
  }
  if ((ext === "docx" || ext === "pptx" || ext === "xlsx" || ext === "zip") && !(b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b)) {
    return { ok: false, error: "Archive/Office document does not have a valid ZIP header." };
  }
  if (ext === "dwg" && b.length >= 6 && !b.subarray(0, 2).toString("ascii").startsWith("AC")) {
    return { ok: false, error: "AutoCAD DWG file signature is invalid (expected AC header)." };
  }

  const previewable = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "txt"].includes(ext);
  return { ok: true, ext, previewable, mimeType: inferSafeMimeType(ext, input.mimeType) };
}
