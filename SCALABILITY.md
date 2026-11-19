# TuRnMaRk scalability assessment

Status: two safe changes are in the repository and are not applied to production. This is not a claim that TuRnMaRk supports 10 million users or the attendance burst targets below.

Nothing in this change was applied to production. The migrations must not be run against production without explicit authorization. Load tests must not target `turnmark.conchportal.com` or the hosted database. `EXPLAIN` was not executed: this workspace has no database.

## What the product is today

TuRnMaRk is one Next.js application on Vercel and one PostgreSQL database on Supabase. Clerk authenticates staff. Students mark attendance without accounts, through a signed class QR. Queues, bookings, attendance and billing share that database and that application.

Tenant isolation is logical, not physical. Every organization is a `businesses` row. School mutations go through security-definer functions. Staff reads use row-level security. A burst in one organization still uses the same Postgres primary, the same connection pool and the same realtime service as every other organization.

That design is the right one at the current size. Splitting into microservices now would add failure points without removing the shared database bottleneck.

## Capacity targets, and what was actually measured

| Target | Required rate | Measured here |
| --- | --- | --- |
| 1,000,000 attendance submissions in 60 seconds | about 16,700 requests/second | not tested against a database |
| 1,000,000 attendance submissions in 10 seconds | about 100,000 requests/second | not tested against a database |
| 10,000,000 registered people | storage and lookup shape | not load-tested |

Local QR signature check, 2 seconds, this machine only:

- 298,878 verifications in 2,000 ms
- about 149,000 verifications/second
- database commits: not measured

The signature check is not the bottleneck. A real attendance submission also uploads a photograph, opens a pooled database connection, runs `school_attend_accountless` (rate-limit counts, locks, roster lookup, several inserts) and publishes a realtime broadcast. Those database steps were not timed under load. Do not read 149,000/second as an attendance capacity.

## Implemented, not yet applied

| Change | State | Evidence |
| --- | --- | --- |
| Matric, identity-lookup and organization attendance indexes | Migration written, not applied | Predicates were checked against `private.normalized_matric`, `school_identify_student` and the organization check-in filters. No `EXPLAIN` yet. |
| Attendance commits notify `class:{id}` only | Migration written, not applied | `school_attend_accountless` and `school_record_identified_attendance` no longer call the organization broadcast. Class creation still does. |
| Organization dashboards poll every 30 seconds and coalesce events for 2 seconds | In the application | `realtimeCadence`. Class, queue and ticket screens stay at 180 ms / 15 seconds. |
| QR signature benchmark and production guard | Measured locally | 149,000 signature checks/second. Not attendance commits. |

The class page already subscribes to `class:{id}` and reloads that class after the database commit. A scan no longer also wakes `school:{org}` and `business:{org}`, so the workspace shell and the institution attendance list do not reload on every submission. They still reload on their poll. Attendance is still shown as recorded only after the transaction returns `ok: true`.

Not changed, because a local database was not available to prove the effect:

- `school_snapshot` still returns every attendance row the lecturer can see. The list page paginates in the browser after that payload arrives. Replacing it would also change exports, the student list and the class register.
- The attendance transaction still takes its locks, duplicate check and idempotency key. Two presence rows (`CHECKED_IN` and `ARRIVED`) remain because event replay treats both as arrival.
- Queue call-next and Paystack webhook verification were re-read and left unchanged. No failing test showed a race or a double charge.
- Photographs still upload before the attendance transaction.

## Bottlenecks, in the order they will fail

1. **One primary does the whole write.** `school_attend_accountless` is synchronous and correct: one row per student per class (`unique (class_session_id, student_id)`), idempotent `request_id`, advisory locks, and a closed-session check. That correctness costs several statements and row locks per scan. A single Postgres primary of the size used for the current product should be planned in the low hundreds of successful attendance commits per second, not tens of thousands. The 16,700/second and 100,000/second targets need a different ingest shape, not a faster page.

2. **Attendance scans no longer wake the whole organization, once the new migration is applied.** `private.school_broadcast` still publishes to `school:{org}`, `business:{org}` and `class:{class}` for class setup and other school changes. Attendance commits call `private.school_broadcast_class`, which publishes only `class:{class}`. Until that migration is applied, production still fans out to the organization. Organization screens in the app already wait 30 seconds between reloads and coalesce bursts for 2 seconds. The class screen stays immediate. `school_snapshot` is still one large document, so a class with a very large register still reloads that register.

