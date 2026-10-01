# QueueZero
Universal virtual queues for physical service businesses.

## Current scope
Next.js App Router, strict TypeScript, Tailwind, Clerk business authentication, a Supabase schema with tenant isolation, atomic business onboarding, a responsive business dashboard, queue creation/management, printable QR codes, public queue landing pages, and atomic anonymous joining. Full ticket tracking, staff ticket operations, billing, and PWA are subsequent bounded tasks.

## Local development
Requires Node.js 22.12+ (including the test tooling) and npm.

```sh
npm ci
cp .env.example .env.local
```

Create a Clerk application, enable your preferred sign-in methods, and place its matching publishable and secret keys in `.env.local`. Set `NEXT_PUBLIC_APP_URL` to the exact browser origin, including the local port. Then run `npm run dev`.

Both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are required. Use Clerk development keys locally and production keys on your configured production domain. The publishable key is embedded at build time; rebuild after changing it. Never prefix private credentials with `NEXT_PUBLIC_` or commit `.env.local`.

Remaining integration variables are placeholders until their integrations are implemented.

## Database and tenancy

See [the database guide](supabase/README.md) for native Clerk/Supabase setup, migrations, permissions, and generated types. The server-only `createUserSupabaseClient()` uses the verified Clerk session and the public project key, so PostgreSQL RLS remains active. It never falls back to the service role.

All application tables have RLS. Owners/admins can read their tenant's operational data; staff customer access is limited to assigned queues. Billing is owner-only. Public customers have no direct table access. Direct client table writes are disabled; authenticated onboarding and queue-management RPCs provide controlled mutations.

Run the PostgreSQL isolation suite without configuring hosted credentials:

```sh
npm run db:test:isolated
```

This requires Docker, creates a disposable PostgreSQL 17 database, applies the migrations, runs pgTAP, and cleans up its container. It does not reset or modify an existing database.

## Authentication
- `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]` use Clerk's hosted UI components, including verification and callback subroutes.
- Successful sign-in and sign-up default to `/dashboard`. Logout returns to `/`.
- `proxy.ts` is the Next.js 16 middleware entry point. It initializes Clerk and protects `/dashboard` and descendants. Session authorized parties are restricted to `NEXT_PUBLIC_APP_URL`.
- Dashboard layout and page also call `requireUserId()`. Every future protected data entry point, Server Action, and API must call the helper and then enforce tenant authorization; a layout alone is insufficient.
- `/q/*` and `/ticket/*` remain public and have no business account controls.
- Signed-in users with no membership are redirected from `/dashboard` to `/onboarding`. Existing members are redirected from onboarding to their dashboard.

## Business onboarding

Apply all migrations, including `20261001000002_business_onboarding.sql`, and configure the Clerk/Supabase integration before trying onboarding. The form collects business name, industry, country, timezone, first location name, and address. A successful submission redirects to the dashboard showing the business name.

The server action authenticates and validates with Zod. The database RPC independently derives the owner from the verified Clerk subject and creates the business, owner membership, first location, and audit event in one transaction. A user-scoped advisory lock makes repeated or simultaneous submissions return the same business. Validation and service errors preserve form input; database failures never masquerade as missing membership.

## Dashboard

The dashboard provides responsive navigation, real queue summaries, locations, read-only business settings, and the current plan. Analytics and subscription management are explicitly upcoming; no synthetic metrics are shown.

Users with multiple memberships can switch workspaces. An HTTP-only cookie stores the preference; every request verifies it against the current Clerk user's memberships. Missing or revoked selections fall back to the first membership ordered by creation time and ID. Queries explicitly scope the selected business and retain RLS. Staff see only assigned queues; locations and analytics require owner/admin access; billing and settings require owner access, enforced server-side as well as in navigation.

Dashboard data has loading, empty, populated, and retryable error states. Business switching returns to the overview so a different role cannot strand a user on an inaccessible page.

## Queue management

Apply `20261001000003_queue_management.sql` before using these screens. Owners and admins can create a queue at `/dashboard/queues/new`, view its details, edit settings, and pause, close, resume, or reopen it. Staff can view only assigned queues and cannot use these management controls. Ticket operations come later.

