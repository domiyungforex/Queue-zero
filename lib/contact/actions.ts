"use server";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { inquirySchema } from "./validation";
export async function submitInquiry(_previous: { error: string }, form: FormData): Promise<{ error: string }> {
  const parsed = inquirySchema.safeParse({ name: form.get("name"), email: form.get("email"), message: form.get("message"), requestId: form.get("requestId") });
  if (!parsed.success) return { error: "Enter your name, a valid email and a message between 10 and 4,000 characters." };
  if (form.get("website")) return { error: "Unable to submit this inquiry." };
  try {
    const secret = process.env.QUEUE_JOIN_SECRET;
    if (!secret || secret.length < 32) throw new Error("Missing signing configuration");
    const h = await headers();
    // Only trust the hosting provider's overwritten header; elsewhere use a shared conservative bucket.
    const address = process.env.VERCEL === "1" ? h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "non-vercel";
    const hash = createHmac("sha256", secret).update(`site-inquiry:${address}`).digest("hex");
    const { error } = await createJoinSupabaseClient().rpc("submit_site_inquiry", { p_name: parsed.data.name, p_email: parsed.data.email, p_message: parsed.data.message, p_source_hash: hash, p_request_id: parsed.data.requestId });
    if (error) return { error: error.code === "P0001" ? "Too many inquiries. Please try again in an hour." : "Your inquiry could not be saved. Please try again." };
  } catch { return { error: "Contact form temporarily unavailable. Please try again later." }; }
  redirect("/contact/thank-you");
}
