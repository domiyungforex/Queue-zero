# Disaster recovery

Current recovery is the Supabase project backup and a redeploy of the Next.js app. This repository does not add a second region, a replica, or an automated failover.

| Failure | Expected behavior today |
| --- | --- |
| One app instance dies mid-request | The client retries. Attendance uses the request id so a retry does not double-insert. |
| App redeploy | No attendance row lives on the instance. Open classes remain in Postgres. |
| Database unavailable | Reads and writes fail visibly. The UI must not show an empty organization as if it had no records. |
| Cache or queue outage | Not applicable. Those systems are not in the path. |
| Bad matric correction | Automatic replacement is blocked. An administrator correction is explicit and does not rewrite historical attendance onto a new student id. |

Restoration of student rows must use a backup or an institution source. Do not invent matric or JAMB numbers during recovery.

A regional failover design is postponed until the single primary is measured as the availability limit and a second region is funded.
