## HANDOFF - AUTH-RESET-SUPABASE-CONNECTION-001: COMPLETE

## Status

Build verified. 100 routes. The password-reset flow now builds Supabase recovery links from the trusted public app URL and lands users on `/reset-password` before returning them to login after the update.

## What changed

- Added `NEXT_PUBLIC_APP_URL` reset-link helpers in `src/lib/auth/auth-redirects.ts`, including development `http://localhost:3000` fallback and production rejection of localhost app URLs.
- Updated self-service `/forgot-password` and Owner staff recovery to call `resetPasswordForEmail()` with `${NEXT_PUBLIC_APP_URL}/reset-password`.
- Updated `/reset-password` to forward `code` or `token_hash&type=recovery` params through `/auth/callback?next=/reset-password`, so the route handler performs the Supabase exchange and sets the recovery-session marker cookie.
- Updated `/auth/callback` to handle PKCE `code` and recovery `token_hash` callbacks, sanitize `next`, and mark password recovery sessions without routing into a workspace.
- Added shared password policy validation and reset form states for checking, invalid/expired links, success redirect, and password requirements.
- Split `/login` into a server page plus client form so `/login?passwordUpdated=true` can show the post-reset success banner.
- Login failure copy now says the email/password may be incorrect and points users to reset their password.
- Added `.next*.log` to `.gitignore` so local Next dev logs stay out of commits.

## Supabase Dashboard/Env

- Production env: `NEXT_PUBLIC_APP_URL=https://cradlewellnessliving.com` or the real deployed CradleHub origin.
- Supabase Auth Site URL: `https://cradlewellnessliving.com`.
- Supabase Auth Redirect URLs should include `http://localhost:3000/reset-password` and `https://cradlewellnessliving.com/reset-password`.
- If the project uses a Vercel preview/production domain, replace any `https://your-project.vercel.app/reset-password` placeholder with the real deployment URL.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, 0 errors, 4 existing warnings
- `pnpm test`: PASS, 49 files / 513 tests
- `pnpm build`: PASS, 100 routes
- Focused auth reset tests: PASS
- Unsafe scans: no `your-project.vercel.app` reset URL, no `localhost:3000/reset-password` in `src`, no password console logging, no password local/session storage. Service-role scan only finds the expected server-only `src/lib/supabase/admin.ts`.

## Manual QA

- Use a real Supabase recovery email locally and in production after dashboard configuration is saved.
- On `/login`, the reset affordance is `Forgot password?` beside the Password label.

---

## HANDOFF - CRM-INDIVIDUAL-SCHEDULE-LIVE-SYNC-001: COMPLETE

## Status

Build verified. CRM individual staff schedule saves now confirm database rows before success, and Live Staff reads one resolved effective schedule source instead of combining stale/partial sources.

## What changed

- Added shared schedule resolver in `src/lib/schedule/resolve-staff-schedule.ts`.
- Added `getResolvedStaffSchedulesForDate()` to load `staff_schedules`, `schedule_overrides`, and staff group rules into that resolver.
- Updated `getDailySchedule()` to expose `schedule_source`, `schedule_is_day_off`, and exact `schedule_windows`, with `work_start/work_end` derived from the same resolved windows.
- Updated Live Staff availability to use resolved windows instead of a separate raw active `staff_schedules` query.
- Updated booking availability post-filter to use the same resolver, including inactive individual rows as individual day off.
- Updated both individual weekly save actions to upsert on `staff_id,day_of_week,shift_type`, chain `.select(...)`, verify returned row count, log technical context server-side, and show safe UI errors.
- Standardized success copy to `Schedule updated successfully.`
- Removed short-lived stale caching from `/api/crm/availability` and the `/crm/schedule` Live Availability SWR fetch.
- Updated the Live Staff Staff List shift cell to show every resolved shift window.

## Resolver Priority

1. Date-specific day-off override
2. Date-specific custom schedule override
3. Individual weekly schedule, including inactive individual rows as individual day off
4. Staff-group schedule fallback
5. No valid schedule -> unscheduled

## Database/RLS

- Table written: `staff_schedules`
- Verified conflict key: `staff_id, day_of_week, shift_type`
- Existing table grants and branch-scoped RLS policies allow CRM/CSR operational roles to SELECT/INSERT/UPDATE `staff_schedules`.
- No new RLS migration was added because this task does not require `staff_schedules` DELETE.

## Verification

- `pnpm type-check`: PASS
- `pnpm test`: PASS, 43 files / 493 tests
- `pnpm lint`: PASS, with existing warnings only
- `pnpm build`: PASS, 100 routes
- Requested swallowed-error scan: only existing notification audio empty catches, no schedule-related matches

## Remaining Manual QA

- Use a real CRM-authorized session to save an individual schedule from `/crm/staff-availability` and `/crm/schedule`, confirm the success message, modal close timing, immediate Live Staff row update, refresh persistence, date/day-off override priority, multi-shift display, branch filtering, and public booking availability.

---

## 2026-06-07 - Public Mobile Homepage Warm Hero + Signature Ritual Cards

Status: COMPLETE. The public mobile homepage hero was warmed with an amber image veil, warmer layered overlays, warmer CTA tones, and no-wrap CTA labels while preserving hero copy, layout, carousel image logic, labels, and links.

Signature Ritual mobile cards now use full-background images with side-specific darker gradients behind text, lighter subject areas, top-left label pills, nearby price chips, preserved title/copy/duration, and gold `Book Ritual` buttons linking to `/book`. The large dark glass content panel was removed.

Final ritual image paths/object positions:
- Glow Ritual: `/images/spa/home/ritual-glow.jpg`, `object-[center_42%]`
- Recovery Ritual: `/images/spa/home/ritual-recovery.jpg`, `object-[center_35%]`
- Full Reset Ritual: `/images/spa/home/ritual-full-reset.jpg`, `object-[center_55%]`

Verification: `pnpm type-check` PASS; `pnpm lint` PASS with 0 errors and 2 existing warnings in `scripts/generate-service-image-assets.mjs`; `pnpm build` PASS, 98 routes; `git diff --check` PASS with LF/CRLF notices only; `/` HTTP 200; mobile browser visual check at 390x844 PASS; desktop homepage smoke check at 1280x900 PASS.

Scope guard: no booking/service/backend/Supabase/server action/API/protected portal/auth/RBAC/booking wizard/public services/about/contact/branches changes were made for this task. There are still unrelated pre-existing modified/untracked files in the worktree from other tasks; stage only this task's files and required ritual images.

---

# HANDOFF - PUBLIC-PAGES-DARK-THEME-001 Public Pages Dark Theme: COMPLETE

## Status

Build verified. 98 routes. Public `/services`, `/contact`, `/about`, and `/branches` now use the dark warm Cradle visual system across the requested mobile page components, desktop public sections, shared service catalog, and shared public header.

## What changed

- Converted `src/components/public/mobile/public-mobile-services.tsx`, `public-mobile-contact.tsx`, `public-mobile-about.tsx`, and `public-mobile-branches.tsx` from cream/light surfaces to deep-green gradients, muted gold borders/actions, cream text, and dark glass cards.
- Converted `src/components/public/service-catalog-client.tsx` empty state, page background, browse rail, category headers, service rows, badges, CTA links, show-more button, and bottom help panel to the dark Cradle palette.
- Converted desktop public sections in `src/app/(public)/services/page.tsx`, `contact/page.tsx`, `about/page.tsx`, and `branches/page.tsx` away from pale section bands and white cards.
- Updated `src/components/public/site-header.tsx` so desktop scrolled state remains dark glass instead of switching to a cream header.
- Adjusted mobile Contact and Branches long branch/address layouts to wrap within the viewport and avoid clipped action labels.

