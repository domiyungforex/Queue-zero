# QueueZero
Universal virtual queues for physical service businesses.

## Current scope
Next.js App Router, strict TypeScript, Tailwind, Clerk business authentication, a Supabase schema with tenant isolation, atomic business onboarding, a responsive business dashboard, queue creation/management, and printable QR codes. Customer joining, staff ticket operations, billing, and PWA are subsequent bounded tasks.

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

The public destination remains the existing landing-page placeholder at this step. Customer joining is not implemented yet. Before a physical pilot, finish the public landing/join tasks, then scan a printed sheet with a phone and confirm it reaches the intended queue. Use the Print button to open the browser dialog; A4 and Letter are supported, and browser-added page headers/footers can be disabled there.

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

Next bounded task: public queue landing page (Prompt 8).
