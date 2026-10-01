"use client";

import { useActionState } from "react";
import { switchBusiness } from "@/app/dashboard/actions";

export function BusinessSelector({ businessId, memberships }: {
  businessId: string;
  memberships: { businessId: string; businessName: string }[];
}) {
  const [state, action, pending] = useActionState(switchBusiness, { error: "" });
  if (memberships.length < 2) return null;
  return <form action={action} className="mt-5 space-y-2">
    <label htmlFor="businessId" className="block text-sm font-medium">Business workspace</label>
    <select id="businessId" name="businessId" defaultValue={businessId} disabled={pending}
      className="min-h-12 w-full min-w-0 rounded-lg border border-black/20 bg-white px-2">
      {memberships.map((membership) => <option key={membership.businessId} value={membership.businessId}>{membership.businessName}</option>)}
    </select>
    <button disabled={pending} className="min-h-11 w-full rounded-lg border border-black/20 px-3 font-medium disabled:opacity-50">{pending ? "Switching…" : "Switch business"}</button>
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}
  </form>;
}