## Preserved

- Booking logic, service logic, branch queries, Supabase/database behavior, server actions, API routes, protected workspaces, CRM/admin/staff/driver portals, auth/RBAC, middleware, and backend behavior were not changed.
- Unrelated public homepage and SEO landing-page sections were left out of scope even though broad scans show they still contain intentional light marketing surfaces.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- Scoped source scan: PASS, no `bg-white`, `bg-[#FCFAF5]`, `bg-[#F7F3EB]`, `bg-[#FBF6EC]`, matching cream inline background, or `hover:bg-white` in the requested route/component set.
- Temporary production route checks on `http://localhost:3011`: `/services`, `/contact`, `/about`, and `/branches` all returned HTTP 200.
- Final headless Chrome screenshots captured at `.tmp/public-dark-screens-prod/` for mobile 390x844 and desktop 1440x1100.
- Visual spot-check confirmed dark desktop services catalog and mobile branches card/action layout.

## Notes

- Tool discovery did not expose the in-app browser controller in this turn, so local headless Chrome was used for visual QA.
- A pre-existing Next dev server was already running on port 3000; a temporary production server was started on port 3011 from the fresh build for final verification and then stopped.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were absent; docs equivalents and `.context/*` were read and updated where applicable.

---

# HANDOFF - PUBLIC-BOOKING-MOBILE-VIEWPORT-001 Public Booking Mobile Viewport Wizard: COMPLETE

## Status

Build verified. 98 routes. Public mobile `/book` now behaves like a viewport-fitted booking app shell with compact header/progress, internally scrollable active step content, fixed bottom actions, and a mobile Date & Time bottom sheet for available slots.

## What changed

- Updated `src/components/public/booking-wizard.tsx` public mobile shell to use `h-[100dvh] min-h-[100dvh] overflow-hidden` with `min-h-0 flex-1 overflow-hidden` content containment.
- Moved active step content into an internal `overflow-y-auto overscroll-contain` pane with bottom padding for the fixed action bar.
- Compact mobile header/progress spacing and reduced mobile Branch, Visit Type, Location, Date & Time, and Details vertical rhythm.
- Added `MobileTimeBottomSheet`, `TimeSlotsGrid`, `TimeSlotButton`, and `SelectedDateTimeCard` UI-only helpers.
- Mobile Date & Time now opens the bottom sheet immediately after date selection; time selection uses the existing `onSelectSlot` callback and closes the sheet.
- Desktop Date & Time keeps its existing calendar/time-grid layout.
- Updated `src/components/public/booking-service-picker.tsx` so mobile categories/summary stay compact and the service grid can scroll internally in constrained parents.
- Added `public-site-footer` to `SiteFooter` and mobile-only CSS in `globals.css` to hide the public footer only when `.public-booking-surface` is present, preventing footer-driven body scroll on `/book`.

## Preserved

- Booking step order, branch selection, visit type selection/filtering, service selection, date state, slot fetching, selected slot state, dispatch filtering, therapist selection, validation, submit payloads, server actions, API routes, Supabase/database logic, CRM/admin/staff/driver/protected workspaces, auth/RBAC, and desktop booking layout behavior.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- `GET http://localhost:3000/book`: PASS, status 200
- Headless Chrome mobile screenshots captured at `.tmp/book-mobile.png` and `.tmp/book-mobile-loaded.png`
- Targeted source scan found no new TypeScript `any`, `@ts-ignore`, or console logs in touched booking files.

## Notes

- Browser tool discovery did not expose the in-app browser controller in this turn; local headless Chrome was used for mobile screenshots instead.
- Full manual mobile click-through of the Date & Time bottom sheet still needs a normal browser session and responsive available-slot API data.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were absent; docs equivalents and `.context/*` were read and updated where applicable.
- Existing uncommitted `.claude/settings.local.json` change was present before this task and was not touched.

---

# HANDOFF - PUBLIC-MOBILE-LOADING-TRANSITIONS-001 Public Mobile Intro and Route Loading: COMPLETE

## Status

Build verified. 98 routes. Public mobile loading now has one short homepage intro and one warm-gold route-loading line for top-level public navigation.

## What changed

- Added `src/components/public/public-route-loading-line.tsx`, a root-mounted client component that listens only while the current path is one of `/`, `/services`, `/book`, `/branches`, `/about`, or `/contact`.
- Added `src/components/public/public-loading-events.ts` so the homepage intro can tell the route line when the intro is active.
- Updated `src/components/public/mobile/cradle-breath-reveal.tsx` to use `sessionStorage` key `cradle_public_intro_seen`, play for 1.2 seconds, dispatch intro active/inactive events, and keep reduced-motion/desktop/session-seen skips.
- Mounted `PublicRouteLoadingLine` in `src/app/layout.tsx` so it survives navigation between root `/` and `(public)` route-group pages.
- Replaced root `src/app/loading.tsx` with a non-branded dark mobile paint guard so the old full-screen Cradle loading bridge no longer appears before the homepage intro and mobile does not flash light/white.
- Added `src/app/(public)/loading.tsx` as a simple thin warm-gold top-line fallback for public segment streaming.
- Added CSS keyframes/classes in `src/app/globals.css` for the public route line and shortened intro timing.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- Local public route smoke checks on the existing `http://localhost:3000` server: `/`, `/services`, `/book`, `/branches`, `/about`, and `/contact` all returned HTTP 200.
- Targeted source scan found no new `any`, `@ts-ignore`, console logs, old `cradle_mobile_home_reveal_seen` key, or old `Loading Cradle Wellness Living` shell text in touched loading/intro files.

## Notes

- Booking wizard step logic, booking routes/data, APIs, Supabase/database logic, server actions, protected workspaces, CRM/admin/staff/driver portals, auth/RBAC, and middleware were not changed.
- The route line intentionally ignores non-top-level booking subroutes such as `/book/[branchId]`, hash links, `tel:`, `mailto:`, external links, modified clicks, same-route links, and clicks while the intro is active.
- Tool discovery did not expose the in-app browser controller in this turn, so visual QA should still be run manually on mobile viewport.

---

# HANDOFF - PUBLIC-MOBILE-HOME-DARK-SECTIONS-001 Mobile Dark Cinematic Homepage Sections: COMPLETE

## Status

Build verified. 98 routes. The public mobile homepage sections after the hero now follow the approved dark, premium, cinematic spa direction while preserving booking/data/portal behavior.

## What changed

- Removed `MobileExperienceGrid` and `MobileInsideCradleSection` from the mobile homepage render path to match the requested section rhythm.
- Converted `MobileCalmCategories` from horizontal cream cards into stacked full-image service category cards with dark overlays, muted gold labels, warm cream text, and circular gold-outline arrows.
- Converted `MobileMostLovedTreatments` from cream catalog tiles into horizontal image-dominant dark cards with gradient overlays, gold metadata, and compact circular booking actions.
- Converted `MobileSignatureRituals` from split image/cream-body cards into full-image ritual panels with bottom dark glass content, gold price pills, and glass/gold `Book Ritual` buttons.
- Converted `MobileGuestImpressions` to dark translucent glass testimonial cards with gold stars and carousel dots.
- Converted `MobileBranchesSection` to image-led branch cards with dark glass address/action panels and integrated Call/Directions buttons.
- Updated the mobile FAQ section to the requested `FREQUENTLY ASKED` / `Questions` treatment using a new dark variant on `FaqAccordion`.
- Tightened `MobileFinalCta` to a single cinematic image CTA with `Book your pause today.` and `Book Now`.
- Updated the actual desktop homepage hero `CoverImage` sizes from `100vw` to `(max-width: 767px) 0px, 100vw` so the desktop-only hidden tree does not advertise full mobile viewport width for `/images/spa/hero.jpg`.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- `GET http://localhost:3000/`: PASS, status 200; rendered HTML includes `Choose Your Calm`, `Most-Loved Treatments`, `What Our Guests`, and `Your calm is waiting`.
- Targeted source scan found no `bg-white`, `bg-[#F3E9D2]`, `bg-[#FFF8E9]`, or `#FFFFFF` card backgrounds in the touched mobile homepage section files.

