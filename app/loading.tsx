import { QrLoader } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main id="main" className="loading-screen">
      <QrLoader label="Loading TuRnMaRk" />
      <span className="skeleton-line tm-skel-sub" aria-hidden="true" />
      <span className="skeleton-line" aria-hidden="true" style={{ width: "42%" }} />
    </main>
  );
}
