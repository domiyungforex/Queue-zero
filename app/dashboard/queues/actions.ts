"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireBusinessManager, requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { QUEUE_FIELDS, queueSchema, queueContextSchema, queueEditContextSchema, queueStatusSchema, type QueueContext, type QueueEditContext, type QueueState, type QueueValues } from "@/lib/validation/queue";

function mutationError(code?: string): QueueState {
  if (code === "QZ009") return { status: "error", message: "Your plan’s queue limit has been reached. Open Billing to upgrade." };
  if (code === "40001") return { status: "error", conflict: true, message: "This queue has changed since you opened it. Reload the latest details before making another change." };
  if (code === "42501") return { status: "error", message: "This queue is unavailable or you no longer have permission to manage it." };
  if (code === "22023") return { status: "error", message: "Check your settings and choose an active location in this business." };
  return { status: "error", message: "We couldn’t save this change. Please try again." };
}

async function saveSettings(context: QueueContext | QueueEditContext, formData: FormData, editing: boolean): Promise<QueueState> {
  const current = await requireBusinessMembership();
  const membership = current.institutionType ? current : await requireBusinessManager();
  const parsedContext = (editing ? queueEditContextSchema : queueContextSchema).safeParse(context);
  if (!parsedContext.success || parsedContext.data.businessId !== membership.businessId) {
    return { status: "error", message: "Your workspace has changed. Return to Queues and open the form again." };
  }
  const revision = editing ? queueEditContextSchema.parse(context).revision : undefined;
  const values = Object.fromEntries(QUEUE_FIELDS.map((field) => {
    const value = formData.get(field);
    return [field, typeof value === "string" ? value : ""];
  })) as QueueValues;
  const retained = Object.fromEntries(QUEUE_FIELDS.map((field) => [field, values[field].slice(0, 2000)])) as QueueValues;
  const unitId = formData.get("unitId");
  if (typeof unitId === "string" && unitId) { values.unitId = unitId; retained.unitId = unitId.slice(0, 100); }
  const parsed = queueSchema.safeParse(values);
  if (membership.institutionType && !editing && !values.unitId) return { status: "error", message: "Choose an institution unit.", values: retained };
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", values: retained, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const db = await createUserSupabaseClient();
    const input = parsed.data;
    const args = {
      p_queue_id: parsedContext.data.queueId,
      p_business_id: membership.businessId,
      p_location_id: input.locationId,
      p_name: input.name, p_description: input.description,
      p_average_service_seconds: input.serviceMinutes,
      p_warning_threshold: input.warningThreshold,
      p_allow_phone: input.phoneMode !== "none", p_require_phone: input.phoneMode === "required",
    };
    const result = revision !== undefined
      ? await db.rpc("update_queue", { ...args, p_expected_revision: revision })
      : membership.institutionType && input.unitId
        ? await db.rpc("create_unit_queue", { ...args, p_unit_id: input.unitId })
        : await db.rpc("create_queue", args);
    if (result.error || !z.uuid().safeParse(result.data).success || result.data !== parsedContext.data.queueId) {
      return { ...mutationError(result.error?.code), values: retained };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { ...mutationError(), values: retained };
  }
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/queues/${parsedContext.data.queueId}?saved=${editing ? "updated" : "created"}`);
}

export async function createQueue(context: QueueContext, _previous: QueueState, formData: FormData): Promise<QueueState> {
  return saveSettings(context, formData, false);
}

export async function updateQueue(context: QueueEditContext, _previous: QueueState, formData: FormData): Promise<QueueState> {
  return saveSettings(context, formData, true);
}

export async function changeQueueStatus(context: QueueEditContext, _previous: QueueState, formData: FormData): Promise<QueueState> {
  const current = await requireBusinessMembership();
  const membership = current.institutionType ? current : await requireBusinessManager();
  const parsedContext = queueEditContextSchema.safeParse(context);
  const status = queueStatusSchema.safeParse(formData.get("status"));
  if (!parsedContext.success || !status.success || parsedContext.data.businessId !== membership.businessId) {
    return { status: "error", message: "This request is unavailable. Reload the queue and try again." };
  }
  try {
    const db = await createUserSupabaseClient();
    const { data, error } = await db.rpc("set_queue_status", {
      p_queue_id: parsedContext.data.queueId, p_business_id: membership.businessId,
      p_expected_revision: parsedContext.data.revision, p_status: status.data,
    });
    if (error || data !== parsedContext.data.queueId) return mutationError(error?.code);
  } catch (error) {
    unstable_rethrow(error);
    return mutationError();
  }
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/queues/${parsedContext.data.queueId}?saved=status`);
}
