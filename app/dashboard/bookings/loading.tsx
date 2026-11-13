export default function BookingsLoading() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Bookings</h1>
          <p className="page-description">Loading booking data…</p>
        </div>
      </div>
      <div className="metrics-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat-card" style={{ minHeight: 90, opacity: 0.5 }} />
        ))}
      </div>
    </>
  );
}
