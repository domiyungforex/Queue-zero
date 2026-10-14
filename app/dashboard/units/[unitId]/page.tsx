import type { Metadata } from "next";
import Link from "next/link";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { UnitForm } from "@/components/institution/forms";
import { LiveRefresh } from "@/components/realtime/refresh";
export const metadata: Metadata = { title: "Unit operations" };
export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
 const { unitId } = await params;
 const { snapshot, manager } = await getInstitutionSnapshot(unitId);
 const unit = snapshot.units.find(item => item.id === unitId)!;
 return <><nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/dashboard/units">Units</Link> / {unit.name}</nav><h1 className="text-3xl font-semibold">{unit.name}</h1><LiveRefresh topic={`unit:${unitId}`} authenticated/><div className="my-6 grid gap-4 sm:grid-cols-3">{[["Waiting now",snapshot.summary.waiting],["Active queues",snapshot.summary.active_queues],["Classes running",snapshot.summary.classes_running]].map(([label,value]) => <div key={label} className="rounded-xl border border-black/10 bg-white p-5"><p>{label}</p><strong className="text-3xl">{value}</strong></div>)}</div><h2 className="text-xl font-semibold">Queues</h2>{snapshot.queues.map(queue => <Link key={queue.id} href={`/dashboard/queues/${queue.id}`} className="my-3 block rounded-xl border border-black/10 bg-white p-5">{queue.name} · {queue.waiting} waiting · {queue.status}</Link>)}{!snapshot.queues.length && <p className="my-4 text-muted">No accessible queues in this unit.</p>}{(manager || unit.permissions.includes("queue.create")) && <Link className="button-primary" href={`/dashboard/queues/new?unit=${unitId}`}>Create queue</Link>}{snapshot.courses.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Courses</h2>{snapshot.courses.map(course => <Link key={course.id} href={`/dashboard/courses/${course.id}`} className="my-3 block rounded-xl border border-black/10 bg-white p-5">{course.code} · {course.title}</Link>)}</section>}{(manager || unit.permissions.includes("unit.manage")) && <section className="mt-8 max-w-2xl"><h2 className="mb-4 text-xl font-semibold">Unit settings</h2><UnitForm units={snapshot.units} unit={unit}/></section>}</>;
}
