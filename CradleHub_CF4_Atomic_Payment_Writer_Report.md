# CradleHub CF4 — Atomic Payment Posting Engine
## Evidence & Acceptance Report

**Stage:** CF4 — Atomic Payment Posting Engine
**Branch:** `stage/cf-financial-foundation`
**CF4 Authorized Base SHA:** `6fa758ec0f113d6af01ce1c0c27b4d133d4448dd`
**CF4 Implementation SHA:** `a880eb300de5bc70372922ab89ab499879ab9ff8`
**CF4 Initial Evidence SHA:** `46194e6644d723e506727129e1eec8eafe1f918f`
**Date:** 2026-09-28
**Program:** CradleHub Web — Controlled Stabilization

---

## 1. Authorization Chain

| Stage | Status | Notes |
|-------|--------|-------|
| CF0 — Financial Discovery | COMPLETE | Baseline analysis & schema audit |
| CF0.1 — Architecture Reconciliation | COMPLETE | Financial architecture alignment |
| CF1 — Financial Contract Freeze | CONTRACT FROZEN | Canonical schema definitions locked |
| CF2 — Financial Accounts + Transaction Foundation | ACCEPTED | Core ledger tables, accounts, RLS, disposable DB verified |
| CF3 — Order Payables + Allocation Foundation | ACCEPTED | Order payables, allocation schema, derived balance contract |
| CF4 — Atomic Payment Posting Engine | **FINAL EVIDENCE VERIFIED** | Canonical secure payment posting engine |

---

## 2. Scope Delivered & Boundaries

CF4 implemented exclusively the canonical secure atomic payment posting engine for orders:

- Database RPC: `public.post_order_payment_atomic` (SECURITY DEFINER)
- Helper Function: `public.derive_order_payment_state` (derived financial status computation)
- Payment Modes:
  - Full customer payment
  - Partial customer payment
  - Split-tender (multi-rail) customer payment (e.g. Cash + GCash)
  - Deposit / advance payment to a booking order
- Allocation Engine:
  - Order-level allocation (default: `payable_item_id = NULL`)
  - Item-level explicit allocation (`payable_item_id` targeted to order items)
  - Strict total matching: sum of allocations must equal sum of payments
  - Cross-order item protection: payable items must belong to the target order
- Idempotency & Concurrency:
  - Strong idempotency key tracking with exact payload hashing
  - Safe replay returning original transaction with `is_idempotent_replay: true`
  - Conflict detection rejecting modified payloads with `IDEMPOTENCY_CONFLICT`
  - Transactional advisory locking and `FOR UPDATE` row locking
- Derived State & Consistency:
  - Real-time calculation of `unpaid`, `partial`, `paid` states
  - Zero-payable order rejection (`ZERO_PAYABLE_ORDER`)
  - Overpayment prevention (`PAYMENT_EXCEEDS_REMAINING_BALANCE`, `ORDER_ALREADY_PAID`)
- Server Adapter & Domain Typing:
  - Server-side wrapper `recordOrderPayment` in `src/lib/cash-flow/payment-writer.ts`
  - Zod schemas and TypeScript interfaces in `src/lib/cash-flow/financial-contract.ts`
  - RPC declaration in `src/types/supabase.ts`
- Verification Suite:
  - Application unit tests in `tests/lib/cash-flow/payment-writer-contract.test.ts`
  - Automated disposable DB harness in `scripts/verification/validate-cf4-payment-writer.mjs`

### Explicit Out-of-Scope Confirmation
The following components were **NOT** implemented in CF4:
- Cash Flow UI / POS front-desk checkout interface
- Expenses and vendor payouts
- Refunds and credit memos
- Gift vouchers and discount coupons
- Customer-credit application
- Tips and gratuity handling
- Payroll and commissions
- Cash sessions (drawer open, float, blind drops, count)
- Day Close / end-of-day reconciliation
- Digital reconciliation against gateway statements
- Retail-only POS and CRM redesign

---

