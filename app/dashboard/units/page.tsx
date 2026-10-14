import type { Metadata } from "next";
import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { InstitutionSetup, UnitForm } from "@/components/institution/forms";
import { displayKind } from "@/lib/institution/contracts";
export const metadata: Metadata = { title: "Institution units" };
export default async function UnitsPage() {
 const membership = await requireBusinessMembership();
 if (!membership.institutionType) return <><h1 className="text-3xl font-semibold">Institution units</h1><p className="my-5 text-muted">Manage departments and campus services within one organization. Existing queues will keep their public links.</p>{["owner","admin"].includes(membership.role) ? <InstitutionSetup/> : <p>An institution administrator can enable this workspace.</p>}</>;
 const { snapshot, manager } = await getInstitutionSnapshot();
 return <><h1 className="text-3xl font-semibold">Units</h1><p className="my-4 text-muted">Faculties, departments and service teams in {snapshot.organization.name}.</p><div className="grid gap-4 md:grid-cols-2">{snapshot.units.map(unit => <Link key={unit.id} href={`/dashboard/units/${unit.id}`} className="rounded-xl border border-black/10 bg-white p-5"><h2 className="font-semibold">{unit.name}</h2><p className="mt-2 text-sm text-muted">{displayKind(unit.type)} · {unit.status}{unit.parent_unit_id && ` · ${snapshot.units.find(parent => parent.id === unit.parent_unit_id)?.name ?? "Parent unit"}`}</p></Link>)}</div>{!snapshot.units.length && <p>No accessible units yet.</p>}{manager && <section className="mt-8 max-w-2xl rounded-2xl border border-black/10 bg-white p-5"><h2 className="mb-5 text-xl font-semibold">Create a unit</h2><UnitForm units={snapshot.units}/></section>}</>;
}
