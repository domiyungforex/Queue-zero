import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAssignmentGuestToken } from "@/lib/academic/distribution";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";

/** Staff roles that may access restricted files and all submissions. */
function isStaffRole(role: string): boolean {
  return role === "owner" || role === "admin";
}
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { readPrivateImage } from "@/lib/storage/store-image";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const fileId = url.searchParams.get("id") ?? "";
    const guestToken = url.searchParams.get("token") ?? "";
    const download = url.searchParams.get("download") === "1";

    if ((kind !== "attachment" && kind !== "submission") || !z.uuid().safeParse(fileId).success) {
      return NextResponse.json({ error: "Invalid file request." }, { status: 400 });
    }

    const db = createJoinSupabaseClient();
    const untyped = db as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: unknown) => {
            eq: (col2: string, val2: unknown) => {
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
            };
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
      };
    };

    let orgId = "";
    let isStaff = false;
    let guestAssignmentId: string | null = null;
    let currentUserId: string | null = null;

    if (guestToken) {
      let parsed: ReturnType<typeof verifyAssignmentGuestToken>;
      try {
        parsed = verifyAssignmentGuestToken(guestToken);
      } catch {
        return NextResponse.json({ error: "Invalid assignment link." }, { status: 403 });
      }
      orgId = parsed.orgId;
      guestAssignmentId = parsed.assignmentId;
      if (kind !== "attachment") {
        return NextResponse.json({ error: "Unauthorized file access." }, { status: 403 });
      }
    } else {
      const membership = await requireBusinessMembership();
      orgId = membership.businessId;
      isStaff = isStaffRole(membership.role);
      currentUserId = await requireUserId();
    }

    let storagePath = "";
    let fileName = "document";
    let mimeType = "application/octet-stream";

    if (kind === "attachment") {
      const { data: att } = await untyped
        .from("assignment_attachments")
        .select("id,assignment_id,file_name,mime_type,storage_path,attachment_role")
        .eq("id", fileId)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!att) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }

      if (guestAssignmentId && String(att.assignment_id) !== guestAssignmentId) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
      }

      if (!isStaff && String(att.attachment_role ?? "ASSIGNMENT_MAIN") === "LECTURER_ONLY") {
        return NextResponse.json({ error: "This resource is restricted to lecturers." }, { status: 403 });
      }

      if (!isStaff) {
        const { data: assignment } = await untyped
          .from("assignments")
          .select("status")
          .eq("id", String(att.assignment_id))
          .eq("organization_id", orgId)
          .maybeSingle();
        if (!assignment || assignment.status !== "PUBLISHED") {
          return NextResponse.json({ error: "Assignment is not published." }, { status: 403 });
        }
      }

      storagePath = String(att.storage_path);
      fileName = String(att.file_name);
      mimeType = String(att.mime_type || "application/octet-stream");
    } else {
      const { data: subFile } = await untyped
        .from("submission_files")
        .select("id,submission_id,file_name,mime_type,storage_path")
        .eq("id", fileId)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!subFile) {
        return NextResponse.json({ error: "File not found." }, { status: 404 });
      }

      if (!isStaff) {
        const { data: sub } = await untyped
          .from("assignment_submissions")
          .select("student_id")
          .eq("id", String(subFile.submission_id))
          .eq("organization_id", orgId)
          .maybeSingle();

        const { data: profile } = sub
          ? await untyped
              .from("school_profiles")
              .select("user_id")
              .eq("id", String(sub.student_id))
              .eq("organization_id", orgId)
              .maybeSingle()
          : { data: null };

        if (!profile || String(profile.user_id ?? "") !== currentUserId) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
        }
      }

      storagePath = String(subFile.storage_path);
      fileName = String(subFile.file_name);
      mimeType = String(subFile.mime_type || "application/octet-stream");
    }

    const stored = await readPrivateImage(db, storagePath, "full");
    if (!stored) {
      return NextResponse.json({ error: "File content could not be retrieved from storage." }, { status: 404 });
    }

    const safeFileName = fileName.replace(/["\r\n]/g, "_");
    const isInlineSafe =
      mimeType === "application/pdf" ||
      (mimeType.startsWith("image/") && !mimeType.includes("svg")) ||
      mimeType.startsWith("text/plain");
    const disposition = !download && isInlineSafe ? "inline" : "attachment";

    return new NextResponse(Buffer.from(stored.body), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load file." }, { status: 500 });
  }
}
