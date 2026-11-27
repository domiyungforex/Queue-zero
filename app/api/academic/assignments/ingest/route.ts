import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { storePrivateImage } from "@/lib/storage/store-image";
import { extractTextFromDocxBuffer, parseAssignmentFromText } from "@/lib/academic/ingestion";
import {
  extractAssignmentWithMistralSmall,
  isMistralConfigured,
  runMistralOcr,
} from "@/lib/ai/mistral";

export const runtime = "nodejs";
export const maxDuration = 30;

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
      const contentHash = createHash("sha256").update(buffer).digest("hex");
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

      const key = `academic-sources/${membership.businessId}/${contentHash.slice(0, 24)}.${ext}`;
      const stored = await storePrivateImage(db, { key, body: buffer, type: file.type });
      if (stored.ok) originalPath = stored.key;

      if (file.type.includes("wordprocessingml")) {
        const docxText = extractTextFromDocxBuffer(buffer);
        if (docxText) extractedText = docxText;
        else warnings.push("Could not extract readable text from this DOCX file; please review manually.");
      } else if (file.type === "text/plain") {
        extractedText = buffer.toString("utf8");
      } else {
        // PDF or Image -> Mistral OCR
        if (!isMistralConfigured()) {
          warnings.push(
            "Original document/photo preserved privately. MISTRAL_API_KEY is not configured on the server, so automated OCR is unavailable — review or enter questions manually.",
          );
        } else {
          const ocr = await runMistralOcr({ buffer, mimeType: file.type });
          if (ocr.ok && ocr.text.trim()) {
            extractedText = ocr.text;
          } else {
            warnings.push(ocr.ok ? "No readable text found in document; please review manually." : ocr.error);
          }
        }
      }
    }

    let extraction = parseAssignmentFromText(extractedText, courses ?? []);
    if (extractedText.trim() && isMistralConfigured()) {
      const ai = await extractAssignmentWithMistralSmall({
        text: extractedText,
        authorizedCourses: courses ?? [],
      });
      if (ai.ok) {
        extraction = ai.extraction;
      } else {
        warnings.push(ai.error);
      }
    }

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
        id: randomUUID(),
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
      aiConfigured: isMistralConfigured(),
    });
  } catch {
    return NextResponse.json(
      { error: "Smart extraction failed. You can still create the assignment manually." },
      { status: 500 },
    );
  }
}
