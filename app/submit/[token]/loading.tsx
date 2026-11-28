import { PanelSkeleton } from "@/components/ui/loading";

/**
 * Guest submission portal loader: a centered card skeleton on the cream
 * canvas, mirroring the portal card the student is about to see.
 */
export default function SubmitLoading() {
  return (
    <main className="submit-loading-shell">
      <div className="submit-loading-card">
        <span className="skeleton-line skeleton-line-short" aria-hidden="true" />
        <span className="skeleton-line submit-loading-title" aria-hidden="true" />
        <PanelSkeleton label="Loading assignment" />
      </div>
    </main>
  );
}
