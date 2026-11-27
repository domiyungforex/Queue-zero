import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireBusinessMembership } from "@/lib/business/membership";
import { verifyAssignmentGuestToken } from "@/lib/academic/distribution";
import { validateUniversalFile } from "@/lib/academic/universal-files";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { storePrivateImage } from "@/lib/storage/store-image";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const rawAssignmentId = String(formData.get("assignmentId") ?? "").trim();
    const guestToken = String(formData.get("token") ?? "").trim();
    const guestStudentId = String(formData.get("studentId") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    let orgId = "";
    let assignmentId = rawAssignmentId || "general";
    let maxSizeBytes = 25 * 1024 * 1024;

    const db = createJoinSupabaseClient();

    if (guestToken) {
      let parsed: ReturnType<typeof verifyAssignmentGuestToken>;
      try {
        parsed = verifyAssignmentGuestToken(guestToken);
      } catch {
        return NextResponse.json({ error: "Invalid assignment link." }, { status: 403 });
      }
      if (!guestStudentId) {
        return NextResponse.json({ error: "Verify your matriculation number before uploading files." }, { status: 403 });
      }
      const untyped = db as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: unknown) => {
              eq: (col2: string, val2: unknown) => {
                maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
              };
            };
          };
        };
      };
      const [{ data: student }, { data: assignment }] = await Promise.all([
        untyped
          .from("school_profiles")
          .select("id")
          .eq("id", guestStudentId)
          .eq("organization_id", parsed.orgId)
          .maybeSingle(),
        untyped
          .from("assignments")
          .select("id,status,max_upload_mb,allow_file_upload,allow_photo_submission")
          .eq("id", parsed.assignmentId)
          .eq("organization_id", parsed.orgId)
          .maybeSingle(),
      ]);

      if (!student || !assignment || assignment.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Not authorized to upload for this assignment." }, { status: 403 });
      }
      if (!assignment.allow_file_upload && !assignment.allow_photo_submission) {
        return NextResponse.json({ error: "File uploads are disabled for this assignment." }, { status: 403 });
      }
      orgId = parsed.orgId;
      assignmentId = parsed.assignmentId;
      maxSizeBytes = Math.max(1, Math.min(50, Number(assignment.max_upload_mb ?? 25))) * 1024 * 1024;
    } else {
      const membership = await requireBusinessMembership();
      orgId = membership.businessId;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUniversalFile({
      fileName: file.name,
      mimeType: file.type,
      buffer,
      maxSizeBytes,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
    const key = `academic/${orgId}/${assignmentId}/${randomUUID()}.${validation.ext}`;

    const stored = await storePrivateImage(db, {
      key,
      body: buffer,
      type: validation.mimeType,
    });
    if (!stored.ok) {
      return NextResponse.json({ error: "Private storage unavailable." }, { status: 503 });
    }

    return NextResponse.json({
      storagePath: stored.key,
      fileName: safeName,
      mimeType: validation.mimeType,
      sizeBytes: file.size,
      previewable: validation.previewable,
    });
  } catch {
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
