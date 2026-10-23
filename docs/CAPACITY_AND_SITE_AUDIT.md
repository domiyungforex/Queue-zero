# Site and capacity audit — 23 October 2026

This release fixes concrete attendance, navigation and refresh defects. It does
**not** certify support for one million simultaneous users. No production load
test, paid infrastructure upgrade, billing release or production test record was
used during validation.

## Attendance behavior

The active `school_attend_accountless` RPC previously required membership in the
class roster. A valid, open, signed QR now permits name + matric check-in without
advance registration. An existing workspace student is matched by normalized
matric and name; a conflicting name never overwrites that record. A new attendee
is recorded in the existing people, school profile, course and class roster
tables. This creates a student record, not a Clerk account or workspace membership.

Optional lecturer imports remain available. Imported students who do not attend
can still be marked absent when a class finishes. Without an expected roster, the
system cannot know about students who never submit; absence totals are therefore
limited to known enrolled students. Self-entered names and matric numbers are not
proof of identity or physical presence. Existing lecturer review flags remain.

The migration changes one existing function, preserves service-role-only execution
and RLS, and uses compatible shared class/session locks for concurrent submissions.
Closing/revoking attendance and roster imports retain their administrative locks.
Workspace/matric locking plus the existing unique index prevent duplicate student
identities. A unique-conflict subtransaction handles an import winning the race
without leaving an orphan person. Expiry is rechecked after waits. No data is
deleted, and no authentication or membership system is replaced.

## Confirmed defects fixed

- Healthy live views performed a full refresh every 15 seconds. They now use
  broadcasts and reconnect resync; only outages use jittered 15–60 second backoff.
  Hidden tabs do not issue fallback refreshes. Completed tickets unsubscribe.
- Continuous broadcasts reset the debounce indefinitely. Coalescing now delivers
  updates during a continuous stream.
- Failed token renewal could leave a stale channel. Recovery now replaces it.
- Notification bursts issued overlapping snapshot reads; reads are now coalesced
  with a subsequent reconciliation for events received in flight. Reconnect uses
  capped jittered backoff, and stale workspace reads are aborted.
- Shell/page institution and school snapshot reads are deduplicated within one
  React server request. No cross-user data cache was introduced.
- Education course detail and secondary routes lacked a selected mobile tab;
  teaching links could be offered to roles without teaching access. Route and
  capability-based navigation now covers these cases.
- More omitted supported secondary destinations and hardcoded Education for other
  workspace types. It now uses actual workspace capabilities and identity.
- The public mobile menu stayed open after selection; selection and Escape close
  it. The main homepage action is no longer hidden on narrow screens.
- Repeated Tailwind theme declarations compiled legacy green into utilities even
  though later CSS variables were orange. Utilities now use one token declaration.
- PWA manifest colors differed from the current app theme; they now agree.

## Remaining scale constraints

| Evidence | Consequence | Required next work |
| --- | --- | --- |
| `school_snapshot` aggregates all authorized classes, attendance and flags | Snapshot cost and payload grow with workspace history | Split dashboard summaries from cursor-paginated lists and date-bounded analytics; preserve complete authorized exports separately |
| Dashboard layout loads `institution_snapshot` for navigation permissions | Navigation can load operational data it does not need | Add a small authorized capability projection; retain permission rechecks on mutations |
| `useLive` renews authenticated tokens every 45 seconds per hook | Shared client does not deduplicate each hook's renewal timer | Share one lifecycle per client; renew according to actual token expiry and resync after visibility changes |
| School mutation broadcasts invalidate school, business and class topics | Large subscriber groups can refetch together | Narrow topics, aggregate high-rate updates, measure subscriber fanout and server render work |
| Notifications use Postgres Changes with workspace filters and RLS | Authorization and fanout capacity depend on provider configuration | Measure subscriber quotas and per-event authorization cost before choosing private broadcast/outbox changes |
| Queue join/Call Next deliberately serialize one queue | A single hot queue differs from many distributed queues | Measure lock waits and per-queue throughput; retain transactional FIFO correctness |
| Attendance abuse limits include 300 attempts/class/network/10 minutes | Large shared campus NATs may reach the threshold | Measure legitimate classroom peaks and introduce an explicit configurable policy; do not silently disable abuse checks |
| Rate-limit and audit tables grow over time | Increasing index/storage/maintenance cost | Define retention and archival policy, bounded index-backed queries, and vacuum/partition strategy from actual volume |

