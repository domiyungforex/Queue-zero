# QueueZero pilot readiness

This checklist distinguishes implemented software from provider setup and physical validation. A successful build alone is not production readiness.

## Implemented

- [x] Business authentication boundaries, onboarding and membership selection.
- [x] Business locations, queue creation/editing/status and stable printable QR codes.
- [x] Transactional join numbering, customer ticket/cancellation and deterministic wait estimates.
- [x] Staff console: atomic Call Next, complete, no-show, recall, cancellation and pause/resume.
- [x] Tenant-safe team management and business settings.
- [x] Real Postgres analytics; explicitly labelled demo data exists only in /demo.
- [x] Private realtime invalidations, reconnect refetch and 15-second fallback polling.
- [x] Web Push adapter, permission control, event outbox, delivery attempts and retries.
- [x] Paystack checkout, verified payment activation, signed/idempotent webhooks, subscription management and queue limits.
- [x] PWA manifest/icons, offline fallback, web notification worker and privacy-safe caching.
- [x] Responsive marketing, auth, onboarding, business and customer screens.
- [x] Error/loading/empty states, audit events, validation and forced RLS.
- [x] Explicitly labelled public demo workspace and local-only seed.

## Deployment and provider checks

- Canonical website: https://queuezero.conchportal.com
- Vercel project: queue-zero, linked to domiyungforex/Queue-zero.
- Supabase project: wbvgorahtkiiwplsbnga. Migrations are the source of truth; history is recorded in supabase_migrations.schema_migrations.
- Clerk production issuer: https://clerk.conchportal.com. Preserve existing Conch domains/configuration; QueueZero uses its own subdomain.
- Configure NEXT_PUBLIC_APP_URL to the canonical origin so new printed QR codes resolve correctly.
- Web Push needs a matching VAPID key pair and VAPID_SUBJECT. Keep the private key server-only.
- Immediate notification delivery runs after operations. CRON_SECRET protects scheduled recovery. The checked-in daily cron is compatible with entry-level Vercel scheduling; higher traffic should use a frequent durable worker.
- Paystack requires PAYSTACK_SECRET_KEY, PAYSTACK_STARTER_PLAN_CODE and PAYSTACK_BUSINESS_PLAN_CODE. Both plans must be monthly and match PAYSTACK_CURRENCY (default NGN).
- Set Paystack webhook to /api/webhooks/paystack. Use the Paystack secret key for signature verification. Do not activate subscriptions from redirect query parameters.
- Verify provider renewal, payment failure, cancellation and webhook replay in test mode before enabling live billing.
- Replace credentials exposed in chat through provider settings before a real-business pilot.

## Required physical pilot checks

- [ ] Laptop receptionist plus five physical phones and one printed QR.
- [ ] Five distinct numbers, correct position updates and called screen.
- [ ] Two receptionist windows calling simultaneously; only one customer called.
- [ ] Pause/resume, no-show, cancellation, recall and reconnection.
- [ ] Web Push on intended Android/iOS/browser versions. iOS requires Home Screen installation for push.
- [ ] Real Clerk signup, verification, logout and cross-tenant isolation on the production domain.
- [ ] Paystack test-mode payment, renewal and cancellation with configured plans.
- [ ] Review pending/failed notification jobs and application logs during the pilot.

Do not begin a paid real-business pilot while authentication or payment verification is blocked. No integrations for SMS/WhatsApp are advertised as active without provider credentials/templates.

## Release verification — 2026-10-02

- Lint and strict TypeScript validation passed; production build passed.
- 329 unit/integration tests passed across 36 files.
- 486 PostgreSQL assertions passed across 10 SQL files, plus real overlapping-session tests for onboarding, queue updates, joins, cancellation, call-next and access revocation.
- Six committed Playwright browser tests passed against the hosted site, including all demo workspace pages at 1440, 768, 390 and 320 pixels with no horizontal overflow.
- Real hosted Clerk sign-in with administrative QA sign-in tickets, native issuer verification in Supabase, onboarding and queue creation passed. This does not replace customer-facing signup/email verification testing.
- Five separate anonymous browser contexts received A001–A005. Two staff windows calling concurrently selected one customer; completion, recall, no-show, pause/resume and live customer updates passed.
- Customer cancellation and offline/reconnect refetch passed. Public API fields exclude customer names, phones and internal IDs. The production service worker registered successfully.
- All actual business routes (overview, queues, analytics, locations, team, billing and settings) rendered at four viewport widths without browser errors. Business settings validation/save and additional location creation passed.
- A second real Clerk tenant was denied the first tenant’s queue API/page. Unsigned notification-worker requests were denied.
- Hosted notification events were recorded and skipped correctly when no browser push subscription existed. This is not evidence of actual device delivery.
- The QA operating queue is closed; all five fixture tickets are terminal (three completed, one no-show, one cancelled). QA history is retained for audit, separated from real businesses.
- The original queue-zero-flax.vercel.app alias redirects to the canonical custom domain.

Remaining blockers for the full paid pilot: Paystack secret/plan setup and real payment testing; actual phone Web Push and printed-QR acceptance; normal signup/email verification testing; rotation of credentials shared in chat. Free queue operation has been exercised end to end on the hosted deployment.
