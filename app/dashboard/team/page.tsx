import { clerkClient } from "@clerk/nextjs/server";
import { UserPlus, UsersRound } from "lucide-react";
import { requireBusinessManager } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { TeamForm,RemoveMember } from "@/components/business/forms";
import { EducationEmpty, EducationHeading, EducationStatus, initials } from "@/components/school/education-ui";
import styles from "@/components/school/education-pages.module.css";

export default async function TeamPage() {
  const membership = await requireBusinessManager();
  const db = await createUserSupabaseClient();
  const [{ data: members, error }, queues] = await Promise.all([
    db.from("business_members").select("id,clerk_user_id,role").eq("business_id", membership.businessId).order("created_at"),
    getDashboardQueues(),
  ]);
  if (error) throw new Error("Team could not be loaded.");
  const names = new Map<string, string>();
  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ userId: (members ?? []).map((member) => member.clerk_user_id), limit: 100 });
    for (const user of users.data) names.set(user.id, user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Team member");
  } catch {
    // Authorized memberships remain visible if Clerk is temporarily unavailable.
  }

  return <main className={styles.page}>
    <EducationHeading eyebrow="TEAM" title="Team members" description="Give each teammate the access they need." />
    <section className={styles.summaryCard}><div className={styles.summaryCount}><span className={styles.icon}><UsersRound size={21} aria-hidden="true" /></span><span><strong>{members?.length ?? 0}</strong><span>{members?.length === 1 ? "Member" : "Members"}</span></span></div><a className={styles.primary} href="#invite-member"><UserPlus size={17} aria-hidden="true" />Invite member</a></section>
    <section className={styles.twoColumn}>
      <div className={styles.panel}><header className={styles.panelHeader}><div><h2>Members</h2><p>Authorized workspace access</p></div></header>{members?.length ? <ul className={styles.rows}>{members.map((member) => {
        const name = names.get(member.clerk_user_id) ?? "Team member";
        return <li key={member.id}><span className={styles.avatar}>{initials(name)}</span><span className={styles.rowMain}><strong>{name}</strong><span>{member.role === "owner" ? "Workspace owner" : "Education workspace member"}</span></span><span className={styles.rowEnd}><EducationStatus tone={member.role === "owner" ? "success" : "info"}>{member.role}</EducationStatus></span>{(member.role === "admin" || member.role === "staff") && (membership.role === "owner" || member.role === "staff") ? <RemoveMember userId={member.clerk_user_id} role={member.role} /> : <span />}</li>;
      })}</ul> : <EducationEmpty title="No teammates yet" description="Add a verified TuRnMaRk user when you are ready to collaborate." icon={UsersRound} />}</div>
      <section id="invite-member" className={`${styles.panel} ${styles.formWrap}`}><TeamForm queues={queues} owner={membership.role === "owner"} /></section>
    </section>
  </main>;
}
