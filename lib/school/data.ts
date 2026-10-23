import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { schoolSnapshotSchema } from "./contracts";

/** Every read, including exports, uses a fresh authorized RPC under the Clerk identity. */
export const getSchoolSnapshot = cache(async (courseId?: string, classId?: string) => {
  if ((courseId && !z.uuid().safeParse(courseId).success) || (classId && !z.uuid().safeParse(classId).success)) notFound();
  const membership = await requireBusinessMembership();
  if (!membership.institutionType && !["owner", "admin", "lecturer"].includes(membership.role)) notFound();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.rpc("school_snapshot", { p_organization_id: membership.businessId, p_course_id: courseId ?? undefined, p_class_id: classId ?? undefined });
  if (error?.code === "42501" || error?.code === "P0002") notFound();
  if (error) throw new Error("School records could not be loaded. Please try again.");
  const parsed = schoolSnapshotSchema.safeParse(data);
  if (!parsed.success) throw new Error("School records are temporarily unavailable.");
  if (parsed.data.organization.id !== membership.businessId || parsed.data.organization.mode === "BUSINESS") notFound();
  if (courseId && !parsed.data.courses.some(course => course.id === courseId)) notFound();
  if (classId && !parsed.data.classes.some(session => session.id === classId)) notFound();
  return { snapshot: parsed.data, canManage: membership.role === "owner" || membership.role === "admin" };
});
