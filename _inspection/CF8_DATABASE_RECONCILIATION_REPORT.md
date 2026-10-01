# CF8 database contract reconciliation — 2026-09-29

## Verdict and baseline

**Repository correction drafted; production deployment and new CF8 behavior remain unverified.**

- Branch: `stage/cf-financial-foundation`
- Base HEAD: `431db1f8e779adca017cbcf66d678c4265f8f298`
- Current HEAD: `431db1f8e779adca017cbcf66d678c4265f8f298` (no commit in this pass)
- Working tree: pre-existing authorized uncommitted CF8 changes were preserved. This pass adds edits to pending migration SQL, canonical Cash Flow/CRM projections, tests, and these inspection files. No reset, stash, clean, commit, push, merge, or deploy occurred.
- Linked project: `lsrbwqhvzjfpiabeolkv` (`Creadlehub` in the connected project list), matching the repository's recorded production ref.
- Live access: **read-only catalog access succeeded** through the approved Supabase connection. The catalog observations below are **LIVE READ-ONLY VERIFIED FACTS**. An aggregate booking-data count was rejected by automatic approval review because the authorization covered schema/catalog inspection, not production business records. It was not retried indirectly.

## Current application and database contract

The active BKG3 model uses `booking_orders.organizer_customer_id` for the organizer, `booking_attendees` for recipients, and `bookings` as service-line rows. `bookings.customer_id` is organizer compatibility, `bookings.attendee_id` is the actual recipient, and `bookings.staff_id` holds line provider assignment. `order_id IS NULL` remains a supported legacy path. There is no separate `booking_service_lines` table in BKG3.

Canonical payment authority is `financial_transactions` plus signed `financial_account_movements`, with `financial_order_allocations` and `v_booking_order_financial_summaries` for orders. An order-level partial payment does not imply a booking-level allocation. The single-booking mirror is permitted only when the sole payable is its service line. Order-only charges stay on the order.

### Live contract observed

The linked project records migration `20260927080000_bkg3_booking_order_atomic`. `booking_orders`, `booking_attendees`, `bookings.order_id`, `bookings.attendee_id`, and `bookings.line_sequence` exist. The order and attendee tables have RLS enabled; `v_booking_orders` has `security_invoker=true`. `create_booking_order_atomic` is a pinned-search-path SECURITY INVOKER function granted to `service_role`. `bookings` is in `supabase_realtime`; order and attendee tables are not.

`staff.system_role` exists and `staff.role` does not. The live booking payment method CHECK lacks `bank_transfer`. The live `record_booking_payment_change` function changes booking snapshots and logs but creates no canonical financial transaction. It is currently executable by `authenticated` and `service_role`. The live booking trigger catalog contains no generic payment-posting trigger.

The live catalog lacks all CF2/CF3/CF4/CF6/CF7/CF8 financial tables, views, and RPCs, including `financial_accounts`, `financial_transactions`, `financial_account_movements`, `order_payable_items`, `financial_order_allocations`, expense/tip/commercial details, `cash_sessions`, `post_order_payment_atomic`, and `post_booking_payment_atomic`. The private `expense-receipts` bucket and named policies are absent. These are expected pending forward migration effects, not evidence of a failed production deployment.

See [CF8_DATABASE_RECONCILIATION_GAP_MATRIX.txt](CF8_DATABASE_RECONCILIATION_GAP_MATRIX.txt) for the object-by-object comparison.

## Root causes and authority map

1. BKG3 reached production before the pending CF financial migrations. The application branch already references the pending financial contract.
2. Pending CF4/CF6/CF7/cash-session code assumed `staff.role`, while the live role authority is `staff.system_role`.
3. The old booking snapshot RPC is still directly callable in the live schema and carries no financial evidence. The pending CF8 command must replace application usage before its direct grant is revoked.
4. Cash Flow previously summed every positive movement, allowing transfers and company-custodied tips to inflate receipts. The repository query now classifies receipt transaction types before calculating receipt totals.

