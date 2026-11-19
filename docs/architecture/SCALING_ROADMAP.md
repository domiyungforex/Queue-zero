# Scaling roadmap

Status date: 2026-11-19. This is the implementation status, not a capacity claim.

TuRnMaRk remains one Next.js application, Clerk for staff, and one Supabase Postgres primary. Nothing below provisions Redis, extra databases, a custom load balancer, workers, or shards. Those stay planned until a measured bottleneck and an approved budget exist.

| Phase | Status | Why it is or is not built |
| --- | --- | --- |
| 0 Audit | Recorded in `SCALABILITY.md` | Current limits are the primary database, snapshot size, and connection count. |
| 1 Stateless app | Already true for Vercel | No authoritative session, queue, or attendance state is kept in process memory. Files go to Supabase Storage. Added `GET /api/health` as a liveness check only. |
| 2 Load balancer | Platform, not custom | Vercel already distributes requests. A second balancer is not justified. |
| 3 Connection pooling | Required, not coded here | Serverless must use the Supabase pooler (transaction mode). Do not raise `max_connections` to compensate. Tenant context must stay inside the transaction. |
| 4 Read replicas | Not implemented | No replica is configured, and attendance confirmation must read the primary. |
| 5 Distributed cache | Not implemented | No Redis. Postgres remains the authority. Do not cache attendance, payments, or permission decisions. |
| 6 Queues | Not implemented for attendance | A scan is confirmed only after the database transaction commits. Exports could move to a queue later. |
| 7 Workers | Not implemented | No separate worker process. |
| 8 Partitioning / sharding | Not implemented | Partition attempt logs only after the table is measured as large. Do not shard by guesswork. |
| 9 Realtime | Partially in code | Class attendance is designed to notify `class:{id}` only. The migration is not applied to production. Dashboards still poll. |
| 10 Observability | Not a metrics stack | Use the host's existing logs. No fabricated dashboards. |
| 11 Integrity | Preserved | RLS, Clerk, matric numbers, and attendance idempotency were not weakened. |
| 12 Load tests | Signature check only | About 149,000 QR signature checks/second on one machine. That is not attendance commits and not 10 million users. |

Do not apply production migrations or run load tests against `turnmark.conchportal.com` without explicit authorization.
