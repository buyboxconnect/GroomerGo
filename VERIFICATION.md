# GroomerGo web verification — October 9, 2026

Live site: https://groomer-go-fdf56660.base44.app

## Functional checks

Production Vite build passed. Five focused Node tests passed for adjacent/overlapping appointments, working hours/lunch/cancellation, Eastern dates and daylight-saving boundaries, future weekdays, and booking creation with availability rechecks and service snapshots. Production dependency audit reported zero advisories.

Browser verification used Codex's in-app browser through the CUA API. The client flow was exercised from service selection through sample time, fictional pet/client details, review, demo acknowledgment and confirmation. The new sample appeared in the dashboard. It was inspected, rescheduled from Monday at 9 AM to Tuesday at 1 PM, and cancelled after confirmation. Client search filtered to Luna. Service switching updated duration, price, deposit and prep copy. Buttons and dialogs use semantic HTML and native dialog focus trapping.

The pilot-interest form successfully wrote a synthetic record through the actual Base44 SDK. An anonymous SDK list returned zero records while that record existed. The project-owner CLI session reported role=admin and could read the entity. The exact synthetic test record was deleted afterward; remaining synthetic record count was zero. No emails, texts or payments were sent. Update/delete permissions are configured admin-only; this is a focused verification, not a comprehensive authorization audit.

Hosted page loading, marketing copy, pricing navigation and the booking entry point were checked after deployment.

## Responsive verification

The browser's viewport override did not reliably change its rendered dimensions. No alternative computer-control framework was used. A temporary local verification page embedded the app in same-origin frames with fixed layout dimensions. The frames were measured through the documented browser DOM APIs. The temporary page is removed and is not part of the deployed bundle.

- Desktop reference layout: 1505 pixels wide, scrollWidth=1505.
- Mobile landing and booking: 393 pixels wide, scrollWidth=393.
- Small-screen landing, booking and dashboard: 320 pixels wide, scrollWidth=320 after repair.
- Screenshots were captured with the in-app browser screenshot API. Desktop comparison captures show the native-size iframe scaled into the available browser panel; the screenshot itself is not a 1505x1045 export. Mobile captures show the fixed-size frame, and can be clipped by the browser panel height.

Fixed mobile header wrapping, headline wrapping, and an intrinsic grid width that had expanded the dashboard to 489 pixels on a 320-pixel screen. The navigation now scrolls within its own row.

## Design fidelity ledger

Concepts were generated with the built-in image tool and inspected with view_image. The latest landing, pricing, booking and dashboard captures were also inspected with view_image, alongside their reference concepts. The implementation was faithfully checked against the reference design system with the explicit corrections below; exact raster/pixel identity is not claimed.

| Comparison | Concept evidence | Render evidence / action |
|---|---|---|
| Copy and hierarchy | landing-concept.png: three-line headline, two demo actions, plain preview disclosure | Same headline, navigation and actions; no invented hero eyebrow. Smaller breakpoints received reduced type size so words do not create accidental extra lines. |
| Palette | Cream canvas, teal text/actions, sage band, peach circle, white panels | Same token palette throughout; no photo tints or gradients added. |
| Typography | Serif editorial headings and wordmark; sans-serif booking controls | Georgia headings and Arial/system controls. Dashboard body intentionally uses sans-serif as requested in the prompt rather than the generated image's excess serif styling. |
| Containers and spacing | Open two-column hero, one agenda panel, numbered journey, one price panel | Preserved section order and container families; responsive stacking replaces columns on small screens. |
| Booking anatomy | booking-concept.png: three service rows, native radio-style selection, visit summary, prep section | Same labels, service values and selected sage row; duration, deposit and preparation update together. Four functional stages extend the component system. |
| Dashboard anatomy | dashboard-concept.png: left navigation, date controls, three appointment rows, journey callout | Same structure and sample records. Current business-local date is computed. Sample status actions and details extend the flow. |
| Icons and assets | Outline paw, scissors, droplet, calendar, arrows, pastel initial circles | Lucide outline SVGs and CSS circles. Generated paw silhouette is intentionally represented by the existing Lucide icon; no raster screenshot is shipped as interactive UI. |
| Pricing and FAQ | pricing-concept.png: proposed $19.99 monthly plan, pilot action, three FAQ disclosures, privacy footer | Same pricing/FAQ story; no live subscription checkout is implied. Pilot form writes actual interest records. |

Above-the-fold copy check: all headline, navigation, CTA, sample labels and disclosure strings match the allowed list in design/README.md. Dates are dynamic. The generated journey line claiming “real availability” was intentionally replaced with demo-specific wording. No unreviewed first-viewport copy additions remain.

Visual evidence and reference files live in design/. The final live screenshot is design/verification/site-live.jpg. Temporary preview hosts and one-off data-check scripts were removed.

## Practical limits

Booking and dashboard data live in React memory, not shared storage. Reloading resets the demo. Live authentication, concurrent reservation protection, Stripe Connect, payment webhooks, SMS/APNs, business isolation and iPhone sync are not implemented. The pilot form's frontend honeypot is not server-side rate limiting; add abuse controls and a dedicated contact/deletion process before broad acquisition campaigns.

The current Base44 CLI's development-only dependency tree reports five advisories (four high, one low). Compatible audit fixes did not clear them, and a forced downgrade was not applied. These are absent from the production dependency audit. The static frontend build and deployed app were verified; no claim of complete production readiness is made.


## GitHub migration — October 10, 2026

Merged the existing mobile-auth draft routes with the original live website. Downloaded the two deployed backend functions, BusinessSnapshot schema, and auth settings before linking. Build and five booking tests pass. Local homepage and unauthenticated callback routing checked in the browser. This does not verify Google login or iOS token handling.

Dependency audit reports inherited Tailwind 3 build-tool and React Router 6 advisories, plus Base44 CLI advisories. No forced major upgrades were applied during migration.
