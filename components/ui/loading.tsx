type QrLoaderProps = { label?: string; compact?: boolean };

const qrCells = [1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1];

export function QrLoader({ label = "Loading", compact = false }: QrLoaderProps) {
  return <div className={`qr-loader${compact ? " qr-loader-compact" : ""}`} role="status" aria-live="polite">
    <span className="qr-loader-mark" aria-hidden="true">
      <span className="qr-loader-grid">{qrCells.map((filled, index) => <i className={filled ? "filled" : ""} key={index} />)}</span>
      <span className="qr-loader-scan" />
    </span>
    <span className="qr-loader-label">{label}</span>
  </div>;
}

export function PageSkeleton({ cards = 3, label = "Loading page" }: { cards?: number; label?: string }) {
  return <div className="page-skeleton" role="status" aria-label={label}>
    <div className="page-skeleton-top"><QrLoader label={label} compact /><span className="skeleton-line skeleton-line-short" /></div>
    <div aria-hidden="true" className="skeleton-heading" />
    <div aria-hidden="true" className="skeleton-card-grid">{Array.from({ length: cards }, (_, index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>
  </div>;
}
