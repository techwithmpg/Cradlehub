# CradleHub CF3 — Order Payables + Financial Allocation Foundation Report

## A. TARGET/STAGE
- **Target Repository:** `E:\cradlehub-booking-simplification`
- **Program:** CradleHub Web — Controlled Stabilization
- **Stage:** CF3 — ORDER PAYABLES + FINANCIAL ALLOCATION FOUNDATION

## B. BRANCH
- `stage/cf-financial-foundation`

## C. IMPLEMENTATION BASE SHA
- `0e2ea15ffaa8d5fa6dd0b356e846bc55d4eded56`
- **CF3 Implementation Commit SHA:** `c7c9a1c0e9cd64502fc90c96b729e1e7d5d31f7a`

## D. FILES CHANGED
1. `supabase/migrations/20260927130000_cf3_order_payables_allocations.sql` (New — CF3 database migration creating `order_payable_items`, `financial_order_allocations`, `derive_order_payment_state`, `v_booking_order_financial_summaries`, triggers, RLS, and explicit role grants)
2. `src/lib/cash-flow/financial-contract.ts` (Modified — Added CF3 domain taxonomy, Zod schemas, type definitions, and pure validation helpers)
3. `src/types/supabase.ts` (Modified — Generated Supabase schema types for CF3 tables, views, and functions)
4. `tests/lib/cash-flow/order-payable-contract.test.ts` (New — Unit test suite validating CF3 charge types, sign rules, tip/voucher exclusion, two-tier allocations, and pure state derivation)
5. `scripts/verification/validate-cf3-order-payables.mjs` (New — Reusable verification harness exercising disposable PostgreSQL across 34 programmatic assertions [A] through [AH])

## E. CF1 DECISIONS IMPLEMENTED
- **CF1-D05 (Unified order payable items):** Implemented `public.order_payable_items` as the canonical granular component model of an order's payable obligation.
- **CF1-D06 (Two-tier allocation):** Implemented `public.financial_order_allocations` supporting order-level default allocation (`payable_item_id IS NULL`) and specific payable-item allocation (`payable_item_id IS NOT NULL`).
- **CF1-D07 (Payment state strictly derived):** Implemented `public.derive_order_payment_state()` and security-invoker view `public.v_booking_order_financial_summaries` deriving `unpaid`, `partial`, `paid`, and `overpaid` strictly from `total_payable` and `net_allocated`.
- **CF1-D14 (Home Service fee is payable):** Supported `charge_type = 'home_service_fee'` as a positive payable charge. Fulfillment fuel/driver allowances remain distinct expense outflows and are not included in payables.
- **CF1-D15 (Retail boundary):** Supported `charge_type = 'retail_product'` attached to booking orders; pure retail POS remains deferred and does not synthesize fake booking orders.
- **CF1-D19 (Legacy booking payment compatibility):** Preserved legacy booking fields (`amount_paid`, `payment_status`) as read-only historical snapshots without activating premature bi-directional synchronization.
- **CF1-D22 (Row Level Security & Authorization):** RLS enabled with deny-by-default write access for `authenticated` role and branch-isolated / cross-branch owner read policies.

## F. BOOKING CONTRACT INSPECTION
- Inspected BKG3 atomic booking schema:
  - Canonical order table: `public.booking_orders(id)`
  - Canonical service-line booking table: `public.bookings(id, order_id)`
  - Booking order relationship: `bookings.order_id` references `booking_orders(id)`
  - Historical bookings without `order_id`: Remain compatible with `order_id IS NULL`; CF3 strictly enforces that new payable items and allocations require valid `booking_orders.id`, and never backfills or synthesizes fake orders for historical rows.

## G. IMMUTABLE BOOKING-TIME PAYABLE SOURCE
- In BKG3, booking creation snapshots service pricing into `bookings.metadata->'price'`, `bookings.metadata->'service_line'`, and `booking_orders.metadata->'subtotal_amount'`.
- In CF3, `public.order_payable_items.amount` acts as the canonical immutable monetary amount for each line item. Catalog changes in `services.price` never retroactively alter existing order payables.

