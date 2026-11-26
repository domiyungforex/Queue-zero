"use client";

import { useActionState } from "react";
import Link from "next/link";
import { switchBusiness } from "@/app/dashboard/actions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

export function BusinessSelector({ businessId, memberships }: {
  businessId: string;
  memberships: { businessId: string; businessName: string; workspaceOwnership?: "INDIVIDUAL" | "ORGANIZATION" }[];
}) {
  const [state, action, pending] = useActionState(switchBusiness, { error: "" });
  if (memberships.length < 2) return <Link className="inline-flex min-h-11 items-center rounded-lg border border-black/20 px-3 text-sm font-semibold" href="/onboarding?new=workspace">Add workspace</Link>;
  return <form action={action} className="w-full min-w-0 space-y-2 sm:w-auto sm:min-w-56">
    <CustomDropdown
      name="businessId"
      label="Workspace"
      defaultValue={businessId}
      disabled={pending}
      options={memberships.map((membership) => ({
        value: membership.businessId,
        label: membership.businessName,
        meta: membership.workspaceOwnership === "INDIVIDUAL" ? "Personal" : "Organization",
      }))}
    />
    <div className="flex flex-wrap gap-2"><button disabled={pending} className="min-h-11 flex-1 rounded-lg border border-black/20 px-3 font-medium disabled:opacity-50">{pending ? "Switching…" : "Switch workspace"}</button><Link className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline" href="/onboarding?new=workspace">Add</Link></div>
    <p className="sr-only" role="status" aria-live="polite">{pending ? "Validating workspace access." : ""}</p>
    {state.error && <p role="alert" className="text-sm text-red-800">{state.error}</p>}
  </form>;
}
