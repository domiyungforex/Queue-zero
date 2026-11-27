import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { storePrivateImage } from "@/lib/storage/store-image";
import { extractTextFromDocxBuffer } from "@/lib/academic/ingestion";
import { getAiProviderStatus } from "@/lib/ai/provider";
import { runSmartAssignmentExtraction } from "@/lib/ai/service";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
]);

export async function GET() {
  try {
    const membership = await requireBusinessMembership();
    if (!["owner", "admin", "manager", "lecturer"].includes(membership.role)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const status = getAiProviderStatus();
    return NextResponse.json({
      ok: true,
      available: status.anyConfigured,
      message: status.anyConfigured
        ? "TuRnMaRk AI is ready."
        : "TuRnMaRk AI is temporarily unavailable.",
    });
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
}

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
    let fileBuffer: Buffer | undefined;
    let fileMimeType: string | undefined;
    let contentHash: string | undefined;
    const preWarnings: string[] = [];

    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: "Unsupported file format. Use PDF, DOCX, TXT, JPEG, PNG, WebP, or HEIC." },
          { status: 400 },
        );
      }
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "File must be under 15 MB." }, { status: 413 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      contentHash = createHash("sha256").update(buffer).digest("hex");
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
                  : file.type === "image/heic" || file.type === "image/heif"
                    ? "heic"
                    : "jpg";

      const key = `academic-sources/${membership.businessId}/${contentHash.slice(0, 24)}.${ext}`;
      const stored = await storePrivateImage(db, { key, body: buffer, type: file.type });
      if (stored.ok) originalPath = stored.key;

      if (file.type.includes("wordprocessingml")) {
        const docxText = extractTextFromDocxBuffer(buffer);
        if (docxText) extractedText = docxText;
        else preWarnings.push("Could not extract readable text from this DOCX file; please review manually.");
      } else if (file.type === "text/plain") {
        extractedText = buffer.toString("utf8");
      } else if (file.type === "image/heic" || file.type === "image/heif") {
        preWarnings.push(
          "Original HEIC photo preserved privately. For automated question extraction, upload JPEG, PNG, WebP, or PDF, or enter questions manually.",
        );
      } else {
        fileBuffer = buffer;
        fileMimeType = file.type;
      }
    }

    const result = await runSmartAssignmentExtraction({
      organizationId: membership.businessId,
      authorizedCourses: courses ?? [],
      buffer: fileBuffer,
      mimeType: fileMimeType,
      contentHash,
      extractedText,
    });

    const extraction = {
      ...result.extraction,
      warnings: [...preWarnings, ...result.warnings],
    };

    const hasQuestions = extraction.questions.length > 0;
    const status =
      result.providerUsed === "local_parser" || !hasQuestions || extraction.warnings.length > 0
        ? "NEEDS_REVIEW"
        : "COMPLETED";

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
        status,
        extracted_json: extraction,
        confidence_notes: extraction.warnings,
      });

    const aiStatus = getAiProviderStatus();
    const userMessage = !hasQuestions
      ? "We couldn't identify assignment questions in this document. Try a clearer document or add your questions manually."
      : extraction.warnings.length > 0
        ? "We extracted some of your assignment content. A few sections may need your attention."
        : "Your assignment has been analysed. Review the extracted questions below.";

    return NextResponse.json({
      ok: true,
      originalPath,
      extraction,
      message: userMessage,
      deduplicated: Boolean(result.deduplicated),
      processingStatus: status,
      aiConfigured: aiStatus.anyConfigured,
    });
  } catch {
    return NextResponse.json(
      { error: "Something interrupted document processing. Your original document is safe. Please try again or enter questions manually." },
      { status: 500 },
    );
  }
}