| UI/server field | Database authority |
| --- | --- |
| Order amount paid, balance, payment state | `v_booking_order_financial_summaries` derived from payables and allocations |
| Order-backed booking payment badge/action | Canonical order summary; order payment command |
| Legacy booking payment badge/action | Booking compatibility snapshot plus explicit legacy payment command |
| Cash Flow receipts and payment mix | Posted receipt transaction types and their signed account movements |
| Expense | `operational_expense` transaction, negative movement, expense detail |
| Direct staff tip | Tip detail; no company movement or revenue |
| Company-custodied tip | Positive account movement plus pending-disbursement tip detail; excluded from receipts |
| Transfer | Equal negative/positive account movements; excluded from receipts and expense totals |
| Opening float | `cash_sessions.opening_float`, never a transaction or movement |
| Provider | `bookings.staff_id` on each service line |
| Attendee | `booking_attendees` and `bookings.attendee_id` |
| Organizer/contact | `booking_orders.organizer_customer_id` |
| Customer Home Service fee | `order_payable_items` with `home_service_fee` |
| Actual driver/fuel/fare cost | Independent operational expense entry |

## Forward migrations drafted or corrected

All listed files are new forward migrations relative to the live migration history; none was applied. No additional reconciliation migration is needed because the affected files are still unapplied. Apply them in this dependency order only after a separate owner deployment authorization:

| Order | File | Purpose, dependency, data impact, security impact |
| --- | --- | --- |
| 1 | `20260927120000_cf2_financial_foundation.sql` | Creates accounts, transactions, movements, masked view. Depends on live branches/staff. Additive; no booking data rewrite. RLS role lists aligned with `system_role`. |
| 2 | `20260927130000_cf3_order_payables_allocations.sql` | Creates payable items, allocations, order summary view. Depends on BKG3 and CF2. Additive; no historical allocation. RLS role lists aligned. |
| 3 | `20260927140000_cf4_atomic_payment_writer.sql` | Creates order payment RPC. Depends on CF2/CF3. No automatic receipt creation. Corrected to `system_role` and explicit financial role gate. |
| 4 | `20260928120000_cf6_operational_cash_flow_writers.sql` | Creates expense/tip/commercial details and writers. Depends on CF2. Adds standard category codes only. Removed arbitrary-staff auth fallback, scoped detail RLS to branch, pinned function search paths, and explicit table/function grants. |
| 5 | `20260929120000_cf7_expense_receipt_storage.sql` | Creates private bucket/policies and 11-argument expense writer. Depends on CF6. No expense-row rewrite; replaces CF6's 10-argument overload. Corrected role checks, auth, search path, and grant. |
| 6 | `20260929130000_cf8_cash_sessions_foundation.sql` | Creates drawer sessions and open RPC. Depends on CF2. No opening-float ledger movement. One-open-drawer partial unique index. Auth now precedes idempotency replay; RLS and grants stay restricted. |
| 7 | `20260929140000_cf8_booking_payment_command.sql` | Replaces CF4 order writer, adds explicit booking payment and atomic in-house composition, widens booking payment method CHECK for bank transfer, revokes old snapshot RPC from app roles. Depends on BKG3 and CF2/CF3/CF4. No historical payment backfill. |

The CF8 order writer now checks the exact tender account, rail, amount, and reference on idempotent replay. Multi-booking partials stay order-level. The in-house wrapper composes BKG3 creation, payable items, and optional CF4 payment in one database transaction. Unpaid/pay-on-site creation posts no receipt.

## Application/server corrections and writer coverage

CRM, Manager, Owner, and Cradle Flow booking payment actions use `post_booking_payment_atomic`; Cash Flow Record Payment uses `post_order_payment_atomic`. The in-house/walk-in/Home Service path uses `create_inhouse_order_with_payment_atomic` and posts payment inside the same boundary only when collected. Public online multi-booking uses BKG3 and is initially unpaid. Desktop/server API delegates to the in-house engine. The old single online legacy action remains for compatibility and creates an unpaid legacy booking without a receipt.

The in-house wizard now requires an explicit collected-now or pay-later choice. Pay later sends no payment rail or reference and creates no receipt; collected-now requires a rail. The public multi-booking action rejects a `pay_now` request because online collection has no supported payment command. These guards prevent a booking request from claiming collection without canonical evidence.