## Notes

- Booking logic/routes, Supabase/database logic, server actions, CRM/admin/staff/driver portals, auth/RBAC, and public booking flow behavior were not changed.
- Images remain existing project assets and service/branch data images; no generated or stock images were added.
- Headless Chrome screenshot capture was blocked: sandboxed Chrome failed with access denied, and the escalated browser run was declined. Non-browser smoke verification was completed instead.

---

# HANDOFF - PUBLIC-MOBILE-HOME-REVEAL-FIX-001 Mobile Loading and Hero Overlay Refinement: COMPLETE

## Status

Build verified. 98 routes. The public mobile homepage now uses a branded Cradle loading bridge before the reveal, preloads only the first mobile hero image, and renders the hero photo with a lighter targeted overlay.

## What changed

- Replaced the root `src/app/loading.tsx` generic gray skeleton with a deep-green Cradle fallback.
- Kept dashboard/staff/driver/CRM loading skeletons intact; those deeper route loading files still override the root fallback.
- Updated `CradleBreathReveal` so it starts in a client-side checking state and only renders the reveal when it should actually play.
- Switched first hero image loading from deprecated `priority` to Next 16 `preload` on only `hero-mobile.jpg`.
- Left `hero-wide.jpg` and `hero-ambience.jpg` as normal non-preloaded secondary slides.
- Replaced the heavy full-screen overlay with targeted gradients:
  - top vignette `rgba(6,25,18,0.42) -> 0.18 -> 0`
  - bottom gradient max `rgba(4,17,12,0.78)`
  - text-area vignette `rgba(6,25,18,0.44) -> 0.16 -> 0`
  - warm glow max `rgba(200,169,106,0.16)`
- Added text shadow to the hero copy to maintain readability without washing out the image.
- Left homepage sections below the hero and all booking/CRM/admin/staff/driver logic unchanged.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- Headless Chrome mobile reveal screenshot captured at `.tmp/home-mobile-reveal-after-fix.png`.
- Headless Chrome mobile post-reveal hero screenshot captured at `.tmp/home-mobile-after-fix.png`.
- Rendered stream includes `Loading Cradle Wellness Living` branded fallback markup instead of the old skeleton blocks.

## Notes

- The existing local Next dev server was already running on `http://localhost:3000`; the attempted second server on port 3001 correctly refused because Next detected the existing process.
- Tool discovery did not expose an in-app browser screenshot tool in this turn, so visual verification used local headless Chrome.

---

# HANDOFF - PUBLIC-MOBILE-HOME-REVEAL-001 Cradle Breath Reveal and Mobile Hero: COMPLETE

## Status

Build verified. 98 routes. The public mobile homepage now opens with a calm Cradle Breath Reveal and transitions into a premium real-photo hero using the requested Cradle assets.

## What changed

- Added `CradleBreathReveal` for a once-per-session mobile-only homepage reveal.
- Rebuilt the mobile homepage hero as a stable-copy, CSS-driven slow crossfade with gentle Ken Burns image movement.
- Added Manrope through `next/font/google` and used the Cormorant/Manrope pairing only in the public spa presentation layer.
- Added optimized real Cradle hero images at:
  - `public/images/spa/hero-mobile.jpg`
  - `public/images/spa/hero-wide.jpg`
  - `public/images/spa/hero-ambience.jpg`
  - `public/images/spa/hero-supporting-massage.jpg`
- Extended `SPA_IMAGES` with the new hero asset paths.
- Mounted the reveal only from the mobile public homepage path.
- Left booking logic, Supabase logic, database schema, server actions, authentication, RBAC, CRM/admin/staff/driver portals, route behavior, and homepage sections below the hero unchanged.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- Headless Chrome mobile screenshots captured at 390x844 for reveal dissolve, post-reveal hero, and a later room/trust slide on `http://localhost:3001`.
- HTTP smoke check confirmed the homepage rendered the new hero copy and image paths.
- Targeted scan found no `any`, `@ts-ignore`, or console logs in the touched reveal/hero/font/image files.

## Notes

- Old desktop/lower-section public images remain outside this scope because this task explicitly did not redesign the desktop homepage or sections below the mobile hero.
- The dev server emitted existing Next/Image `sizes` warnings for older unchanged `hero.jpg` and `cta-banner.jpg` usage in non-hero/lower-section surfaces.

---

# HANDOFF - BOOKING-THERAPIST-DROPDOWN-001 Public Booking Therapist Dropdown: COMPLETE

## Status

Build verified. 98 routes. The public booking Select therapist step now uses a compact dropdown-only provider picker while preserving the existing booking state and submission logic.

## What changed

- Added focused therapist picker components under `src/components/features/booking/therapist-picker/`.
- Replaced the large therapist card grid in `src/components/public/booking-wizard.tsx` with a dropdown-only picker.
- Kept `Any available provider` as the recommended default using the existing `"auto"` convention.
- Specific therapist selections still submit through the existing staff id path.
- Clear resets back to `Any available provider`.
- Booking summary now updates dynamically for both Any available provider and specific therapist selections.
- No booking backend logic, status rules, API contracts, tables, or fake provider data were changed.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- `/book` route smoke check returned HTTP 200 on the local dev server.
- Targeted scans found no TypeScript `any` in the touched picker/wizard paths, no inline styles or `@ts-ignore` in the new therapist-picker files, no therapist-step search UI, and no old large-card grid markers. Existing inline styles remain elsewhere in the older booking wizard outside this picker scope.

## Follow-up

Authenticated/manual visual QA can still be run in-browser through the full public booking flow to confirm final spacing with live service/location/staff data.

---

# HANDOFF - SCHEDULE-RULE-BUILDER-UI-001 Schedule Rule Builder UI: COMPLETE

## Status

Build verified. 98 routes. Schedule Setup General Rules and Individual Adjustments now use the new role-aware rule-builder UI while preserving existing schedule actions and storage.

## What changed

- Added shared schedule rule-builder utilities for role group policy, visible shift kinds, weekly patterns, shift times, overnight detection, and save payload conversion.
- General Rules now shows role group pills, shift definition cards, a pill-based weekly matrix, edit-time controls, coverage today, group summary, and in-page quick actions.
- Individual Adjustments now shows staff selector/profile context, save/reset controls, individual weekly pill matrix, custom override hints, compare-with-group snapshot, staff today, schedule info, and quick actions.
- Opening/closing groups show Opening, Closing, and Day Off controls; regular-only groups show Regular and Day Off controls.
- Existing group and individual schedule actions remain wired; booking, dispatch, driver portal, payment, schema, and unrelated logic were not changed.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- Protected route smoke checks for `/crm/staff-availability`, `/crm/staff-availability?tab=individual`, `/crm/staff-availability?tab=coverage`, and `/manager/staff-availability` redirected unauthenticated traffic to `/login` as expected.
- Targeted scan found no inline styles, `any`, `@ts-ignore`, or lingering `React.ComponentType` references in touched schedule files.

