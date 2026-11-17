import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { LiveRefresh } from "@/components/realtime/refresh";
import { DashboardWelcomeBanner } from "@/components/ui/turnmark-system";
import { PageHeading } from "@/components/ui/workspace";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { getInstitutionSnapshot } from "@/lib/institution/data";

export async function InstitutionOverview() {
  try {
    const { snapshot } = await getInstitutionSnapshot();
    return <>
      <PageHeading eyebrow="INSTITUTION OVERVIEW" title={snapshot.organization.name} description="Queues and attendance across your authorized units." />
      <DashboardWelcomeBanner eyebrow="ONE INSTITUTION. AUTHORIZED UNITS." title="Campus flow, without the ERP clutter." description="Use real queue, class and attendance activity to coordinate the services people visit." visual={TURNMARK_ASSETS.industries.education} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["People waiting", snapshot.summary.waiting], ["Active queues", snapshot.summary.active_queues], ["Classes running", snapshot.summary.classes_running], ["Attendance today", snapshot.summary.attendance_today], ["Active units", snapshot.summary.units_active]].map(([label, value]) => <div key={label} className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</div>
      <h2 className="mt-8 text-xl font-semibold">Your units</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{snapshot.units.map((unit) => <Link key={unit.id} href={`/dashboard/units/${unit.id}`} className="rounded-xl border border-black/10 bg-white p-5 font-semibold">{unit.name}<LiveRefresh topic={`unit:${unit.id}`} authenticated /></Link>)}</div>
      {!snapshot.units.length && <p className="mt-5 text-muted">No units are assigned to you yet. An institution administrator can grant access.</p>}
      <Link href="/dashboard/services" className="button-secondary mt-6">Browse institution services</Link>
    </>;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Institution overview failed", error);
    return <section role="alert" className="rounded-2xl border border-black/10 bg-white p-6">
      <h2 className="text-lg font-semibold">Institution services could not be loaded</h2>
      <p className="mt-2 text-muted">Your workspace is open, but unit data could not be read. Nothing here is sample data.</p>
      <Link href="/dashboard" className="button-secondary mt-4">Try again</Link>
    </section>;
  }
}
