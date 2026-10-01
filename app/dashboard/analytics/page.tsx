import { requireBusinessManager } from "@/lib/business/membership";
export default async function AnalyticsPage() {
  await requireBusinessManager();
  return <><h1 className="text-3xl font-semibold">Analytics</h1><div className="mt-8 rounded-2xl border border-black/10 bg-white p-8"><h2 className="text-xl font-semibold">Reports are coming soon</h2><p className="mt-3 text-muted">Queue volume, waiting times, and service reports will be available here.</p></div></>;
}
