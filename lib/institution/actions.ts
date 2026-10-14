"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { institutionActionSchema, type InstitutionActionState } from "./validation";
export async function manageInstitution(_previous: InstitutionActionState, form: FormData): Promise<InstitutionActionState> {
 const membership = await requireBusinessMembership();
 const payload: Record<string, unknown> = Object.fromEntries(form.entries());
 if (payload.action === "create_unit" || payload.action === "update_unit") payload.parent_unit_id ||= null;
 if (payload.action === "assign_member") payload.permissions = form.getAll("permissions");
 const parsed = institutionActionSchema.safeParse(payload);
 if (!parsed.success) return { status: "error", message: "Check the fields and try again." };
 try {
  const db = await createUserSupabaseClient();
  const { action, ...values } = parsed.data;
  const result = action === "setup" && "type" in values
   ? await db.rpc("institution_setup", { p_organization_id: membership.businessId, p_type: values.type })
   : await db.rpc("institution_manage", { p_action: action, p_payload: { ...values, organization_id: membership.businessId } });
  if (result.error) return { status: "error", message: result.error.code === "42501" ? "You no longer have permission for this change." : "This change could not be saved. Check the unit and member details and try again." };
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Institution changes saved." };
 } catch (error) { unstable_rethrow(error); return { status: "error", message: "The change could not be saved. Please try again." }; }
}
