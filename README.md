# QueueZero

Scan. Join. Leave the line. Come back when you’re almost next.

QueueZero runs physical queues through a public customer web app and an authenticated business workspace. The application uses Next.js App Router, strict TypeScript, Clerk, Supabase PostgreSQL/Realtime, Paystack, and Web Push.

## Explore

- Website: https://queuezero.conchportal.com
- Interactive workspace demo: https://queuezero.conchportal.com/demo
- Business workspace: `/dashboard`
- Public queue: `/q/{slug}`; private customer ticket: `/ticket/{opaque-token}`
- Waiting-room display: `/display/{slug}`

The demo is explicitly fictional and runs in browser memory. Real dashboard analytics always derive from the database.

## Implemented

Business authentication and onboarding; locations and staff assignments; queue creation, editing and stable printable/downloadable QR codes; anonymous transactional joining; daily unique numbering; private ticket status, cancellation and deterministic waiting estimates; a live staff console with atomic Call Next, complete, recall, no-show and removal; pause/reopen/close; reconnect recovery; aggregate analytics; owner billing; signed, idempotent Paystack webhooks; notification outbox and Web Push; installable PWA metadata, icons and offline fallback.

The cream, forest-green and lime design spans marketing, auth, onboarding, dashboard, queue operations, analytics, locations, team, settings, billing, public tickets and displays. Public customer screens are mobile-first.

## Run locally

Node.js 22.12+ is required.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill the environment variables with matching provider credentials. Use Clerk development keys locally. Never commit `.env.local` or expose server keys through `NEXT_PUBLIC_` variables.

For a disposable local customer-flow preview, with Docker running:

```sh
npm run preview
```

Open http://localhost:3000/demo for the visual workspace demo, or http://localhost:3000/q/demo-clinic for the real local customer flow. The preview applies migrations to disposable PostgreSQL/PostgREST containers and does not bypass business authentication. Stopping it removes those containers. It never contacts the hosted database. Use `PORT=3001` for a different port or `PREVIEW_APP_URL` for the browser’s forwarded origin.

## Correctness and privacy

Postgres is authoritative. Queue operations lock the queue, validate current membership/assignment, transition tickets and append audit events in one transaction. Call Next requires explicit completion of the current customer: simultaneous staff actions cannot silently advance two people. Actor-bound request IDs make ambiguous retries safe. Daily ticket allocation is transactional; ordering uses arrival time across midnight.

All application tables have forced RLS. Authenticated database clients pass verified Clerk identity and use the public Supabase key. Public customers receive deliberate projections through opaque tokens, never raw customer tables. Controlled joining/cancellation and background delivery use a server-only service client. Public displays expose ticket numbers only.

Realtime broadcasts contain invalidation notices, not customer data. Clients refetch authoritative snapshots on events, reconnect and focus, with a 15-second polling fallback. Private topics authorize staff or opaque ticket capabilities. Notification delivery occurs after successful transactions, with durable deduplication, leases and retry limits.

Wait estimates use the configured duration until five valid completions exist, then a bounded window of the last 20 services with exponential smoothing. Estimates use coarse ranges. Week 1 supports one active serving counter per queue.

## Validation

```sh
npm run lint
npx next typegen
npm run typecheck
npm test
npm run db:test:isolated
npm run build
```

The database suite requires Docker and creates an isolated PostgreSQL 17 database. It includes pgTAP authorization/state tests and overlapping real database sessions for race conditions. Unit/integration tests use fixture identities; production auth and actual phone notifications must also be checked independently.

## Deployment and pilot

See [DEPLOYMENT.md](DEPLOYMENT.md), [database setup](supabase/README.md), [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md), [PILOT_GUIDE.md](PILOT_GUIDE.md), and [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

Paystack checkout remains disabled until actual secret and monthly plan codes are configured. SMS and WhatsApp are adapter boundaries, not active channels. Web Push depends on customer permission and browser support; the ticket remains usable without it. The laptop/five-phone/printed-QR pilot is a separate physical acceptance test.
