"use server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { schoolInputSchema, parseStudentCsv } from "./validation";
import type { SchoolActionState } from "./contracts";
import { z } from "zod";
import type { Json } from "@/lib/db/database.types";

export async function manageSchool(_previous: SchoolActionState, form: FormData): Promise<SchoolActionState> {
  const membership = await requireBusinessMembership();
  if (!["owner", "admin", "lecturer"].includes(membership.role)) return { ok: false, message: "You do not have permission to manage attendance." };
  try {
    const raw: Record<string, unknown> = Object.fromEntries(form.entries());
    if (raw.action === "enroll") raw.students = parseStudentCsv(String(raw.csv ?? ""), String(raw.department_id ?? ""));
    if (raw.action === "class") { raw.departure_required = raw.departure_required === "on"; for (const field of ["starts_at", "planned_ends_at"]) { const value = String(raw[field] ?? ""); raw[field] = field === "planned_ends_at" && !value ? null : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value + ":00Z" : value; } }
    const parsed = schoolInputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "Please check the form fields and try again." };
    const { action, ...fields } = parsed.data;
    if (["faculty", "department", "lecturer", "remove_lecturer"].includes(action) && membership.role === "lecturer") return { ok: false, message: "Only an owner or administrator can change school setup." };
    let payload: Record<string, Json | undefined> = { ...fields, organization_id: membership.businessId };
    if (parsed.data.action === "course" && membership.role === "lecturer") {
      const identity = await currentUser();
      const verifiedEmail = identity?.emailAddresses.find(address => address.verification?.status === "verified")?.emailAddress;
      if (!identity || (!identity.fullName && !verifiedEmail)) return { ok: false, message: "Add your name or verify an email in your account before creating a course." };
      payload.creator_display_name = (identity.fullName || verifiedEmail!).slice(0, 160);
    }
    if (parsed.data.action === "lecturer") {
      const email = parsed.data.email.toLowerCase();
      const client = await clerkClient();
      const users = await client.users.getUserList({ emailAddress: [email], limit: 2 });
      const matched = users.data.filter(user => user.emailAddresses.some(address => address.emailAddress.toLowerCase() === email && address.verification?.status === "verified"));
      if (matched.length !== 1) return { ok: false, message: "Ask this lecturer to create a TuRnMaRk account and verify that email, then try again." };
      payload = { course_id: parsed.data.course_id, user_id: matched[0].id, display_name: matched[0].fullName || email, organization_id: membership.businessId };
    }
    const db = await createUserSupabaseClient();
    const result = await db.rpc("school_manage", { p_action: action, p_payload: payload });
    if (result.error) return { ok: false, message: result.error.code === "42501" ? "This record is unavailable or your access has changed." : result.error.code === "23505" ? "This record already exists. Check the course, email or matric number." : "We couldn’t save this change. Check the class state and details, then try again." };
    const response = z.object({ id: z.uuid().optional(), message: z.string() }).safeParse(result.data);
    if (!response.success) return { ok: false, message: "The response was unavailable. Reload to check before retrying." };
    revalidatePath("/dashboard", "layout");
    return { ok: true, ...response.data };
  } catch (error) {
    unstable_rethrow(error);
    // Validation messages contain row positions, never student PII or provider errors.
    if (error instanceof Error && /^(Import at most|Use the header|Include between|Check the CSV|Check the name|Row \d|Duplicate student)/.test(error.message)) return { ok: false, message: error.message };
    return { ok: false, message: "We couldn’t save this change. Check your connection and try again." };
  }
}
