# Web final stabilization: Phone / Future and Cradle Live — 2026-10-26

## Authority and repository state

- Owner authorized a local correction of the CRM booking modal and final Cradle Live verification in `E:\cradlehub`. The configured Supabase target is **PRODUCTION**; only existing branch-authorized read-only dashboard queries were used. No booking, payment, attendance, schema, or other database mutation occurred.
- Branch: `main`. Baseline, working `HEAD`, and freshly fetched `origin/main`: `23fa84f5e5abf5d7e5bf3499b0d4c733999f29d4`.
- No branch, commit, merge, push, deployment, migration, or build was made. Existing Cradle Live, booking layout, Cash Flow, Operations Center, and other local edits were preserved.

## Diagnosis and correction

- The form held both `mode` and `phoneSourceChosen`. Clicking **Phone / Future** from Walk-in selected `phone` but left `phoneSourceChosen=false`; `validate()` then rejected Save with `fieldErrors.source`. The selected card also nested Call/Future buttons.
- Removed the source flag, remembered source state, toggle handler, nested controls, and source validation. The three top-level cards now select Walk-in, Phone / Future, or Home Service directly. Entered date, time, customer, service, and guest data remain in place on this switch under existing mode-change rules.
- Unified staff selection from Walk-in submits backend mode `phone`; an existing programmatic `standard_future` modal request keeps that backend mode, including after switching away and back. Both modes use the established non-walk-in exact-time availability rules. Same-day Walk-in alone receives the special attendance preference. The form still sets `markArrived` only for Walk-in; a Phone / Future booking is not automatically arrived. Existing validation, atomic creation, idempotency, metadata persistence, and downstream reporting consumers were left intact. Historical booking metadata was not rewritten.
- Cradle Live's populated lifecycle now explicitly says **Payment due** or **Paid** on the relevant lines. All other roster, capacity, activity, fixture, refresh, and fullscreen corrections from `CRADLE-LIVE-FINAL-ACCURACY-HANDOFF-2026-10-26.md` remain in place.

## Files changed in this pass

- `src/components/features/bookings/quick-booking-form.tsx` — removed the redundant source UI and Save blocker; retained the pre-existing layout and image fallback edits in this file.
- `tests/components/crm/quick-booking-payment-intent.test.tsx` — one-click same-day and future-date submissions, legacy `standard_future`, invalid input/availability, workspace notification and success callback.
- `src/components/features/cradle-live/cradle-live-board.tsx` — payment-state wording on lifecycle lines. This file remains part of the earlier untracked Cradle Live implementation.
- `tests/components/cradle-live-board-feed-health.test.tsx` — unavailable issue-feed presentation.
- This handoff report.

## Tests and rendered evidence

- Booking form/modal callers: **3 files, 30 tests passed**. Adjacent booking UI and Cradle Live suites: **8 files, 46 tests passed**. Booking engine, schedule, issue-model and Cradle Live core: **11 files, 83 tests passed**. Cross-subsystem preservation: **9 files, 86 tests passed**. The feed-health test passed separately and with the booking suite. Some files overlap between commands; counts are per run, not cumulative unique tests.
- Full `pnpm lint`: **0 errors, 22 pre-existing warnings** outside this correction. Focused ESLint and `git diff --check`: passed. `pnpm type-check` and a fresh `pnpm exec tsc --noEmit --incremental false --pretty false`: passed. An earlier dev-generated `.next/dev/types/validator.ts` was malformed; it disappeared during normal Next regeneration without manual cache deletion. The temporary isolated TS config was not equivalent to the project setup and is not used as a quality-gate result.
- Authenticated Playwright at 1920×1080: New Booking modal opened from `/crm/today`, displayed exactly three mode cards, and selected Phone / Future with one click. No nested source controls remained. The dialog measured 1180×820 pixels; console errors: zero. Mocked tests proved a valid Phone / Future Save reaches `createInhouseBookingMultiAction`, keeps `markArrived=false`, emits the bookings-changed event, and calls the modal owner's success callback. Live Save was **not** used: automatic approval review rejected the production write-capable click and directed use of mocks.
- Cradle Live fixture at 1920×1080 showed six lifecycle stages, separate multi-guest service lines, partial-capacity rooms, schedule/attendance states, issues, and explicit payment wording. No horizontal or vertical overflow; console errors: zero. Prior checks verified reduced motion, fullscreen entry/exit, and the extended-window permission fallback. A physical second monitor was unavailable, so placement remains unverified. Screenshot paths: `.tmp/phone-future-unified-modal-2026-10-26-1920x1080.png` and `.tmp/cradle-live-stabilization-2026-10-26-1920x1080.png` (synthetic wallboard).

## Bounded performance and source inventory

- One local development navigation to the real, read-only `/crm/live-operations` route: navigation duration **4,196 ms**, first response byte **614 ms**, DOM content loaded **4,195 ms**, encoded document body **43,617 bytes**. One manual read-only refresh generated an RSC response lasting **2,677 ms** with **27,569 encoded bytes**. These are single browser observations and exclude any production percentile claim.
- Static composition: **9 parallel top-level source groups** followed by **3 room reads**. The Operations source launches **8 initial nested source calls**; the direct availability source launches **4**; the previous-day schedule resolves through **5 direct reads**; the Operations snapshot starts **5 more nested sources**. Conditional booking/order, readiness, and trip paths add further reads. An exact database round-trip count and individual SQL duration were not measured without intrusive profiling of the production-configured server.
- A repeated availability path exists: Cradle Live loads availability directly and Operations snapshot also loads an availability snapshot. No cache, index, denormalization, polling change, or broad query rewrite was introduced without runtime query evidence. The board retains one coordinated 60-second refresh, marks stale/error states, and shows unavailable diagnostics instead of a healthy result when feeds fail.

## Limits, rollback and next boundary

- No approved LOCAL/TEST database configuration was available for a production build or a real booking creation. Production query latency and physical extended-monitor placement remain unverified. The configured production data was read only through the authorized authenticated dashboard route; no synthetic fixture data was written to operational tables.
- **Selective rollback:** in `quick-booking-form.tsx`, restore only the prior source selector/state/validation if the owner rejects this UX correction; preserve the pre-existing `fallbackImageUrl` and customer layout hunks. Revert the new tests in `quick-booking-payment-intent.test.tsx`; remove `cradle-live-board-feed-health.test.tsx` if desired. In `cradle-live-board.tsx`, revert only the added `Payment due`/`Paid` prefix. Do not run `git restore` on the whole booking form, Cradle Live folder, or other dirty files: that would discard unrelated local work. Review `git diff` before and after a selective reversal.
- **Recommendation: PASS for local owner review.** This is not production release approval. A later authorized release gate must use an approved LOCAL/TEST build target, independent review, and any required production performance/monitor evidence. Commit, push, merge, deployment and database mutation remain unauthorized.
