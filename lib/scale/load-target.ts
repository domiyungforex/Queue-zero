const BLOCKED_HOSTS = [
  "turnmark.conchportal.com",
  "supabase.co",
  "supabase.in",
];

/** Load tests may target an explicit isolated environment only. Production is refused. */
export function assertIsolatedLoadTarget(value: string | undefined): URL {
  if (!value) throw new Error("Set LOAD_TARGET to an isolated staging URL. Production is not a load-test target.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LOAD_TARGET must be an absolute URL.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("LOAD_TARGET must be HTTPS, or localhost for a local stack.");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
    throw new Error("Refusing to load-test production or the hosted database.");
  }
  return url;
}
