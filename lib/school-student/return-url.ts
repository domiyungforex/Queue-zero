/** Only local application paths may survive the authentication round trip. */
export function safeAuthReturn(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  try { const url = new URL(value, "https://turnmark.invalid"); return url.origin === "https://turnmark.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback; } catch { return fallback; }
}
