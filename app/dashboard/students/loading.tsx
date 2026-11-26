export default function StudentsLoading() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading student management">
      <div className="page-skeleton-top" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gap: 10, width: "100%" }}>
          <span className="skeleton-line skeleton-line-short" />
          <span className="skeleton-line" style={{ width: "42%", height: 28 }} />
          <span className="skeleton-line" style={{ width: "68%" }} />
        </div>
      </div>
      <div className="skeleton-card" style={{ marginBottom: 16 }}>
        <span />
        <span />
        <span />
      </div>
      <div className="skeleton-card" style={{ marginBottom: 16 }}>
        <span />
        <span />
      </div>
      <div className="skeleton-card">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
