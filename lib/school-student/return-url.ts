/** Only local application paths or same-origin Clerk return URLs survive authentication. */
export function safeAuthReturn(value: string | null | undefined, fallback = "/dashboard", allowedOrigin?: string) {
  if (!value || /[\\\r\n]/.test(value)) return fallback;
  try {
    if (value.startsWith("/") && !value.startsWith("//")) {
      const url = new URL(value, "https://turnmark.invalid");
      return url.origin === "https://turnmark.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
    }
    if (!allowedOrigin) return fallback;
    const url = new URL(value);
    const trusted = new URL(allowedOrigin);
    if (url.origin !== trusted.origin || url.username || url.password) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
