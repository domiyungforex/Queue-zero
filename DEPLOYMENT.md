# Deploy the current QueueZero build

Import `domiyungforex/Queue-zero` into Vercel, select the Next.js preset and repository root, and use `npm run build`. The lockfile is committed. No custom output directory is needed.

## Environment variables

Add these in **Vercel → Project → Settings → Environment Variables** before building. Use `.env.example` for variable names; `.env.local` is intentionally ignored and is never pushed.

| Variable | Value source |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Exact deployed origin, such as `https://queuezero.vercel.app` if assigned to this project; QR links use it. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk key for this deployment's instance/domain. |
| `CLERK_SECRET_KEY` | Matching Clerk secret, server only. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Valid publishable or legacy anon key from that same project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server secret for controlled customer joins/cancellation. |
| `QUEUE_JOIN_SECRET` | Stable private random secret; generate with `openssl rand -hex 32`. |

Use production Clerk keys only on the production domains configured in Clerk. The supplied publishable key identifies `clerk.conchportal.com`; verify the intended QueueZero website domain is configured for that instance. For a separate preview deployment, use a compatible Clerk development instance. Changing public variables requires a rebuild. Never put a server secret in a `NEXT_PUBLIC_` variable or commit environment files.

Paystack, push notification and webhook credentials are not required for the currently implemented screens; those features are not implemented yet.

## Database and authentication

Follow [the database setup guide](supabase/README.md) to enable native Clerk integration in Supabase. Session tokens must include the authenticated role and verified Clerk subject.

Link the intended Supabase project using the CLI and authenticated database access. Inspect `npx supabase db push --dry-run`, then apply all checked-in migrations with `npx supabase db push`. A REST service-role key alone is not database migration access. Do not disable RLS to bypass errors.

## Current verification and blockers

On 2026-10-02, the supplied keys were saved only to the ignored local environment. Read-only hosted probes found:

- Clerk frontend configuration endpoint responded HTTP 200. Backend API requests returned a non-JSON HTTP 403, so server-key validity and matching-instance authentication remain unverified.
- Supabase public key returned HTTP 401. Replace it with a working public key for the configured project.
- Server-authenticated access to `queues` returned `PGRST205` (table absent from the API schema cache). Apply/verify migrations and schema-cache visibility before testing business flows.
- This workspace has no configured Vercel project or Vercel deployment token. Local environment values are not automatically transferred by a Git push.

A successful build is not evidence that hosted sign-in, onboarding or customer joining works. Resolve these blockers before calling the deployment functional.

## Smoke test after deployment

1. Open the landing page and sign-in page without browser errors.
2. Register, create a business/location, and open the dashboard.
3. Create a queue and confirm its QR points to the deployed origin.
4. Join from two signed-out browsers; confirm distinct ticket numbers and private ticket pages.
5. Cancel one waiting ticket and refresh the other to verify its position.
6. Confirm another business cannot read or modify the first business's queues.

The atomic Call Next backend is implemented and concurrency-tested locally. Staff-console controls, realtime, notifications and billing are still subsequent tasks. This build is for reviewing progress, not a completed production pilot.
