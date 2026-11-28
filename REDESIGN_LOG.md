# REDESIGN_LOG — Site-wide UI/UX redesign (2026-11-28)

Branch: `feat/redesign-2026-11-28` (based on `fix/audit-2026-11-28` / PR #23).
Scope: visual and flow redesign ONLY. No business logic, server actions, data
fetching semantics, routes, or copy meaning were changed. All existing
functionality and test behaviour preserved (see Verification).

## Colour palette — UNCHANGED (law)

No colour was added, removed, or altered in meaning. Every colour used by the
redesign already existed in the codebase. The preserved tokens:

- `--tm-primary` / brand orange: `#ff6b2b`
- Brand gradient: `linear-gradient(135deg, #ff6b2b 0%, #ff4765 100%)`
- Coral: `#ff4765`
- Loader orange (existing QrLoader): `#ff5c1a`
- Deep orange shade (existing): `#d94b14`
- Canvas / warm cream: `#fffaf7` (family: `#fff8ef`, `#fff0e8`, `#fff7ef`, `#ffd9ca`, `#ffd2bf`)
- Ink: `#111318` (family: `#17130f`)
- Muted text: `#73788a` (family: `#626975`)
- Border: `#eee7e3`
- Panels: `#ffffff`
- Skeleton tones: `#f1e8df`, `#eadbce`
- Queue-console deep green surfaces remain as-is via the existing global
  classes (`#173e31` family in globals.css); the redesign restyled layout
  around them, not their colours.
- Typography: Sora (Variable) remains the single font. Only scale, weight,
  letter-spacing and spacing rhythm were refined.

Verification of the above: an automated scan of every hex value ADDED by this
redesign's diff shows only values from this pre-existing set.

## The loader

- NEW `components/ui/brand-loader.tsx` — `BrandLoader({ label, fullScreen })`.
  The befitting app loader: the "TuRnMaRk" wordmark in Sora (ink, weight 800,
  tight tracking), a thin orange-gradient shimmer beneath it, and an inline
  SVG queue ticket — rounded ticket outline, perforated dashed divider, stub
  lines, and three queue dots with an orange pulse that travels dot-to-dot
  (people moving up the queue) while the ticket gently pulses. Cream stage
  (`#fffaf7`) when `fullScreen`. `role="status"` with an aria-label; the
  artwork is decorative (`aria-hidden`). All motion is disabled under
  `prefers-reduced-motion`.
- `app/loading.tsx` now renders `BrandLoader fullScreen` — the app-startup /
  route-transition moment is branded, never a blank spinner.
- The existing `QrLoader` remains for in-context loading (auth, compact).
- Layout-shaped skeletons extended (pattern started in PR #23):
  `ListSkeleton` and `PanelSkeleton` added to `components/ui/loading.tsx`;
  new route loaders for `app/dashboard/academic`, `…/assignments`, and
  `app/submit/[token]` (a centred guest-card skeleton on cream); bookings
  loader gained list rows beneath its existing heading/stats skeleton.
  Dashboard, marketing, and auth loaders were already layout-shaped and kept.

## Layout & spacing system

- One appended, delimited layer at the end of `app/globals.css`
  ("Redesign 2026: loader, flow primitives, rhythm") refines spacing,
  typography, radius, and shadow ONLY for `.page-heading`, `.panel-heading`,
  `.panel`, `.stat-card`, `.metrics-grid`, `.section-toolbar`,
  `.workspace-main`, `.empty-state` — no colour declarations.
- Shared flow primitives in NEW `components/ui/flow.tsx`, used across
  academic, dashboard, and public flows:
  - `Breadcrumbs({ items })` — `nav[aria-label="Breadcrumb"]`, chevron
    separators, last item `aria-current="page"`.
  - `StepIndicator({ steps, current })` — completed steps get the orange
    gradient fill + check, the current step an orange ring with
    `aria-current="step"`, upcoming steps muted; connector line; labels
    always visible.
  - `StickyActionBar({ children })` — sticky bottom action bar (white 88% +
    backdrop blur, `#eee7e3` top border, safe-area padding) so the primary
    action on long forms/pages is always reachable.
- `.tm-fade-up` utility: gentle opacity/translate entrance for content.
- Consistency rules applied everywhere: eyebrow → heading → description
  page headers (`PageHeading`), sections introduced by `.section-toolbar`,
  stats in `.metrics-grid` of `StatCard`, statuses always via `StatusPill`,
  empty lists always via `EmptyState` with a clear next action.

## Flow changes per section

### Academic (priority)
- Overview: breadcrumbs; stats unified on `.metrics-grid`; "Quick actions"
  and "Recent Assignments" sections with toolbars; recent list uses
  `StatusPill`; an `EmptyState` with "Create Assignment" replaces the
  previous render-nothing empty case.
- Assignments list: breadcrumbs; dashboard cards on the shared system —
  off-palette emerald/amber/blue status chips replaced by `StatusPill`,
  orange hover border, chevron affordance on "Review & Grade", filtered-empty
  state is now the shared `EmptyState`.
- Assignment detail + submission reviewer: breadcrumbs to the assignment;
  reviewer is a clear two-zone layout (submission list sticky on desktop,
  review panel beside it), statuses via `StatusPill`, empty submissions via
  `EmptyState`, and the grade actions sit in a sticky bottom bar. (Data
  rendered is unchanged — the identity/answers data fix lands separately.)
- Guest submission (`/submit/[token]`): a `StepIndicator` —
  Verify identity → Answer → Submit → Done — driven entirely by the
  portal's existing state (verified student, submitting flag, receipt);
  cards converted to `.panel` rhythm; the receipt view is styled as the
  "Done" step. Form logic untouched.
- Assignment wizard: step header restyled onto the palette (completed steps
  were emerald; now cream/coral matching `StepIndicator` visuals) and the
  Previous/Next footer is a sticky bottom bar. The header keeps its
  click-to-jump behaviour, so it was restyled rather than swapped for the
  shared component.
- Student portal: breadcrumbs, shared `EmptyState`, orange card hover;
  submission editor's submit button sits in a sticky bottom bar.
- Gradebook, earnings, referrals, integrity, question-bank: breadcrumbs and
  shared empty states (original sentences preserved verbatim); gradebook
  status via `StatusPill`. Attendance/course detail pages gained
  breadcrumbs above their existing headings.

### Dashboard
- Home: "Jump back in" quick-action cards (Queues, Bookings, Academic,
  Attendance) between the stat row and "Your queues"; the hand-rolled empty
  state replaced by shared `EmptyState`.
- Queues: list header is now `PageHeading`; console page uses breadcrumbs,
  `.notice` banners, and `.panel` detail cards (Call Next was already the
  gradient primary via globals); new/edit/QR pages gained breadcrumbs and
  headings; the queue form's submit sits in a `StickyActionBar`.
- Bookings: `PageHeading`, filter form and table on `.panel`, off-palette
  inline hexes aligned to the frozen tokens, a page-level `EmptyState`
  when there are no bookings and no filters; settings page breadcrumbed.
- Billing: current-plan chip and history chips via `StatusPill`, usage via
  `StatCard`, history as `.panel` + `.panel-heading` with a shared
  `EmptyState`. Paystack copy untouched.
- People, customers, units, services: `PageHeading`, `.panel` cards,
  `StatCard` tiles, shared empty states; team form submit in a
  `StickyActionBar`. Settings/locations/team/analytics/notifications were
  already on the shared system and were left alone.

### Marketing
- One appended block in `components/marketing/site.module.css` (hexes drawn
  only from that file's existing palette): a uniform 88px section rhythm,
  unified card hover/lift across product, audience, and step cards, and the
  closing band now carries the brand gradient with a flipped white action.
- Home markup intentionally unchanged — it already implements the target
  hierarchy and its labels/hrefs are test-asserted; all gains are via CSS.
- Pricing: an assurance strip under the plans (secure Paystack upgrades,
  no app downloads, start free — wording sourced from existing copy);
  plans toggle gained `aria-pressed` and an orange active shadow. Plan
  data, order, and amounts untouched.
- Help: guide cards moved to a dedicated grid system (icon chip, chevron
  link pinned to the card foot; hrefs/labels verbatim) and the closing CTA
  became a gradient "Still stuck?" contact band.
- Contact: matching eyebrow added, contact meta restyled, the form is now a
  white card whose focus ring is the brand orange (replacing a leftover
  purple override). Fields, names, and validation untouched.
- About/features/how-it-works/solutions/privacy inherit the system fixes:
  subpage headline emphasis is brand orange everywhere, step cards are
  uniform flex columns with pinned links, prose links styled, FAQ gained a
  +/– affordance. Team page keeps its honest empty state (no invented
  profiles) on a palette-native card.

## Verification (coordinator, on the full branch)

- ESLint (`eslint .`): 0 errors; 4 warnings, all pre-existing in untouched
  lines (3× `no-img-element`, 1× unused var in the wizard).
- Typecheck (`tsc --noEmit`): PASS (one tuple-typing fix in
  `app/dashboard/units/[unitId]/page.tsx` was needed and applied).
- Vitest: 711 passed, 1 skipped, 2 failed — identical to the pre-redesign
  baseline; the 2 failures are the known pre-existing ones
  (`organization-navigation.test.tsx`, `school-exports.test.ts`). No new
  failures.
- Production build (`next build`): PASS.
- Colour audit: every hex added by the diff belongs to the pre-existing
  palette listed above.
