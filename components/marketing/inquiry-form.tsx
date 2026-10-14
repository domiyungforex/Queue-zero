"use client";
import { useActionState, useState } from "react";
import { submitInquiry } from "@/lib/contact/actions";
import styles from "./site.module.css";
export function InquiryForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitInquiry, { error: "" });
  const [id] = useState(requestId);
  return <form action={action} className={styles.inquiryForm}><input type="hidden" name="requestId" value={id} /><div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div><label>Your name<input name="name" autoComplete="name" required maxLength={100} /></label><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>How can we help?<textarea name="message" required minLength={10} maxLength={4000} /></label><p className="text-sm">Please do not include passwords, medical records or customer ticket links.</p>{state.error && <p role="alert">{state.error}</p>}<button className={styles.button} disabled={pending}>{pending ? "Saving inquiry…" : "Send inquiry"}</button></form>;
}
