# QueueZero database foundation

The migrations are authoritative. Storage, tenant security, atomic business onboarding, queue management, and a restricted public queue projection are implemented. Customer/ticket mutations, notifications, billing handlers, and Realtime are later bounded tasks.

## Clerk identity and Supabase setup

1. Create a Supabase project and use Clerk's [native Supabase integration](https://supabase.com/docs/guides/auth/third-party/clerk). Enable it in [Clerk](https://dashboard.clerk.com/setup/supabase), then register the exact Clerk issuer in Supabase Authentication → Third-Party Auth.
2. Confirm Clerk session tokens include `role: "authenticated"`. Supabase verifies the token signature and issuer before PostgREST sets this database role. RLS reads the text `sub` claim; Clerk IDs cannot be cast through `auth.uid()`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. The latter supports a new publishable key or a legacy anon JWT. Configuration rejects service-role/secret keys in that field.
4. For a full local Supabase stack, set `[auth.third_party.clerk]` to `enabled = true` with your exact Clerk domain in `config.toml`. It starts disabled because no real issuer has been configured. The SQL tests do not need Clerk.
5. Apply all checked-in migrations through the Supabase CLI. Local commands below never target a hosted project. For a hosted project, link the intended project, inspect `npx supabase db push --dry-run`, then apply with `npx supabase db push` through your normal release process.

`createUserSupabaseClient()` is server-only and authenticates through Clerk before creating a request-scoped Supabase client. It passes the current session token via `accessToken`, uses the public project key, and does not use the service role. No deprecated JWT template or shared JWT signing secret is needed. Missing sessions fail closed.

Keep only `public` in the exposed API schemas. `private` contains narrowly scoped policy/trigger helpers, with a fixed empty search path and explicit function permissions. Do not expose it through PostgREST.

## Access model

| Data | Owner | Admin | Staff | Anonymous customer |
| --- | --- | --- | --- | --- |
| Business and locations | Own memberships | Own memberships | Own memberships | No direct access |
| Business members | Own tenant | Own tenant | Own membership only | No direct access |
| Queues, tickets, ticket events | Own tenant | Own tenant | Assigned queues only | No direct access |
| Queue assignments | Own tenant | Own tenant | Own assignments only | No direct access |
| Subscription/billing records | Own tenant | No access | No access | No direct access |
| Notification logs | Own tenant | Own tenant | No access | No direct access |
| Business audit events | Own tenant | Own tenant | No access | No direct access |
| User push keys | Own user only | Own user only | Own user only | No direct access |
| Customer push keys, daily counters, raw webhooks | No direct access | No direct access | No direct access | No direct access |

Every application table has forced RLS. Authenticated clients have only the listed SELECT grants; there are no direct table mutation policies/grants. `onboard_business`, `create_queue`, `update_queue`, and `set_queue_status` are the authenticated mutation RPCs currently granted. `get_public_queue` is a read-only projection granted to `anon` and `authenticated`; it adds no table access. Queue management RPCs require owner/admin membership in the target business, independently of application checks. Do not weaken RLS or add a service-role fallback when a query is denied. Never expose a ticket row directly from a public endpoint: future endpoints must resolve an opaque token and return a deliberate public projection without other customers' identities or phone numbers.

The service role has explicit table DML grants for trusted background/server operations, but cannot truncate tables or mutate existing ticket events. It bypasses RLS, so future uses must derive authorization and queue ownership server-side. No service-role application client is provided in this step.

## Database invariants

- All primary keys are UUIDs. Queue/ticket relations use composite foreign keys where tenant/queue consistency must be enforced.
- `queue_staff_assignments` is the additional relation needed for assigned-queue permissions. Neither a foreign business member nor a foreign queue can be assigned into another tenant.
- A business must have exactly one matching owner membership. The deferred owner foreign key and consistency triggers allow onboarding to create business, owner, and location atomically. Ownership transfers must update both representations in one transaction.
- `tickets.service_date` and the daily counters' unique keys scope numbering to each queue's local service day. The future join RPC must derive the service date from the location timezone. It must lock/increment the counter transactionally. Uniqueness constraints alone do not implement allocation.
- Ticket ordering indexes use `joined_at, id`; comparing sequence numbers alone across a midnight reset is incorrect. The future queue engine must account for service dates or chronological order.
- Only one serving ticket is allowed per queue. Lifecycle timestamps must match status, including `no_show_at`. Atomic Call Next and allowed state transitions are not implemented by this migration.
- Ticket events are append-only, with RESTRICT foreign keys protecting history. Administrative deletion/data-retention operations require a separately designed, audited purge path; there are no destructive cascades.
- `subscriptions` is the current subscription per business; signed webhook events will provide payment history. Provider event IDs are unique per provider. If Paystack supplies no unique event ID, the billing handler must derive a stable deduplication key.
- Notifications have a unique `(channel, deduplication_key)` for later retry handling. Provider dispatch, retries, endpoint validation, and automatic state-change event creation are not implemented yet.
- Business/location timezones must exist in Postgres. Phone-required queues must enable phone collection. The future join RPC must enforce the queue's phone setting on submitted tickets.

