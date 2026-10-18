"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BriefcaseBusiness, Check, ChevronDown, GraduationCap, Plus } from "lucide-react";
import { switchBusiness } from "@/app/dashboard/actions";
import styles from "./workspace-shell.module.css";

type Membership = {
  businessId: string;
  businessName: string;
  role: string;
  workspaceOwnership?: "INDIVIDUAL" | "ORGANIZATION";
};

function WorkspaceOption({ membership, current }: { membership: Membership; current: boolean }) {
  const [state, action, pending] = useActionState(switchBusiness, { error: "" });
  return <form action={action}>
    <input type="hidden" name="businessId" value={membership.businessId} />
    <button type="submit" disabled={pending || current} aria-current={current ? "true" : undefined}>
      <span className={styles.switcherOptionIcon}>{current ? <Check size={16} aria-hidden="true" /> : <BriefcaseBusiness size={16} aria-hidden="true" />}</span>
      <span><strong>{membership.businessName}</strong><small>{membership.workspaceOwnership === "INDIVIDUAL" ? "Personal Workspace" : "Organization Workspace"} · {membership.role.replaceAll("_", " ")}</small></span>
      {pending && <em>Switching…</em>}
    </button>
    {state.error && <p role="alert">{state.error}</p>}
  </form>;
}

export function MobileWorkspaceSwitcher({ businessId, memberships, contextLabel, education = false }: { businessId: string; memberships: Membership[]; contextLabel?: string; education?: boolean }) {
  const current = memberships.find((membership) => membership.businessId === businessId) ?? memberships[0];
  if (!current) return null;
  const CurrentIcon = education ? GraduationCap : BriefcaseBusiness;
  return <details className={styles.mobileSwitcher}>
    <summary aria-label={`Switch workspace. Current workspace: ${current.businessName}`}>
      <span className={styles.switcherIcon} data-education={education ? "true" : undefined}><CurrentIcon size={17} aria-hidden="true" /></span>
      <span className={styles.switcherCopy}><strong>{current.businessName}</strong><small>{contextLabel ?? (current.workspaceOwnership === "INDIVIDUAL" ? "Personal Workspace" : "Organization Workspace")}</small></span>
      <ChevronDown size={17} aria-hidden="true" />
    </summary>
    <div className={styles.switcherMenu}>
      <p>YOUR WORKSPACES</p>
      {memberships.map((membership) => <WorkspaceOption key={membership.businessId} membership={membership} current={membership.businessId === businessId} />)}
      <Link href="/onboarding?new=workspace"><Plus size={17} aria-hidden="true" />Add workspace</Link>
    </div>
  </details>;
}