Forms validate queue name, optional description, active location, service time in minutes (stored as whole seconds), notification threshold, and phone collection. The server derives the selected business from verified membership. Database functions independently authorize the caller and check location ownership; direct table writes remain disabled.

A stable random ID per creation form makes repeated submissions safe, including retries after an ambiguous network failure. This protects retries of the same form, not separately opened creation forms. Slugs have an independent random suffix and remain stable on edits. Queue revisions and row locks reject stale edits/status changes rather than overwriting a newer change. Reloading after a conflict replaces unsaved values with the latest settings. Queue changes and administrative audit events commit together. Closing a queue preserves its records and tickets.

With real Clerk/Supabase credentials configured, verify:

1. Create a queue at your onboarding location, then edit its settings.
2. Pause → resume → close → reopen; check the list and detail status agree.
3. Open the same edit page in two tabs, save in the first, then submit in the second. The second must show a conflict and offer to reload.
4. Try direct manager routes/actions as staff and from another business; neither may change the queue.
5. Retry a failed creation from the same form; it must not duplicate a committed queue.

## Queue QR codes

Queue details include a QR preview, PNG download, copyable public link, and an open-public-queue link. The print sheet at `/dashboard/queues/[queueId]/qr` uses the same authorized queue lookup; staff can access it only for assigned queues. The sheet includes QueueZero branding, business and queue names, and “Scan to join the queue.” Dashboard controls are hidden in print output.

Set `NEXT_PUBLIC_APP_URL` to the exact public origin before building: `https://queuezero.vercel.app` for the initial deployment or `https://queuezero.com` once configured. Only HTTP/HTTPS origins without credentials, paths, queries, or fragments are accepted for QR generation. Local development can use `http://localhost:3000`; a phone cannot reach your laptop through its own `localhost`, so use a reachable development origin for physical scan testing.

The QR contains only `${NEXT_PUBLIC_APP_URL}/q/${queue.slug}`. It never embeds a dashboard URL, internal queue ID, or customer information. Editing queue names/settings or pausing/closing does not change the QR. Changing the public origin or slug requires new printouts or a redirect from the old URL.

PNGs are generated server-side with black modules, an opaque white background, a four-module quiet zone, and medium error correction. Generation uses `qrcode`; test-only `jsqr` and `pngjs` independently decode exported images. No external QR service receives queue data. Clipboard denial falls back to a selectable link; print waits for image decoding. Loading, encoding/image failure, retry, and copy/download/print feedback are included.

The public destination displays real queue details and aggregate waiting counts. Customer joining is available once its migration and private server configuration are applied. Before a physical pilot, finish staff operations and live ticket tracking, then scan a printed sheet with a phone and confirm it reaches the intended queue. Use the Print button to open the browser dialog; A4 and Letter are supported, and browser-added page headers/footers can be disabled there.

## Public queue landing

Apply `20261001000004_public_queue_landing.sql` before opening `/q/[slug]`. The page shows the business name/logo, location name, service description, open/paused/closed state, actual waiting count, and an approximate wait range. A refresh button reloads the current database snapshot; realtime is a later task. Closed/paused queues do not display active wait estimates. Inactive locations and unknown/malformed slugs show an unavailable page.

The public page uses a server-only anonymous Supabase client and the `get_public_queue` projection. No Clerk account or service-role key is needed for this read. Anonymous table access remains blocked. Only the exact requested slug can be read: the RPC cannot list queues and exposes no internal IDs, ticket tokens, customer names/phones, ownership fields, private addresses, or historical analytics. Public response validation fails closed on unexpected fields. Requests bypass the Next.js fetch cache and the page is dynamically rendered.

The initial estimate is waiting count × configured average service seconds, shown in rounded ranges. It counts waiting tickets across service dates and excludes completed/cancelled/no-show tickets. The remaining time of an in-progress service is not yet modeled; an empty waiting list with someone being served says “After the current customer” instead of promising zero wait. Historical smoothing belongs to the later wait-time engine.

Open queues link to the anonymous join form; paused/closed queues disable new joins. Public business text is rendered as text. HTTPS logos load directly in the browser without a referrer or server-side image proxy, and broken/invalid logos fall back to an initial.

