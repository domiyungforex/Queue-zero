type BrandLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

/**
 * Flagship branded app loader: the TuRnMaRk wordmark above an SVG ticket
 * motif. A perforated ticket carries three queue dots and an orange pulse
 * travels dot-to-dot — people moving up the queue — while a thin orange
 * shimmer runs under the wordmark. Animation lives in globals.css under
 * the .brand-loader prefix and honours prefers-reduced-motion.
 */
export function BrandLoader({ label = "Loading TuRnMaRk", fullScreen = false }: BrandLoaderProps) {
  return (
    <div className={`brand-loader${fullScreen ? " brand-loader-fullscreen" : ""}`} role="status" aria-label={label}>
      <span className="brand-loader-wordmark" aria-hidden="true">TuRnMaRk</span>
      <span className="brand-loader-shimmer" aria-hidden="true" />
      <svg className="brand-loader-ticket" viewBox="0 0 220 92" width="220" height="92" aria-hidden="true" focusable="false">
        <rect className="brand-loader-ticket-body" x="6" y="6" width="208" height="80" rx="16" />
        <line className="brand-loader-ticket-perf" x1="150" y1="10" x2="150" y2="82" />
        <circle className="brand-loader-dot" cx="42" cy="46" r="9" />
        <circle className="brand-loader-dot" cx="78" cy="46" r="9" />
        <circle className="brand-loader-dot" cx="114" cy="46" r="9" />
        <circle className="brand-loader-pulse" cx="42" cy="46" r="5" />
        <rect className="brand-loader-stub-line" x="166" y="32" width="32" height="7" rx="3.5" />
        <rect className="brand-loader-stub-line" x="166" y="50" width="22" height="7" rx="3.5" />
      </svg>
      <span className="brand-loader-label">{label}</span>
    </div>
  );
}
