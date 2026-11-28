# Turnmark audit fixes — branch `fix/audit-2026-11-28` (2026-11-28)

Base: HEAD `9200f91` ("Fix TypeScript and Turbopack build errors", 2026-11-27).
Not pushed, not deployed. Verification at the end of this log.

---

## ASSIGNMENTS (fixed in user-specified order: Step 0 → 1 → 2)

### Step 0 — Assignment creation fails with a generic "Could not save assignment."

**Investigation (alternatives eliminated with evidence):**
- Wizard payload → `createAssignmentSchema`: a new test reproducing the wizard's
  exact payload (existing MEE 403 course, one SHORT_ANSWER question / 10 marks,
  deadline, session `2025/2026`, semester `First`) passes validation for Publish,
  Save-as-Draft, and the manual-course variant (`tests/unit/assignment-create-payload.test.ts`).
- The wizard does surface server errors (`setError(res.error)`), and the live
  toast text matches the action's insert-failure return exactly — so the failure
  was the `assignments` INSERT in `createAssignmentAction` (`lib/academic/actions.ts`).
- Not RLS (insert uses the service-role join client), not identity (`created_by`
  is `text`), not the course FK (`courses` has `unique(id, organization_id)`),
  no triggers on `assignments`, and every inserted column + check constraint
  exists in the repo migrations at HEAD.
- **Root cause (two parts):** (1) Code defect — the insert error was swallowed:
  no server logging anywhere in the save path, and the client got one generic
  sentence for every possible failure; question/answer-key/attachment insert
  errors were ignored entirely, so a partial save could silently publish an
  assignment with no questions. (2) The production rejection itself is at the
  database layer and, given the code evidence above, is almost certainly
  migration drift: the academic feature landed 2026-11-26/27
  (`20261126180000` creates `assignments`; `20261127150000` manual-course columns;
  `20261127170000` target_audience; `20261127180000` subject_domain /
  marking_instructions / max_attachments) and the workspace has never held a
  single assignment. **The exact Postgres error cannot be confirmed from code** —
  after this fix deploys, the real code/message will be in the server logs, and
  the immediate check is: Supabase dashboard → confirm those four migrations are
  applied to the production project; apply any missing ones in order.

**Fixes (`lib/academic/actions.ts`):**
- Insert failures are now logged server-side (`console.error` with stage,
  Postgres code/message/details/hint, org + course context) and mapped to a
  specific user-safe message by error code: 42P01/42703 → "Assignment storage is
  not ready on the server yet (a database update is pending)…", 23503 → course
  re-select message, 23514 → settings rejected message, 23505 → duplicate,
  otherwise the message includes the error code for support.
- Question, answer-key, and attachment inserts are now checked: on failure the
  partial assignment is deleted (cascades to its questions) and the same
  specific error is returned — no more silently broken published assignments.

**Tests:** `tests/unit/assignment-create-action.test.ts` (mocked DB, wizard
payload): publish inserts PUBLISHED + question + answer key; draft inserts
DRAFT; a 42703 insert failure returns the specific "database update is pending"
message and logs stage+code; a question-insert failure deletes the partial
assignment. All pass.

### Step 1 — Student assignment view / share link 404

**Root causes:**
1. Portal detail (`app/dashboard/academic/student/[assignmentId]/page.tsx`)
   calls `notFound()` when the assignment is absent from
   `getStudentPortalData()`'s list. That list used the RLS-bound user client;
   the `assignments_read` policy only shows a student a PUBLISHED assignment if
   a `people` row in the org carries their Clerk user id. Students created via
   roster import / attendance often have no claimed people row
   (`clerk_user_id` NULL) → empty list → 404 for a legitimately published
   assignment.
2. Guest page (`app/submit/[token]/page.tsx`) called `notFound()` on ANY token
   verification failure, including simple expiry.
3. `lib/academic/distribution.ts` `signingSecret()` silently fell back to a
   hardcoded, public dev secret when no env secret was set — links minted under
   it are forgeable and stop verifying the moment a real secret is configured.