## Validation
```sh
npm run lint
npx next typegen
npm run typecheck
npm test
npm run build
```

The unit/integration tests use mocked Clerk sessions and inert configuration fixtures. They cover allowed/denied dashboard access, nested route protection, public routes, middleware matching, and missing/invalid server credentials. They do not exercise a real Clerk account.

With your Clerk instance configured, verify in a browser:
1. An incognito visit to `/dashboard` redirects to `/sign-in`.
2. Complete sign-up and required email verification; a new user should reach `/onboarding`.
3. Submit business/location details and confirm the dashboard shows the business name. Revisit `/onboarding` and confirm it redirects back. Try duplicate submissions from two tabs and confirm only one business and location exist.
4. Sign out, confirm the navigation changes, and confirm the dashboard is inaccessible.
5. Sign back in and confirm dashboard access, including a direct reload.
6. Open `/q/demo` and `/ticket/demo` while signed out; neither requires registration.
7. Check sign-in/sign-up and onboarding on phone, tablet, and desktop, including invalid details and a failed connection.

Real sign-in, verification, and logout require working Clerk credentials; those checks cannot be replaced by the mocked tests.

## Layout
`app` contains marketing, auth, dashboard, and public route shells. `components/ui` is reserved for shadcn/ui-compatible components. Domain libraries live in `lib`; migrations in `supabase/migrations`; tests in `tests`.

Next bounded task: full customer ticket experience (Prompt 10), including position, wait, permitted cancellation, and all ticket states.

## Atomic customer joining

Apply `20261001000005_atomic_queue_join.sql` and configure `SUPABASE_SERVICE_ROLE_KEY` and a private `QUEUE_JOIN_SECRET` (generate with `openssl rand -hex 32`). Public reads still use the anonymous key. Only the server action uses the privileged client; anonymous/authenticated database roles cannot invoke the join mutation directly. Never expose either secret in browser configuration.

The flow is `/q/[slug]` → `/q/[slug]/join` → `/ticket/[opaqueToken]`. A short redirect sets a random HttpOnly, SameSite=Lax browser cookie before showing the form; this GET never creates tickets. Cookies are required. Forms collect a first name and a phone only when enabled, with country-code validation enforced against current database settings. The receipt confirms the actual number and status without exposing customer names, phones, or internal IDs. Full tracking and cancellation are the next task; realtime and notifications remain later tasks.

`join_public_queue` locks the queue and checks its current state, active location, phone settings, and 1,000-active-ticket safety ceiling. It allocates numbers transactionally using the location’s local date, writes the ticket, joined event, and request mapping together, and returns only the opaque token. Initial estimates count all waiting tickets across dates × configured service duration. Numbers beyond 999 retain all digits. Any failure rolls back allocation and audit writes.

A stable form nonce plus an HMAC of the browser cookie makes retries safe. Separate tabs resume the same active ticket; recorded request aliases still resolve to that ticket after completion. A new form can join again after the previous ticket ends. Clearing cookies, using another browser, or rotating `QUEUE_JOIN_SECRET` creates a new browser identity; this is basic duplicate protection, not proof of a person’s identity. Keep the secret stable across instances/deployments.

The database limits new joins to 60 per network address per 10 minutes, across queues. Retries/resuming an active ticket do not spend this allowance. Only on Vercel (`VERCEL=1`) does the action use the platform-controlled `x-vercel-forwarded-for` address; arbitrary forwarding headers are ignored. Other hosting/local development uses one conservative shared bucket until a trusted proxy adapter is supplied. Busy shared networks may reach this limit; tune it from pilot evidence. Address values are HMAC’d before persistence, never stored raw. Operational maintenance may delete rate rows whose window ended more than 10 minutes ago; request mappings must remain to preserve retry guarantees. Configure that cleanup before sustained production traffic.

`npm run db:test:isolated` verifies allocation, phone rules, privacy, rate/capacity limits, timezone numbering, idempotency, and full rollback on downstream failure. Separate PostgreSQL sessions test 12 overlapping distinct joins, repeated requests/tabs, and a pause competing with a join. These local checks do not replace hosted Supabase/Clerk verification or physical phone testing.
