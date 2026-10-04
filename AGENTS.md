# TuRnMaRk Engineering Rules
## Mission
Build TuRnMaRk as reliable production software for real businesses managing real physical queues. Prioritize correctness, speed, simplicity, accessibility, security and operational reliability.
## Required workflow
Before making any change: read this file completely, inspect the implementation, understand the task, identify relevant files, and make the smallest coherent change. Do not begin unrelated work.
## Scope discipline
Each request is one bounded task. Do not redesign unrelated areas, rename unrelated files, introduce unnecessary abstractions, install dependencies without clear need, replace working technology, or perform broad refactors. Explain required dependencies before use.
## Stack
Next.js App Router, strict TypeScript, React, Tailwind CSS, shadcn/ui, Clerk, Supabase/PostgreSQL, Supabase Realtime, Paystack, Zod.
## TypeScript
Reuse shared types. Do not introduce any unless an unavoidable external boundary requires it and document why. Never ignore TypeScript errors.
## Database
Migrations are authoritative. Every schema change requires a migration. Every tenant-owned table requires RLS. Never weaken RLS or expose service-role credentials client-side.
## Queue correctness
Queue operations must be concurrency-safe and critical transitions transactional. Never determine the next customer only in frontend state. Simultaneous Call Next requests must never call the same ticket. Keep auditable history.
## Customer privacy
Never expose other customers' names or phones, internal database identifiers, or private analytics. Public access uses opaque tokens.
## Realtime
Postgres is authoritative. Refetch on reconnect. Do not assume exactly-once delivery.
## Payments
Verify payments server-side and signed webhooks idempotently. Never activate subscriptions solely from redirects.
## UI
Support mobile customer UX and responsive business dashboards. Every async operation needs loading, success and failure states. Every data view needs loading, empty, error and populated states. Use accessible semantic controls.
## Security
Validate external input with Zod. Authenticate and authorize protected mutations. Never trust submitted ownership. No secrets in source control or logs.
## Testing
Review diff, run lint, TypeScript validation and relevant tests; verify happy paths, obvious failures, responsive layouts and regressions. Do not mark complete with known errors.
## Completion response
Report changes, decisions, files, tests and results, remaining risks and next bounded task. Do not automatically begin the next task.
## Git
One meaningful task per commit. Commit only after verification. Use descriptive conventional commits.
