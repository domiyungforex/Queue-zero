# TuRnMaRk public website review

## Implemented

- Unique public titles, descriptions, canonical URLs, Open Graph/Twitter previews and a generated 1200×630 share image.
- Custom 404 recovery, SVG favicon, sitemap, robots directives and both requested `llm.txt` and conventional `llms.txt`.
- Clickable logo, current copyright year, mobile menu, internal education/contact/privacy links, breadcrumbs, mobile sticky queue CTA and five factual FAQs.
- Organization structured data and factual FAQ/breadcrumb data. LocalBusiness is emitted only when the operator configures an actual public address.
- Real inquiry persistence with server validation, idempotent retry, five requests per network source per hour, restricted service-only RPC and private RLS-enabled records. The form displays pending/error state and redirects only after a successful write. No email delivery claim.
- Privacy policy reflecting current authentication, operational data, payments, device signals and inquiry processing.
- Optional consented Google Analytics on public pages only, isolated in a sandboxed iframe with storage and advertising denied. A sanitized public path is the only page location supplied; iframe isolation prevents an analytics script surviving into a private SPA route. Enhanced user/session tracking is deliberately unavailable; confirm aggregate page-view collection in GA DebugView before enabling for production.

## Operator configuration

Set verified values on the server:

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Existing canonical custom domain. Preserve old queue links if changing domains. |
| `SITE_CONTACT_EMAIL` | Public contact email; clickable mail link. |
| `SITE_CONTACT_PHONE` | Real international phone; clickable phone link. |
| `SITE_PUBLIC_ADDRESS` | Actual public address; enables map, directions and LocalBusiness schema. |
| `SITE_RESPONSE_PROMISE` | A response commitment the real team has agreed to meet. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Real `G-…` measurement ID; absent means no analytics request or banner. |

The form uses the existing service-role configuration and `QUEUE_JOIN_SECRET` on the server. Its migration is `20261004064440_public_site_inquiries.sql`. New inquiries are available to the database operator through protected administrative access, not any public endpoint; no inbox UI or email delivery was added. The operator must assign someone to review inquiries and define a retention/deletion schedule before advertising a response commitment. Non-Vercel hosts use one conservative shared rate-limit bucket until a trusted proxy integration is configured.

## Real content still required

No customer reviews, performance results, team photos, address, telephone number or response-time guarantee was invented. The homepage includes a case-study participation invitation rather than a fabricated success story. Publish named reviews and measured case studies only with permission and source evidence. Supply a genuine team photograph and descriptive alt text before adding a team section. Existing place photographs describe settings and are not represented as the team or customers.

A custom production domain already exists at `queuezero.conchportal.com`. Renaming the product does not establish ownership or DNS for a new TuRnMaRk domain. Domain changes remain deployment configuration work.

## Verification

Focused Vitest: 9 assertions passed (metadata, search scope, safe JSON-LD, validation, persistence errors, rate limits and success redirect).
Focused PostgreSQL/pgTAP: 9 assertions passed against the new migration (permissions, persistence, exact retry, mismatched retry, rate limit).
Focused ESLint passed.
Added browser checks for 360px/768px public pages, one H1, distinct titles, descriptions/canonical, image alt attributes, navigation, overflow, FAQ, 404 and search/share assets. Root integration owns execution against its coordinated preview and full build.

## Remaining checks

Real custom-domain/DNS verification, GA delivery verification with the owner's actual ID, contact operations and legal-policy review remain operator work. The user must supply real review/team/address content. Source maps should be disabled in production build configuration and bundle output measured after the integrated production build. Public inquiry data is intentionally not tenant data: it belongs to the site operator and is never exposed to organization staff.
