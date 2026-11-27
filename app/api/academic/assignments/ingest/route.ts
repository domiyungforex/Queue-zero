import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { storePrivateImage } from "@/lib/storage/store-image";
import { extractTextFromDocxBuffer, parseAssignmentFromText } from "@/lib/academic/ingestion";

export const runtime = "nodejs";
export const maxDuration = 20;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

export async function POST(request: Request) {
  try {
    const membership = await requireBusinessMembership();
    if (!["owner", "admin", "manager", "lecturer"].includes(membership.role)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const userId = await requireUserId();
    const userDb = await createUserSupabaseClient();
    const { data: courses } = await userDb
      .from("courses")
      .select("id,code,title")
      .eq("organization_id", membership.businessId);

    const formData = await request.formData();
    const method = String(formData.get("method") ?? "DESCRIPTION").toUpperCase();
    const descriptionText = String(formData.get("description") ?? "").trim();
    const file = formData.get("file");

    const db = createJoinSupabaseClient();
    let extractedText = descriptionText;
    let originalPath: string | null = null;
    const warnings: string[] = [];

    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: "Unsupported file format. Use PDF, DOCX, TXT, JPEG, PNG, or WebP." },
          { status: 400 },
        );
      }
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "File must be under 15 MB." }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext =
        file.type === "application/pdf"
          ? "pdf"
          : file.type.includes("wordprocessingml")
            ? "docx"
            : file.type === "text/plain"
              ? "txt"
              : file.type === "image/png"
                ? "png"
                : file.type === "image/webp"
                  ? "webp"
                  : "jpg";

      const key = `academic-sources/${membership.businessId}/${randomUUID()}.${ext}`;
      const stored = await storePrivateImage(db, { key, body: buffer, type: file.type });
      if (stored.ok) originalPath = stored.key;

      if (file.type.includes("wordprocessingml")) {
        const docxText = extractTextFromDocxBuffer(buffer);
        if (docxText) extractedText = docxText;
        else warnings.push("Could not extract readable text from this DOCX file; please review manually.");
      } else if (file.type === "text/plain") {
        extractedText = buffer.toString("utf8");
      } else {
        // PDF / Image: use configured OCR/AI provider if available, otherwise preserve source and request lecturer review
        warnings.push(
          "Original document/photo preserved privately. Configure an OCR/AI provider key on the server for automated image/PDF text extraction, or paste/edit questions below.",
        );
      }
    }

    const extraction = parseAssignmentFromText(extractedText, courses ?? []);
    if (warnings.length > 0) {
      extraction.warnings = [...warnings, ...extraction.warnings];
    }

    await (
      db as unknown as {
        from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> };
      }
    )
      .from("assignment_ingestion_jobs")
      .insert({
        organization_id: membership.businessId,
        created_by: userId,
        source_method: method === "PHOTO" || method === "DOCUMENT" ? method : "DESCRIPTION",
        original_file_path: originalPath,
        status: extraction.warnings.length > 0 ? "NEEDS_REVIEW" : "COMPLETED",
        extracted_json: extraction,
        confidence_notes: extraction.warnings,
      });

    return NextResponse.json({
      ok: true,
      originalPath,
      extraction,
    });
  } catch {
    return NextResponse.json({ error: "Smart extraction failed. You can still create the assignment manually." }, { status: 500 });
  }
}
