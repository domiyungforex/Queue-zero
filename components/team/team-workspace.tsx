"use client";

import { useActionState, useMemo, useState } from "react";
import { Mail, Search, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { RemoveMember } from "@/components/business/forms";
import { revokeTeamInvitation, type FormResult } from "@/app/dashboard/settings/actions";
import { EducationEmpty, EducationStatus, initials } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";

export interface TeamMemberItem {
  id: string;
  clerkUserId: string;
  name: string;
  email: string | null;
  role: "owner" | "admin" | "manager" | "staff" | "viewer" | "lecturer";
}

export interface TeamInvitationItem {
  id: string;
  email: string;
  role: string;
  staffTitle: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
}

const emptyResult: FormResult = { ok: false, message: "" };

function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(revokeTeamInvitation, emptyResult);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <XCircle size={14} aria-hidden="true" />
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {state.message ? (
        <span role={state.ok ? "status" : "alert"} className="text-xs text-neutral-600">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Workspace Owner",
  admin: "Administrator",
  manager: "Operations Manager",
  staff: "Queue Staff",
  viewer: "Read-only Viewer",
  lecturer: "Academic Lecturer",
};

export function TeamWorkspace({
  members,
  invitations,
  actorRole,
}: {
  members: TeamMemberItem[];
  invitations: TeamInvitationItem[];
  actorRole: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.email?.toLowerCase().includes(q) ?? false) ||
        m.role.toLowerCase().includes(q)
      );
    });
  }, [members, query, roleFilter]);

  const canManage = actorRole === "owner" || actorRole === "admin";

  return (
    <div className="space-y-6">
      <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Members</h2>
            <p>Authorized workspace access and role-based permissions</p>
          </div>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
          <label className="relative block">
            <span className="sr-only">Search team members</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or role…"
              className="min-h-12 w-full rounded-xl border border-black/15 bg-white pl-10 pr-4 text-base text-[#111318] outline-none focus:border-[#ff6b2b]"
            />
          </label>
          <CustomDropdown
            name="roleFilter"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "all", label: "All roles" },
              { value: "owner", label: "Owner" },
              { value: "admin", label: "Admin" },
              { value: "manager", label: "Manager" },
              { value: "staff", label: "Staff" },
              { value: "viewer", label: "Viewer" },
              { value: "lecturer", label: "Lecturer" },
            ]}
          />
        </div>

        {filteredMembers.length > 0 ? (
          <ul className={styles.rows}>
            {filteredMembers.map((member) => {
              const removable =
                member.role !== "owner" &&
                canManage &&
                (actorRole === "owner" || member.role !== "admin");
              return (
                <li key={member.id}>
                  <span className={styles.avatar}>{initials(member.name)}</span>
                  <span className={styles.rowMain}>
                    <strong>{member.name}</strong>
                    <span>
                      {ROLE_LABELS[member.role] ?? member.role}
                      {member.email ? ` · ${member.email}` : ""}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <EducationStatus tone={member.role === "owner" ? "success" : "info"}>
                      {member.role}
                    </EducationStatus>
                  </span>
                  {removable ? (
                    <RemoveMember userId={member.clerkUserId} role={member.role as "admin" | "manager" | "staff" | "viewer" | "lecturer"} />
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EducationEmpty
            title="No matching teammates"
            description="Adjust your search or role filter, or invite a teammate."
            icon={UsersRound}
          />
        )}
      </div>

      {invitations.length > 0 ? (
        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2>Invitations</h2>
              <p>Pending and historical staff invitations</p>
            </div>
          </header>
          <ul className={styles.rows}>
            {invitations.map((inv) => (
              <li key={inv.id}>
                <span className={styles.avatar}>
                  <Mail size={16} aria-hidden="true" />
                </span>
                <span className={styles.rowMain}>
                  <strong>{inv.email}</strong>
                  <span>
                    {inv.staffTitle ? `${inv.staffTitle} · ` : ""}
                    Role: {inv.role} · Sent {new Date(inv.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className={styles.rowEnd}>
                  <EducationStatus
                    tone={
                      inv.status === "accepted"
                        ? "success"
                        : inv.status === "pending"
                          ? "info"
                          : "warning"
                    }
                  >
                    {inv.status}
                  </EducationStatus>
                </span>
                {inv.status === "pending" && canManage ? (
                  <RevokeInviteButton invitationId={inv.id} />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-[#fffaf7] p-5 text-sm text-neutral-700">
        <div className="flex items-center gap-2 font-bold text-[#111318]">
          <ShieldCheck size={16} className="text-[#ff6b2b]" aria-hidden="true" />
          Role Permissions Summary
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          <li><strong>Owner:</strong> Full workspace, billing, team &amp; settings control.</li>
          <li><strong>Admin:</strong> Manage queues, locations, staff, analytics &amp; students.</li>
          <li><strong>Manager:</strong> Operate queues, bookings &amp; daily operations.</li>
          <li><strong>Staff / Viewer:</strong> Serve assigned queues or view read-only reports.</li>
        </ul>
      </div>
    </div>
  );
}
