# TuRnMaRk deployment

The Vercel project `queue-zero` tracks `domiyungforex/Queue-zero`, branch `main`. The canonical production origin is **https://turnmark.conchportal.com**. Set the Next.js preset and default `npm run build`; do not specify a custom output directory.

## Environment

Copy variable names from `.env.example` into Vercel’s encrypted environment settings. Git pushes never transfer local environment files.

| Configuration | Required values |
| --- | --- |
| Canonical origin | `NEXT_PUBLIC_APP_URL=https://turnmark.conchportal.com` |
| Clerk | Matching publishable/secret keys; `CLERK_DISABLE_AUTO_PROXY=true` for direct frontend API on the configured custom domain |
| Supabase | Matching project URL, public key, server-only service key |
| Anonymous join protection | Stable random `QUEUE_JOIN_SECRET` |
| Browser notifications | Matching public/private VAPID keys, `VAPID_SUBJECT`, random `CRON_SECRET` |
| Paid plans | `PAYSTACK_SECRET_KEY`, STARTER/BUSINESS monthly plan codes and currency |

Production currently shares the existing Clerk primary domain `conchportal.com`. Do not rename that instance’s primary domain. The TuRnMaRk subdomain must be authorized by Clerk. Supabase must trust the exact Clerk issuer `https://clerk.conchportal.com`, and verified session tokens must carry the authenticated database role. Use a separate Clerk development instance for unrelated preview origins.

Public variables are embedded at build time; rebuild after changing them. Keep server keys out of browser code and Git. Replace credentials shared in chat through their providers before a public pilot.

## Database

All checked-in migrations through `20261002223553_publish_business_updates.sql` are applied to the hosted project. The release was verified on the canonical Vercel domain on 2026-10-03. Schema changes must remain migrations. For future releases, inspect `supabase db push --dry-run`, then apply pending migrations to the linked intended project. Never apply local test bootstrap/preview fixtures to production or weaken RLS to address an authentication error.

Clerk third-party issuer configuration was registered with Supabase. Verify actual authenticated onboarding, tenant reads and private Realtime after deploying; a successful build does not prove provider integration.

## Notifications

VAPID credentials and the notification cron secret are configured in production. Actions request delivery after commit; an outbox retains pending work. `vercel.json` schedules a daily retry sweep, compatible with a basic Vercel plan. Higher-volume operations should schedule the authenticated `/api/notifications/deliver` endpoint more frequently. Stale turn notifications are skipped. Customers must opt in, and iOS Web Push requires a supported installed home-screen app.

## Billing

Create monthly Paystack plans in the configured currency and add their codes and secret. Configure the webhook as `/api/webhooks/paystack` and callback as `/api/billing/verify`. Signatures use Paystack’s secret-key HMAC-SHA512; activation requires server verification of the stored checkout’s business, plan, currency and amount. Browser return state alone cannot activate a plan.

Until credentials exist, paid checkout intentionally remains unavailable. Verify test-mode success, cancellation, failed payment, duplicate webhook and renewal before accepting payments.

## Release smoke test

1. Verify landing pages and the legacy `/demo` → authenticated workspace redirect and Clerk sign-in, signup, logout, and protected redirects.
2. Create a business, location and queue; check QR destination equals the canonical origin.
3. Join from separate signed-out browsers; confirm unique numbers and private ticket data.
4. Open two staff consoles; call simultaneously and verify exactly one active serving customer.
5. Complete, recall, no-show, cancel, pause/resume and reconnect; confirm live customer changes.
6. Test a second tenant, notification permission, public display, mobile layouts and billing configuration.
7. Run the physical acceptance procedure in the pilot guide before inviting real customers.

Use the production checklist for outstanding provider and physical checks; deployment alone is not a production-readiness claim.

## Shared Clerk instance role claim

Production sets `CLERK_DATABASE_JWT_TEMPLATE=queuezero_db`. That isolated template contains `role: "authenticated"`, uses Clerk’s normal RS256 signing key and a 60-second lifetime, and retains the verified issuer/subject. Supabase verifies it through the registered third-party issuer. It does not use a legacy Supabase HS256 signing secret or change the shared instance’s default session claims. Server database reads and authenticated Realtime use the same token configuration. Leave the variable empty when native session tokens already include the required role.

## TuRnMaRk deployment — 2026-10-04

User authorized production deployment of `72eefa3`. Applied the additive presence and attendance migrations as `20261004015357_presence_domains` and `20261004015405_school_attendance`, matching provider-recorded versions. Existing queue-session links were checked, anonymous school RPC access is denied, and production raw-table RLS checks are performed before publishing. Vercel deployment `dpl_4ZmphskdimjTV4ULBzBBzScx3snU` reached READY for commit `2d65af6`, and the canonical domain serves TuRnMaRk. All 14 hosted read-only Playwright checks passed (PWA, mobile layouts, auth boundaries, invalid attendance/ticket links and navigation). This is not a production-readiness certification. The unrelated shared-project exposure remains unresolved; no other application tables or records were changed.

Production environment names were verified without revealing values: Clerk, Supabase, queue signing, VAPID and cron variables are present. Paystack credentials/plan codes are absent, so paid checkout remains unavailable. Clerk publicly advertises email-code sign-in, but its shared-instance signup settings also require username, first/last name and password; the advanced provider flow remains available and fully passwordless signup is not yet provider-configured. No shared Clerk settings were changed. The Vercel grouped runtime-error scan returned no errors in the 15-minute release window.
