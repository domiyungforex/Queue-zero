# Capacity verification and authenticated QA

One million simultaneous users is **not verified**. The changes in this repository
reduce known request amplification; they do not establish hosted capacity. The
existing isolated database concurrency tests establish specific correctness
properties, not a million-user throughput result.

## Small public HTTP baseline

`scripts/capacity-baseline.mjs` uses Node's built-in HTTP client and needs no added
dependency. It exercises five existing public GET routes: `/`, `/how-it-works`,
`/solutions/education`, `/manifest.webmanifest`, and `/llms.txt`. It sends no
credentials, cookies or mutations and does not follow redirects. Billing,
attendance submissions, queue joins, sign-in and private data are excluded.

The default command only checks configuration and sends **zero requests**:

```sh
node scripts/capacity-baseline.mjs --check
```

With the application already running locally, use a small baseline:

```sh
CAPACITY_BASE_URL=http://127.0.0.1:3000 \
CAPACITY_DURATION_SECONDS=10 \
CAPACITY_RPS=2 \
node scripts/capacity-baseline.mjs --run > /tmp/turnmark-public-baseline.json
```

Use `npm run preview` for the existing disposable local database setup. A dev
server compiles routes on demand, so label cold runs separately. Its timings must
not be presented as production performance. Use a production build in an isolated
environment for useful comparative results, and do not run `next build` while the
dev server is writing the same `.next` directory.

| Variable | Default | Bounds |
| --- | --- | --- |
| `CAPACITY_BASE_URL` | `http://127.0.0.1:3000` | Origin only; no credentials, path, query or fragment |
| `CAPACITY_CONCURRENCY` | 2 | 1–100 local, 1–25 approved staging |
| `CAPACITY_RPS` | 2 | 1–20 local, 1–5 approved staging |
| `CAPACITY_DURATION_SECONDS` | 10 | 1–60 |
| `CAPACITY_TIMEOUT_MS` | 5,000 | 100–10,000 |
| `CAPACITY_MAX_P95_MS` | 2,500 | 100–10,000; checked after 20 responses |

Only `localhost`, `127.0.0.1`, and `::1` count as local. Do not use a local proxy or
tunnel to production. Hosted targets require HTTPS and both explicit guard values:

```sh
CAPACITY_BASE_URL=https://qa.example.test \
CAPACITY_APPROVED_STAGING_ORIGIN=https://qa.example.test \
CAPACITY_STAGING_ACK=isolated-staging-no-production \
node scripts/capacity-baseline.mjs --check
```

Replace that illustrative domain with an isolated, authorized staging origin and
inspect the `--check` output before choosing `--run`. The product's
`conchportal.com` domain family and `queue-zero*.vercel.app` alias family are
blocked even with those values. A custom staging domain is required for this
guarded harness. The guard cannot establish that an operator-selected custom
domain uses a separate database or test credentials; verify that separately.
No hosted baseline was run as part of creating this harness.

The runner automatically aborts at five consecutive failures, an error rate over
10% after 20 responses, or the configured p95 threshold after 20 responses.
Responses over 2 MiB fail; request timeouts and Ctrl-C cancel outstanding work.
All non-200 responses, redirects, and unexpected content types fail. Results
contain counts, status distribution, transferred bytes, achieved requests/second,
and p50/p95/p99 total-response latency. They exclude response bodies and cookies.
Any failure or abort gives a nonzero exit code. These conservative thresholds are
baseline safeguards, not agreed product SLOs.

This is a **closed-loop, rate-capped HTTP baseline**, not a million-user simulator.
Slow responses reduce achieved load instead of building an unlimited request
backlog. Compare achieved rate with requested rate; latency alone can hide
saturation. It does not execute browser JavaScript, download page assets, measure
rendering, open Realtime connections, authenticate staff, or exercise database
writes. `capacityVerified` is always `false` in its output.

Safety regression tests:

```sh
npx vitest run tests/unit/capacity-baseline.test.ts
```

They run local HTTP fixtures solely to check the runner, including production
rejection, rate bounds, anonymous GET-only requests, cookie omission and redirect
refusal. They do not create application records or count as site capacity tests.

## Required hosted acceptance work

1. **Define the workload.** One million signed-in idle sessions, public page
   visitors, live ticket sockets and simultaneous attendance submissions have
   different costs. Specify the mix, active fraction, peak duration, workspaces,
   class/queue concentration, requests/second and accepted latency/error SLOs.
2. **Prepare an isolated environment.** Use production-equivalent schema,
   indexes, RLS and runtime settings; separate Clerk/Supabase/Paystack test
   configuration; and test data confined to that environment. Record software
   SHA, region, database resources, connection limits, Realtime quotas, Vercel
   limits, and a cost budget before provisioning or issuing sustained traffic.
