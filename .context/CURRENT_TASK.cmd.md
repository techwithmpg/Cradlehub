# CURRENT TASK: PUBLIC-MOBILE-RESET-001 — Approved Mobile Public UI Reset

## Overview
Implement the approved mobile-only public website layout for Cradle Massage & Wellness Spa using:

`docs/design-references/cradle-mobile-public-ui-reference.png`

## Scope
- Public mobile pages only:
  - `/`
  - `/services`
  - `/book`
  - `/branches`
  - `/about`
  - `/contact`
- Preserve existing desktop layouts at `md` and above.
- Preserve booking, CRM, auth, routing, database, Supabase, and dashboard logic.

## Implementation Plan
1. Create mobile-only public components for the approved header, bottom nav, section/card patterns, home, services, branches, about, and contact.
2. Render mobile components with `md:hidden`.
3. Keep existing desktop components wrapped with `hidden md:block` where needed.
4. Adjust the booking wizard presentation only on mobile while preserving all existing state, API calls, validation, and submit actions.
5. Verify mobile route rendering and desktop stability.

## Progress
- [x] Read required `.context` and docs files.
- [x] Inspected approved mobile reference image.
- [x] Audited current public page structure and mobile split points.
- [x] Reported pre-edit public page/mobile component audit.
- [ ] Implement mobile-only public UI reset and polish existing reset scaffold.
- [ ] Run lint, type-check, build.
- [ ] Update changelog/handoff/errors/roadmap.

## Route-by-Route Implementation Plan
- `/` → keep existing desktop `HomePageSections`; refine `PublicMobileHome` to match screen 01 with dark image hero, two CTAs, experience cards, trust strip, and branded gallery teaser copy.
- `/services` → keep desktop catalog; refine `PublicMobileServices` for screen 02 with image hero, category chips, compact real-data rows, correct public booking/inquiry rules, and show-more behavior.
- `/book` → preserve `BookingWizard` state/API/server-action behavior; only adjust public mobile container, progress indicator, branch-card visuals, and bottom action spacing to match screen 03.
- `/branches` → keep desktop branch page; refine `PublicMobileBranches` for screen 04 using real branch rows and safe neutral availability copy.
- `/about` → keep desktop about page; refine `PublicMobileAbout` for screen 05 with image hero, story card, value icons, and dark CTA.
- `/contact` → keep desktop contact page; wire `PublicMobileContact` to real branch rows and available contact methods for screen 06.

## Guardrails
- Do not touch booking logic.
- Do not touch CRM logic.
- Do not touch auth/routing.
- Do not touch database/migrations.
- Do not touch dashboard/workspace pages.
- Do not redesign desktop.
