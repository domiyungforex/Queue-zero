export default function MarketingLoading() {
  return (
    <main id="main" className="tm-skel" role="status" aria-label="Loading page">
      <div className="tm-skel-nav" aria-hidden="true">
        <span className="skeleton-line tm-skel-logo" />
        <span className="skeleton-line tm-skel-links" />
      </div>
      <div className="tm-skel-hero" aria-hidden="true">
        <span className="skeleton-line tm-skel-title" />
        <span className="skeleton-line tm-skel-title-2" />
        <span className="skeleton-line tm-skel-sub" />
      </div>
      <div className="tm-skel-cards" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </main>
  );
}