## H. ORDER PAYABLE SCHEMA
- Table: `public.order_payable_items`
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `order_id UUID NOT NULL REFERENCES public.booking_orders(id) ON DELETE RESTRICT`
  - `booking_id UUID REFERENCES public.bookings(id) ON DELETE RESTRICT`
  - `charge_type TEXT NOT NULL CHECK (charge_type IN ('service', 'home_service_fee', 'retail_product', 'surcharge', 'discount', 'manual_adjustment', 'other_charge'))`
  - `description TEXT NOT NULL`
  - `amount NUMERIC(12,2) NOT NULL`
  - `currency TEXT NOT NULL DEFAULT 'PHP'`
  - `sequence INT NOT NULL DEFAULT 1`
  - `source_type TEXT`
  - `source_id UUID`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `created_by UUID`

## I. CHARGE TAXONOMY
- Allowed Charge Types:
  - `service`: Primary salon/spa service line
  - `home_service_fee`: Customer-facing travel charge
  - `retail_product`: Attached retail item
  - `surcharge`: Peak-time or specialized surcharge
  - `discount`: Promotional or loyalty reduction
  - `manual_adjustment`: Authorized positive or negative manual correction
  - `other_charge`: Generic approved miscellaneous fee
- Excluded Types:
  - `tip`, `tip_collected`: Excluded (tips are custodial pass-throughs, not company receivables)
  - `voucher`: Excluded (gift vouchers are financial payment tenders or liability issuances)
  - `customer_credit`: Excluded (customer credits are payment tenders, not payable charges)

## J. AMOUNT SIGN SEMANTICS
- Database check constraint `chk_order_payable_amount_sign`:
  - `service`, `home_service_fee`, `retail_product`, `surcharge`, `other_charge`: strictly `amount > 0`
  - `discount`: strictly `amount < 0`
  - `manual_adjustment`: strictly `amount <> 0`
- Zero-amount items are rejected at the database level.

## K. HOME SERVICE PAYABLE BOUNDARY
- Customer-facing travel fee is captured under `charge_type = 'home_service_fee'` with positive amount.
- Driver fare, fuel allowances, and vehicle operating costs are operating expenses and are excluded from order payables.

## L. RETAIL BOUNDARY
- Retail products sold in conjunction with a booking order are supported via `charge_type = 'retail_product'`.
- Pure retail sales without bookings are out of scope for CF3 and do not create fake booking orders.

