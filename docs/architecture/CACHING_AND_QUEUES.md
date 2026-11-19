# Caching and queues

## Cache

No distributed cache is deployed. Postgres is the source of truth for attendance, queue position, bookings, billing, and student identity.

A future cache may hold public institution labels and course codes, keyed by organization id, with a short TTL and invalidation on school setup changes. It must not hold student photographs, matric numbers, attendance rows, or staff permissions. If the cache is down, those reads go to Postgres. That cache is not built.

## Queues and workers

No application queue or worker process is deployed. Attendance export generation still runs in the request. That is acceptable until export time is measured as a problem.

If exports move to a queue later, the job must be durable, idempotent, retried with backoff, and visible when it fails. The lecturer sees "export started", not "export finished", until the file exists.

Attendance ingestion stays synchronous. A student is told attendance is recorded only after the primary commits the row. Placing a scan on a queue is not a success.
