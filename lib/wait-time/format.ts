/** Coarse ranges communicate uncertainty without presenting a countdown. */
export function formatWaitRange(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Wait must be finite and nonnegative.");
  if (seconds === 0) return "No wait expected";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 5) return "Under 5 min";
  if (minutes < 60) {
    const lower = Math.floor(minutes / 5) * 5;
    return `About ${lower}–${lower + 5} min`;
  }
  if (minutes < 1440) {
    const lower = Math.floor(minutes / 60);
    return `About ${lower}–${lower + 1} hr`;
  }
  const lower = Math.floor(minutes / 1440);
  return `About ${lower}–${lower + 1} days`;
}
