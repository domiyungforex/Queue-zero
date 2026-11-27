import { clerkClient } from "@clerk/nextjs/server";
import { UserPlus, UsersRound } from "lucide-react";
import { requireBusinessManager } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { TeamForm } from "@/components/business/forms";
import { EducationHeading } from "@/components/school/education-ui";
import { TeamWorkspace, type TeamInvitationItem, type TeamMemberItem } from "@/components/team/team-workspace";
import styles from "@/components/school/education-pages.module.css";

function mapInvitations(
  rawInvitations: Array<{
    id: string;
    email: string;
    role: string;
    staff_title: string | null;
    accepted_at: string | null;
    revoked_at: string | null;
    expires_at: string;
    created_at: string;
  }> | null,
): TeamInvitationItem[] {
  const now = Date.now();
  return (rawInvitations ?? []).map((inv) => {
    let status: TeamInvitationItem["status"] = "pending";
    if (inv.revoked_at) status = "revoked";
    else if (inv.accepted_at) status = "accepted";
    else if (new Date(inv.expires_at).getTime() <= now) status = "expired";

    return {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      staffTitle: inv.staff_title,
      status,
      createdAt: inv.created_at,
    };
  });
}

export default async function TeamPage() {
  const membership = await requireBusinessManager();
  const db = await createUserSupabaseClient();
  let queues: Awaited<ReturnType<typeof getDashboardQueues>> = [];
  let queuesFailed = false;
  try {
    queues = await getDashboardQueues();
  } catch (error) {
    console.error("Team queue list failed", error);
    queuesFailed = true;
  }

  const [{ data: members, error }, { data: rawInvitations }] = await Promise.all([
    db
      .from("business_members")
      .select("id,clerk_user_id,role")
      .eq("business_id", membership.businessId)
      .order("created_at"),
    db
      .from("institution_invitations")
      .select("id,email,role,staff_title,accepted_at,revoked_at,expires_at,created_at")
      .eq("organization_id", membership.businessId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (error) throw new Error("Team could not be loaded.");

  const userDetails = new Map<string, { name: string; email: string | null }>();
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({
      userId: (members ?? []).map((member) => member.clerk_user_id),
      limit: 100,
    });
    for (const user of users.data) {
      userDetails.set(user.id, {
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Team member",
        email: user.primaryEmailAddress?.emailAddress ?? null,
      });
    }
  } catch {
    // Authorized memberships remain visible if Clerk is temporarily unavailable.
  }

  const teamMembers: TeamMemberItem[] = (members ?? []).map((member) => {
    const detail = userDetails.get(member.clerk_user_id);
    return {
      id: member.id,
      clerkUserId: member.clerk_user_id,
      name: detail?.name ?? "Team member",
      email: detail?.email ?? null,
      role: member.role as TeamMemberItem["role"],
    };
  });

  const invitations = mapInvitations(rawInvitations);

  return (
    <main className={styles.page}>
      <EducationHeading
        eyebrow="TEAM & RBAC"
        title="Team members"
        description="Manage workspace roles, queue assignments, and pending invitations."
      />
      <section className={styles.summaryCard}>
        <div className={styles.summaryCount}>
          <span className={styles.icon}>
            <UsersRound size={21} aria-hidden="true" />
          </span>
          <span>
            <strong>{teamMembers.length}</strong>
            <span>{teamMembers.length === 1 ? "Member" : "Members"}</span>
          </span>
        </div>
        <a className={styles.primary} href="#invite-member">
          <UserPlus size={17} aria-hidden="true" />
          Invite member
        </a>
      </section>
      <section className={styles.twoColumn}>
        <TeamWorkspace members={teamMembers} invitations={invitations} actorRole={membership.role} />
        <section id="invite-member" className={`${styles.panel} ${styles.formWrap}`}>
          {queuesFailed ? (
            <p role="alert">
              Queues could not be loaded, so a new member cannot be assigned yet. Try again in a moment.
            </p>
          ) : (
            <TeamForm queues={queues} owner={membership.role === "owner"} />
          )}
        </section>
      </section>
    </main>
  );
}
