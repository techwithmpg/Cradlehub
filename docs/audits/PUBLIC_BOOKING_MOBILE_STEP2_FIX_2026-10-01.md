# Public Booking Step 2 mobile correction — working evidence

## Authority and status

- Owner request: post-release P1 presentation and interaction correction for the public booking wizard, with inspection, implementation, tests, commit, and normal fix-branch push authorized.
- Target: CradleHub Web public booking wizard service step.
- Base: fetched `origin/main` at `e663ba18d61b26e66668dfe17be689aff30d7318`.
- Branch: `fix/public-booking-mobile-step2`.
- Verdict: **CORRECTION REQUIRED** before merge review is complete. Browser viewport QA and a successful production build remain unverified.

## Root cause and correction

On mobile, the wizard fixes the shell to `100dvh` and hides overflow in the main column. The service step's own scroll container had `overflow-hidden`, while the service picker placed another vertical scroller inside a block without a constrained height. The recipient choices also stacked in three rows, followed by a wrapping guest row and a large name control. This combination could clip the category and service area below the footer with no usable vertical scroll path.

The correction gives the existing step content one vertical scroller with bottom safe-area clearance, removes the picker's inner vertical scrolling, and leaves the existing fixed Back/Continue footer in place. The recipient modes are a three-column native radio group using the existing `me`, `me_and_others`, and `someone_else` values. Guest controls use one horizontal strip with the existing active attendee ID, selection counts, Add Guest, Remove Guest, and rename handlers. The service heading identifies the active attendee. Changing guest adjusts only the strip's horizontal scroll position; it does not scroll the whole wizard to the top.

## Contracts and scope

- Existing attendee list, active attendee ID, per-attendee service IDs, single-person selected services, category behavior, Continue validation, booking actions, pricing, availability, date/time, Home Service, and payment behavior remain in place.
- `Someone Else` retains the existing required recipient name in this step; customer contact details remain in Details.
- Changed runtime files: `src/components/public/booking-wizard.tsx`, `src/components/public/booking-service-picker.tsx`.
- Regression test: `tests/components/booking/public-service-step.test.tsx`.
- Database impact: **none**. Migration impact: **none**. Booking contract impact: presentation and interaction only.

## Verification performed

- `pnpm exec vitest run tests/components/booking/public-service-step.test.tsx tests/lib/bookings/booking-wizard-confirm.test.ts tests/lib/bookings/booking-order-contract.test.ts tests/lib/bookings/booking-simplification-safety.test.ts` — 4 files, 35 tests passed.
- `pnpm type-check` — passed.
- `pnpm exec eslint src/components/public/booking-wizard.tsx src/components/public/booking-service-picker.tsx tests/components/booking/public-service-step.test.tsx` — passed.
- `git diff --check` — passed.
- `pnpm build` — blocked before compilation completed because Google Fonts requests failed in this restricted environment (Cormorant Garamond, DM Sans, Manrope, Playfair Display).
- Isolated local QA checkout with dummy LOCAL Supabase settings served the real wizard fixture at HTTP 200. The in-app browser timed out before returning DOM or screenshot evidence; the fixture and checkout were removed. No actual 320, 360, 375, 390, 412, 430, short-height, tablet, or desktop viewport behavior was verified. No production behavior was verified.

## Release boundary and next action

This branch is repository-recorded working evidence only. Re-run the production build with font access and perform the requested responsive browser flows before a PASS verdict. Obtain review and the applicable owner gate before merge. No main push, merge, deployment, production data access, schema change, or migration is authorized by this handoff. Rollback is to revert the fix commit on the branch or an accepted later merge through the normal reviewed process.