## Local workflow

### Onboarding transaction

`public.onboard_business` takes six descriptive fields, never a user ID or business ID. It uses a fixed empty search path, validates direct RPC inputs, reads the verified JWT subject, acquires a transaction-scoped advisory lock for that user, and checks existing memberships after locking. Existing members receive their first workspace ID without any writes. Otherwise, business, owner membership, first location, and a `business_created` audit event commit together. The business slug has an independent random suffix and does not expose the internal row ID.

The lock protects concurrent onboarding calls across app instances. Future membership-creation/invitation operations should coordinate with this same user lock if they must exclude onboarding. Do not change this function to accept ownership from client payloads. `business_events` is append-only, manager-readable, and has no client write grants. The service role has only SELECT/INSERT on that audit table.

Industry/country options are validated in both the application and RPC. If the allowed lists change, update application validation and add a migration; do not edit an already-deployed migration.

### Queue management transactions

`create_queue` validates manager membership, settings, and an active tenant-owned location. It serializes by the form's random queue ID, rechecks existence after locking, and returns the same ID for an authorized retry without another write. Slugs use a separate random UUID suffix; no internal queue ID is embedded in them.

`update_queue` and `set_queue_status` lock the selected business's queue row, compare `p_expected_revision`, and reject stale writes with SQLSTATE `40001`. A trigger advances the revision on every queue update. Name/location/settings edits never change the slug. A same-status request at the current revision is a no-op. Each committed change appends a business audit event inside the same transaction. No delete RPC or direct write grant is added. Staff management is deliberately denied here; assigned-staff operational RPCs are a later task.

Future joining and ticket operations must coordinate with the same queue row lock when inspecting/changing queue state. An RLS policy or a frontend check alone cannot enforce open/paused/closed state during concurrent operations.

### Public landing projection

`get_public_queue(text)` validates a canonical exact slug and returns at most one row for an active location. Its fixed return shape contains public business/queue/location labels, optional logo/description, state, a waiting count, an initial wait estimate, and a boolean indicating whether a customer is being served. It returns no identifiers or ticket/customer data. Queue lookup uses the unique slug index; waiting count and serving presence use the existing partial ticket indexes. All aggregates come from one statement snapshot, and waiting tickets from previous service dates remain counted.

The SECURITY DEFINER boundary uses an empty search path and explicit execute grants only to `anon` and `authenticated`. Raw table grants, RLS policies, and existing RPC permissions are unchanged. Public reads never use the service-role application key. Unknown/invalid slugs and inactive locations produce no rows. Paused/closed queues remain recognizable but return a null wait estimate.

The public pgTAP suite checks the precise output shape, real aggregates, cross-queue isolation, anonymous and signed-in access, invalid input, inactive locations, and continued denial of raw table access. The application independently validates the response before rendering.

### Commands

Requires Docker and the checked-in npm dependencies:

```sh
npm run db:start
npm run db:migrate
npm run db:test
npm run db:types
```

`db:migrate` applies pending local migrations. Avoid resetting an existing development database unless you intend to discard its data. `db:types` regenerates `lib/db/database.types.ts` from public schema introspection and formats it with the already-installed TypeScript printer. It writes only after generation succeeds. Additional CLI flags can be passed after `--`, such as a database URL for a disposable local database.

The pgTAP suite in `tests/tenancy.test.sql` covers tenant and role boundaries, customer privacy, missing/forged identity claims, write denial, defense against accidental grants, structural integrity, owner consistency, ticket numbering constraints, and history preservation. Fixtures and temporary test grants are rolled back.

If the full Supabase image does not fit your Docker disk budget, run:

```sh
npm run db:test:isolated
```

This builds a smaller PostgreSQL 17 + pgTAP image, starts a randomly named container without networking or published ports, applies every migration from scratch, runs the same tests through `pg_prove`, and removes that container. It does not touch an existing project database. `tests/database/bootstrap.sql` outside this directory is a **test-only** reproduction of Supabase roles, default grants, and `auth.jwt()`; never apply it to Supabase itself.

The isolated runner also opens two overlapping PostgreSQL sessions to verify onboarding idempotency. The first keeps its transaction open while the second calls onboarding; both must return the same ID, with exactly one business, owner, location, and audit event. The runner also overlaps queue creation requests and conflicting status updates, verifying creation commits once and a stale status update fails. The pgTAP suites force late location/audit failures to verify rollback leaves no partial state, and cover direct RPC validation, tenant boundaries, inactive locations, stable slugs, and revision conflicts.

## Verification boundary

The isolated suite verifies PostgreSQL behavior using injected JWT claims under actual `anon`, `authenticated`, and `service_role` roles. The application integration tests use the real Supabase SDK with mocked Clerk and HTTP transport to verify token forwarding and failure handling. Neither replaces a real Clerk-issued token being accepted by a configured Supabase project. Before hosted deployment, verify two real business accounts cannot access one another through the Data API and a customer request cannot read tables.
