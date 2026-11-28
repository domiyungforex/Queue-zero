export default function AuthLoading() {
  return (
    <main id="main" className="tm-skel-auth" role="status" aria-label="Opening secure sign-in">
      <div className="tm-skel-auth-story" aria-hidden="true" />
      <div className="tm-skel-auth-form" aria-hidden="true">
        <span className="skeleton-line tm-skel-title-2" style={{ height: 34 }} />
        <span className="skeleton-line tm-skel-sub" />
        <span className="skeleton-line tm-skel-input" />
        <span className="skeleton-line tm-skel-input" />
        <span className="tm-skel-button" />
      </div>
    </main>
  );
}
