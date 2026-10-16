# TuRnMaRk asset audit — Stage 1

Source: `turnmark_separate_assets.zip` supplied on 2026-10-16.

This audit is intentionally limited to inspection, classification and safe asset organization. No application screen, authentication flow, queue behavior, attendance behavior, payment logic or database code was changed.

## Inspection result

- 40 PNG files were present and readable.
- Every file is an RGBA PNG with transparency.
- Dimensions range from 88×131 to 280×62 pixels.
- 20 assets passed visual review and were copied byte-for-byte into `public/assets/turnmark/`.
- 20 assets remain on hold because the extraction includes neighboring fragments, cropped artwork, rough edge remnants, illegible generated text or decorative fake QR content.
- No source image was overwritten, resampled, stretched or recompressed.

The approved allowlist is defined in `lib/brand/assets.ts`. Application code should use that manifest instead of adding asset paths ad hoc.

## Approved assets

| Category | Assets | Usage constraint |
| --- | --- | --- |
| Branding | `brand_symbol.png`, `brand_wordmark.png` | Official brand artwork. Preserve aspect ratio and transparent background. |
| Characters | `student_character.png` | Decorative education/persona artwork; not a user avatar. |
| Industries | `government_building.png`, `hospital_building.png`, `school_building.png` | Decorative industry cards and empty states. |
| Illustrations | `calendar_3d.png`, `clock_3d.png`, `success_badge.png`, `waiting_chairs.png` | Decorative status/empty-state imagery. Continue to express status semantically in text. |
| Icons | `analytics_icon_card.png`, `appointment_icon_card.png`, `attendance_icon_card.png`, `bank_icon_card.png`, `business_icon_card.png`, `government_icon_card.png`, `hospital_icon_card.png`, `queue_icon_card.png`, `reports_icon_card.png`, `school_icon_card.png` | Illustration cards only. Use Lucide/CSS icons for controls, navigation and accessible status indicators. |

There are currently no approved assets in `devices/` or `decorations/`. Those directories should remain unused until clean sources are supplied or cleanup is separately approved.

## Held assets

| Asset | Finding | Decision |
| --- | --- | --- |
| `bank_building.png` | Detached tree fragment on the right edge. | Hold. |
| `company_building.png` | Detached tree/building fragment on the right edge. | Hold. |
| `banker_character.png` | Neighboring character fragments at the right edge. | Hold. |
| `doctor_character.png` | Neighboring tablet/body fragments at both edges. | Hold. |
| `nurse_character.png` | Neighboring hand and body fragments at both edges. | Hold. |
| `worker_character.png` | Neighboring body and decoration fragments at both edges. | Hold. |
| `chat_bubbles.png` | Neighboring people illustration at the right edge. | Hold. |
| `people_group.png` | Cropped neighboring artwork and excessive empty canvas. | Hold. |
| `notification_bell.png` | Neighboring colored fragments on both edges. | Hold. |
| `location_pin.png` | Neighboring colored fragments on both edges. | Hold. |
| `plant.png` | Neighboring device/art fragments on both edges. | Hold. |
| `queue_display.png` | Detached orange fragment at the left edge. | Hold. |
| `station_kiosk.png` | Detached chair fragment at the right edge. | Hold. |
| `phone_logo.png` | Phone body is cropped tightly at the right edge. | Hold. |
| `phone_qr.png` | Neighboring fragments and a nonfunctional decorative QR. | Hold; never use as a functional QR. |
| `ticket_printer.png` | Generated text defects, rough transparency and a nonfunctional decorative QR. | Hold; never use as a ticket or functional QR. |
| `gradient_arrow.png` | Neighboring decoration fragments at the right edge. | Hold. |
| `gradient_blob_coral.png` | Adjacent decoration fragments on multiple edges. | Hold. |
| `gradient_blob_orange_purple.png` | Adjacent decoration fragments on multiple edges. | Hold. |
| `gradient_blob_purple.png` | Adjacent decoration fragments and clipped shape. | Hold. |

Held files remain only in the supplied source archive and were not copied into the public application tree.

## Future integration map

| Product surface | Approved candidates | Notes for its implementation stage |
| --- | --- | --- |
| Shared navigation and footer | Brand symbol and wordmark | Replace the current temporary SVG mark only after responsive logo sizing and contrast checks. |
| Landing page | Brand artwork, industry buildings, student, feature icon cards, waiting chairs | Do not invent statistics, reviews or unsupported product capability. |
| Authentication and onboarding | Brand artwork, student, industry icon cards | Preserve Clerk and the verified conditional onboarding flow. Held professional characters must not be used. |
| Lecturer and education dashboards | Student, school building, attendance/reports icons | Metrics remain database-backed. |
| Healthcare and government dashboards | Hospital/government buildings and icons | Use only as welcome/empty-state decoration. |
| Queue management | Queue icon and waiting chairs | Existing generated QR and ticket components remain authoritative. |
| Attendance | Student, school building, attendance icon | Existing class-session QR remains authoritative. |
| Appointments | Calendar and appointment icon | Show only where current backend support exists. |
| Reports and billing | Reports/analytics icon cards | No changes to Paystack or entitlement logic. |
| Loading and completion states | Clock and success badge | Preserve accessible status text and reduced-motion behavior. |

## Quality follow-up

The held assets should be replaced from their original layered/vector source where possible. Automated generative reconstruction is not suitable for the official logo, functional QR imagery, tickets or text-bearing UI because it could alter brand geometry or create misleading data.