At one million mounted live views, the removed 15-second polling loop would imply
approximately **66,667 refreshes/second** before events. At one million visible
authenticated views with one hook, 45-second token renewal still implies roughly
**22,222 renewal calls/second**. These are arithmetic demand estimates, not measured
throughput or a claim that every user follows that workload. Anonymous attendance
does not require a Clerk login or a long-lived subscription.

## Safe capacity acceptance plan

1. Define the workload: concurrent connections, attendance submissions/second,
   queue joins/second, class sizes, workspaces, read/write ratio and peak duration.
2. Use an isolated staging project with production-equivalent indexes/RLS and
   synthetic test fixtures confined to that environment. Obtain infrastructure
   quotas and a bounded load-test cost budget before provisioning/running it.
3. Start at 100 concurrent clients, then 1,000, 10,000 and measured increments.
   Stop on error/latency/lock-wait saturation rather than jumping to one million.
4. Measure p50/p95/p99 latency, error and retry rates, connection pool waits,
   database CPU/IO/locks, rows scanned, payload/egress, Realtime lag/fanout, Clerk
   renewal rate and Vercel concurrency. Test one hot class/queue separately.
5. Verify duplicate prevention, tenant isolation, close/revoke races and persisted
   records at every level. Include reconnect storms, slow clients, provider
   outages and a sustained soak. Success requires correctness as well as speed.
6. Agree production quotas, alarms, rollback and rollout stages with measured
   headroom. Only publish a capacity claim after a reproducible target-level run.

## QA boundaries

Actual public pages were captured from the running local application at 390×844
and 1440×900, with additional width checks. Screenshots are in
`qa-output/site-audit-20261022/`; the JSON report records HTTP status, overflow,
headings, broken images and browser errors. Public route, PWA, anonymous attendance
access and disposable-database customer flows have browser tests.

Signed-in Home, Classes, Students, Reports, Team, Settings and notification arrival
still require a dedicated Clerk QA account or authenticated test storage state.
No personal credentials were requested and no fake authenticated UI was used as
evidence. Unit tests exercise role navigation and notification lifecycle; isolated
database tests exercise authorization and real transactions. These do not replace
authenticated end-to-end QA or a hosted Realtime capacity test.

Billing foundation changes remain excluded from this release.

## Executed validation

- `npm run lint`: passed, no warnings.
- `npm run typecheck`: passed.
- `npm test`: 626 passed, one skipped (87 files passed, one skipped).
- `npm run build`: passed with a non-production placeholder Clerk public key.
- `npm run db:test:isolated`: 753 pgTAP assertions passed, followed by all
  transaction/concurrency suites, including optional attendance and import/close races.
- Local Playwright suite: 19 passed, including five independent customer browsers
  and the real database outage-fallback path (the preview has no Realtime server).
- Additional attendance browser test: passed. A signed QR accepted a student with
  no prior record, persisted one attendance record, replayed safely after reload,
  and disabled submission after closure. Its screenshot is explicitly labeled as
  a local test; it is not evidence of production data or authenticated staff QA.
- Screenshots: nine public routes at 390×844 and 1440×900, plus width checks at
  360, 375, 393, 414, 430, 768 and 1280. No horizontal overflow or page errors in
  the recorded public-page audit. Sign-in shows the local configuration fallback;
  it is not a successful Clerk login test.

For the optional attendance browser test, start `npm run preview` with a local
`ATTENDANCE_QR_SECRET` of at least 32 characters, then run Playwright with that
same value in `E2E_ATTENDANCE_QR_SECRET` and the disposable `PREVIEW_DB_CONTAINER`.
The test rejects hosted targets and container names outside the local preview
pattern. Never use production keys or a hosted database for this test.
