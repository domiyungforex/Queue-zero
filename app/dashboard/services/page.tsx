import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeading } from "@/components/ui/workspace";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { getProfessionalWorkspaceProfile } from "@/lib/professional/data";
import { PROFESSIONAL_LABELS } from "@/lib/professional/contracts";
import { PersonalServicesMobile } from "@/components/professional/personal-workspace-mobile";
import personalStyles from "@/components/professional/personal-workspace-mobile.module.css";

export const metadata: Metadata = { title: "Workspace services" };

export default async function ServicesPage() {
  const membership = await requireBusinessMembership();
  if (membership.workspaceOwnership === "INDIVIDUAL"
    && membership.professionalCategory
    && membership.professionalCategory !== "LECTURER_TEACHER") {
    const category = membership.professionalCategory;
    const profileResult = await getProfessionalWorkspaceProfile().then((value) => ({ value, error: false })).catch(() => ({ value: null, error: true }));
    const profile = profileResult.value;
    return <>
      <PersonalServicesMobile profile={profile} fallbackLabel={PROFESSIONAL_LABELS[category]} canManage={membership.role === "owner" || membership.role === "admin"} loadError={profileResult.error} />
      <div className={personalStyles.desktopOnly}>
        <PageHeading eyebrow="SERVICES" title="The work customers come to you for." description="Your onboarding service is saved here. Create queues only when you are ready to receive customers." action={(membership.role === "owner" || membership.role === "admin") ? <Link className="button-primary" href="/dashboard/queues/new">Create queue</Link> : undefined} />
        {profileResult.error ? <div className="notice warning" role="alert">Your saved service could not be loaded.</div> : profile ? <section className="panel max-w-2xl p-6">
          <p className="eyebrow">PRIMARY SERVICE</p>
          <h2 className="mt-2 text-2xl font-semibold">{profile.service_name ?? PROFESSIONAL_LABELS[category]}</h2>
          {profile.locations ? <p className="mt-3 text-muted">{profile.locations.name} · {profile.locations.address}</p> : <p className="mt-3 text-muted">No practice location is currently available.</p>}
        </section> : <EmptyState title="No service details available" description="Your workspace exists, but its professional service profile could not be found." />}
      </div>
    </>;
  }

  if (!membership.institutionType) redirect("/dashboard");
  const { snapshot } = await getInstitutionSnapshot();
  const units = snapshot.units.filter((unit) => unit.status === "active");
  const queueCounts = new Map<string, number>();
  const courseCounts = new Map<string, number>();
  for (const queue of snapshot.queues) {
    if (queue.unit_id) queueCounts.set(queue.unit_id, (queueCounts.get(queue.unit_id) ?? 0) + 1);
  }
  for (const course of snapshot.courses) {
    if (course.unit_id) courseCounts.set(course.unit_id, (courseCounts.get(course.unit_id) ?? 0) + 1);
  }
  return <>
    <PageHeading eyebrow="SERVICES" title="Institution services" description="Open a unit to see the queues and courses your role permits you to access." />
    {units.length ? <div className="grid gap-4 sm:grid-cols-2">{units.map((unit) => <Link key={unit.id} href={`/dashboard/units/${unit.id}`} className="panel block p-5"><h2 className="font-semibold">{unit.name}</h2><p className="mt-2 text-muted">{queueCounts.get(unit.id) ?? 0} accessible queues · {courseCounts.get(unit.id) ?? 0} courses</p></Link>)}</div> : <EmptyState title="No services available" description="No active institutional units are available to your account." />}
  </>;
}