**Fixes:**
- `lib/academic/data.ts`: published assignments are now read with the
  service-role join client, scoped to the caller's verified workspace
  membership (`membership.businessId`), with a fallback to the user client if
  the service client is not configured. Per-student submission data stays keyed
  to the linked profile. (Server-only module; no service-role exposure to the
  client; DB RLS itself is unchanged.)
- `app/submit/[token]/page.tsx`: an expired token now renders a clear
  "This submission link has expired — ask your lecturer for a new link" page;
  invalid/forged tokens still 404.
- `lib/academic/distribution.ts`: hardcoded fallback removed — signing fails
  closed with "Assignment link signing is not configured." when no
  `ATTENDANCE_QR_SECRET` / `QUEUE_JOIN_SECRET` / `CLERK_SECRET_KEY` is set.

**Tests:** token round-trip + expired-token contract in
`tests/unit/assignment-guest-access.test.ts`; fail-closed signing test in
`tests/unit/distribution-allowance-ledger.test.ts`; source guard for the
service-client portal read in `tests/unit/assignment-enrollment-source.test.ts`.
All pass. (Student links themselves were already consistent at HEAD — a wrong
`/student/assignments/` link was fixed upstream in `2c74187`.)

### Step 2 — Enrolled students told "not registered for the course"

**Root cause:** `verifyGuestStudentForAssignment` (`lib/academic/guest-actions.ts`)
queried a table named **`course_enrollments`, which does not exist in any
migration**. Enrollment lives in **`course_students`** (created in
`20261004015405_school_attendance.sql`; PK `(course_id, student_id)`;
`student_id` → `school_profiles(id)`; no `id` column). The query always errored
→ no row → every COURSE_ENROLLED-audience student was rejected. The same broken
table in `lib/school/attendance-notifications.ts` meant COURSE_ENROLLED
notification resolution always returned zero recipients.

**Fixes:** both files now query `course_students` selecting `student_id`, with
`organization_id` scoping in the guest check. Non-enrolled students are still
blocked with the same message.

**Tests:** `tests/unit/assignment-guest-access.test.ts` — enrolled student is
admitted (ok:true), non-enrolled student is blocked with the restricted
message; source guard in `tests/unit/assignment-enrollment-source.test.ts`.
All pass.

---

## BOOKINGS (critical) — confirmed bookings invisible to staff

**Root cause:** `supabase/migrations/20261112000000_booking_virtual_queue_system.sql`
compares the TEXT column `business_members.clerk_user_id` against `auth.uid()`
in 6 places (`get_staff_bookings`, `get_booking_metrics`, and 4 RLS policies).
Clerk subjects are TEXT (`user_…`); the repo's own tenant RLS migration provides
`private.current_clerk_user_id()` for exactly this. Staff RPCs therefore failed,
and `lib/booking/staff-actions.ts` silently converted the failure into
`{total: 0, bookings: []}` and zero metrics — matching the live symptom exactly.

**Fixes:**
- NEW `supabase/migrations/20261128000000_booking_staff_clerk_access.sql` —
  recreates both RPCs and the 4 policies using `private.current_clerk_user_id()`
  (bodies otherwise unchanged). **Must be applied to production Supabase.**
- `lib/booking/staff-actions.ts` — RPC failures now `console.error` with the
  error code in all environments (was silent in production).
- Note: the same broken `auth.uid()` pattern exists in
  `20261117020000_operations_timeline_triggers.sql` — flagged, out of scope.

## ATTENDANCE (critical) — fresh QR tokens rejected at /attend

**Findings:** Decoded QR payloads from the live test were well-formed (issued
2026-11-28T12:43:45Z, expiry = session close 14:00:00Z, session_id matches,
43-char signature). At HEAD, generation and validation code are consistent —
no code-level smoking gun; the production trigger is **unverified** (suspects:
production `ATTENDANCE_QR_SECRET` mismatch with the secret used at issue time,
or a deployment behind HEAD). Confirmed by design: Refresh returns a
byte-identical QR because `school_issue_qr` reuses the unexpired nonce —
rotation is via Revoke only.

