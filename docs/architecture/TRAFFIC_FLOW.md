# Traffic flow

Implemented path today:

1. The browser calls the Next.js app on Vercel.
2. Vercel terminates TLS and sends the request to a healthy serverless instance. This repository does not add another load balancer.
3. `proxy.ts` requires Clerk only for `/dashboard` and `/onboarding`. Student attendance stays public.
4. Staff reads use the user-scoped Supabase client and RLS. Student writes use the service role only on the server, inside security-definer functions.
5. Attendance is committed on the primary database, then the class channel is notified. The student sees success only when that transaction returns `ok: true`.
6. `GET /api/health` returns `{ ok: true, role: "liveness" }` with `cache-control: no-store`. It does not check the database, so it cannot be used as proof that attendance writes are healthy.

Unhealthy instances are removed by the host. There is no custom health-aware router in this repository. Long-lived realtime connections go to Supabase, not through a process-local socket.

Cost of the current path: the existing Vercel and Supabase plans. A second traffic layer would add cost without a measured routing failure.
