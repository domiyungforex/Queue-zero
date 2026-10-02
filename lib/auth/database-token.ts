import "server-only";
/** Optional issuer-signed template for shared Clerk instances without a role claim. */
export function databaseTokenOptions() {
  const template = process.env.CLERK_DATABASE_JWT_TEMPLATE?.trim();
  return template ? { template } : undefined;
}
