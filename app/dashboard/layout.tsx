import Link from "next/link";
import { getMemberships, requireBusinessMembership } from "@/lib/business/membership";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { BusinessSelector } from "@/components/dashboard/business-selector";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const membership = await requireBusinessMembership();
  const memberships = await getMemberships();
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="border-b border-black/10 bg-white p-4 lg:min-h-screen lg:border-r lg:p-6">
      <Link href="/dashboard" className="inline-flex min-h-12 items-center text-2xl font-bold tracking-tight">Queue<span className="text-primary">Zero</span></Link>
      <div className="mt-4 lg:mt-10"><DashboardNavigation role={membership.role} /></div>
      <BusinessSelector key={membership.businessId} businessId={membership.businessId} memberships={memberships} />
    </aside>
    <div className="min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 bg-white px-5 py-4 lg:px-10">
        <div className="min-w-0"><p className="break-words font-semibold">{membership.businessName}</p><p className="text-sm capitalize text-muted">{membership.role} workspace</p></div>
        <AuthNavigation />
      </header>
      <main id="main" className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  </div>;
}