## Browser note

Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn, and the schedule setup routes require authentication. Authenticated visual QA should be re-run after logging in as CRM/manager, checking General Rules, Individual Adjustments, group switching, staff switching, save/reset states, and mobile/tablet responsiveness.

---

# HANDOFF - MOBILE-LOADING-001 Mobile Route Loading Line: COMPLETE

## Status

Build verified. 98 routes. Mobile route-change progress is wired through the shared mobile shell/nav layer.

## What changed

- Added `MobileNavigationProgressProvider`, `MobileRouteProgress`, and `MobileNavLink` under `src/components/features/mobile-shell/`.
- `FloatingMobileBottomNav` now uses `MobileNavLink` for href-based nav items and center actions.
- Staff, Therapist, and Driver mobile shells each mount one provider and one fixed top progress line.
- Driver Profile remains a button/modal action, so opening Profile does not trigger route progress.
- Added mobile-friendly standalone driver loading skeletons for Trips, Jobs, and Map child routes.
- Removed the existing inline style from the standalone driver desktop error banner.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- Protected route smoke checks for driver and staff mobile routes redirected unauthenticated traffic to `/login` as expected.

## Browser note

Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn. Authenticated mobile verification should be re-run at 390px width after logging in as Basic Staff, Therapist, and Driver users, checking nav taps, current-route taps, Profile modal open/close, and route skeleton pairing.

---

# HANDOFF - DRIVER-PROFILE-EDIT-001 Driver Profile Pop Modal: COMPLETE

## Status

Build verified. 98 routes. Driver mobile Profile bottom-sheet view/edit flow is complete in the existing `DriverProfileSheet` path.

## What changed

- Refactored `src/components/features/staff-portal/driver/driver-profile-sheet.tsx` into a wrapper around focused components in `src/components/features/staff-portal/driver/profile/`.
- Profile view mode now shows a premium mobile sheet with avatar/initials, full name, nickname, Driver role, branch, duty chip, phone, staff type, Driver Portal access, readiness, action rows, and logout.
- Edit mode stays inside the sheet and supports full name, nickname, phone, and profile photo.
- The existing `updateMyProfileDetailsAction` now optionally validates and updates `phone` only when the form submits it; forms without phone do not clear phone.
- Driver self-edit still cannot change system role, staff type, tier, branch, active status, services, schedules, or permissions.
- The driver floating Profile nav item is a button with `aria-label="Open profile"` and active sheet state.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- `/staff-portal`, `/driver`, and `/driver/jobs` route smoke checks redirected unauthenticated traffic to `/login` as expected.

## Browser note

The in-app browser remained on a connection-refused interstitial for `localhost:3000/login`, even though shell `Invoke-WebRequest` reached the app and saw the expected redirects. Authenticated click-through of opening Profile, switching to edit mode, saving, and returning to view still needs a valid local driver staff session.

---

# HANDOFF - DRIVER-JOBS-001 Driver Jobs Page: COMPLETE

## Status

Build verified. 98 routes. Driver Jobs mobile page is complete for `/staff-portal/jobs` and `/driver/jobs`.

## What changed

- Added the new Jobs component set in `src/components/features/staff-portal/driver/jobs/`.
- `/staff-portal/jobs` now renders the new premium mobile Jobs UI.
- Added `/driver/jobs` and `/driver/jobs/[bookingId]` for the standalone Driver portal.
- Updated the driver floating nav center action to `Jobs` and routed it to the correct Jobs page for staff-portal and standalone driver contexts.
- Updated standalone driver Trips and Map detail links to use `/driver/jobs`.
- Removed the previous inline-styled driver jobs list/card implementation.

## Key behavior

- Data comes from existing driver actions and `RealDispatchItem`; no backend logic, booking status rules, or fake job data were added.
- Visible page copy uses Jobs/Job/Trips wording, not Dispatch.
- Active jobs are highlighted with a live elapsed timer when a real start timestamp exists.
- The persistent floating bottom nav remains owned by `DriverMobileShell`; the Jobs page does not render a bottom nav.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- `/driver/jobs`, `/staff-portal/jobs`, and `/driver/dispatch` route smoke checks redirected unauthenticated traffic to `/login` as expected.

## Browser note

Authenticated mobile visual verification still needs a valid local driver staff session.

---

# HANDOFF - DRIVER-MAP-001 Driver Route Map Page: COMPLETE

## Status

Build verified. 97 routes. Driver Route Map mobile page is complete for `/staff-portal/map` and `/driver/map`.

## What changed

- Added the new Route Map component set in `src/components/features/staff-portal/driver/map/`.
- Mobile Route Map now includes a compact header, route summary chips, map-like route placeholder, floating map controls, next-stop bottom sheet, route actions, and today's stops strip.
- `/staff-portal/map` now renders the new route map UI.
- Added `/driver/map` for the standalone Driver portal.
- Updated standalone driver bottom nav to show `Map` and link to `/driver/map`.
- Removed the previous inline-styled route map page and bottom card.

## Key behavior

- Data comes from existing driver dispatch/jobs actions and `RealDispatchItem`; no backend logic, booking status rules, tables, or fake trip data were added.
- ETA and distance show pending labels unless existing route data supports concrete values.
- Visible UI uses Route Map / Map / Trips wording. Internal dispatch route/action/query names are unchanged.
- The persistent floating bottom nav remains owned by `DriverMobileShell`; the map page does not render a bottom nav.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 97 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- `/staff-portal/map`, `/driver/map`, and `/driver/dispatch` route smoke checks redirected unauthenticated traffic to `/login` as expected.

## Browser note

Authenticated mobile visual verification still needs a valid local driver staff session. Tool discovery did not expose an in-app browser screenshot tool in this turn.

---

# HANDOFF - DRIVER-TRIPS-MOBILE-001 Driver Trips Page: COMPLETE

## Status

Build verified. 96 routes. Driver Trips mobile page is complete for `/driver/dispatch` and driver-mode `/staff-portal/dispatch`.

## What changed

- Added the new Trips component set in `src/components/features/staff-portal/driver/trips/`.
- Mobile `/driver/dispatch` now renders `DriverTripsPage`; desktop still renders the existing dispatch workspace.
- Driver-mode mobile `/staff-portal/dispatch` now renders `DriverTripsPage`; non-driver and desktop behavior remain unchanged.
- The UI uses Trips/Trip/Jobs wording for visible page title, tabs, empty states, cards, and actions.
- Internal dispatch route names, data queries, logs, and action names remain unchanged for safety.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 96 routes
- `git diff --check`: PASS with LF/CRLF warnings only
- `/driver/dispatch` and `/staff-portal/dispatch` route smoke checks redirected unauthenticated traffic to `/login` as expected.

## Browser note

Authenticated mobile visual verification still needs a valid local driver staff session.

---

# HANDOFF - MOBILE-NAV-001 Floating Glass Mobile Bottom Nav: COMPLETE

## Status

Build verified. 96 routes. Persistent shell-owned mobile bottom nav is complete for Basic Staff Portal, Therapist Staff Portal, Driver Staff Portal, and standalone `/driver/*` routes.

## What changed

- Added `src/components/features/mobile-shell/floating-mobile-bottom-nav.tsx` as the shared glass nav primitive.
- Added `StaffMobileShell` and `TherapistMobileShell`; reused `DriverMobileShell` for both staff-portal driver mode and standalone driver routes.
- Updated `staff-portal/layout.tsx` to choose the correct shell from `getStaffPortalMode(staff)`.
- Updated `/driver/layout.tsx` to wrap authenticated driver routes in `DriverMobileShell`.
- Reworked Staff, Therapist, and Driver bottom-nav files into thin route config wrappers around the shared component.
- Removed duplicate fixed bottom nav renders and old `paddingBottom: 96` spacing from Basic, Therapist, legacy Staff mobile home, and standalone Driver mobile pages.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 96 routes
- Local route smoke checks for `/staff-portal`, `/staff-portal/schedule`, `/staff-portal/service-progress`, `/staff-portal/dispatch`, `/driver`, and `/driver/dispatch` redirected unauthenticated traffic to `/login` as expected.

