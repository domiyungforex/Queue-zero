# QueueZero
Universal virtual queues for physical service businesses.

## Current scope
Next.js App Router, strict TypeScript, Tailwind, Clerk business authentication, and a Supabase schema with tenant isolation. Onboarding, queue operations, billing, and PWA are subsequent bounded tasks.

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

All application tables have RLS. Owners/admins can read their tenant's operational data; staff customer access is limited to assigned queues. Billing is owner-only. Public customers have no direct table access. Client mutations remain disabled until authorized transactional RPCs are added in subsequent tasks.

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
- Authentication does not establish business membership. No onboarding or tenant data is implemented yet.

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
2. Sign-up and any required email verification complete, then open the dashboard.
3. Sign out, confirm the navigation changes, and confirm the dashboard is inaccessible.
4. Sign back in and confirm dashboard access, including a direct reload.
5. Open `/q/demo` and `/ticket/demo` while signed out; neither requires registration.
6. Check sign-in/sign-up on phone, tablet, and desktop, including an invalid password and a failed connection.

Real sign-in, verification, and logout require working Clerk credentials; those checks cannot be replaced by the mocked tests.

## Layout
`app` contains marketing, auth, dashboard, and public route shells. `components/ui` is reserved for shadcn/ui-compatible components. Domain libraries live in `lib`; migrations in `supabase/migrations`; tests in `tests`.

Next bounded task: atomic business onboarding (Prompt 4).
