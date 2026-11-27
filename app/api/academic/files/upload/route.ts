import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { storePrivateImage } from "@/lib/storage/store-image";

export const runtime = "nodejs";
export const maxDuration = 15;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  try {
    const membership = await requireBusinessMembership();
    const formData = await request.formData();
    const file = formData.get("file");
    const assignmentId = String(formData.get("assignmentId") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file format. Upload PDF, DOCX, JPEG, PNG, or WebP." },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be between 1 byte and 15 MB." }, { status: 413 });
    }

    const safeExt =
      file.type === "application/pdf"
        ? "pdf"
        : file.type.includes("wordprocessingml")
          ? "docx"
          : file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";

    const key = `academic/${membership.businessId}/${assignmentId || "general"}/${randomUUID()}.${safeExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const db = createJoinSupabaseClient();

    const stored = await storePrivateImage(db, { key, body: buffer, type: file.type });
    if (!stored.ok) {
      return NextResponse.json({ error: "Private storage unavailable." }, { status: 503 });
    }

    return NextResponse.json({
      storagePath: stored.key,
      fileName: file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120),
      mimeType: file.type,
      sizeBytes: file.size,
    });
  } catch {
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