## Browser note

Authenticated mobile visual verification still needs valid local Basic Staff, Therapist, Driver Staff Portal, and standalone Driver sessions. Tool discovery did not expose the in-app browser/screenshot tool in this turn.

---

# HANDOFF - Driver Staff Portal Mobile UI: COMPLETE

## Status

Build verified. 96 routes. Driver Staff Portal mobile UI complete.

## What changed

**New driver server actions** in `actions.ts`:
- `getMyDriverJobsAction(date)` — today's dispatch jobs via `getDispatchData(role="driver")`
- `getMyDriverAllJobsAction()` — last 30 days of jobs for the "All" tab (direct `driver_id` query)
- `getMyDriverJobByIdAction(bookingId)` — single job with driver safety check (`driver_id === me.id`)
- `getMyDriverStatsAction(year, month)` — monthly stats queried by `driver_id`

**18 new driver components** in `src/components/features/staff-portal/driver/`:
- `driver-mobile-bottom-nav.tsx` — Home, Dispatch, Map, Jobs, More
- `driver-header.tsx` — logo, "STAFF · DRIVER", bell, avatar
- `driver-greeting-card.tsx` — greeting + On Route / Arrived / In Progress / On Duty / Off Duty status
- `driver-today-overview-card.tsx` — route status, job count strip, View Route button
- `driver-next-stop-card.tsx` — next active stop with countdown badge, address, service, time
- `driver-quick-actions.tsx` — Map View, Jobs, Update Status, My Stats
- `driver-mobile-home.tsx` — assembles all home cards
- `driver-dispatch-card.tsx` — individual dispatch item card with status badge
- `driver-dispatch-page.tsx` — client: Upcoming / History tabs
- `driver-route-map-page.tsx` — route overview list + map placeholder + Google Maps navigation links
- `driver-job-status-stepper.tsx` — Assigned → On Way → Arrived → In Progress → Completed
- `driver-job-details-page.tsx` — full job detail with stepper, Start Travel / Mark Arrived actions (reuses `updateBookingProgressAction`)
- `driver-job-timeline.tsx` — timestamped progress timeline
- `driver-active-job-page.tsx` — active job with elapsed timer (reuses `TrackingTimer`)
- `driver-job-card.tsx` — compact job card for list
- `driver-jobs-list-page.tsx` — Today / All tabs with summary strip
- `driver-stats-page.tsx` — driver stats by driver_id (completed, total, rate)
- `driver-more-menu.tsx` — Account + Work (Jobs, Map, Dispatch History) + Support with server logout

**New routes (4)**:
- `/staff-portal/map` — DriverRouteMapPage
- `/staff-portal/jobs` — DriverJobsListPage
- `/staff-portal/jobs/active` — DriverActiveJobPage
- `/staff-portal/jobs/[bookingId]` — DriverJobDetailsPage

**Updated pages**:
- `page.tsx` (home): driver mode → `DriverMobileHome`
- `dispatch/page.tsx`: driver mode → `DriverDispatchPage` on mobile; `HomeServiceDispatchWorkspace` on desktop (unchanged)
- `stats/page.tsx`: driver mode → `DriverStatsPage`
- `more/page.tsx`: driver mode → `DriverMoreMenu`

**Key design decisions**:
- `updateBookingProgressAction` reused for Start Travel (travel_started) and Mark Arrived (arrived) — no duplicate progress system
- `TrackingTimer` reused in active job page for elapsed time
- `getDispatchData(role="driver")` reused with `driver_id` filter — no new dispatch table
- Map page uses Google Maps links (lat/lng or address) — no new map library
- Dispatch page detects driver via `system_role === "driver"` OR `staff_type === "driver"`
- Therapist Portal, Basic Staff Portal, CRM dispatch completely untouched

## Verification

- tsc: PASS, lint: PASS (0 errors, 2 pre-existing warnings), build: PASS (96 routes)
- Zero TypeScript `any` in new files
- Authenticated visual check needs valid local driver session

---

# HANDOFF - Therapist Staff Portal Mobile UI: COMPLETE

## Status

Build verified. 93 routes. Therapist Staff Portal mobile UI complete.

## What changed

**New action:** `getMyServiceProgressAction(date)` in `actions.ts` — fetches all non-cancelled today's bookings split into `active` / `completed` arrays.

**13 new therapist components** in `src/components/features/staff-portal/therapist/`:
- `therapist-mobile-bottom-nav.tsx` — Home, Schedule, **Service Progress**, Stats, More
- `therapist-header.tsx` — sticky logo + role + bell + avatar
- `therapist-greeting-card.tsx` — greeting + service-aware status (In Service / Traveling / On Duty / Day Off / No Shift)
- `therapist-shift-card.tsx` — My Shift Today card
- `therapist-next-service-card.tsx` — Next Service with countdown badge + room/home-service context
- `therapist-quick-actions.tsx` — My Schedule, Service Progress, Dispatch, My Stats
- `therapist-mobile-home.tsx` — assembles all home cards
- `therapist-service-progress-card.tsx` — service card reusing `BookingProgressActions`
- `therapist-service-progress-page.tsx` — client: Active / Completed tabs
- `therapist-schedule-list.tsx` — compact day cards with appointment chips
- `therapist-week-detail.tsx` — day picker + timeline with appointments
- `therapist-stats.tsx` — booking-based stat cards (completed, revenue, rate)
- `therapist-more-menu.tsx` — Account + Work + Support sections with inline logout

**New route:** `/staff-portal/service-progress` — service progress tabs for therapists.

**Updated pages:** home, schedule, week, stats, more — all now route therapist mode to therapist components.

**Key reuse decisions:**
- `BookingProgressActions` unchanged and embedded in service progress cards (no duplicate progress system)
- `TrackingTimer` already used inside `BookingProgressActions`
- Dispatch page at `/staff-portal/dispatch` unchanged (therapist home links there)
- Basic Staff Portal (`basic/` components) untouched
- Driver Portal untouched

## Verification

- tsc: PASS, lint: PASS, build: PASS (93 routes)
- Zero TypeScript `any` in new files
- Authenticated visual check needs valid local therapist session

---

# HANDOFF - Basic Staff Portal Mobile UI: COMPLETE

## Status

Build verified. CradleHub now has a complete Basic Staff Portal mobile UI for non-therapist, non-driver staff.

## What changed

### Staff portal mode helper

Added `src/lib/staff/get-staff-portal-mode.ts`.

- Exports `StaffPortalMode = "basic" | "therapist" | "driver" | "crm_staff"`.
- `getStaffPortalMode(staff)` checks `system_role` and `staff_type` to determine mode.
- `isBasicStaffMode(mode)` returns true for `"basic"` and `"crm_staff"`.

### New server actions

Added to `src/app/(dashboard)/staff-portal/actions.ts`:
- `getMyTodayScheduleAction(date)` — fetches today's shift schedule row and override for the home page.
- `getMyMonthlyScheduleStatsAction(year, month)` — computes working days, days off, hours scheduled from `staff_schedules` + `schedule_overrides`.

### Updated week types

`src/lib/staff-portal/week.ts`: `WeekResult.staff` now includes `nickname`, `staff_type`, `avatar_url`, `avatar_path` in its type, reflecting what `getMyWeekAction` already returns at runtime.

