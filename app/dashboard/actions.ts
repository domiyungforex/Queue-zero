"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceMembership } from "@/lib/business/membership";

export async function switchBusiness(_previous: { error: string }, formData: FormData): Promise<{ error: string }> {
  try {
    const parsed = z.uuid().safeParse(formData.get("businessId"));
    if (!parsed.success) return { error: "This workspace is unavailable to your account." };
    const membership = await getWorkspaceMembership(parsed.data);
    if (!membership) return { error: "This workspace is unavailable to your account." };
    (await cookies()).set("queuezero-business", parsed.data, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    revalidatePath("/dashboard", "layout");
  } catch (error) {
    unstable_rethrow(error);
    return { error: "We couldn’t switch workspaces. Please try again." };
  }
  redirect("/dashboard");
}