**Fixes:**
- `app/attend/page.tsx` — structured server logging that distinguishes
  SIGNING_NOT_CONFIGURED / TOKEN_INVALID / LOOKUP_FAILED and logs RPC error
  codes (token and secret never logged), so the next production failure is
  diagnosable from logs. Student-facing message unchanged.
- `tests/unit/attendance-qr.test.ts` — fixed a stale test: the future-issued
  tolerance is 60s (commit `1b63ce7`), so 6s-future now validates and 61s-future
  throws.
- `components/school/attendance-qr.tsx` — Refresh button title now explains the
  code stays the same while attendance is open.

## AUTH (major) — password sign-in failed with a generic message

**Root cause:** `lib/auth/ui.ts` `authErrorMessage` had no mapping for Clerk's
`form_password_incorrect` (nor pwned/duplicate/short-password codes), so a wrong
password fell through to "We couldn't sign you in right now. Try again." —
exactly the live behaviour. (Whether the saved password itself was wrong cannot
be proven from outside.)

**Fix:** mappings added in `lib/auth/ui.ts` (incorrect password now suggests the
email-code path) + tests in `tests/unit/auth-ui.test.ts`.

## PRICING / UI QUICK WINS + REDESIGN (shared-system level)

- Plan order ascending by price (FREE, STARTER, EVENTS, GROWTH, EDUCATION,
  PROFESSIONAL, ENTERPRISE): fallback catalog in `lib/pricing/plans.ts`,
  component sort in `components/billing/plans.tsx`, and NEW migration
  `supabase/migrations/20261128010000_pricing_plan_display_order.sql` setting
  `plans.sort_order` + fixing the seeded EVENTS description. **Apply to prod.**
- Grammar: "1 active queue" / "1 location" pluralization in `plans.tsx`.
- Annual label: "/ year, billed annually" in `plans.tsx`.
- Plan carry-over: public "Choose" → `/sign-up?plan=<plan>`; sign-up shows a
  "Selected plan: X" notice (`components/auth/auth-form.tsx` + CSS module);
  billing page reads `?plan=` → banner + SELECTED highlight in Plans.
- The truncated Stripe-webhooks developer note is hidden on the public pricing
  page (kept in dashboard billing, corrected to Paystack — see Billing).
- Help page guide cards now link to real pages (`app/(marketing)/help/page.tsx`);
  "rotating QR" copy corrected (QR is stable by design).
- Typography: Sora Variable is now the single UI font. Removed the competing
  Manrope (`QueueManrope`) references from `app/globals.css` and
  `components/marketing/site.module.css` (the unused `public/fonts/manrope.woff2`
  is no longer fetched; file left in place). No new font downloads added.
- Loaders: route loaders are now layout-shaped skeletons built on the existing
  skeleton system instead of a blank screen with a lone spinner —
  `app/loading.tsx`, `app/(marketing)/loading.tsx` (nav + hero + cards; covers
  the pricing page), `app/(auth)/loading.tsx` (auth-shell shape; covers the
  sign-in wait). New `.tm-skel*` classes appended to `app/globals.css`.
- Branding: one name form — `TURNMARK` → `TuRnMaRk` in `app/global-error.tsx`,
  About eyebrow, and the home "How it works" eyebrow.
- NOT done (needs the user, not code): Team page is DB-driven (`team_profiles`)
  and empty because no profiles are published in prod; footer "©2026TuRnMaRk"
  spacing — code at HEAD already renders spaces, so the prod rendering differs
  from HEAD (deployment drift). `app/globals.css` still carries three
  generations of layered overrides (green/indigo/orange eras); a future
  consolidation pass is recommended rather than a risky rewrite now. Deeper
  per-page redesign (Features/How It Works/About layouts) still outstanding.

