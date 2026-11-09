# WEB P1 — Public/CRM booking consistency hotfix (2026-11-09)

## Authority and scope
- Target: **CradleHub Web only**, controlled stabilization P1 correction.
- Owner authorization: 2026-11-09 request to implement on a separate fix branch and open a pull request, including necessary backend changes.
- Branch: `fix/web-p1-public-crm-booking-consistency-20261109`.
- Verified accepted base: `main` at `009658a35a47cb07186899d9836788274949ac6c`.
- No implementation on `main`, merge, production deployment, database DML/DDL, Auth/RLS or migration changes authorized by this PR.
- Boutique/other Web or Desktop branches remain independent and untouched.

## Source of truth, consumers and preservation
- Authoritative server booking lines: `public.bookings`, with `booking_orders` and `booking_attendees`; payments come from order financial summaries.
- Public creation: `createOnlineBookingMultiAction` / `create_booking_order_atomic`.
- CRM creation: `executeInhouseBookingCreation` / `create_inhouse_order_with_payment_atomic`.
- CRM readers: `getCrmBookingsOperationalData`, `getCrmBookingsCommandCenterRows`, `getCrmUpcomingBookings`, `getCrmOrderServiceLines`; SWR/retained workspace invalidation handles presentation.
- Client-side realtime event payloads are **never** applied to booking records; events only invalidate authorized server reads.
- The existing staff notifications, payment/checkout, attendance, dispatch, staff assignments and customer-booking flows are preserved.

## Verified observations, limitations
- **Live read-only database observation** (2026-11-09): Supabase `supabase_realtime` publication already includes `public.bookings`; `public.bookings` has RLS with CRM/CSR/manager read policies.
- **Live read-only database observation**: 135 orders created in the preceding 90 days had service lines and attendee records; two order/line date divergences had a recorded reschedule audit; no recent requested-vs-assigned staff ID mismatch was found in 214 booking lines. These checks are not an end-to-end transaction test or browser verification.
- **Live read-only database observation**: 24 past-date public booking lines remained `pending_crm_confirmation` across both branches. Historical disposition requires staff review; this hotfix **does not** auto-close/cancel or rewrite them.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE**: CRM display data used branch/date queries with limited upcoming-window expansion; a selected daily booking did not explicitly hydrate out-of-date sibling order lines. The UI notification stream was not a reliable way to invalidate CRM bookings for every remote public/CRM creation.

## Changes
1. Subscribe the CRM layout to `bookings` INSERT/UPDATE by trusted branch ID (Supabase authenticated Postgres Changes), debounce reconciliation events, refresh on initial subscribe, reconnect/timeout, focus/visibility or online recovery, and cleanly remove listeners/subscription.
2. Reuse existing retained workspace invalidation and authoritative SWR refresh to keep both front-desk computers in sync without mutating local booking caches.
3. In server `getCrmBookingsOperationalData`, when a booking is explicitly selected, expand **its complete branch-scoped order** in Daily as well as Upcoming. Preserve daily-only scope when no booking is selected. Keep financial summaries on the established authoritative order-scoped path.
4. Regression tests for scoped subscription/invalidation/recovery, cleanup, selected-order hydration, and unselected daily date scope.

## Test and release gate
- Proposed exact targeted commands from the repository:
  - `pnpm exec vitest run tests/components/crm/crm-bookings-realtime-bridge.test.tsx tests/lib/bookings/crm-order-hydration.test.ts`
  - `pnpm exec vitest run tests/components/crm/bookings-generation-swr.test.tsx tests/lib/bookings/crm-bookings-api.test.ts tests/lib/bookings/booking-order-contract.test.ts`
  - `pnpm type-check`
  - `pnpm exec eslint src/components/features/bookings/crm-bookings-realtime-bridge.tsx src/app/'(dashboard)'/crm/layout.tsx src/lib/queries/crm-bookings-operational.ts tests/components/crm/crm-bookings-realtime-bridge.test.tsx tests/lib/bookings/crm-order-hydration.test.ts`
  - `pnpm format:check`
- **Not run in the current connector-only environment**: installed Node 24/pnpm dependency checks, browser test with two authenticated CRM sessions, native device tests or isolated Postgres concurrency tests.
- Vercel preview check: the branch deployment was **CANCELED** because the existing Ignored Build Step (`[ "$VERCEL_GIT_COMMIT_REF" != "main" ]`) returned exit code 0. This intentionally skips non-`main` builds; Vercel status `success` is **not** a compiled preview or test pass. Do not alter this gate within the hotfix.
- A GitHub/Vercel build or preview is not equivalent to live cross-device browser acceptance.
- A release should be blocked until CI and independent reviewer inspect branch diff, targeted tests, actual authenticated browser scenarios, live read authorization and cross-device reconciliation.
- A test-only backend source fix is included; **no DB migration required for this scoped fix**. Historical parent-order date semantics and overdue pending booking disposition are separately gated.

## Impact, rollback, independence
- Expected positive impact: more reliable server-authoritative CRM list refresh on booking writes; correct order-group detail for deep links after partial reschedule.
- Risk: additional authorized CRM reads on booking-write bursts, initial socket subscription, visibility/online recovery; debounced per branch session.
- Rollback: revert the layout bridge mount and the bounded server query hydration change; no SQL/data rollback needed.
- No unmerged branch is treated as accepted baseline. No production behavior is claimed verified by repository changes.