## M. ALLOCATION SCHEMA
- Table: `public.financial_order_allocations`
- Columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `financial_account_movement_id UUID NOT NULL REFERENCES public.financial_account_movements(id) ON DELETE RESTRICT`
  - `order_id UUID NOT NULL REFERENCES public.booking_orders(id) ON DELETE RESTRICT`
  - `payable_item_id UUID REFERENCES public.order_payable_items(id) ON DELETE RESTRICT`
  - `amount NUMERIC(12,2) NOT NULL CHECK (amount > 0)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `created_by UUID`

## N. TWO-TIER ALLOCATION INVARIANT
- Order-level default allocation: `payable_item_id IS NULL`. Allocates payment to the order as a whole without forcing line-by-line CSR attribution.
- Item-level allocation: `payable_item_id IS NOT NULL`. Allocates payment to a specific payable line item.
- Cross-order item invariant enforced by database trigger `trg_validate_financial_order_allocation`: If `payable_item_id` is present, it must belong to the exact same `order_id`.

## O. SPLIT-PAYMENT ATTRIBUTION
- Allocations reference individual `financial_account_movements(id)`.
- Split payments (e.g., Cash 1,000 + GCash 200) produce distinct movement records, and allocations preserve distinct payment-rail attribution rather than collapsing into a single method string.

## P. DOUBLE-COUNT PREVENTION
- Every row in `financial_order_allocations` represents a distinct slice of satisfied monetary obligation.
- Summing `financial_order_allocations.amount` for an order reflects the net allocated value.
- An order-level allocation and an item-level allocation cannot coexist for the same dollar: each row must reference a distinct movement amount allocation, bounded by the source movement's total value via trigger `fn_validate_financial_order_allocation`.

## Q. DERIVED PAYABLE TOTAL
- Computed via `COALESCE(SUM(amount), 0.00)` over `order_payable_items` where `order_id = target_order_id`.

## R. DERIVED ALLOCATED TOTAL
- Computed via `COALESCE(SUM(amount), 0.00)` over `financial_order_allocations` where `order_id = target_order_id`.

## S. DERIVED PAYMENT STATE
- Evaluated via `public.derive_order_payment_state(p_total_payable, p_net_allocated)`:
  - `total_payable < 0` → `'invalid_negative_payable'`
  - `net_allocated == 0` → `'unpaid'` (for `total_payable > 0`)
  - `0 < net_allocated < total_payable` → `'partial'`
  - `net_allocated == total_payable` → `'paid'`
  - `net_allocated > total_payable` → `'overpaid'`
- Refund states (`partially_refunded`, `refunded`) are structurally modeled in the taxonomy but not yet operationally produced in CF3 (documented as STRUCTURALLY SUPPORTED — NOT YET OPERATIONALLY PRODUCED).

## T. ZERO-PAYABLE BEHAVIOR
- Fully discounted or 100% promotional orders where `total_payable = 0.00`:
  - When `net_allocated = 0.00` → derived state is `'paid'` (obligation satisfied with zero payment required).
  - When `net_allocated > 0.00` → derived state is `'overpaid'`.

## U. RLS / AUTHORIZATION
- Row Level Security is enabled on `order_payable_items` and `financial_order_allocations`.
- Deny-by-default writes: Direct `INSERT`, `UPDATE`, and `DELETE` privileges are revoked from `authenticated` and `anon` roles. Only privileged server RPCs / service role can perform writes.
- Read access:
  - Staff: Restricted to orders belonging to their assigned branch (`get_auth_branch_id()`).
  - Owner: Cross-branch access permitted (`get_auth_role() = 'owner'`).

## V. APPEND-ONLY / DELETE PROTECTION
- Immutability trigger `trg_enforce_financial_allocation_immutability` blocks `UPDATE` and `DELETE` on `financial_order_allocations`.
- `ON DELETE RESTRICT` foreign keys on `financial_order_allocations(payable_item_id)` prevent destructive deletion of payable items that have attached financial allocations.

## W. DATABASE CONSTRAINTS
- `chk_order_payable_charge_type`: Validates permitted charge types.
- `chk_order_payable_amount_sign`: Enforces sign rules per charge type.
- `chk_financial_order_allocation_amount_positive`: Enforces `amount > 0` on allocations.
- Foreign Key Constraints:
  - `fk_order_payable_items_order_id` (RESTRICT)
  - `fk_order_payable_items_booking_id` (RESTRICT)
  - `fk_financial_order_allocations_movement_id` (RESTRICT)
  - `fk_financial_order_allocations_order_id` (RESTRICT)
  - `fk_financial_order_allocations_payable_item_id` (RESTRICT)

## X. INDEXES
- `idx_order_payable_items_order_id` ON `public.order_payable_items(order_id)`
- `idx_order_payable_items_booking_id` ON `public.order_payable_items(booking_id)`
- `idx_financial_order_allocations_order_id` ON `public.financial_order_allocations(order_id)`
- `idx_financial_order_allocations_movement_id` ON `public.financial_order_allocations(financial_account_movement_id)`
- `idx_financial_order_allocations_payable_item_id` ON `public.financial_order_allocations(payable_item_id)`

## Y. DISPOSABLE DB HARNESS
- Implemented in `scripts/verification/validate-cf3-order-payables.mjs`.
- Harness Mode: DISPOSABLE MODELED PRE-CF3 SCHEMA VALIDATION.
- Uses official Supabase PostgreSQL image (`public.ecr.aws/supabase/postgres:17.6.1.167`) in a dedicated disposable container with automatic cleanup on exit.

## Z. DB ASSERTION RESULTS
All 34 required assertions passed cleanly (37 assertions executed including sub-checks):
- **[A] CF2 + CF3 migrations applied cleanly:** PASS
- **[B] Expected CF3 tables/views exist:** PASS (`order_payable_items`, `financial_order_allocations`, `v_booking_order_financial_summaries`)
- **[C] Normal positive service payable accepted:** PASS
- **[D] Discount negative amount accepted:** PASS
- **[E] Invalid sign/type combinations rejected:** PASS (negative service, zero service, positive discount)
- **[F] Service payable references valid booking/order:** PASS
- **[G] Cross-order booking/payable mismatch rejected:** PASS
- **[H] Home Service fee accepted as payable:** PASS
- **[I] Tip payable type rejected:** PASS
- **[J] Voucher payable type rejected:** PASS
- **[K] Customer credit payable type rejected:** PASS
- **[L] Historical booking without order is not automatically backfilled:** PASS
- **[M] Valid order-level allocation accepted:** PASS
- **[N] Valid item-level allocation accepted:** PASS
- **[O] Item belongs to same order invariant enforced:** PASS
- **[P] Invalid movement FK rejected:** PASS
- **[Q] Invalid payable FK rejected:** PASS
- **[R] Allocation amount zero rejected:** PASS
- **[S] Allocation exceeding source movement rejected by trigger:** PASS
- **[T] Branch read isolation:** PASS (Staff A sees Branch A only; Staff B sees Branch B only)
- **[U] Owner cross-branch authorized read:** PASS (Owner reads all branches)
- **[V] Direct authenticated payable INSERT rejected:** PASS
- **[W] Direct authenticated allocation INSERT rejected:** PASS
- **[X] Allocation UPDATE rejected by immutability trigger:** PASS
- **[Y] Allocation DELETE rejected by immutability trigger:** PASS
- **[Z] Referenced payable destructive delete rejected:** PASS
- **[AA] Split-payment attribution preserved across two movements:** PASS
- **[AB] Order-level allocation cannot double-count with item allocation:** PASS
- **[AC] Derived unpaid:** PASS
- **[AD] Derived partial:** PASS
- **[AE] Derived paid:** PASS
- **[AF] Derived overpaid:** PASS
- **[AG] Zero-payable and net-negative edge case behaviors:** PASS
- **[AH] Transaction rollback leaves no partial records:** PASS

## AA. CASH FLOW TESTS
- Executed `pnpm test tests/lib/cash-flow/ --run`
- **Result:** 2/2 test files passed, 45/45 tests passed.

## AB. BOOKING REGRESSION
- Executed `pnpm test tests/lib/bookings/ --run`
- **Result:** 21/21 test files passed, 159/159 tests passed.

## AC. TYPECHECK
- Executed `pnpm type-check` (`tsc --noEmit`)
- **Result:** PASS (0 errors).

## AD. TARGETED ESLINT
- Executed `pnpm eslint src/lib/cash-flow/financial-contract.ts src/types/supabase.ts tests/lib/cash-flow/order-payable-contract.test.ts scripts/verification/validate-cf3-order-payables.mjs`
- **Result:** PASS (0 errors, 0 warnings).

## AE. FULL LINT
- Executed `pnpm lint`
- **Result:** `FAIL — PRE-EXISTING REPOSITORY BASELINE` (114 problems: 88 errors, 26 warnings in `tests/lib/pwa/*`; 0 problems introduced in CF3 files).

## AF. BUILD
- Executed `pnpm build` (`next build` with Turbopack)
- **Result:** PASS (Compiled successfully, static page generation 148/148 complete).

## AG. git diff --check
- Executed `git diff --check`
- **Result:** PASS (Clean, zero whitespace or line ending issues).

## AH. MIGRATION SHA256
- `964E4AC1FC4D1CCC11BA217827C6E8EE094FC00EABF6C8C8D9068AE4623EBECF`

## AI. WORKING TREE
- Clean after commits.

## AJ. PRODUCTION DATABASE OPERATIONS
- **NONE** (No remote or production database touched).

## AK. DEPLOYMENT
- **NONE** (No deployment executed).

## AL. PUSH / MERGE
- **NONE** (Local commits only; no git push or git merge executed).

## AM. OUT-OF-SCOPE CONFIRMATION
- Confirmed: Front-desk checkout UI, payment collection RPC, replacing booking payment writers, expenses, customer credits, gift vouchers, tips, payroll payout, cash sessions, Day Close, digital reconciliation, retail POS implementation, CRM redesign, and production deployment were NOT touched.

## AN. LIMITATIONS / DEFERRED WRITER INVARIANTS
- Transactional payment collection and cash drawer movement writers are deferred to CF4.
- Direct table insertion for order payables and allocations remains blocked for client roles; transactional integrity will be handled via dedicated server RPCs in future stages.

## AO. FINAL VERDICT
- **PASS — CF3 ORDER PAYABLE & ALLOCATION FOUNDATION VERIFIED LOCALLY**
