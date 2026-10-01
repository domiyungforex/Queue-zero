import { getBusinessDetails } from "@/lib/dashboard/data";
export default async function SettingsPage() {
  const business = await getBusinessDetails();
  return <><h1 className="text-3xl font-semibold">Business settings</h1><p className="mt-3 text-muted">Your business details.</p><dl className="mt-8 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white px-6">
    {[["Business name",business.name],["Industry",business.industry],["Country",business.country_code],["Timezone",business.timezone]].map(([label,value]) => <div key={label} className="py-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
  </dl></>;
}