3. **Matric lookup can miss its index.** Profiles are uniquely indexed on `(organization_id, lower(regexp_replace(btrim(matric_number), '\\s+', '', 'g')))`. The hot functions compare `private.normalized_matric(matric_number)` to a constant. Postgres does not reliably match a function call to a differently spelled expression index. The new migration adds an index on the function expression. Until it is applied, a large institution can fall back to a scan of that organization's profiles.

4. **Identity rate-limit counts are unindexed.** `attendance_identity_lookups` is appended on every matric lookup and counted for the last 10 minutes. It was created with only its primary key. The migration adds `(organization_id, device_hash, created_at desc)`.

5. **Dashboard "today" counts are unindexed by organization.** `attendance_records` is uniquely keyed by class and student, which is the right duplicate guard, but organization-wide time filters have no supporting index. The migration adds a partial index on `(organization_id, check_in_at desc)`.

6. **Attempt logs grow without retention.** `attendance_submission_limits` stores every attempt. The rate-limit indexes are present. The table is not partitioned and nothing prunes it. At a million attempts this becomes its own write and vacuum cost.

7. **Photographs are on the request path.** The scan uploads the image before the attendance transaction. Storage latency is added to the student's wait, and a storage failure can fail a scan that the database could otherwise commit.

8. **Serverless clients share one database.** The app uses the Supabase service role for public attendance and a user-scoped client for staff. There is no application-level pooler setting in the repository. Vercel functions must use Supabase's transaction pooler. Direct connections will exhaust sessions before CPU does.

9. **Realtime is shared.** There is no per-organization connection budget. A university with thousands of open dashboards competes with a clinic's queue display for the same realtime service.

10. **CI is not a scaling control.** GitHub Actions for this repository is currently blocked by an account billing lock. That does not limit production traffic. It does mean automated verification is not running.

What is already in good shape:

- Queue join and call-next are atomic database functions with idempotency keys. One serving ticket per queue is a partial unique index. Two staff members cannot both commit a different "next" ticket for the same queue.
- Attendance duplicates are rejected inside the same transaction that inserts the row. The interface must keep treating only `ok: true` from that transaction as recorded.
- Paystack webhooks verify the signature, cap body size, and read the provider's current subscription before writing state.
- Public attendance routes are outside Clerk. Staff dashboards stay protected.
- Broadcast topics are organization or class scoped. The database does not publish one global channel to every tenant. The remaining problem is fan-out inside a large tenant and the shared realtime cluster.

## What not to build yet

- No microservices. The write path is one function. Splitting it before measuring the database does not add capacity.
- No table partitioning yet. Partition `attendance_records`, `presence_events` and `attendance_submission_limits` by month when a table is large enough that vacuum and indexes hurt (plan for this well before 100 million attendance rows, not at a few hundred).
- No read replica in application code. Add a replica when dashboard reads, not attendance commits, are the saturated resource. Attendance writes must stay on the primary.
- No claim that face photographs or GPS checks can be skipped to gain throughput.

## Target architecture, when the measurements require it

```text
student phone
  -> CDN / Next.js (stateless): verify QR signature, rate-limit, validate photo
  -> primary Postgres: one transaction commits the attendance row
  -> class-scoped realtime hint
lecturer dashboard
  -> read replica or cached class page for lists
  -> primary only for the actions that change state
```

For a measured commit rate above what one primary can sustain (the 16,700/second scenario):

- The edge returns **accepted for processing**, not **attendance recorded**.
- A durable queue holds the validated submission.
- Workers insert in batches on the primary, still under the unique `(class_session_id, student_id)` constraint.
- The phone polls or subscribes until the transaction commits.
- Confirmed attendance is shown only after that commit.

That queue is justified only after a staging test shows the primary saturating. It is not justified by the current data volume.

## Service levels to hold while growing

These are targets. Database latency, commit rate, pool wait and dashboard payload size have not been measured.

- Recorded attendance: the response says recorded only after the database transaction commits. p95 under 800 ms while the primary is below 200 successful commits/second.
- Duplicate scan: same student and class returns the duplicate result and does not insert a second row.
- Call next: exactly one ticket leaves `waiting` for a given request id.
- A closed or expired QR never inserts.
- One organization's scan does not take a lock on another organization's rows. Advisory locks are already keyed by organization, class and student. Keep them that way.
- Dashboard list for one class of 2,000 students: p95 under 1.5 seconds, without loading every class in the institution.

## Index migrations

`supabase/migrations/20261119160000_scale_hot_path_indexes.sql` adds:

