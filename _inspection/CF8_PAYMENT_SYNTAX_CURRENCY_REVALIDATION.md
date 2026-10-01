# CF8 payment syntax and order-currency safety — handoff

## Task, authorization, and baseline

- Owner-authorized narrow correction: remove the parser-sensitive inline `CASE` from the CF8 booking-payment replay `IF`; enforce PHP-only order currency in pending order-backed payment writers; preserve BKG3 and existing daily reconciliation.
- Branch: `stage/cf-financial-foundation`. Baseline and current HEAD: `20afec933f830a3a2a6670bb5c13b53a1e04e411`; work remains uncommitted.
- Validation target: **PRODUCTION** Supabase project `lsrbwqhvzjfpiabeolkv`, SQL role `postgres`.
- The local `origin/main` ref is `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a`; its merge base with this stage branch is `f8977cce5c1286402eed2e6805ba0428c38dc660`. The branch has not been reconciled with accepted main in this correction pass.
- Scope remains correction, focused tests, live read-only inspection, and rollback-only validation. No persistent migration, history change, business-record mutation, commit, push, merge, or deploy was authorized.

## Changes and decisions

- `20260929140000_cf8_booking_payment_command.sql`: computes `v_expected_source_type` and `v_expected_source_id` before replay comparison; uses `IS DISTINCT FROM`. The inline `IF variable <> CASE ... END OR ...` construct is gone.
- `20260927140000_cf4_atomic_payment_writer.sql` and the CF8 replacement of `post_order_payment_atomic`: load `booking_orders.currency` and reject any value distinct from `PHP` with `UNSUPPORTED_ORDER_CURRENCY: Cash Flow currently supports PHP orders only`, after actor/branch authorization and before posting.
- CF8 `post_booking_payment_atomic` checks the locked parent order's currency before replay or payment mutation. Paid `create_inhouse_order_with_payment_atomic` checks the actual created/replayed order currency before returning or calling the writer. Unpaid creation is not changed by this payment-only guard.
- No `booking_orders` CHECK constraint, conversion, exchange rate, order rewrite, or new currency system was added.
- BKG3 remains `booking_orders` + `booking_attendees` + service-line rows in `bookings` (`order_id`, `attendee_id`, `line_sequence`). No `booking_service_lines` table was created.
- Existing `public.daily_cash_reconciliations` remains untouched. It is an existing consumer/source-of-truth candidate for later CF8-E Day Close inspection; future work must inspect consumers and decide authority before any integration or replacement.

## Evidence actually run

- Focused Cash Flow Vitest: **11 files, 163 tests passed**. Added checks for the currency guard across writers/compositions, precomputed replay source, and preserved BKG3/reconciliation scope.
- Targeted ESLint on changed test: passed. `pnpm type-check`: passed. `git diff --check`: passed (line-ending warnings only).
- **Full seven-migration rollback-only validation passed** in approved order: CF2, CF3, CF4, CF6, CF7, CF8 cash sessions, CF8 booking payment command. One transaction used `BEGIN`, `SET LOCAL lock_timeout='5s'`, `SET LOCAL statement_timeout='120s'`, the seven SQL bodies with only their outer `BEGIN/COMMIT` wrappers removed for validation, then `ROLLBACK`. The target returned `rollback_complete`.
- Post-validation **PRODUCTION read-only** check: `financial_accounts` absent, `cash_sessions` absent, `expense-receipts` bucket absent, zero rows for the seven pending versions in migration history, and `daily_cash_reconciliations` present. `booking_service_lines` remains absent.
- Read-only aggregate of `booking_orders.currency` returned no rows; this is not a runtime test of a non-PHP order.

## Production impact, limits, and next action

The previous SQLSTATE `42601` compilation blocker is resolved in rollback-only validation. Runtime booking payment, receipt, idempotency, and non-PHP rejection behavior remain unverified on production because the migrations are not applied. The seven migrations remain pending. The existing Cash Flow page correctly reports unavailable required data until they are applied.

NO PERSISTENT PRODUCTION MIGRATION APPLIED

NO PRODUCTION BUSINESS DATA MUTATED

NO HISTORICAL MIGRATION REPLAY

NEW CF8 BEHAVIOR NOT YET PRODUCTION VERIFIED

The next permitted action is owner review of these uncommitted corrections and the already proposed forward migration-version synchronization plan. Reconcile this working branch with accepted `origin/main` before formal final review. Persistent PRODUCTION application, migration-history synchronization, business-data tests, commit, push, merge, and deploy each remain outside this authorization and require the applicable owner gate.
