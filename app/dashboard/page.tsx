import { PageShell } from "@/components/ui/page-shell";
import { requireUserId } from "@/lib/auth/server";

export default async function Page() {
  // Guard the resource itself as well as the layout and request proxy.
  await requireUserId();
  return (
    <PageShell title="Your workspace">
      <p className="max-w-xl leading-relaxed text-muted">
        You’re signed in. Business setup will be available soon.
      </p>
    </PageShell>
  );
}