- `school_profiles_org_matric_fn` on `(organization_id, private.normalized_matric(matric_number))`
- `attendance_identity_lookups_device_window` on `(organization_id, device_hash, created_at desc)`
- `attendance_records_org_check_in` on `(organization_id, check_in_at desc)` where a check-in exists

The existing unique matric index uses the expression inline. The lookup functions call `private.normalized_matric`, so the new index matches the call. A second index on `(class_session_id, check_in_at)` was not added: the unique `(class_session_id, student_id)` key already starts with the class. `CREATE INDEX CONCURRENTLY` is not used because this migration runs inside a transaction, which PostgreSQL requires, and these tables are still small.

`supabase/migrations/20261119170000_class_scoped_attendance_broadcast.sql` replaces the two attendance commit functions and adds `private.school_broadcast_class`. Duplicate protection, the idempotency key and the one-row-per-student constraint are unchanged. Class creation still notifies the organization.

These migrations do not update attendance, students or payments. Apply them on a staging copy first. Then run `scripts/load/hot-path-explain.sql` and confirm the three plans use the new indexes. That `EXPLAIN` has not been run.

## Load tests

`scripts/load/attendance-token-benchmark.mjs` measures local signature checks. `LOAD_TARGET` set to production or `*.supabase.co` throws before any work. The script does not send HTTP traffic.

`lib/scale/load-target.ts` is the same refusal rule for a future staging runner. Tests cover production, the hosted database, localhost and a non-production HTTPS host.

`scripts/load/hot-path-explain.sql` is the matric, rate-limit and organization check-in plan. It has not been executed.

Not yet run, and not to be run against production:

- 1,000, 10,000, 50,000 and 100,000 concurrent clients
- 1,000,000 attendance submissions in 60 seconds
- 1,000,000 attendance submissions in 10 seconds
- queue join, call next, booking create, dashboard snapshot and realtime fan-out

Run those on a staging project with synthetic organizations. Record successful commits, duplicate rows, p50/p95/p99, database CPU, pool wait and whether a second synthetic organization slows down.

## Capacity and cost, as planning ranges

These are planning ranges, not quotes and not measurements.

| Stage | Shape | Rough monthly cost |
| --- | --- | --- |
| Now: thousands of people, hundreds of scans a day | Current Vercel project and the current Supabase project | current bill |
| About 1 million registered profiles, hundreds of scans per second peak | Larger primary, transaction pooler, the indexes in this migration, class-sized dashboard reads, photo upload off the critical path | low thousands of USD |
| 10 million registered profiles, mostly idle | Same primary plus storage. Registration count is not the hard problem if lookups stay indexed | still dominated by the database and file storage, not by user count |
| 16,700 attendance commits/second | Not one primary. Queued ingest, batch commits, separate realtime fan-out, and a tested staging run | a dedicated data platform; decide after the staging test, not before |

10 million registered users is mostly a storage and index problem. One million scans in a minute is a write-pipeline problem. They are different projects. The platform can grow the first a long way on one well-indexed Postgres. It cannot honestly promise the second on the current synchronous function.

## Security while scaling

Do not drop row-level security or the service-role boundary to gain speed. Public attendance may only receive a signed class token and return one student's name and department. It must not list a roster. Rate limits on matric lookup stay. Staff export and QR issue stay behind Clerk. Payment state stays behind the signed Paystack webhook.

## Roadmap

1. Apply the index migration on staging, then production, only when authorized. Compare `EXPLAIN` for matric lookup and the identity rate-limit count before and after.
2. Apply the class-scoped broadcast migration. Confirm a scan updates the open class page and does not refresh the workspace shell.
3. Page attendance inside `school_snapshot` only after a staging database shows the payload size. Keep one class's rows available for its register and its export.
4. Move photograph upload so a storage delay does not hold the attendance transaction, without confirming attendance early.
5. Prune `attendance_submission_limits` and `attendance_identity_lookups` older than the rate-limit window.
6. Confirm Vercel uses the Supabase transaction pooler. Set a pool size from measured function concurrency, not from a guess.
7. Run the staging scenarios above. Publish the measured commit rate. Only then decide whether a queue is required for the 60-second million-scan target.

## How close this is to 10 million users

Registered records: the data model can hold them after the matric and attendance indexes are in place and dashboard reads are bounded. That has not been demonstrated with a load test.

Concurrent attendance at university scale: the current synchronous path will not reach 16,700 or 100,000 successful commits per second. The signature check is fast enough. The database transaction and the organization-wide realtime refresh are not.

TuRnMaRk is a sound single-database multi-tenant system for its present size. It is not yet evidence-backed internet-scale infrastructure.
