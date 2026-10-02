# QueueZero database

Migrations are authoritative. They implement tenant security, onboarding, queue management, transactional joins and operations, deterministic waiting estimates, public privacy projections, Realtime invalidation, notification outbox, analytics and billing persistence.

## Identity

Enable Clerk third-party authentication in Supabase using the exact instance issuer. Verified Clerk session tokens must carry `role: "authenticated"`; RLS uses their text `sub` claim, not `auth.uid()` UUID casting. `createUserSupabaseClient()` forwards the session token with the public project key and never falls back to service credentials.

The configured hosted issuer is `https://clerk.conchportal.com`. Local Supabase third-party auth stays disabled until a real development issuer is supplied. SQL tests inject fixture JWT claims only inside disposable databases.

Keep `private` out of exposed API schemas. Security-definer helpers use fixed search paths and explicit grants. Never weaken RLS or add a service-role fallback to fix denied tenant queries.

## Access and mutation model

Every QueueZero table has forced RLS. Owners/admins can read their tenant’s operational records; staff access customer records only for assigned queues. Billing is owner-only. Public callers have no raw customer table access and can only use narrow queue/ticket/display projections.

Direct browser table writes are disabled. Authenticated RPCs independently validate membership and assignments. Onboarding derives the owner from the JWT subject and serializes duplicate submissions. Queue creation uses a stable request UUID; edits use revisions to reject stale overwrites. Administrative changes append audit events.

Controlled anonymous join/cancellation RPCs are service-only and called by validated, rate-limited server actions. Ticket allocation locks the queue/counter transactionally. Public tokens are random UUID capabilities. Tickets order by `(joined_at, id)` across service dates, while display numbering resets by local service day.

`call_next_ticket`, `operate_ticket` and `operate_queue` lock the queue and recheck access under lock. Exactly one serving ticket is permitted. Completion is explicit; simultaneous Call Next operations cannot advance two customers. Actor-bound request UUIDs preserve the original outcome across retries. Events are append-only, and no-show records are retained.

Private Broadcast topics send payload-free invalidations. `queuezero_receive_topic` authorizes staff queue/business topics and exact public slug/ticket capabilities without granting raw table access. Clients refetch state after reconnect. Notification triggers persist unique outbox events; delivery leases use `SKIP LOCKED`, bounded retries and expired-endpoint removal. Failure to send does not roll back a queue transition.

Billing checkout intents store expected amount, currency, plan and tenant. Server verification and signed webhook handlers call service-only idempotent synchronization RPCs. Queue plan limits serialize per business; downgrades retain existing queues and prevent creation above entitlement.

## Local verification

```sh
npm run db:test:isolated
```

Requires Docker. The runner builds a disposable PostgreSQL 17/pgTAP container, applies every migration, runs SQL tests and overlapping-session concurrency checks, then removes it. It never resets or modifies a hosted project. `tests/database/bootstrap.sql` emulates Supabase roles only for this isolated environment; never apply it to Supabase itself.

For a full local Supabase installation:

```sh
npm run db:start
npm run db:migrate
npm run db:test
npm run db:types
```

`db:types` introspects public schema and updates the shared strict TypeScript database definitions. For hosted deployment, link the intended project, review `supabase db push --dry-run`, then apply pending migrations. Never modify an already-applied migration: create a forward migration instead.

## Demo and production separation

`seed.sql` is explicitly local-only demo data and automatic seeding is disabled. The preview launcher creates disposable data. `/demo` uses fictional browser-memory data and does not read/write hosted customer records. None of these fixtures should be applied to production.

Unit and isolated SQL tests cannot prove real identity-provider integration or physical notification delivery. Verify a real Clerk-issued token against hosted Supabase, two separate tenant identities, private realtime reconnect and actual phone alerts before a public pilot. See the root production checklist and pilot guide.
