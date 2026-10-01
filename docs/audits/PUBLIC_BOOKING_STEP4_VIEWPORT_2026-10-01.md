# Public booking Details viewport correction — working evidence

## Authority and source state

- Owner request: simplify the public Details step for mobile and laptop/desktop, keep required controls in the default viewport where practical, preserve booking contracts, and perform physical-phone QA after implementation. The owner subsequently authorized commit, merge, and push to `main` **when done**.
- Branch: `fix/public-booking-step4-viewport` in a managed isolated worktree. Source HEAD before this correction: `eb55d5fc380890abbccccb09a0387695877696af` (the prior Step 2 fix); implementation HEAD: `ca41d0d` (`fix(booking): compact public details for viewport`). A fresh fetch confirmed accepted `origin/main` at `e663ba18d61b26e66668dfe17be689aff30d7318`; the fix branch is two commits ahead and zero behind at implementation HEAD.
- Current verdict: **CORRECTION REQUIRED** before merge. The implementation commit is pushed to `origin/fix/public-booking-step4-viewport`; it is not merged or deployed.
- The shared `E:\cradlehub` checkout has separate uncommitted startup-diagnostic and Next configuration changes. They were not reset, staged, or included in this correction.

## Scope and decisions

- Changed application files: `src/components/public/booking-wizard.tsx` and `src/components/features/booking/therapist-picker/therapist-dropdown-picker.tsx`. Added focused test: `tests/components/booking/public-details-step.test.tsx`.
- The public flow proceeds from Date & Time directly to a combined Details step. Back returns directly to Date & Time. Internal numeric step IDs and the in-house wizard remain intact; the public desktop stepper hides the now-internal therapist step.
- The default public Details view shows only validated required contact fields (full name and phone), a compact optional therapist selector, and a single optional email/requests entry point. Email and notes remain editable on request and retain the existing form state. The selected therapist still uses the existing staff preference value and booking submission mapping.
- The public Details hero, verbose therapist education, repeated auto-assignment panels, service/payment summaries, and desktop summary sidebar are omitted from the default view. Group bookings show one short assignment line when the preference is automatic. The final button keeps its existing **Confirm Booking** action and label because it submits the booking.
- Mobile keeps the existing `100dvh` wizard shell, one step-content vertical scroller, and fixed footer with safe-area clearance. Desktop uses a centered, compact form and navigation row. No database, migration, pricing, availability, payment, attendee, or server changes were made.

## Verification actually performed

- Focused Vitest run after final edits: four files, 22 tests passed (`public-details-step`, `public-service-step`, `therapist-selection-preference`, `booking-wizard-confirm`). An initial retry was stopped before execution by an automatic approval usage-limit error; the subsequent retry completed successfully.
- `node_modules\.bin\tsc.cmd --noEmit --incremental false` — passed after final edits.
- Targeted ESLint on the two changed application files and new test — passed after final edits.
- `git diff --check` — passed after final edits.
- `next build` compiled and type-checked, then failed during static generation of `/owner/marketing` because this isolated worktree has no Supabase URL. No database target was configured or contacted; this is not a full build pass.
- Mock-only local browser QA used the actual wizard UI and fixed site header with no database calls. At 320×568, the single middle content area scrolled and the final optional control cleared the footer after scrolling. At 360×640 it had a 1 px content overflow. At 375×667, 390×844, 412×915, 430×932, 1280×720, 1366×768, 1440×900, and 1920×1080, default Details and the footer fit without content or page scroll. Screenshots were visually inspected at 320×568, 390×844, and 1366×768. Browser viewport emulation is not physical-device evidence. The temporary QA route and server were removed/stopped.

## Remaining gates and impact

- Physical Android Chrome Step 4 QA is still required. The host currently exposes no `adb` or `scrcpy` command; access to Windows PnP inventory was denied. No physical-phone Step 4 result is claimed.
- The owner reported that the original port-3000 splash now clears. A separate mock-only Step 4 preview is being served at `http://192.168.137.1:3006/qa-booking-step4` for physical-phone layout and interaction QA. Its temporary route and LAN development-origin setting are uncommitted and will be removed after that check; the preview does not represent live availability or a booking submission.
- External review is required by `docs/14-BRANCH-STRATEGY.md`. Reconcile with a freshly fetched accepted `origin/main`, complete the build gate in an identified LOCAL/TEST environment, and perform physical-phone QA before merging. The owner has authorized a main merge and push **when done**, but those conditions are not yet met.
- Git staging in the managed worktree was initially denied by the sandbox because its index resides in protected `E:\cradlehub\.git`; an approved retry succeeded. The implementation commit was created and pushed normally; no history was rewritten.
- Production impact: none so far. A later accepted `main` push may deploy; no production outcome is asserted. Rollback after a reviewed merge would be a normal revert of the correction commit.
