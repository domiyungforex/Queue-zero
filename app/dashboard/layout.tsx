import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { getMemberships, requireBusinessMembership } from "@/lib/business/membership";
import { workspaceAccessDecision } from "@/lib/business/workspace-access";
import { WorkspaceDashboardShell } from "@/components/dashboard/workspace-dashboard-shell";
import { getWorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";
import { requireUserId } from "@/lib/auth/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let memberships: Awaited<ReturnType<typeof getMemberships>> | null = null;
  try {
    memberships = await getMemberships();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) throw error;
    console.error("Dashboard membership failed", error);
  }

  const decision = workspaceAccessDecision({ signedIn: true, membershipCount: memberships ? memberships.length : null });
  if (decision === "retry") {
    return (
      <main className="setup-shell" style={{ maxWidth: 640, margin: "48px auto", padding: 24 }}>
        <h1 className="text-2xl font-semibold">Your workspace could not be loaded</h1>
        <p className="my-4 text-muted">The database request failed, so this page did not open setup or show an empty organization. Your records were not changed.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="button-primary">Try again</Link>
          <Link href="/sign-in" className="button-secondary">Sign in again</Link>
        </div>
      </main>
    );
  }
  if (decision === "onboarding" || !memberships) redirect("/onboarding");

  const m = await requireBusinessMembership();

  const [institution, identity, userId, notifications] = await Promise.all([
    m.institutionType ? getInstitutionSnapshot().catch(() => null) : Promise.resolve(null),
    currentUser().catch(() => null),
    requireUserId().catch(() => ""),
    getWorkspaceNotificationSnapshot().catch(() => ({ unread: 0, items: [] })),
  ]);

  if (!userId) redirect("/sign-in");

  const institutionTeaching = Boolean(institution?.snapshot.units.some(unit => unit.permissions.some(permission => permission.startsWith("course.") || permission.startsWith("attendance."))));
  const institutionStaffManagement = Boolean(institution?.snapshot.units.some(unit => unit.permissions.includes("unit.staff.manage")));

  return (
    <WorkspaceDashboardShell
      membership={m}
      memberships={memberships}
      institutionTeaching={institutionTeaching}
      institutionStaffManagement={institutionStaffManagement}
      userId={userId}
      notifications={notifications}
      userName={identity?.fullName ?? identity?.primaryEmailAddress?.emailAddress ?? null}
      userImageUrl={identity?.imageUrl ?? null}
    >
      {children}
    </WorkspaceDashboardShell>
  );
}