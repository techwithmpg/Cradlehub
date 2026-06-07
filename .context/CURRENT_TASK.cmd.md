Task ID: PUBLIC-MOBILE-HOME-WARM-RITUALS-001
Description: Warm the public mobile homepage hero overlay and redesign only the mobile Signature Ritual cards to use the current cinematic CTA-card image style
Agent: Codex
Status: COMPLETE

Scope:
- Public mobile homepage visual refinements only.
- Warmth/color/overlay treatment for the mobile hero.
- Signature Ritual mobile card presentation, text safe zones, overlays, and scoped object-position values.
- Required context updates after verification.

Do not change:
- Hero copy, hero layout structure, hero button labels, hero button hrefs/actions.
- Ritual names, descriptions, prices, booking hrefs, or image paths.
- Choose Your Calm cards/images.
- Public services, branch, contact, about pages.
- Booking logic, service logic, Supabase/database logic, server actions, API routes, protected workspaces, CRM/admin/staff/driver portals, authentication/RBAC, or booking wizard behavior.

Verification required:
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`
- Mobile public homepage visual check for hero warmth and Signature Ritual subject visibility.
- Desktop homepage smoke check to ensure it is not broken.

Git:
- Stage only relevant homepage visual files, required `.context/` updates, and supporting image assets needed by the current homepage state.
- Commit: `style(public): warm hero and refine signature ritual cards`
- Push current branch without force-pushing.

Completed changes:
- Warmed only the public mobile homepage hero with a subtle amber image veil, warmer layered gradients, warmer dark secondary CTA styling, and no-wrap CTA labels. Hero copy, layout, carousel image logic, button labels, and button hrefs were preserved.
- Redesigned only the public mobile Signature Ritual cards into cinematic full-image cards with side-specific dark gradients, lighter subject areas, top-left best-for pills, price chips near the text, title/copy/duration stacks, and gold `Book Ritual` pills linking to `/book`.
- Preserved ritual copy, names, resolved prices/durations, booking links, and image paths.
- Final ritual image paths and object positions:
  - Glow Ritual: `/images/spa/home/ritual-glow.jpg`, `object-[center_42%]`
  - Recovery Ritual: `/images/spa/home/ritual-recovery.jpg`, `object-[center_35%]`
  - Full Reset Ritual: `/images/spa/home/ritual-full-reset.jpg`, `object-[center_55%]`

Verification complete:
- `pnpm type-check`: PASS
- `pnpm lint`: PASS with 0 errors and 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- Local `/` HTTP check: PASS, status 200
- Mobile browser visual check at 390x844: hero warm/readable; Signature Ritual images visible; cards use no large dark glass content panel; `Book Ritual` links resolve to `/book`.
- Desktop homepage browser smoke check at 1280x900: PASS, hero/nav/CTA render intact.