### Basic staff components (10 new files)

All in `src/components/features/staff-portal/basic/`:
- `basic-staff-header.tsx` — sticky top bar with logo, role, bell, avatar
- `basic-staff-greeting-card.tsx` — greeting + On Duty / Day Off / No Shift status badge
- `basic-staff-shift-card.tsx` — "My Shift Today" with time range, shift type, View Full Schedule
- `basic-staff-assignment-card.tsx` — "Next Assignment" without service progress controls; empty state
- `basic-staff-quick-actions.tsx` — 2×2 quick action grid (Schedule, Week, Stats, Profile)
- `basic-staff-mobile-home.tsx` — assembles cards + StaffMobileBottomNav
- `basic-staff-mobile-schedule.tsx` — client: compact day cards + filter chips (All/On Duty/Day Off/Booked/Blocked)
- `basic-staff-week-detail.tsx` — client: horizontal day picker + selected day detail + timeline + notes
- `basic-staff-stats.tsx` — schedule-based stat cards (working days, days off, hours, avg daily hours)
- `basic-staff-more-menu.tsx` — More menu with Account + Support sections; inline "use server" logout action

### New route

`src/app/(dashboard)/staff-portal/more/page.tsx` — `/staff-portal/more` route renders `BasicStaffMoreMenu`.

### Updated pages

- `page.tsx` (home) — detects mode; basic → `BasicStaffMobileHome`, therapist/driver → existing `StaffMobileHome`
- `schedule/page.tsx` — basic on mobile → `BasicStaffMobileSchedule`; others → existing `StaffSchedulePage`
- `week/page.tsx` — basic on mobile → `BasicStaffWeekDetail`; others → existing `MyWeekPage`
- `stats/page.tsx` — basic → `BasicStaffStats` (schedule stats); others → existing booking stats

### Bottom nav

`staff-mobile-bottom-nav.tsx` — "More" now links to `/staff-portal/more` (was `/staff-portal/profile`); active detection covers `/staff-portal/more`, `/staff-portal/profile`, `/staff-portal/notifications`, `/staff-portal/settings`.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `pnpm lint`: PASS (0 errors, 2 pre-existing warnings in scripts/)
- `pnpm build`: PASS, 92 routes (+1 `/staff-portal/more`)
- Zero TypeScript `any` in new/modified files
- Therapist portal flows (StaffMobileHome, StaffSchedulePage, MyWeekPage) not modified
- Driver portal flows not modified
- Profile page locked fields (role/type/tier) preserved — existing server action only updates full_name and nickname

## Browser note

Authenticated visual check still needs a valid local staff session. Login as a utility/CSR/front-desk staff user (not therapist, not driver) and open `/staff-portal` on mobile viewport to see the Basic Staff Portal mobile UI.

---

# HANDOFF - Multi-workspace switching: COMPLETE

## Status

Build verified. CradleHub now has a shared workspace-access resolver, `/select-workspace`, an account setup fallback, and a premium setup-center-style switching overlay.

## What changed

### Workspace access model

Added `src/lib/auth/workspace-access.ts`.

- Defines `WorkspaceKey`, `WorkspaceAccess`, and typed profile input.
- Builds workspace access from the active staff profile without creating duplicate accounts or separate logins.
- Returns CRM for operational/admin roles, Owner for owners, Manager for manager roles, Staff Portal for active non-driver/non-utility staff, Driver Portal for `system_role` or `staff_type` driver, and Utility Portal to preserve the existing utility workspace.
- Provides `getWorkspaceSwitchDestination()` for login/proxy redirects.

Added `src/lib/auth/get-user-workspace-access.ts`.

- Loads current user workspace access from Supabase.
- Preserves super-admin and local dev-bypass behavior.

### Login and route guard

Changed `src/app/(auth)/login/actions.ts`.

- After successful login, calls `getUserWorkspaceAccess(user.id)`.
- Redirects zero-workspace users to `/account/setup`.
- Redirects single-workspace users directly to that workspace.
- Redirects multi-workspace users to `/select-workspace`.

Changed `src/proxy.ts`.

- Replaced single-role workspace redirects with workspace-access checks.
- Allows multi-access users into every entitled workspace.
- Blocks unauthorized manual visits server-side and redirects to `/select-workspace` when multiple authorized options exist.
- Removes the old owner/manager forced-to-CRM behavior.

### Selector and setup fallback

Added `src/app/(dashboard)/select-workspace/page.tsx`.

- Premium centered workspace selector.
- Shows only authorized workspace cards with icon, label, description, branch chip, and Open Workspace action.
- Single-workspace users are redirected out of the selector.

Added `src/app/account/setup/page.tsx`.

- Authenticated fallback for users with login access but no usable workspace.
- Shows pending/rejected/no-profile messaging from onboarding status where available.

### Switching transition

Added `src/components/shared/workspace-switching-loader.tsx`.

- Uses the existing setup-center `CrmPremiumLoader`.
- Renders centered blurred/dimmed overlay with CradleHub mark and warm card styling.

Added `src/components/shared/workspace-switch-link.tsx`.

- Client wrapper for workspace navigation.
- Prevents repeated clicks, shows loader immediately, uses `router.push()`, has a fail-safe timeout, and shows a Sonner error if push throws.

### Header and driver compatibility

Changed `src/components/features/dashboard/header.tsx`.

- Adds a profile dropdown with My Profile, Switch Workspace, Settings, Help & Support, and Logout.
- Shows Switch Workspace only when the user has more than one workspace.

Changed `src/app/(dashboard)/layout.tsx`.

- Fetches workspace access and passes it into the header.

Changed `src/app/(dashboard)/driver/page.tsx` and `src/app/(dashboard)/driver/dispatch/page.tsx`.

- Driver portal now allows staff with `staff_type = driver`, not only `system_role = driver`.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 91 routes
- Focused scan for `any`, `@ts-ignore`, and direct `console.` in touched files: PASS
- In-app browser reached `http://localhost:3000/select-workspace` and correctly redirected unauthenticated traffic to `/login`.

## Browser note

Authenticated click-through still needs local test sessions for CRM-only, Staff-only, CRM+Staff, Driver, Owner/Admin, and no-workspace users. Code-level checks and unauthenticated proxy behavior are verified.

## Follow-up fix: Staff Portal shell nav

After user screenshot review, fixed `src/components/features/dashboard/sidebar.tsx` so path-derived workspace identity wins over role-derived CRM/CSR identity. Multi-access users visiting `/staff-portal/*` now get `NAV_CONFIG.staff` and Staff Portal sidebar metadata instead of CSR/CRM navigation. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; in-app browser reached `/staff-portal/profile` but redirected unauthenticated traffic to `/login`.

## Follow-up fix: Staff Portal self-edit profile

Added `src/components/features/staff-portal/staff-profile-details-form.tsx` and `updateMyProfileDetailsAction` in `src/app/(dashboard)/staff-portal/actions.ts`. Staff users can edit only `full_name` and `nickname` on their own staff row. `system_role`, `staff_type`, and `tier` are displayed as locked read-only fields and remain controlled by owner/manager/CRM staff management flows. The server action validates the authenticated user, updates only the linked staff row via the server admin client, and hard-codes the allowed update payload. Also fixed the staff portal profile lookup to load real `staff_type`, `avatar_url`, and `avatar_path` fields instead of forcing them to null. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; authenticated save click-through still needs a local staff session.

## Follow-up fix: Staff Portal role dropdowns

