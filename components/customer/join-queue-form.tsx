"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { JoinAction, JoinOptions, JoinState } from "@/lib/validation/join";

const initialState: JoinState = { status: "idle" };
export function JoinQueueForm({ options, action }: { options: JoinOptions; action: JoinAction }) {
  const [state, submit, pending] = useActionState(action, initialState);
  return <form action={submit} className="space-y-5" aria-busy={pending}>
    <div><label htmlFor="firstName" className="block font-medium">Name</label>
      <input id="firstName" name="firstName" autoComplete="name" required maxLength={80} defaultValue={state.values?.firstName} aria-invalid={!!state.fieldErrors?.firstName} aria-describedby="name-error" className="mt-2 min-h-12 w-full rounded-lg border border-black/20 bg-white px-3" />
      <p id="name-error" className="mt-1 text-sm text-red-800">{state.fieldErrors?.firstName?.join(" ")}</p></div>
    {options.allow_phone && <div><label htmlFor="phone" className="block font-medium">Phone number {options.require_phone ? "" : "(optional)"}</label>
      <input id="phone" name="phone" type="tel" autoComplete="tel" required={options.require_phone} maxLength={32} defaultValue={state.values?.phone} aria-invalid={!!state.fieldErrors?.phone} aria-describedby="phone-help phone-error" className="mt-2 min-h-12 w-full rounded-lg border border-black/20 bg-white px-3" />
      <p id="phone-help" className="mt-1 text-sm text-muted">Include your country code, for example +2348012345678.</p>
      <p id="phone-error" className="mt-1 text-sm text-red-800">{state.fieldErrors?.phone?.join(" ")}</p></div>}
    {state.message && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">{state.message}</p>}
    <button disabled={pending} className="min-h-14 w-full rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">{pending ? "Joining…" : "Join queue"}</button>
    <p className="text-sm text-muted">One active place per browser in this queue. Retrying this form won’t create another ticket.</p>
    {state.refreshRequired && <Link prefetch={false} href={`/q/${options.slug}/join/start`} className="inline-flex min-h-12 items-center font-medium text-primary">Reopen join form</Link>}
  </form>;
}
