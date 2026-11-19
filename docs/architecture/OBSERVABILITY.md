# Observability

No new metrics vendor was added. Use the existing Vercel and Supabase logs.

Useful signals, none of which were given fake numbers here:

- Request latency and 5xx rate on the app host.
- Database connections, slow queries, lock waits, and storage growth in Supabase.
- Attendance responses whose status is `ACCEPTED` versus `DUPLICATE`, `NOT_REGISTERED`, `CLOSED`, and `RATE_LIMITED`.
- Replica lag, cache hit rate, queue depth, and worker retries: not applicable until those components exist.

`GET /api/health` is liveness only. An alert on that route does not detect a paused database.

Suggested first SLOs, not yet measured:

- Attendance write p95 under 2 seconds while the class is open, excluding photo upload.
- Duplicate scans never insert a second row for the same student and class.
- A staff member never reads another organization's rows.

Do not treat the local QR-signature benchmark as an attendance SLO.