3. **Observe every layer.** Collect request p95/p99, achieved throughput, error
   and retry rates, DB CPU/IO, connection/pool waits, lock waits, payload/egress,
   Realtime connection count and event delay, token renewal traffic and function
   concurrency. Synchronize timestamps between generators and providers.
4. **Ramp progressively.** Begin at 100 users, then 1,000, 10,000 and measured
   increments. Use a suitable distributed, arrival-rate load generator when
   targets exceed this bounded baseline. Set abort thresholds for resource
   saturation, incorrect results, rising errors, p99 and provider spend. Account
   for generator resource limits and coordinated omission in the report.
5. **Test concentrated and distributed activity.** Separate hot-class/hot-queue
   runs from many-workspace traffic. Verify attendance duplicates, optional
   student registration, close/revoke races, FIFO Call Next, tenant isolation,
   notification delivery/read state, reconnects and expired authentication.
   Existing database tests are useful preconditions, not substitutes for this.
6. **Soak and recover.** Measure sustained traffic, reconnect storms, slow
   clients, token expiry, provider outages and recovery. Reconcile persisted
   outcomes against attempted operations; never judge success from HTTP 200
   counts alone.
7. **Publish measured limits.** Preserve the exact workload, configuration,
   dashboards and correctness results. Claim one-million-user capacity only
   after the agreed target-level workload succeeds with measured headroom.

Production load generation, paid infrastructure changes, live payment operations
and test records in production are not part of this runbook's local execution.

## Authenticated mobile QA prerequisite

The current managed environment has no dedicated Clerk QA credentials or
authenticated Playwright storage state. Public-page screenshots, unit tests and
isolated database tests do not prove signed-in staff-screen behavior.

Configure a dedicated QA account through environment secrets, or provide an
authenticated Playwright `storageState` as a secret file. It must belong to an
isolated test workspace with appropriate roles; do not provide a personal account
or commit cookies/tokens. Confirm the test base URL and Clerk instance match the
state. Do not bypass Clerk or fabricate authenticated React state for screenshots.

The disposable `npm run preview` launcher intentionally overrides Clerk with
invalid local placeholders; adding QA credentials to that command will not enable
staff sign-in. Use `npm run dev` with a dedicated development Clerk instance and
an isolated Supabase project that trusts its issuer, or a configured staging
deployment. Match `NEXT_PUBLIC_APP_URL`, Clerk keys and the test origin. A real
Realtime service is required for arrival/reconnection checks; the disposable
PostgREST preview does not provide it. Supply an Education workspace with a QA
owner, a second authorized workspace for switching, and a restricted QA member
for denial checks. Existing Playwright tests do not yet configure authenticated
storage state or an account setup project.

With that access, run Home, Classes, Attendance, Students, Reports, Team, Settings,
More and Notifications at 390×844 and the requested narrow/wide breakpoints.
Verify workspace switching, route highlights, no horizontal overflow, accessible
controls, persisted attendance after reload, duplicate/closed-session errors,
notification arrival without refresh, mark-read and subscription cleanup. Record
actual screenshots and results; keep sensitive roster and payment details out of
shared artifacts.

Billing deployment remains excluded.

## Executed local checks — 24 October 2026

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 664 passed, one skipped. The skipped database journey requires a
  disposable database container; no database schema or write path changed here.
- `npm run build`: passed. Local testing used the same deliberately invalid Clerk
  placeholder identity as the preview launcher, not live account credentials.
- Public-site and PWA Playwright suites: eight passed, including mobile menu
  behavior, overflow checks and offline navigation. These are public screens.
- Small baseline against the local production build: 20 requests at a configured
  2 requests/second over a 10-second schedule, all HTTP 200, p50 8.73ms, p95
  24.30ms, p99 182.33ms. There was no database, authenticated or Realtime workload.
  These timings are a runner smoke test, not a scaling result.

An earlier attempt used a placeholder **development** Clerk key. Public HTML
requests redirected to that unavailable instance's handshake, so the HTTP runner
refused the redirects (12 of 20 requests failed) and seven browser tests failed.
Rebuilding with the repository preview's supported placeholder configuration
resolved that local setup mismatch. No redirect/authentication guard was removed
and no failing assertion was suppressed. Both attempts' logs and baseline JSON
are retained locally in `qa-output/capacity-20261024/`.

No hosted load test, authenticated staff-screen QA, infrastructure provisioning,
production deployment or billing change was performed in this follow-up.
