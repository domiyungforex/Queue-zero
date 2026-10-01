"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMemberships } from "@/lib/business/membership";

export async function switchBusiness(_previous: { error: string }, formData: FormData): Promise<{ error: string }> {
  try {
    const memberships = await getMemberships();
    const parsed = z.uuid().safeParse(formData.get("businessId"));
    if (!parsed.success || !memberships.some((membership) => membership.businessId === parsed.data)) {
      return { error: "This business is unavailable to your account." };
    }
    (await cookies()).set("queuezero-business", parsed.data, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    revalidatePath("/dashboard", "layout");
  } catch (error) {
    unstable_rethrow(error);
    return { error: "We couldn’t switch businesses. Please try again." };
  }
  redirect("/dashboard");
}
