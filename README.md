# QueueZero
Universal virtual queues for physical service businesses.

## Foundation scope
Next.js App Router, strict TypeScript, Tailwind, responsive page structure, environment validation, and error/loading conventions. Authentication, database, queue operations, billing, and PWA are subsequent bounded tasks. Dashboard and auth pages currently contain no protected data or working authentication.

## Local development
Requires Node.js 20.9+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set NEXT_PUBLIC_APP_URL to the deployment origin before building for production. Optional integration variables are placeholders and are not consumed until their integrations are implemented. Never prefix private credentials with NEXT_PUBLIC_.

## Validation
```sh
npm run lint
npm run typecheck
npm run build
```

## Layout
`app` contains marketing, auth, dashboard, and public route shells. `components/ui` is reserved for shadcn/ui-compatible components. Domain libraries live in `lib`; migrations in `supabase/migrations`; tests in `tests`.

Next bounded task: implement Clerk authentication and protect the dashboard before adding tenant data.