Per latest user request, updated the Staff Portal profile form so `system_role` and `staff_type` are editable dropdowns sourced from `SYSTEM_ROLE_OPTIONS` and `STAFF_TYPE_OPTIONS`. `updateMyProfileDetailsAction` now validates those values against `SYSTEM_ROLES` and `STAFF_TYPES`, then updates `full_name`, `nickname`, `system_role`, and `staff_type` on the authenticated user's own staff row. Tier remains read-only. Save button keeps the `Loader2` in-button spinner while pending. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; browser route check redirected unauthenticated traffic to `/login`.

## Follow-up fix: Staff Portal visible save button

Moved the Staff Portal profile `Save Changes` button into the `Account Details` card header so staff can see it immediately. The button now uses a dedicated submit component with React DOM `useFormStatus()` so the inline `Loader2` spinner and `Saving` label reflect the active form submission. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; local route reachability still redirects unauthenticated traffic to `/login`, so final visual save confirmation needs a logged-in staff session.

## Follow-up fix: Driver Staff Portal persistent nav + safe profile sheet

Implemented the driver mobile shell refinement. Driver staff now get a single persistent mobile bottom nav from `/staff-portal/layout.tsx` with Home, Dispatch, Map, Jobs, and Profile. Profile opens a bottom sheet instead of the old More-route nav item. The sheet reuses `StaffProfilePhotoUploader` and `updateMyProfileDetailsAction`; it only submits `fullName` and `nickname`, while Staff Role, System Role, Tier, Branch, Active Status, and Permissions are read-only/admin-managed.

Driver mobile pages no longer render duplicated fixed navs. `/staff-portal/schedule` now has a driver mobile schedule page showing week-day trip cards while desktop keeps `StaffSchedulePage`. `updateBookingProgressAction` now authorizes assigned drivers by `system_role="driver"` or `staff_type="driver"`, matching the workspace mode resolver. Revalidation now includes driver staff routes and CRM dispatch/live-operation surfaces.

