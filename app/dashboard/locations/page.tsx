import { getDashboardLocations } from "@/lib/dashboard/data";
export default async function LocationsPage() {
  const locations = await getDashboardLocations();
  return <><h1 className="text-3xl font-semibold">Locations</h1><p className="mb-8 mt-3 text-muted">Where your business serves customers.</p>
    {locations.length ? <ul className="grid gap-4 xl:grid-cols-2">{locations.map((location) => <li key={location.id} className="min-w-0 rounded-2xl border border-black/10 bg-white p-6"><h2 className="break-words text-xl font-semibold">{location.name}</h2><p className="mt-2 break-words text-muted">{location.address}</p><p className="mt-4 text-sm text-muted">{location.timezone} · {location.is_active ? "Active" : "Inactive"}</p></li>)}</ul> : <p className="rounded-2xl border border-dashed border-black/20 p-8">No locations yet.</p>}</>;
}
