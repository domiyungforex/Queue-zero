# Database scaling

## What exists

One Supabase Postgres primary. RLS and security-definer functions isolate organizations. Attendance writes, student registration, queue call-next, bookings, and Paystack state all use that primary. There is no read replica and no shard map in this repository.

## Pooling

Serverless instances must use Supabase's transaction pooler, not a direct session per request. Transaction pooling is required so a pooled session cannot keep `set_config` tenant state after commit. Attendance functions set their locks inside the transaction and do not depend on session variables surviving the call.

Do not increase `max_connections` until pool wait time, not CPU, is the measured limit. A safe starting budget is: pool size per instance times peak instance count stays under the pooler's client limit, and the pooler's server connections stay under the database `max_connections` minus a reserve for migrations and the dashboard.

This change does not set those numbers in production. They have not been measured here.

## Replicas

Not implemented. A replica may later serve historical exports and completed-class reports. It must not serve the read that confirms a scan that just committed. If replica lag or failure is detected, that read returns to the primary. No routing code claims this is active.

## Partitioning and sharding

Not implemented. The first candidate, after measurement, is time partitioning of `attendance_submission_limits`, with a retention rule. Sharding by organization is a later design only if one primary still misses an agreed latency target after indexes, pooling, and shorter transactions.

Until then every organization stays in the same database, isolated by `organization_id`, RLS, and function checks.
