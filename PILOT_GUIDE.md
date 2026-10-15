# TuRnMaRk first-business pilot

Resolve the critical blockers in `PRODUCTION_CHECKLIST.md` before operating real customer queues. Use one business, one location and one active serving counter per queue. No new product scope is required.

## Onboard a business in under ten minutes

This timing assumes production authentication and provider setup have already passed acceptance.

1. **Sign in — 1 minute.** Open https://turnmark.conchportal.com, create the business account and verify its email. Customers never need accounts.
2. **Business and location — 2 minutes.** Enter name, industry, country, reporting timezone, first location and address. Confirm the timezone with staff.
3. **Create a queue — 1 minute.** Set the service name, location, typical service duration and almost-turn threshold. Leave phone collection off unless operationally necessary.
4. **Print the QR — 2 minutes.** Download the queue PNG or use Print. Check the printed code opens the business's canonical public queue URL on a phone. Place it where arriving customers can reach it.
5. **Open the staff console — 1 minute.** Use the receptionist laptop/tablet. Add teammates only after they create accounts and verify the exact email; assign their queues.
6. **Practice — 2 minutes.** Two phones join; each gets a different number. Call Next, then Complete service, then Call Next again. Try pause/resume and enable customer alerts where supported.
7. **Begin small — 1 minute.** Name the staff member responsible, keep a manual fallback, and help customers without phones. Start with 20–50 joins and observe the full shift.

Installation is optional. Ordinary QR links work in a browser. On Android, use the browser's install action if desired. On supported iPhones, use Safari → Share → Add to Home Screen, open that installed app, then enable alerts; a browser tab still works for ticket tracking without push.

## Launch-day physical acceptance: one laptop, five phones, one printed QR

Record date, release commit, business/queue, tester, browser/OS versions, network and observed results. Use a dedicated acceptance queue with no unrelated customers. Record pass/fail for each step; do not substitute browser emulation for physical devices.

| Step | Action | Required result |
| --- | --- | --- |
| 1 | Laptop receptionist opens the staff console. Print its queue QR. | QR resolves over HTTPS to the intended business/service. |
| 2 | Phone 1 scans and joins; repeat in order for Phones 2–5. | Five unique ticket numbers and five distinct private links. No customer account prompt. Each sees its position and estimated wait. |
| 3 | Enable alerts on the intended phones; keep one normal browser tab and one installed app. | Grant/deny paths both remain usable. Actual notification receipt must be observed, not inferred from an outbox row. |
| 4 | Receptionist presses **Call Next** once. | Phone 1 shows **It’s your turn**. Phone 2 changes from one waiting person ahead to zero; it still waits for staff to call it while Phone 1 is served. All remaining positions update. |
| 5 | Press **Complete service**, then **Call Next**. | Phone 1 shows completed; Phone 2 shows its turn; the queue advances once. Repeat through the remaining phones. |
| 6 | Rejoin at least two phones and open a second receptionist window with another authorized staff account. Press **Call Next** in both windows almost simultaneously. | Exactly one ticket becomes serving and one call event is recorded. Both windows agree on that ticket. The second request must not advance to a different customer. |
| 7 | Double-click Call Next and retry after briefly interrupting the request/network. | No duplicate call and no second customer advanced. Completing the current ticket remains explicit. |
| 8 | Mark a called customer **No-show**; call the next. Cancel another waiting ticket from its phone. | Terminal tickets leave the active waiting list once; positions update; audit history remains. |
| 9 | Pause the queue, scan QR on a spare browser, then resume. | New joins are blocked while paused; existing tickets remain visible; new joins resume afterward. |
| 10 | Disconnect one waiting phone, advance the queue, reconnect it and return to its tab. | It refetches current status without a duplicate join. If Broadcast is unavailable, fallback polling catches up within roughly 15 seconds plus network latency. |
| 11 | Open an invalid token and attempt another business's console using a second tenant account. | No customer details leaked; foreign business/queue access denied. |
| 12 | Install/uninstall where supported; navigate back, open external browser links, rotate phones, use the tablet and open the keyboard. | No trapped navigation, covered controls or horizontal overflow. Product remains usable without installation or notification permission. |

**Essential concurrency rule:** Never accept two distinct serving customers, two call events for one transition, or an unexplained second advancement. Stop the pilot and retain timestamps/audit evidence if any occurs. Do not keep pressing buttons to work around it.

