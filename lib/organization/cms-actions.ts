"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { invitationToken, invitationDigest } from "@/lib/institution/invitation-token";

const assignSchema = z.object({
  courseId: z.string().uuid(),
  userId: z.string().regex(/^user_[A-Za-z0-9]+$/),
  displayName: z.string().min(1).max(160),
});

export async function assignLecturerAction(formData: FormData) {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, message: "Only administrators can assign lecturers." };
  }

  const courseId = formData.get("courseId") as string;
  const userId = formData.get("userId") as string;
  const displayName = formData.get("displayName") as string;

  const parsed = assignSchema.safeParse({ courseId, userId, displayName });
  if (!parsed.success) {
    return { ok: false, message: "Invalid lecturer assignment details." };
  }

  const db = await createUserSupabaseClient();
  const { error } = await db.rpc("school_manage", {
    p_action: "lecturer",
    p_payload: {
      organization_id: membership.businessId,
      course_id: parsed.data.courseId,
      user_id: parsed.data.userId,
      display_name: parsed.data.displayName,
    },
  });

  if (error) {
    return { ok: false, message: "Failed to assign lecturer. Ensure user has a valid account." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/structure");
  return { ok: true, message: "Lecturer successfully assigned to course." };
}

export async function removeLecturerAction(formData: FormData) {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, message: "Only administrators can remove lecturers." };
  }

  const courseId = formData.get("courseId") as string;
  const userId = formData.get("userId") as string;

  const db = await createUserSupabaseClient();
  const { error } = await db.rpc("school_manage", {
    p_action: "remove_lecturer",
    p_payload: {
      organization_id: membership.businessId,
      course_id: courseId,
      user_id: userId,
    },
  });

  if (error) {
    return { ok: false, message: "Failed to remove lecturer from course." };
  }

  revalidatePath("/dashboard/courses");
  return { ok: true, message: "Lecturer removed from course." };
}

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["LECTURER", "UNIT_ADMIN", "STAFF", "ORGANIZATION_ADMIN", "ORGANIZATION_VIEWER"]),
  unitId: z.string().uuid(),
  courseId: z.string().uuid().optional().nullable(),
  staffTitle: z.string().max(80).optional(),
});

export async function invitePersonnelAction(formData: FormData) {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, message: "Only administrators can invite personnel." };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = formData.get("role") as z.infer<typeof inviteSchema>["role"];
  const unitId = formData.get("unitId") as string;
  const courseIdRaw = formData.get("courseId") as string;
  const courseId = courseIdRaw && courseIdRaw !== "none" ? courseIdRaw : null;
  const staffTitle = (formData.get("staffTitle") as string)?.trim() || null;

  const parsed = inviteSchema.safeParse({ email, role, unitId, courseId, staffTitle: staffTitle || undefined });
  if (!parsed.success) {
    return { ok: false, message: "Please check the email address and invitation details." };
  }

  try {
    const requestId = crypto.randomUUID();
    const rawToken = invitationToken(requestId);
    const digest = invitationDigest(rawToken);

    const db = await createUserSupabaseClient();

    // Map default permissions according to role
    const permissions: string[] = [];
    if (role === "LECTURER") {
      permissions.push("course.manage", "attendance.start", "attendance.manage", "attendance.export");
    } else if (role === "UNIT_ADMIN") {
      permissions.push("unit.manage", "unit.staff.manage", "course.create", "course.manage", "attendance.start", "attendance.manage", "attendance.export");
    } else if (role === "ORGANIZATION_ADMIN") {
      permissions.push("unit.manage", "unit.staff.manage", "course.create", "course.manage", "attendance.start", "attendance.manage", "attendance.export", "reports.view");
    } else {
      permissions.push("attendance.start", "queue.serve");
    }

    const { error } = await db.rpc("institution_invite", {
      p_organization_id: membership.businessId,
      p_unit_id: unitId,
      p_email: email,
      p_role: role === "ORGANIZATION_ADMIN" ? "UNIT_ADMIN" : role,
      p_staff_title: staffTitle || "Staff",
      p_permissions: permissions,
      p_token_hash: digest,
      p_request_id: requestId,
    });

    if (error) {
      if (error.code === "54000") return { ok: false, message: "Invitation hourly limit reached. Please wait." };
      return { ok: false, message: "Failed to create invitation: " + error.message };
    }

    // If courseId is specified, update invitation record
    if (courseId) {
      await db
        .from("institution_invitations")
        .update({ course_id: courseId })
        .eq("id", requestId);
    }

    revalidatePath("/dashboard/people");
    revalidatePath("/dashboard/structure");

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/invitations/${rawToken}`;
    return {
      ok: true,
      message: `Invitation generated successfully. Link: ${inviteLink}`,
      inviteLink,
    };
  } catch {
    return { ok: false, message: "Could not send invitation. Try again." };
  }
}

export async function revokeInvitationAction(invitationId: string) {
  const membership = await requireBusinessMembership();
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, message: "Only administrators can revoke invitations." };
  }

  const db = await createUserSupabaseClient();
  const { error } = await db.rpc("institution_revoke_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    return { ok: false, message: "Could not revoke invitation." };
  }

  revalidatePath("/dashboard/people");
  return { ok: true, message: "Invitation revoked." };
}
