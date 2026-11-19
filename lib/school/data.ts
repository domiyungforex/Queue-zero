import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { schoolSnapshotSchema } from "./contracts";
import { displayAttendancePhoto } from "./photo-src";

/** Every read, including exports, uses a fresh authorized RPC under the Clerk identity. */
export async function getSchoolSnapshot(courseId?: string, classId?: string) {
  if ((courseId && !z.uuid().safeParse(courseId).success) || (classId && !z.uuid().safeParse(classId).success)) notFound();
  const membership = await requireBusinessMembership();
  if (!membership.institutionType && !["owner", "admin", "lecturer"].includes(membership.role)) notFound();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.rpc("school_snapshot", { p_organization_id: membership.businessId, p_course_id: courseId ?? undefined, p_class_id: classId ?? undefined });
  if (error?.code === "42501" || error?.code === "P0002") notFound();
  if (error) {
    console.error("school_snapshot failed", { code: error.code, message: error.message });
    throw new Error("School records could not be loaded. Please try again.");
  }
  const parsed = schoolSnapshotSchema.safeParse(data);
  if (!parsed.success) {
    console.error("school_snapshot schema mismatch", parsed.error.issues.slice(0, 8));
    throw new Error("School records are temporarily unavailable.");
  }
  if (parsed.data.organization.id !== membership.businessId || parsed.data.organization.mode === "BUSINESS") notFound();
  if (courseId && !parsed.data.courses.some(course => course.id === courseId)) notFound();
  if (classId && !parsed.data.classes.some(session => session.id === classId)) notFound();
  await revealStoredPhotos(db as unknown as PhotoLookup, parsed.data.attendance);
  return { snapshot: parsed.data, canManage: membership.role === "owner" || membership.role === "admin" };
}

/** The snapshot hides inline photos and cannot be used as an image address. Point at the staff photo route instead. */
async function revealStoredPhotos(db: PhotoLookup, rows: { id: string; photo_url?: string | null }[]) {
  const hidden = rows.filter((row) => !row.photo_url).map((row) => row.id);
  const found = new Set<string>();
  if (hidden.length && db.from) {
    try {
      for (let index = 0; index < hidden.length; index += 80) {
        const slice = hidden.slice(index, index + 80);
        const { data, error } = await db.from("attendance_records").select("id").in("id", slice).not("photo_url", "is", null);
        if (error || !data) continue;
        for (const row of data) found.add(row.id);
      }
    } catch {
      // A snapshot that already includes a photo reference can still be displayed.
    }
  }
  for (const row of rows) {
    const src = displayAttendancePhoto(row.id, row.photo_url || (found.has(row.id) ? "stored" : null));
    if (src) row.photo_url = src;
  }
}

type PhotoLookup = {
  from?: (table: "attendance_records") => {
    select: (columns: "id") => {
      in: (column: "id", values: string[]) => {
        not: (column: "photo_url", operator: "is", value: null) => Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
      };
    };
  };
};