## Repeatable local regression

Use Node 22.12+ and Docker. No live credentials or production database are needed for the customer acceptance test.

```sh
npm ci
npx playwright install chromium
npm run lint
npx next typegen
npm run typecheck
npm test
npm run db:test:isolated
# In terminal 1 (disposable DB; stop with Ctrl+C):
npm run preview
# In terminal 2; exactly one local preview should be running:
PREVIEW_DB_CONTAINER=$(docker ps --filter name=queuezero-preview --filter ancestor=queuezero-db-tests:local --format '{{.Names}}') npx playwright test
```

`customer-journey.spec.ts` refuses hosted origins and non-preview container names. It creates a fresh fixture business/queue and opens five independent customer contexts. SQL fixture identities execute receptionist operations; real anonymous browser joins and HTTP ticket updates are used. The standalone database suite also overlaps two different staff identities and twelve simultaneous joins. This does not replace Clerk signup, a browser-authenticated staff session, real Broadcast delivery, real push or printed-QR acceptance.

Run `npm run build` separately with valid local/test environment configuration after stopping the preview. Keep test credentials out of Git. Production provider configuration must be checked separately.

## Week-1 acceptance and measurement

By Day 7, a real business must be able to register, create a location/queue, print and scan the QR, admit account-free customers, allocate unique numbers, show people ahead and estimated waits, update live, call/complete/no-show safely, receive notifications, pause/resume, use real analytics, upgrade when paid billing is offered, enforce tenant isolation and operate on phones from a verified deployed release.

The final question is practical: **Can we place the QR on a real business's counter and operate its actual queue without touching code?** Record the answer from a real shift; do not mark it passed from automated checks.

| Measure | Definition / collection |
| --- | --- |
| Businesses onboarded | Real businesses with completed setup; exclude QA/demo fixtures. |
| Queue joins; joins/business/day | Count committed join events; exclude idempotent retries and QA. Report calendar-day and operating-day denominators explicitly. |
| Average wait | Mean `called_at - joined_at` for called tickets; show sample count and date range. |
| Completion / no-show rate | Completed or no-show tickets divided by joined tickets in a settled cohort; report cancellations separately. |
| Weekly active businesses | Businesses with real queue joins or staff operations in the week. |
| Staff actions/day; operating hours | Count audited operations by type; record opening/closing periods with the pilot operator. |
| Notification success | Outbox sent/failed/skipped counts plus observed device receipt. “Sent” alone does not prove delivery. |
| Retention | Track whether each business returns to operate queues in the following week. |
| Willingness to pay | Ask the owner after observed use; record actual checkout completion separately from stated interest. |

Review these measures and staff/customer feedback each day. Run the product with actual businesses before expanding. Appointments, reservations, deposits, customer history, multiple counters, forecasting, AI wait prediction, discovery, service availability/maps, APIs and enterprise integrations remain future possibilities only after usage validates the queue system. Do not start AI development as the next automatic task.

## Real records only

Start with an empty business and create its actual location and services during onboarding. The product has no seeded queues, sample customers, simulated staff actions or placeholder analytics. Old `/demo` links open the authenticated workspace. Dashboard, console and customer screens refetch database records on live events and reconnect; a 15-second fallback recovers missed events. Check the connection indicator rather than assuming a disconnected screen is current. Apply the business-update migration before pilot testing. Automated fixtures belong only in disposable test databases.

## School staging pilot

Keep the queue pilot first. Once the pending school release is deployed to staging and provider checks pass:

1. Choose school or hybrid during onboarding (or owner Settings).
2. In Courses, add faculty/department and course. Assign an existing lecturer by verified account email.
3. Enroll students with real full name, verified school email, matric number and level; CSV imports are limited to 200 rows per submission.
4. Create a class, check its UTC start time, and open attendance. Display its rotating QR.
5. An enrolled student signs in, rescans the current QR if authentication outlasted it, and confirms arrival. Check the lecturer's live register.
6. Close check-in, enable checkout if required, and scan a fresh QR for departure. Retrying the same scan must not create a departure.
7. End the class and download PDF/CSV/XLSX. Review flags as signals, not automatic findings of misconduct.

Use consenting test accounts in staging. School credentials and student records are never demo data in the product. The ten-minute business onboarding flow above stays independent of attendance.