## BILLING — Paystack only (user decision 2026-11-28)

**What already existed:** a substantially real dual-provider setup —
`billing_checkouts` + `subscriptions` tables, idempotent `confirm_checkout` and
`sync_subscription_event` RPCs, Paystack hosted checkout + verify + signed
webhook, Stripe checkout/portal/webhook. BUT Paystack checkout only supported
STARTER and legacy BUSINESS, while the catalog sells STARTER/GROWTH/
PROFESSIONAL/EDUCATION/EVENTS — and `billingConfigured()` required both legacy
plan codes, so with them unset every paid button showed the disabled
"Subscriptions opening soon" (the live symptom).

**Built/changed:**
- `lib/paystack/server.ts` — `getPaidPlan()` generalized to every paid plan and
  both intervals via `PAYSTACK_<PLAN>_PLAN_CODE` /
  `PAYSTACK_<PLAN>_ANNUAL_PLAN_CODE` env vars (amount/currency/interval still
  verified against Paystack's own plan record); added `paystackPlanConfigured()`;
  `billingConfigured()` now means the secret key is present (per-plan config is
  surfaced per plan). `verifyCheckout()` now derives the paid period from the
  plan interval so annual plans are not cut off after one month.
- `lib/payments/provider.ts` — rewritten Paystack-only; checkout takes an
  interval; subscription management uses Paystack's manage link.
- `app/dashboard/billing/actions.ts` — `startCheckout(plan, interval)`;
  configuration errors surface as a clear "not available for checkout yet"
  message instead of a generic failure.
- `components/billing/plans.tsx` — provider toggle removed; per-plan,
  per-interval availability (unconfigured plans show a disabled
  "Not yet available" instead of a dead click or a false "opening soon");
  `highlightedPlan` support; security note fixed to Paystack.
- `app/dashboard/billing/page.tsx` — current-plan panel with subscription
  status (Active / Past due / Cancelled / Expired) and renewal/period-end date
  from the `subscriptions` table; past-due warning; billing history now always
  renders with a clean empty state ("No payments yet…"); `?plan=` banner.
- `app/(marketing)/pricing/page.tsx` — prices fetched for all paid plans,
  per-plan failure isolation.
- Stripe removed: `lib/stripe/` deleted, `app/api/webhooks/stripe/route.ts`
  deleted, `tests/unit/stripe-webhook.test.ts` deleted, help-page copy
  corrected to Paystack, `.env.example` Stripe vars removed. (The
  `plan_prices.provider` DB column/type remains for historical rows; checkout
  and pricing display now only use Paystack rows.)
- Webhooks (already wired, unchanged): Paystack `charge.success` → verify +
  `confirm_checkout`; subscription events → `sync_subscription_event` with
  active/past_due/cancelled mapping.

**To go live, the user must configure (no keys in code):**
1. Vercel env: `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`,
   `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_CURRENCY=NGN` (if not already set).
2. In the Paystack dashboard, create one subscription plan per Turnmark plan
   (monthly; plus an annual variant of each for annual billing) and set in
   Vercel: `PAYSTACK_STARTER_PLAN_CODE`, `PAYSTACK_GROWTH_PLAN_CODE`,
   `PAYSTACK_PROFESSIONAL_PLAN_CODE`, `PAYSTACK_EDUCATION_PLAN_CODE`,
   `PAYSTACK_EVENTS_PLAN_CODE` (+ the five `..._ANNUAL_PLAN_CODE` vars).
   Plans without a code show "Not yet available" — nothing breaks.
3. Register the Paystack webhook URL: `https://turnmark.conchportal.com/api/webhooks/paystack`
   (events: charge.success, subscription.create/disable/not_renew,
   invoice.payment_failed, invoice.update). Checkout callback is
   `/api/billing/verify` (set automatically).
4. Apply the two new migrations to production Supabase (bookings + pricing
   order above).

---

## Verification (final state of this branch)

- `npm run typecheck` — PASS.
- ESLint (`app lib components tests`) — 0 errors, 4 pre-existing warnings in
  untouched files (img elements, one unused var).
- `npm run build` — PASS (production build; it caught and we fixed a
  "use server" export violation in `lib/academic/actions.ts`).
- Full Vitest suite — 711 passed, 1 skipped, **2 failed, both pre-existing at
  HEAD** (verified by running them in a clean HEAD worktree):
  `organization-navigation.test.tsx` ("does not expose a staff workspace to
  students") and `school-exports.test.ts` (PDF/XLSX generation). Neither is
  touched by this branch's changes; they were failing before it.
- Assignment-specific suites (payload, create-action, guest-access,
  enrollment-source, distribution) — all pass.

## Still unverified / needs production action

1. Apply migrations `20261128000000` + `20261128010000` to production Supabase.
2. Confirm the academic migrations (20261126180000, 20261127150000,
   20261127170000, 20261127180000) are applied to production Supabase — the
   Step 0 check; if any is missing, assignment saves will keep failing (now
   with a specific, logged error).
3. Attendance QR production rejection: root trigger still unidentified from
   code; new logging will name it on the next failure. Check prod
   `ATTENDANCE_QR_SECRET` consistency.
4. Paystack go-live configuration (above). No live charges were made.
5. Mobile responsiveness was not re-tested; Team page needs real profiles
   published in the DB; pricing/hero marketing claims ("1,000+ teams", "4.9")
   still need a source or removal — content decision for the user.

---

# Submission reviewer identity + answers — branch `fix/submission-reviewer-identity-answers` (2026-11-28)

## SUBMISSION REVIEWER — fake student identity, answers invisible to lecturers

**Symptoms (verified live + in DB):** on the staff assignment detail page
(`/dashboard/academic/assignments/[assignmentId]`), every submission showed a
made-up identity ("Student 15368c" / matric "15368cc7" — slices of the student
UUID), and the answer panel always said "No written text answer provided."
even for submissions with a full written answer (e.g. SUB-C0CAA204).

**Root causes:**
1. The detail page never looked the student up: it hardcoded
   `studentName: "Student " + student_id.slice(0, 6)` and
   `matricNumber: student_id.slice(0, 8)`.
2. The submissions query never selected `answers_json`, and
   `submission-reviewer.tsx` rendered only `text_content`. Guest submissions
   store per-question answers in `answers_json` (question_id -> answer) while
   `text_content` stays empty, so the reviewer had nothing to show. The data
   was intact in the DB the whole time.

**Fixes:**
- `app/dashboard/academic/assignments/[assignmentId]/page.tsx`: submissions
  query now also selects `answers_json`; the assignment's questions are
  loaded from `assignment_questions` (ordered by position); people
  (`full_name`) and `school_profiles` (`matric_number`) are batch-loaded for
  the distinct submission student ids, scoped to the workspace, via the same
  service-role join client. Names fall back to the truncated-id label only
  when no `people` row exists; the matric falls back to "" — never a fake
  value sliced from the UUID.
- `lib/academic/submission-review.ts` (new): pure helpers —
  `buildQuestionAnswers` (joins `answers_json` to questions in position
  order, skips unanswered questions, stringifies non-string answers),
  `buildStudentIdentityMap`, `submissionStudentName`, `formatAnswerValue`.
- `components/academic/submission-reviewer.tsx`: `SubmissionRow` gains
  `questionAnswers`; the detail panel renders each question prompt (with
  marks) and the student's answer, keeps the free-text block when
  `textContent` exists, and shows "No written text answer provided." only
  when there is neither. List rows/detail header show the real name and
  matric (matric segment omitted when empty).

**Tests:** `tests/unit/submission-review.test.ts` — answer join (present,
missing question, orphaned answer, non-string answers, malformed/empty
payloads, JSON-string payload) and identity mapping (real name + matric,
no fabricated matric, fallback label). All pass.