Verification: `pnpm type-check` PASS, `pnpm lint` PASS (0 errors, 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`), `pnpm build` PASS (96 routes). Local unauthenticated route checks for the staff portal driver route set returned 307 -> `/login`; authenticated mobile visual verification still needs a valid driver staff session.

---

# HANDOFF - UI-MOBILE-PRELOAD-001 Mobile First-Visit Public Preloader: COMPLETE

## Status

Build verified. 98 routes. Cradle public pages now have a mobile-only first-visit preloader that appears once per browser session and fades out without touching protected workspaces or global loading systems.

## What changed

- Added `src/components/shared/mobile-first-visit-preloader.tsx`.
- Mounted `MobileFirstVisitPreloader` in `src/app/page.tsx` for `/`.
- Mounted `MobileFirstVisitPreloader` in `src/app/(public)/layout.tsx` for public route-group pages like `/book`, `/services`, `/branches`, `/about`, and `/contact`.
- Removed the older `CradleBreathReveal` mount from `src/components/public/mobile/public-mobile-home.tsx` so two splash experiences do not stack on the homepage.

## Behavior

- Uses `sessionStorage` key `cradle_mobile_preloader_seen`.
- Shows only at `window.innerWidth <= 768`.
- Marks the session as seen as soon as it is eligible to show.
- Fades after the short timing window and removes itself from interaction/DOM.
- If session storage is restricted, it still shows at most once for that mounted component lifecycle.
- Reduced motion disables dot/float animation and shortens transition duration.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- Headless Chrome runtime check on `http://localhost:3000`: mobile first public visit showed and marked the session; fade removal passed; same-session reload stayed hidden; public navigation after first visit stayed hidden; desktop public visit never showed or marked the session; `/crm` mobile did not show or mark the session; reduced motion disabled dot animation.

## Preserved

Route progress bars, workspace switching loaders, CRM/staff/driver/owner/admin loading states, skeleton loaders, `src/app/loading.tsx`, `src/app/(public)/loading.tsx`, global animation CSS, booking logic, Supabase/database logic, server actions, APIs, auth/RBAC, and middleware were not changed.

---

# HANDOFF - UI-MOBILE-PRELOAD-002 Mobile Preloader First-Paint Fix: COMPLETE

## Status

Build verified. 98 routes. Public first visits now get preloader markup from the server when `cradle_mobile_preloader_seen` is absent, so the mobile overlay can cover the initial landing-page paint instead of appearing after client hydration.

## What changed

- `MobileFirstVisitPreloader` now accepts `initiallyVisible: boolean` and initializes state with `useState(initiallyVisible ? "visible" : "hidden")`.
- Added `src/lib/public/mobile-preloader.ts` so the cookie/storage key is shared by server and client code.
- `/` (`src/app/page.tsx`) and the `(public)` layout both use `await cookies()` and pass `initiallyVisible={!hasSeenMobilePreloader}`.
- Mobile clients set a session cookie and sessionStorage fallback: `cradle_mobile_preloader_seen=1`.
- Desktop clients remove the server-rendered mobile-hidden overlay immediately without setting the cookie.
- The component applies the approved dark forest/gold/ivory preloader design and keeps timing at `700ms` minimum visible, `1600ms` maximum visible, and `420ms` fade.
- A scoped data-attribute pause guard is active only while the overlay is visible: `.sp-reveal`, `.sp-reveal-scale`, and `[data-hero-animation]`.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- Raw HTML checks: `/` and `/services` include `cradle-mobile-preloader-overlay` without cookie and omit it with `cradle_mobile_preloader_seen=1`; `/crm` never includes it.
- Headless Chrome CDP checks on `http://localhost:3000`: mobile first visit had overlay at DOMContentLoaded, set cookie/storage to `1`, and removed overlay by the end of the fade; repeat-cookie mobile hidden; desktop no-cookie hidden with no cookie; protected `/crm` redirected to `/login` with no overlay/cookie.

## Preserved

No changes were made to route progress bars, workspace switching loaders, CRM/staff/driver/owner/admin loading states, skeleton loaders, `src/app/loading.tsx`, `src/app/(public)/loading.tsx`, global animation CSS, booking logic, Supabase/database logic, APIs, server actions, auth/RBAC, or middleware.

## Notes

The in-app browser controller was not exposed. Non-escalated Chrome could not expose DevTools from the sandbox, so the successful browser verification used an approved escalated local headless Chrome run. A first short CDP wait caught the preloader mid-fade on the slow dev server; the follow-up longer CDP pass confirmed final removal.

---

# HANDOFF - CRM-SCHEDULE-UI-001 Daily Timeline Fit/Expand: COMPLETE

## Status

Build verified. 98 routes. CRM Schedule Daily Timeline now defaults to a Fit Day view that keeps the right rail visible and fits the active day into the main schedule column. Expanded mode gives the timeline full page width and enables horizontal detail scrolling.

## What changed

- `src/components/features/schedule/schedule-workspace.tsx` now uses a responsive CRM grid with `minmax(0, 1fr)` for the schedule area and a 300px right rail in Fit Day mode.
- Added a Fit Day / Expanded control beside the existing density controls using `Maximize2` and `Minimize2`.
- Expanded mode switches the CRM board area to one column and hides the right rail while the timeline is expanded.
- `DailyScheduleBoard` computes one `TimelineRange` from staff work hours, current overrides, bookings, and blocked times, with an 8 AM to 11 PM fallback.
- Header labels, grid lines, off-duty overlays, bookings, blocked-time blocks, and the Now indicator all use the same percent-based active-day range.
- Fit mode has no horizontal scroll; Expanded mode uses a wider per-hour minimum and horizontal scrolling when needed.

## Preserved

No changes were made to the public mobile preloader, public landing page, booking logic, schedule generation logic, Supabase schema/database logic, route/workspace loaders, skeleton loaders, or protected portal data fetching.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 98 routes
- `git diff --check`: PASS with LF/CRLF notices only
- Local unauthenticated route probe: `/crm/schedule` returned `307 /login`; authenticated visual QA still needs a logged-in CRM session.

---

# HANDOFF - OWNER-RECONNECT-001 Owner Workspace Restoration: COMPLETE

## Status

Build verified. 98 routes. Owner workspace routing, workspace switching, role-to-nav resolution, and route warm-up are restored for Owner users. Manager remains soft-paused to CRM.

## What changed

- `/owner` layout now authorizes with `getCurrentUserWorkspaceAccess()` and `hasWorkspaceAccess(..., "owner")` instead of redirecting every request to `/crm`.
- Proxy route authorization now delegates protected path checks to `canAccessWorkspacePath()` in `src/lib/auth/workspace-access.ts`, making the existing behavior directly testable.
- Owner role fallback now resolves to Owner nav; `getDefaultDashboardPath("owner")` returns `/owner`.
- Owner nav is no longer `mvpHidden` and no longer includes the production Dev Panel link.
- Owner prefetch no longer includes nonexistent `/owner/settings` or `/dev`.
- Added focused Vitest coverage in `tests/lib/auth/workspace-access.test.ts`.
- Added `vitest.config.ts` so tests resolve the app's existing `@/*` TypeScript alias.

## Preserved

CRM, Staff Portal, Driver Portal, Utility Portal, public booking, booking logic, scheduling logic, dispatch/live-map logic, Supabase schema/RLS/migrations, API behavior, and payroll business implementation were not changed. Manager restoration is still deferred.

## Validation

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm test tests/lib/auth/workspace-access.test.ts`: PASS, 8 tests
- `pnpm build`: PASS, 98 routes; `/owner/*` routes generated
- Service-role scan: only existing `src/lib/supabase/admin.ts`
- Suspicious RLS scan: no matches
- Stale Owner settings scan: no `/owner/settings` references
- Full `pnpm test`: PARTIAL, 428/430 passing; two unrelated booking progress tests fail in `tests/lib/bookings/progress.test.ts`

## Remaining Work

- Authenticated Owner browser QA should verify `/owner`, `/owner/bookings`, `/owner/schedule`, `/owner/reports`, `/owner/branches`, `/owner/staff`, `/owner/services`, and `/owner/notifications` with a real Owner session.
- Payroll route is reachable but payroll business implementation was intentionally not expanded in this task.
- Resolve the separate booking progress state-machine/test mismatch before treating the full Vitest suite as green.

---

# HANDOFF - AUTH-STAFF-RECOVERY-001 Staff Password Recovery and Account Diagnostics: COMPLETE

## Status

Build verified. 100 routes. Staff password recovery, password visibility controls, and Owner-only account access diagnostics are implemented without replacing the existing Supabase Auth, proxy/RBAC, or workspace-switching system.

## What changed

- Added `/forgot-password` with generic reset responses and Supabase `resetPasswordForEmail` redirecting through `/auth/callback?next=/reset-password`.
- Added `/auth/callback` route handler using `exchangeCodeForSession` and internal redirect sanitization.
- Added `/reset-password` guarded by the recovery session, updating the password through `auth.updateUser`, auditing the event, and signing the user out afterward.
- Added shared `PasswordInput` show/hide control and applied it to login, reset password, staff onboarding, and legacy onboarding password fields.
- Added Owner staff preview `Account Access` panel with server-side diagnostics for linked auth account, email confirmation, last sign-in, active status, CRM workspace access, and recovery availability.
- Added Owner-triggered staff password recovery for linked auth accounts with rate-limit/audit recording.
- Added `staff_account_access_events` migration plus TypeScript table types for password recovery and diagnostic audit events.
- Preserved existing login action, middleware/proxy, staff RBAC, workspace switching, direct invite flow, and service-role server-only boundary.

## Verification

- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 4 existing warnings outside this task
- Focused tests: PASS, 3 files / 9 tests
- `pnpm test`: PARTIAL, 39 files passed; 2 known unrelated booking progress assertions still fail in `tests/lib/bookings/progress.test.ts`
- `pnpm build`: PASS, 100 routes
- Credential/token scan: PASS, no token/password logging matches
- Client service-role scan: PASS, no client component imports `createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY`, or `service_role`

## Notes

- Owner diagnostics can send recovery only when `staff.auth_user_id` resolves to a Supabase Auth user with an email. Staff rows without an auth link still need invite/account linking first because the `staff` table does not store email.
- The legacy `/onboard/[staffId]` route remains present but was not expanded.
- Existing unrelated worktree changes for CRM availability/time-format were present before this task and were left untouched.

---

# HANDOFF - OWNER-DASHBOARD-REDESIGN-001 Owner Overview Dashboard: COMPLETE

## Status

Build verified. 97 routes. `/owner` now renders the approved executive-style Owner Overview inside the existing Owner shell, with real Supabase data and section-level unavailable states when a data source fails.

## What changed

- Replaced the old inline Owner Overview page with a thin server page that loads `getOwnerOverviewDashboardData()` and renders `OwnerDashboard`.
- Added `src/lib/queries/owner-dashboard.ts` for Owner-only auth, branch-local date handling, and server-side section data loading.
- Added `src/lib/owner/dashboard.ts` for pure dashboard calculations: bookings, completed sessions, paid revenue, active branches/staff, new staff, branch performance normalization, revenue trend, staff snapshot, payroll snapshot, action merging, and owner access checks.
- Added `src/components/features/owner/dashboard/` for the hero, attention banner, KPI grid, Today at a Glance, Branch Performance, Revenue Trend, Staff Snapshot, Quick Actions, Payroll Snapshot, and Pending Actions cards.
- Added `tests/lib/owner/dashboard.test.ts` with 13 focused tests covering dashboard business rules and partial failure behavior.
- Tidied two React lint blockers in already-touched files: keyed `BranchEditForm` reset and payroll staff table derived-view state sync removal.

## Metric definitions

- Today's revenue: sum of paid `bookings.amount_paid` for active, non-closed bookings scheduled on the dashboard date.
- Completed today: bookings with `session_completed_at` or `completed_at` on the dashboard date in `Asia/Manila`.
- Staff on shift: schedule-based while `MVP_CHECKIN_PAUSED = true`; check-in based helper path remains covered for future unpaused mode.
- Pending Actions: merged `workspace_notifications` requiring action and open/in-progress `workflow_tasks`; no separate approvals module exists yet.

## Preserved

No database migrations, RLS changes, global shell redesign, shadcn primitive changes, CRM workflow changes, Staff Portal changes, Driver Portal changes, public booking changes, booking progress changes, or schedule engine changes were made for this dashboard.

## Validation

- `pnpm test tests/lib/owner/dashboard.test.ts`: PASS, 13 tests.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS, with existing warnings only in `scripts/generate-service-image-assets.mjs` and payroll test mocks.
- `pnpm build`: PASS, 97 routes; `/owner` generated.
- Browser smoke: existing `http://localhost:3000/owner` redirects unauthenticated browser session to `/login` with no local app console errors.
- Full `pnpm test`: PARTIAL, 467/469 passing; two known unrelated failures remain in `tests/lib/bookings/progress.test.ts`.

## Remaining Work

- Authenticated Owner browser QA should verify the final `/owner` visual against the mockup with real Owner data.
- Decide whether to add a formal approvals domain later; current dashboard correctly labels that surface as Pending Actions.
- Resolve the booking progress state-machine/test mismatch before treating full Vitest as green.
