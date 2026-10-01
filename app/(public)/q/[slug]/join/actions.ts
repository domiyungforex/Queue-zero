"use server";

import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CUSTOMER_COOKIE, customerSessionSchema, getJoinKeys } from "@/lib/security/customer-session";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { joinContextSchema, joinInputSchema, type JoinContext, type JoinState } from "@/lib/validation/join";

function domainError(code?: string): JoinState {
  if (code === "QZ002") return { status: "error", refreshRequired: true, message: "This queue is paused or closed. Your place has not been added. Please check with staff." };
  if (code === "QZ003") return { status: "error", fieldErrors: { phone: ["Enter a valid phone number with its country code, e.g. +233 24 123 4567."] }, message: "Please check the phone number. The queue’s phone requirements may have changed.", refreshRequired: true };
  if (code === "QZ004") return { status: "error", message: "This queue is full right now. Please check with staff." };
  if (code === "QZ005") return { status: "error", message: "Too many joins from this network. Please wait up to 10 minutes or ask staff for help." };
  if (code === "QZ001" || code === "QZ006") return { status: "error", message: "This queue or join request is unavailable. Please reopen the queue link.", refreshRequired: true };
  return { status: "error", message: "We couldn’t confirm your place. Retry this form to safely check or finish your join." };
}

export async function joinQueue(context: JoinContext, _previous: JoinState, form: FormData): Promise<JoinState> {
  const parsedContext = joinContextSchema.safeParse(context);
  if (!parsedContext.success) return { status: "error", message: "Please reopen the queue link and try again." };
  const values = { firstName: typeof form.get("firstName") === "string" ? String(form.get("firstName")) : "", phone: typeof form.get("phone") === "string" ? String(form.get("phone")) : "" };
  const retained = { firstName: values.firstName.slice(0, 80), phone: values.phone.slice(0, 32) };
  const parsed = joinInputSchema.safeParse(values);
  if (!parsed.success) return { status: "error", values: retained, message: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  let token: string;
  try {
    const session = customerSessionSchema.safeParse((await cookies()).get(CUSTOMER_COOKIE)?.value);
    if (!session.success) return { status: "error", values: retained, message: "Enable cookies for this site, then reopen the queue link to join.", refreshRequired: true };
    const keys = getJoinKeys(session.data, await headers());
    const { data, error } = await createJoinSupabaseClient().rpc("join_public_queue", {
      p_slug: parsedContext.data.slug, p_request_id: parsedContext.data.requestId,
      p_customer_key: keys.customerKey, p_rate_key: keys.rateKey,
      p_customer_name: parsed.data.firstName, p_phone: parsed.data.phone,
    });
    const parsedToken = z.uuid().safeParse(data);
    if (error || !parsedToken.success) return { ...domainError(error?.code), values: retained };
    token = parsedToken.data;
  } catch (error) {
    unstable_rethrow(error);
    return { ...domainError(), values: retained };
  }
  revalidatePath(`/q/${parsedContext.data.slug}`);
  redirect(`/ticket/${token}`);
}
