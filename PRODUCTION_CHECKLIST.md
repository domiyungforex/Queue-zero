# QueueZero first-business pilot checklist

**Status: blocked for production approval.** Local validation is strong, but the critical shared-database exposure and provider/device acceptance gates below remain open. These results supersede earlier readiness claims in this file. Local validation on 2026-10-02; deployment and hosted smoke checks on 2026-10-03.

## Release blockers

- [ ] **Critical: shared production schema exposure.** Nine unrelated tables have RLS disabled and anonymous SELECT grants. The database owner must repair their access policies/grants or isolate QueueZero. Do not deploy guessed policies for another application. See `SECURITY_REVIEW.md` and the [Supabase advisory](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- [x] Apply `20261002223535_bound_join_retry_records.sql`, `20261002223544_recheck_staff_management_authorization.sql` and `20261002223553_publish_business_updates.sql` through the controlled migration process, then deploy the reviewed application commits. All three migrations were applied through the authenticated Supabase connector; release `906adc2` deployed successfully to the canonical production domain. Local filenames match the recorded remote versions.
- [ ] Run normal Clerk production signup → verification → onboarding → sign-out/sign-in with the intended account. Investigate the three dashboard membership-load errors observed in the last 24 hours. The old realtime endpoint also logged one expired/deleted-session error; its generic non-cacheable 401 fix is deployed and the signed-out endpoint check passes.
- [ ] Verify actual browser push on the target phones, including Home Screen installation on supported iPhones. An outbox event or successful worker registration is not device-delivery evidence.
- [ ] Complete the laptop + five phones + printed QR acceptance in `PILOT_GUIDE.md`, including two receptionist windows calling concurrently.
- [ ] For paid upgrades: confirm Paystack secret, currency and monthly plan codes; run test-mode purchase, renewal, failure, cancellation and webhook replay. Existing notes said configuration was missing; current secret presence could not be independently inspected.
- [ ] Confirm rotation of any credentials exposed in earlier sessions and set log/phone-data retention. No credentials were exported or rotated in this session.

## Fresh validation evidence

| Check | Result / limits |
| --- | --- |
| Lint | `npm run lint` passed. |
| Strict TypeScript | `npm run typecheck` passed; `next build` also completed type generation/checking. |
| Unit + integration | `npm test`: 355 tests across 43 files passed. Includes permissions, public projections, QR decoding, wait estimates, payment matching/signatures, realtime lifecycle and security regressions. Provider identities are fixtures. |
| PostgreSQL | `npm run db:test:isolated`: 503 pgTAP assertions across 12 SQL files; overlapping onboarding, queue management, joins, cancellation, Call Next and access-revocation transactions. PostgreSQL 17 with all repository migrations. |
| Browser | Five-customer Playwright journey passed against disposable local PostgreSQL/PostgREST: unique numbers, staff transaction races, polling/reconnect, cancel/no-show/pause/resume. All 10 public/PWA browser tests passed against the final optimized build, including 1440/768/390/320px layouts, legacy redirect, offline recovery and normal navigation. |
| Production build | `npm run build` passed with synthetic local Clerk keys. All 10 public/PWA browser tests passed against `next start`. This proves the optimized bundle, not live provider configuration. |
| Dependencies | `npm audit --omit=dev`: zero known production dependency vulnerabilities. |
| UI review | Mobile dark staff console, white cards, emerald controls, dark waiting ticket, status icons and mobile bottom navigation follow the supplied reference. No horizontal overflow in tested widths. |
| PWA | Stable manifest ID/scope/start URL, standard 192/512 icons, opaque maskable icon, Apple icon, matching theme/background, worker registration and no-cache headers. Browser tests cover back navigation, offline fallback/recovery and uninstalled use. Worker tests cover push/click handling. Real OS installation and notch/home-indicator behavior remain physical checks. |

The five-browser test uses real anonymous HTTP joins and ticket screens, with staff operations executed as fixture-authenticated SQL transactions. It does **not** claim a fresh end-to-end Clerk signup, a browser-authenticated staff session, Supabase Broadcast delivery or actual Web Push. Preview has PostgREST, not Supabase Realtime; browser updates exercised polling/reconnect recovery. The dedicated SQL race suite tests two distinct receptionist identities.

The no-demo regression also confirmed the preview starts with zero businesses, queues and tickets. Two console tests enforce server-confirmed changes and honest failure states. Ten SQL assertions verify business/service/location invalidations and private payloads using a disposable transport capture; they do not prove hosted Broadcast delivery.

The DB test harness now waits for PostgreSQL's final TCP listener rather than its temporary initialization socket. Docker Hub rate limiting was worked around using the official PostgreSQL image from its public ECR mirror and the official PostgREST release binary, without changing product dependencies.

## Read-only production observations

- Canonical site `https://queuezero.conchportal.com` responds successfully over HTTPS.
- Vercel project `queue-zero` (`prj_ChgtgY0WlNMzEcartohGeDm02Tp6`) deployed release **`906adc2`** successfully as `dpl_DxJ9jGC7hGrZG1Jaha4k1QTb6Ls8`. The canonical domain serves the updated application.
- All 10 read-only hosted browser checks passed: mobile/public layouts, PWA metadata/icons, offline recovery, browser navigation and the legacy demo redirect. The data-writing customer journey was intentionally skipped on production.
- Hosted SQL catalog checks confirmed all 10 new triggers enabled, the manager-lock and join-limit helpers installed, Realtime Broadcast available, and anonymous execution of the private business helper denied. No sample records were inserted.
- The workspace lacks Supabase CLI credentials; migration deployment used the authenticated connector after comparing remote history with the local files. Git HTTPS push authentication failed; GitHub Git Data API publishing preserved every original commit and verified identical tree hashes before a non-forced main update.
- Supabase `wbvgorahtkiiwplsbnga` reports ACTIVE_HEALTHY (PostgreSQL 17). All original 14 migrations are recorded. All 18 QueueZero tables have enabled and forced RLS. Anonymous roles lack raw QueueZero table SELECT grants.
- Realtime has the receive-only `queuezero_receive` policy on `realtime.messages`, gated by authorized topic access. Real subscribed client delivery was not revalidated here.
- Production signup HTML references `https://clerk.conchportal.com` production scripts. This proves routing only; it does not prove email delivery, session issuance or database JWT configuration.
- Vercel grouped runtime errors were inspected through the connected app. The project-detail endpoint returned a connector argument-validation error, and no environment-variable listing tool was available. Secret names/values and provider dashboard settings therefore remain unverified.
- No live customer records were inspected or mutated. Earlier repository claims of hosted QA journeys are historical evidence, not fresh acceptance of this release.

## Environment and provider checklist

Set these in the deployment's **production** environment, using matching provider instances. Never paste secret values into review documents.

| Configuration | Required verification |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Exactly `https://queuezero.conchportal.com`; no path/query/credentials. Print QR only from this configured origin. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Matching production instance; allowed origin and sign-in/up redirects point to QueueZero. Preserve other applications using the shared instance. |
| `CLERK_DATABASE_JWT_TEMPLATE` | If needed, issuer-signed template supplies the authenticated role and correct subject; Supabase trusts the matching Clerk issuer. Verify using two genuine tenant sessions. |
| `CLERK_DISABLE_AUTO_PROXY` | Confirm the configured direct Clerk custom-domain script path works. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Match the intended project; use only publishable/anon keys in public variables. Confirm API and private Broadcast access. |
| `SUPABASE_SERVICE_ROLE_KEY`, `QUEUE_JOIN_SECRET` | Server-only secret/service key and independent random HMAC secret (32+ characters). No exposure in client bundles/logs. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Matching Web Push pair and valid contact; test permission denial, unsupported browser, delivery, expired endpoints and retries. |
| `CRON_SECRET` | Random server secret; unauthenticated delivery calls fail. Daily cron is recovery only; action-triggered delivery is immediate. Monitor pending/failed jobs. |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_STARTER_PLAN_CODE`, `PAYSTACK_BUSINESS_PLAN_CODE`, `PAYSTACK_CURRENCY` | Matching provider mode; monthly plans with expected prices/currency. Webhook URL is `/api/webhooks/paystack`; raw-body signature uses the **Paystack secret key**. The example's `PAYSTACK_WEBHOOK_SECRET` and public key are unused by this server-hosted checkout. |
| `CLERK_WEBHOOK_SECRET` | Reserved/unused; do not infer a Clerk webhook integration exists. |

## Operational release gates

- [ ] Review migration SQL, apply in order and compare migration history. Back up before release; roll back the application if needed without deleting audit/idempotency history.
- [ ] Confirm no historical seed files or automated test fixtures were applied to production. Product seeds and the simulated console are removed; `/demo` redirects to `/dashboard`. All business screens subscribe to real database invalidations with authoritative refetch and connection recovery.
- [ ] Decode a downloaded/printed QR and confirm it contains the canonical public `/q/{slug}` URL, never a dashboard ID or private ticket token. Check existing printed codes after deployment.
- [ ] Test phone portrait/landscape and tablet receptionist console; keyboard and focus remain usable, navigation is visible, and safe areas do not cover controls. Test installed and ordinary-browser modes.
- [ ] Confirm user-visible failure/retry states for offline joins, provider failures, lost realtime connections and duplicate staff actions. Never treat stale offline state as a current turn.
- [ ] Redact `/ticket/{token}` URLs, session identifiers, phones and provider payloads from log exports; define retention and access controls.
- [ ] Review existing staff memberships after the verified-email fix. Use named accounts and queue assignments, not shared owner credentials.
- [ ] Keep a manual queue fallback and named pilot owner. Pause new joins during an operational incident; retain audit history.

Full Week-1 success requires every user outcome in the pilot guide, including real signup, notification receipt, safe concurrent staff actions, paid upgrade where offered, and a verified deployed release. Passing local tests alone does not meet that definition.
