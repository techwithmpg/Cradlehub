# WEB — Booking Operations Stabilization (P1 package)

**Date:** 2026-11-09 · **Stage:** controlled P1 corrections · **Owner authorization:** one coordinated Web booking operational fix package.

## Baseline and scope

- Target repo: `techwithmpg/Cradlehub` **Web only**.
- Accepted base: `main` `038737dc470201f0fdd0ec1231506a8707b6d170` (merged PR #88).
- Fix branch: `fix/web-p1-booking-operations-20261109`; no direct `main` implementation.
- In-scope: overdue pending review, proposed controlled pending holds, order-date reschedule invariant, two-computer acceptance, booking/payment lifecycle regression, actionable contact communications including international callback fallback.
- Out-of-scope: speculative UI redesign, automatic historical booking cancellation, production DML/DDL, changes to attended/completed visits, client authorization bypass, CRM cash ledger rewrites, SMS sender/service activation, Desktop implementation and other unmerged Web stage branches (PRs #82, #76, #22 etc.).
- Active Web stages must be independently reconciled before merge; no cross-stage or cross-repository authorization is implied.

## Ownership and preserved functionality

- Public booking writer: `createOnlineBookingMultiAction` → `create_booking_order_atomic` (existing service-role server call).
- CRM booking writer: `executeInhouseBookingCreation` → `create_inhouse_order_with_payment_atomic` (existing actor/branch authorization).
- CRM confirmation: `confirm_online_booking_order_atomic` (production already rechecks pending expiry, provider and room capacity, and validates branch).
- Existing payment writer: `post_order_payment_atomic` / `post_order_payment_with_discounts_atomic`; immutable financial movements and order financial-summary view remain **authoritative**.
- CRM read models: Today, Bookings, Upcoming, order service lines; real-time events are invalidation hints only.
- Staff/CRM notifications are best-effort persisted in-app; external SMS is a distinct opt-in service. Do not imply Twilio delivery on successful booking creation.
- No local/offline cache becomes source of authorization, booking capacity, or payment truth.

## Verified facts

1. **LIVE read-only production database, 2026-11-09:** 24 past-dated `pending_crm_confirmation` service lines across 18 orders and 27 legacy standalone `pending_payment` lines. Historic null-hold requests are excluded from Today-to-future incoming query and the normal operational list hides unattended past dates.
2. **LIVE read-only production database:** 135 orders created in last 90 days had 0 missing financial summaries, negative totals or payable-versus-paid-versus-balance arithmetic mismatches. No checkout/receipt/browser certification is claimed.
3. **LIVE read-only production database:** two recent order header/current service-line date mismatches followed recorded rescheduling. Parent-date semantics are a proposed contract, not yet approved in database.
4. **LIVE read-only production database:** `confirm_online_booking_order_atomic` already guards expired holds, staff conflicts, room capacity and locks order/booking lines; `crm_booking_row_blocks_availability` currently blocks `pending_crm_confirmation` without expiry. The existing `bookings` table also has attendance, timing, assignment and overlap triggers.
5. **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** Public booking previously rejected international numbers; provider SMS dispatch is disabled unless explicitly configured and scheduled. In-app therapist assignments from a group may share the *primary booking ID*, so direct line-by-line notification counts are not proof of missing delivery.
6. **LIVE deployment metadata:** production Vercel `READY` at baseline `038737dc...`; does not prove live authenticated multi-client behavior.

## Changes implemented on branch

- Explicit branch-scoped, read-only `/crm/bookings?overdue=true&tab=needs-action` review mode, plus conditional tiny CSR link in Today. Retains historical records and existing action/authorization paths, preserves ordinary Today and Upcoming scopes, and bypasses the *view-only* stale-date filtering **only** for this review mode.
- International E.164 phone syntax accepted with **required email fallback** for public single/multi bookings, while local +63/09 behavior is unchanged. Customer receipt/automatic SMS delivery is not inferred. The existing single CRM `booking_created` action notice mentions email fallback instead of creating duplicate popups.
- Prepared TypeScript hold logic: explicit future CRM hold expires; null historical holds still block. This source change remains behavior-neutral until the **separate reviewed DB installation** creates holds on new requests.
- Review-only SQL proposal for new pending hold triggers/DB availability policy and in-transaction parent order date synchronization. **NOT a migration or production DB change**; the SQL proposal requires a canonical migration created with approved CLI after isolated DB testing.
- Read-only financial/notification/date audit SQL, frontend and backend contract regressions, and a limited GitHub PR-only test workflow.

## Release blockers / required acceptance

1. **Automation:** GitHub workflow passing; targeted Vitest; Next.js type check; ESLint; formatting. Any failures require correction. GitHub/Vercel status alone is not browser acceptance.
2. **Backend DATABASE:** owner approves 120-minute after-hours hold policy and order header semantics; isolated Postgres concurrency, signed RLS, staff/room capacity, all attendance triggers and rollback; authorized staged migration; never replay local-only historical migrations. Current live holds/database not changed.
3. **Two-computer REAL browser:** two logged-in CSR computers in same branch; one creates CRM walk-in/future order, other sees list/Today/Schedule immediately; public booking appears in both; focused/hidden/offline/reconnected recovery; other branch never sees it. Include group and staff preference. No real customer bookings should be created as QA data.
4. **Payment lifecycle LOCAL/TEST:** public/CRM single/group → pending → confirm → check-in → service start → duration/extension → complete → senior/PWD/VIP discount → split payment → receipt → cash flow; compare committed financial movements and voucher/stock if relevant; verify duplicate/retry idempotency and drawer ownership. No live financial mutation.
5. **Communication:** therapist reassignment and Home Service driver notices reach correct staff PWA with acknowledgment, not just DB row existence. Test international callbacks/email fallback in CRM; SMS provider activation, sender pool, recipient country permissions, consent and opt-out are separate release gates.
6. **Customer policy:** publish accurate public request/expiry wording only when hold activation is approved; do not promise booked/confirmed appointment or automatic international SMS before confirmation.
7. **Review:** independent reviewer inspects branch from accepted base, full diff, active PR overlaps, gates, risk/rollback; owner approves before merge/deploy.

## Rollback

- Web only: revert review/query scope and contact changes if unexpected; no data rollback needed (no production mutation in this branch).
- Proposed DB: cannot roll back individual expiring holds by merely reverting TypeScript; rollback **must** restore the previous DB availability function and drop newly installed triggers in an independently tested transaction; retain any bookings created during activation. SQL proposal is not installed.

## Evidence limitations

Remote GitHub connector may create commits/tests/PR but the current workspace cannot run Node 24/pnpm or two authenticated browser sessions. The GitHub Actions workflow is a new check; inspect its actual run and do not claim PASS before logs show PASS. No isolated Postgres database or device/sender credentials are provided. This draft must remain unmerged until all release blockers are addressed.
