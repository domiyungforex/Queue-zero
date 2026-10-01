import { PageShell } from "@/components/ui/page-shell";
import { requireBusinessMembership } from "@/lib/business/membership";

export default async function Page() {
  // Guard the resource itself as well as the layout and request proxy.
  const membership = await requireBusinessMembership();
  return (
    <PageShell title={membership.businessName}>
      <p className="max-w-xl leading-relaxed text-muted">
        Your business workspace is ready.
      </p>
    </PageShell>
  );
}