## 3. Files Delivered

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260927140000_cf4_atomic_payment_writer.sql` | Migration defining `post_order_payment_atomic` RPC and `derive_order_payment_state` |
| `src/lib/cash-flow/payment-writer.ts` | Server-side adapter `recordOrderPayment(client, payload)` |
| `tests/lib/cash-flow/payment-writer-contract.test.ts` | 26 application-level contract unit tests |
| `scripts/verification/validate-cf4-payment-writer.mjs` | Disposable PostgreSQL Docker verification harness (37 machine check increments) |

### Modified Files
| File | Purpose |
|------|---------|
| `src/lib/cash-flow/financial-contract.ts` | Added payment schemas (`PaymentPartPayloadSchema`, `PaymentAllocationPayloadSchema`, `PostOrderPaymentPayloadSchema`, `FinancialPaymentMethodSchema`, etc.) |
| `src/types/supabase.ts` | Registered `post_order_payment_atomic` RPC in database interface |

---

## 4. Database Migration Details

- **Filename:** `supabase/migrations/20260927140000_cf4_atomic_payment_writer.sql`
- **SHA256:** `F0CFAB02C8B684693791DE66D0959D15C9988F1A05DD7F126D868F7F56CBB2CA`

### RPC Signature
```sql
CREATE OR REPLACE FUNCTION public.post_order_payment_atomic(
  p_order_id           UUID,
  p_idempotency_key    TEXT,
  p_payments           JSONB,
  p_allocations        JSONB    DEFAULT NULL,
  p_business_date      DATE     DEFAULT NULL,
  p_external_reference TEXT     DEFAULT NULL,
  p_notes              TEXT     DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```

---

## 5. Security, Concurrency, and Policy Specifications

### Security Model
1. **Execution Privileges:** Executable exclusively by `authenticated` role (`REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`). Anonymous execution is explicitly denied.
2. **Context Pinning:** Defined with `SECURITY DEFINER` and locked to `search_path = public, pg_temp` to prevent search path hijacking.
3. **Caller Authentication:** Inspects `auth.uid()`; raises `AUTH_REQUIRED` if unauthenticated.
4. **Staff Validation:** Resolves `public.staff` by `auth.uid()`; raises `STAFF_NOT_FOUND` if missing or `STAFF_INACTIVE` if marked inactive.
5. **Branch Authorization:** Verifies that caller's branch matches the order's branch (`BRANCH_UNAUTHORIZED`), unless the caller possesses system-wide owner privileges.
6. **Ledger Defense (RLS):** Direct `INSERT`, `UPDATE`, or `DELETE` on financial tables (`financial_transactions`, `financial_account_movements`, `financial_order_allocations`) by `authenticated` users is denied by RLS policies; all financial ledger mutations must occur via validated RPCs.

### Concurrency & Advisory Locking
- **Serialization:** Obtains transaction-level advisory lock `pg_advisory_xact_lock(hashtext('order_payment_' || p_order_id::text))` before reading order state.
- **Row-Level Lock:** Issues `SELECT ... FOR UPDATE` on the target order row.
- **Race Condition Prevention:** Completely eliminates balance check race conditions under parallel execution. Concurrent calls either serialize or replay idempotently.

### Idempotency Model
- Uses `p_idempotency_key` stored in `financial_transactions.idempotency_key`.
- An SHA256 digest of the request payload is verified against the recorded transaction.
- **Identical Replay:** Returns existing transaction details with `is_idempotent_replay: true` and status code 200 without creating duplicate ledger records.
- **Payload Conflict:** If the idempotency key matches an existing transaction but the payload differs, raises `IDEMPOTENCY_CONFLICT`.

### Payment Modes & Multi-Rail Tender
Supports single or split-tender payments across authorized rails:
| Payment Rail (`payment_method`) | Required Account Type (`financial_accounts.type`) |
|---------------------------------|--------------------------------------------------|
| `cash`                          | `cash_drawer`                                    |
| `gcash`                         | `gcash`                                          |
| `maya`                          | `maya`                                           |
| `bank_transfer`                 | `bank_transfer`                                  |
| `card`                          | `card_terminal`                                  |

Each payment tender produces a corresponding `financial_account_movements` record preserving payment method, financial account, amount, and tender-specific external references.

### Allocation Engine
- **Order-Level Allocation:** If `p_allocations` is omitted or empty, creates an allocation record with `payable_item_id = NULL` for the full payment amount.
- **Item-Level Allocation:** Validates that each referenced `payable_item_id` belongs to `p_order_id` (`CROSS_ORDER_ITEM_MISMATCH`).
- **Sum Integrity:** Sum of item allocations must strictly equal sum of payment tenders (`ALLOCATION_TOTAL_MISMATCH`).

### Overpayment & Zero-Payable Policy
- Orders with zero or negative total payable are rejected immediately (`ZERO_PAYABLE_ORDER`).
- Orders already settled (`remaining_balance <= 0`) are rejected (`ORDER_ALREADY_PAID`).
- Payments exceeding the remaining balance are rejected (`PAYMENT_EXCEEDS_REMAINING_BALANCE`).

### Legacy Compatibility & Historical Preservation
- **Dual-Read / Safe Isolation:** The CF4 writer writes exclusively to the new financial tables (`financial_transactions`, `financial_account_movements`, `financial_order_allocations`).
- **Legacy Booking Columns:** Existing columns on `bookings` (`payment_status`, `payment_method`, `total_amount`, etc.) are left intact and unaffected.
- **Legacy Payment Logs:** The `booking_payment_logs` table is completely untouched and continues to function independently for legacy workflows until future migration.

---

## 6. Disposable DB Verification & Assertion Count

- **Database Container:** `public.ecr.aws/supabase/postgres:17.6.1.167` (disposable, destroyed after verification)
- **Harness:** `scripts/verification/validate-cf4-payment-writer.mjs`
- **Result:** `37 checks passed` (0 failed)

### Assertion Structure & Count Breakdown
The harness organizes checks under top-level labels `[A]` through `[AE]` (31 label groups) and records 37 machine check increments (`passedCount` increments):
- Helper `assertSuccess()` increments `passedCount++` on RPC success.
- Helper `assertFailure()` increments `passedCount++` on expected SQL error code.
- Helper `assertEqual()` verifies state equality without auto-increment; blocks of `assertEqual()` assertions are recorded via a group increment `passedCount++`.

| Label | Checks Counted | Description | Result |
|-------|----------------|-------------|--------|
| **[A]** | 1 | CF2 + CF3 + CF4 migrations apply cleanly in sequence | PASS |
| **[B]** | 1 | `post_order_payment_atomic` RPC exists in `information_schema.routines` | PASS |
| **[C]** | 1 | Unauthenticated execution denied (`AUTH_REQUIRED`) | PASS |
| **[D]** | 1 | Unauthorized branch staff execution denied (`BRANCH_UNAUTHORIZED`) | PASS |
| **[E]** | 1 | Inactive staff execution denied (`STAFF_INACTIVE`) | PASS |
| **[F]** | 1 | Account belonging to different branch denied (`ACCOUNT_BRANCH_MISMATCH`) | PASS |
| **[G]** | 1 | Inactive financial account denied (`ACCOUNT_INACTIVE`) | PASS |
| **[H]** | 1 | Payment method and account type mismatch denied (`ACCOUNT_TYPE_MISMATCH`) | PASS |
| **[I]** | 1 | Zero payment amount rejected (`INVALID_PAYMENT_AMOUNT`) | PASS |
| **[J]** | 1 | Negative payment amount rejected (`INVALID_PAYMENT_AMOUNT`) | PASS |
| **[K]** | 1 | Full payment succeeds; derived state = `paid`, remaining balance = 0 | PASS |
| **[L]** | 1 | Partial payment succeeds; derived state = `partial`, balance updated | PASS |
| **[M]** | 1 | Split Cash + GCash payment succeeds atomically | PASS |
| **[N]** | 1 | Exactly one transaction header created for split payment | PASS |
| **[O]** | 1 | Two movement records created preserving distinct tender attribution | PASS |
| **[P]** | 1 | Order-level allocation recorded with `payable_item_id = NULL` | PASS |
| **[Q]** | 2 | Item-level allocation succeeds targeting explicit order payable items | PASS |
| **[R]** | 1 | Cross-order item allocation rejected (`CROSS_ORDER_ITEM_MISMATCH`) | PASS |
| **[S]** | 2 | Idempotent replay returns original transaction (`is_idempotent_replay: true`) | PASS |
| **[T]** | 1 | Idempotent replay creates zero duplicate movements or allocations | PASS |
| **[U]** | 1 | Conflicting payload under existing idempotency key rejected (`IDEMPOTENCY_CONFLICT`) | PASS |
| **[V]** | 2 | Failure mid-execution rolls back atomically with zero orphan records | PASS |
| **[W]** | 1 | Zero-payable order payment rejected (`ZERO_PAYABLE_ORDER`) | PASS |
| **[X]** | 1 | Negative-payable order payment rejected (`ZERO_PAYABLE_ORDER`) | PASS |
| **[Y]** | 2 | Payment on settled order (`ORDER_ALREADY_PAID`) and overpayment (`PAYMENT_EXCEEDS_REMAINING_BALANCE`) rejected | PASS |
| **[Z]** | 3 | Direct authenticated INSERT denied by RLS on `transactions`, `movements`, `allocations` | PASS |
| **[AA]** | 1 | Derived payment state logic correctly calculates settled, partial, unpaid | PASS |
| **[AB]** | 1 | Historical booking rows without orders remain completely untouched | PASS |
| **[AC]** | 1 | Historical `booking_payment_logs` records remain completely untouched | PASS |
| **[AD]** | 1 | Concurrent identical idempotency requests safely deduplicated | PASS |
| **[AE]** | 1 | Concurrent balance race serialized under lock without over-allocation | PASS |
| **Total** | **37** | **All 37 verification increments passed across 67 granular assertions** | **PASS** |

---

## 7. Quality Gates & Verification Evidence

### Cash Flow Tests
```text
pnpm vitest run tests/lib/cash-flow/
Test Files  3 passed (3)
Tests       71 passed (71)
Result      PASS
```

### Bookings Tests
```text
pnpm vitest run tests/lib/bookings/
Test Files  21 passed (21)
Tests       159 passed (159)
Result      PASS
```

### TypeScript Type Check
```text
pnpm type-check
Exit Code   0
Errors      0
Result      PASS
```

### Targeted ESLint (CF4 Changes)
```text
pnpm eslint src/lib/cash-flow/financial-contract.ts src/lib/cash-flow/payment-writer.ts src/types/supabase.ts tests/lib/cash-flow/payment-writer-contract.test.ts scripts/verification/validate-cf4-payment-writer.mjs --max-warnings=0
Exit Code   0
Errors      0
Warnings    0
Result      PASS
```

### Full Repository Lint
```text
pnpm lint
Exit Code   1 (Pre-existing repository baseline)
Problems    114 (88 errors, 26 warnings)
Location    Exclusively in tests/lib/pwa/*
CF4 Intro   0 errors, 0 warnings introduced by CF4
```

### Production Build
```text
pnpm build
Exit Code   0 (Next.js Turbopack build completed successfully)
Result      PASS
```

### Git Whitespace Check
```text
git diff --check
Exit Code   0 (No whitespace errors)
Result      PASS
```

---

## 8. Rollback Strategy

If rollback of CF4 is required prior to production adoption:
1. **Database Rollback:**
   ```sql
   DROP FUNCTION IF EXISTS public.post_order_payment_atomic(UUID, TEXT, JSONB, JSONB, DATE, TEXT, TEXT);
   DROP FUNCTION IF EXISTS public.derive_order_payment_state(UUID);
   ```
2. **Code Rollback:**
   - Remove `src/lib/cash-flow/payment-writer.ts`
   - Remove `tests/lib/cash-flow/payment-writer-contract.test.ts`
   - Remove `scripts/verification/validate-cf4-payment-writer.mjs`
   - Revert schema additions in `src/lib/cash-flow/financial-contract.ts` and `src/types/supabase.ts`
3. **Safety Guarantee:** Because CF4 introduced purely additive functions and adapters with zero changes to existing table schemas or booking payment tables, rolling back or removing the migration has zero side effects on existing booking operations.

---

## 9. Limitations & Operating Constraints

1. **Backend Engine Only:** CF4 provides the secure database RPC and server-side TypeScript adapter. It does not provide front-end UI components or front-desk POS forms.
2. **Order Dependency:** The RPC requires an existing order record in `orders` (or `financial_order_allocations`/`order_payable_items`). Payments for off-order items or direct legacy bookings must first establish order payables via CF3 foundation.
3. **No Refund/Voucher Logic:** The engine handles payments and deposits only. Credit note applications, voucher redemptions, and refunds belong to subsequent authorized stages.

---

## 10. Production Impact Assessment

- **Existing Booking Engine:** Zero operational impact. The existing booking payment flow continues to write to legacy booking tables.
- **Data Integrity:** Fully isolated ledger. All payments posted via `post_order_payment_atomic` are ACID compliant, idempotently protected, and concurrency-safe.
- **Migration Deployment:** The migration is non-destructive and additive (creates two functions). It does not lock existing application tables.

---

## 11. Production Safety Attestation

- Target database for all verification: Local disposable Docker container (`public.ecr.aws/supabase/postgres:17.6.1.167`).
- All Docker containers and scratch databases destroyed upon completion.
- Zero production mutations executed.
- Zero git pushes or remote branch changes made.
- Zero merges to `main`.
- Repository working tree is clean.

---

## 12. Stopping Condition & Sign-off

CF4 implementation and evidence verification are **COMPLETE**.
CF5 has **NOT** been authorized and has **NOT** been started.
Awaiting owner authorization for subsequent stages.

*Report updated: 2026-09-28T07:30:00+08:00*
