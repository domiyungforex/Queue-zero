# TuRnMaRk evolution review

## Architecture and compatibility

TuRnMaRk remains queue-first: anonymous QR joining, live tickets, wait estimates, staff operations and billing keep their existing domains. `sessions` and `presence_events` are shared infrastructure beneath specialized queues and classes. Queue events now append common presence events transactionally. Guest queue users do not receive permanent people profiles or need Clerk accounts.

BUSINESS, SCHOOL and HYBRID organization modes control specialized navigation and school access. Only QUEUE and CLASS have workflows. Future session types are enum extension points, not unfinished screens. School views use real database data; local test fixtures never run in production.

The exact product brand is **TuRnMaRk** in UI, authentication, metadata, install manifests, icons, offline page, printable QR cards, exports and documentation. Existing `queuezero.conchportal.com` URLs, repository identity, legacy database functions and browser cookie/idempotency keys remain compatible. Renaming the public domain requires configuring a real replacement and preserving redirects; no domain has been invented or switched.

## Additive migrations

Apply in order, after backup and staging verification:

1. `20261003193433_presence_domains.sql`: organization/session/person/attendance enums and lecturer/student roles; existing businesses default to BUSINESS.
2. `20261003193434_school_attendance.sql`: sessions/people/events, school hierarchy and enrollments, frozen class roster/lecturer names, attendance/flags/devices/nonces/retry ledger, forced RLS, protected RPCs, private realtime topics and queue authorization hardening.

Existing queue tables, public slugs, ticket tokens, payment records and queue history are retained. Existing queues are linked to sessions; historical queue events are not synthesized as new arrivals. New migrations are locally verified but **not deployed**. Roll back application code if necessary; do not drop school/audit data to roll back a release.

## New school journey

An owner enables school mode, creates a faculty/department/course, assigns an existing verified lecturer and enrolls students individually or by bounded CSV import. Assigned lecturers can create courses and classes, start attendance, display rotating QR, close check-in, enable checkout, review flags, finish the class and export its real register as A4 PDF, CSV or XLSX. The roster is frozen on opening, and finishing records missing students as absent and required missing departures as incomplete.

Students sign in through Clerk OTP using their enrolled email. The server resolves identity; matric numbers are profile data only. First valid scan records arrival; a second fresh valid scan records departure when enabled; duplicate/replayed requests cannot silently turn check-in into checkout. Class/private school broadcasts trigger authoritative refetch and reconnect recovery.

## Security

See `SECURITY_REVIEW.md` for severity, fixes and remaining risks. Important boundaries include signed expiring QR, authenticated enrollment resolution, server timestamps after lock acquisition, concurrent scan serialization, tenant RLS, explicit queue role allowlists, course-scoped exports, spreadsheet injection protection and privacy-conscious shared-device review signals.

## Validation

Final command results are recorded below after verification. Tests use isolated local databases and disposable test identities. Stubbed Clerk boundaries test application behavior; they do not prove real provider OTP delivery. The browser queue journey drives five independent customer contexts and actual PostgreSQL operations; staff calls use the SQL boundary rather than authenticated staff browser sessions.

## Known limitations and release blockers

- **Critical existing production blocker:** unrelated shared Supabase tables were previously found accessible to anonymous roles without RLS. This change does not alter another application's tables. Resolve and independently verify that exposure before a real-business pilot.
- New migrations and TuRnMaRk application changes are not deployed. Hosted Clerk email OTP, Supabase JWT/Broadcast behavior, real Web Push and Paystack lifecycle require staging/provider acceptance. Local tests do not establish production readiness.
- The physical one-laptop/five-phone/printed-QR acceptance test remains manual. Test two receptionist windows acting simultaneously, genuine realtime reconnect, installed/mobile behavior and notifications on actual devices.
- Attendance QR plus identity/device signals do not prove physical presence. Optional WebAuthn, location and institutional-network verification are extension points only; none are falsely presented as enabled.
- School confirmations are in-app. Existing queue Web Push remains available when configured; school SMS/WhatsApp/email/push delivery is not implemented.
- Attendance screens and official exports explicitly use UTC. Organization-local display and school record retention/correction policies need agreement before rollout.
- School snapshot reads currently return authorized history without pagination; bound/paginate before large institutions. Device/replay history requires a retention policy.
- Full authenticated school browser E2E remains unverified without suitable Clerk test accounts. Real-database application integration covers course/enrollment/QR/check-in/checkout/finalized exports with the identity provider mocked only at the test boundary.

## Files and next bounded task

Primary changes: `app/dashboard/{attendance,courses,students,exports}`, `app/attend`, `app/api/school`, `components/school`, `lib/{qr,school,school-student}`, organization/auth/navigation files, two migrations, generated database types and regression suites. Brand changes cover shared shells, manifest/layout/icons, QR printing, exports and docs. Export dependencies are server-side only; the PDF font is licensed and bundled.

Next bounded task: resolve the shared-database exposure with its owning application, then run a staging release acceptance using genuine Clerk identities and hosted Realtime before applying migrations or promoting to production. Do not begin AI or unrelated product scope.

## Final local verification — 2026-10-04

| Command / check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 427 passed; one opt-in database test skipped in this default run |
| `PREVIEW_DB_CONTAINER=<disposable-preview-db> npx vitest run tests/integration/school-database-journey.test.ts` | 1 passed against real local PostgreSQL/PostgREST; also rerun after attendance namespace rename |
| `npm run db:test:isolated` | 601 assertions in 13 SQL suites passed, plus onboarding, queue management, revocation, cancellation, joins, Call Next and attendance concurrency programs |
| `PREVIEW_DB_CONTAINER=<disposable-preview-db> PLAYWRIGHT_CHROMIUM_EXECUTABLE=<installed-chromium> npm run test:e2e` | All 15 passed; five customer contexts and 320/390/768/1440px public coverage |
| Branded PWA browser checks | All 4 passed after adding exact TuRnMaRk title/manifest assertions; mobile screenshot visually reviewed |
| Attendance signing/device/security route checks after namespace rename | All 20 passed |
| `npm run build` | Passed with local validation-only Clerk keys; not live authentication evidence |
| Production export output trace | Licensed PDF font included |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `git diff --check` | Passed |

Existing Paystack verification/webhook behavior, queue wait estimates, tenant authorization, anonymous joins, cancellation and concurrent staff mutations are covered by the passing suites. Real provider payment capture, physical notification delivery and live Clerk OTP remain explicitly unverified.