Cradle Flow and CRM Today now project order state for order-backed tickets. The pending payment and action lists deduplicate siblings by order and send order payments to Cash Flow. Legacy tickets continue to use booking fields. Cash Flow receipts use posted canonical receipt movements; unmatched booking snapshots appear as reconciliation items. The cash drawer expected amount uses signed movements created after opening, independently of a transaction's business date.

`src/types/supabase.ts` already contains repository-pending CF2/CF3 draft types but not all CF6/CF8 additions. Production type generation now would erase pending schema requirements, so it was not run. Server RPC adapters currently carry the pending signatures. Regenerate and review types from a known migrated TEST target before production deployment, then from production after acceptance.

Application/server files in the current authorized worktree: `src/app/(dashboard)/crm/bookings/actions.ts`, `src/app/(dashboard)/crm/today/page.tsx`, `src/app/(dashboard)/manager/bookings/actions.ts`, `src/app/(dashboard)/owner/bookings/actions.ts`, `src/app/api/desktop/v1/bookings/route.ts`, `src/components/features/bookings/quick-booking-form.tsx`, `src/components/public/booking-wizard.tsx`, `src/lib/actions/online-booking.ts`, `src/lib/bookings/{inhouse-booking-engine,payment-transaction,revalidate-booking-surfaces}.ts`, `src/lib/validations/booking.ts`, `src/lib/queries/bookings.ts`, `src/lib/crm/cradle-flow.ts`, the Cradle Flow Today components/tabs, and `src/lib/cash-flow/{cash-flow-actions,cash-flow-queries,cash-flow-types,payment-evidence}.ts` with the Cash Flow Today, Ledger, workspace, record-entry, and open-drawer components. Existing authorized edits in those files were preserved.

## Data impact, security, and rollback

No historical receipt, order, or allocation is synthesized. Existing booking snapshots remain compatibility evidence and may appear as unmatched reconciliation rows. No data normalization is proposed. The only existing-table constraint change widens accepted `bookings.payment_method` values to include `bank_transfer`; it does not rewrite rows. The exact population of legacy paid snapshots is unknown because the aggregate production business-data query was rejected by automatic approval review. Any future historical reconciliation requires a separate authorization and a specific population/rollback plan.

The live BKG3 RLS and function grant were inspected. Pending financial tables enable RLS. CF6 detail policies are branch scoped, and direct authenticated writes are revoked. Pending CF2/CF3 immutability functions and CF4/CF6/CF7/CF8 monetary RPCs now pin an empty `search_path`; monetary RPCs require `auth.uid()`, active staff, accepted `system_role`, and branch checks, and anonymous execution is revoked. The in-house composition RPC is SECURITY INVOKER, granted only to `service_role`, with actor identity supplied by the verified server action. The application must continue to keep the service-role key server-side.

Rollback before any new financial writes would restore the prior application release and reverse only the exact newly applied schema objects after dependency review. Once canonical transactions exist, dropping CF tables would destroy new evidence and is not an acceptable automatic rollback. Use an incident-specific compensating migration and preserve ledger records. CF7's overload replacement and CF8's old-RPC revoke require coordinated application deployment so old writers are not left calling removed interfaces.

## Verification and later deployment plan

Focused repository Vitest passed: 40 test files and 332 tests. Targeted ESLint, `pnpm type-check`, and `git diff --check` passed. Static tests cover DB01–DB30 across the existing CF suites and `cf8-database-reconciliation.test.ts`. No migration runtime test was run against production or any unknown database target. The read-only catalog script [CF8_DATABASE_RECONCILIATION_VERIFY.sql](CF8_DATABASE_RECONCILIATION_VERIFY.sql) is available for a known target.

Later, with explicit owner authorization: establish a known TEST target, apply only the seven listed forward migrations there in order, run catalog checks and transactional payment/booking cases, resolve generated types, review data impact and security, then schedule an application/database cutover for the confirmed production ref. Apply only those exact migrations to production under a separate owner gate; verify schema, grants, RLS, and real payments with authorized controlled procedures. Do not replay or mark historical local-only migrations to reconcile version history.

NO PRODUCTION MUTATION PERFORMED

MIGRATIONS NOT APPLIED

NO HISTORICAL MIGRATION REPLAY

NOT VERIFIED IN PRODUCTION FOR NEW CF8 BEHAVIOR
