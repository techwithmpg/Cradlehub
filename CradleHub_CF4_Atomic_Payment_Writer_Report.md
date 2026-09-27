# CradleHub CF4 — Atomic Payment Posting Engine
## Evidence & Acceptance Report

**Stage:** CF4 — Atomic Payment Posting Engine  
**Branch:** `stage/cf-financial-foundation`  
**CF4 Implementation SHA:** `a880eb3`  
**CF4 Authorized Base SHA:** `6fa758ec0f113d6af01ce1c0c27b4d133d4448dd`  
**Date:** 2026-09-27  
**Program:** CradleHub Web — Controlled Stabilization

---

## 1. Authorization Chain

| Stage | Status |
|-------|--------|
| CF0 — Financial Discovery | COMPLETE |
| CF0.1 — Architecture Reconciliation | COMPLETE |
| CF1 — Financial Contract Freeze | CONTRACT FROZEN |
| CF2 — Financial Accounts + Transaction Foundation | ACCEPTED (after Correction Pass 1) |
| CF3 — Order Payables + Allocation Foundation | ACCEPTED |
| CF4 — Atomic Payment Posting Engine | **IMPLEMENTED — AWAITING ACCEPTANCE** |

---

## 2. Scope Delivered

CF4 implemented exclusively:

- `public.post_order_payment_atomic` — canonical secure SECURITY DEFINER RPC
- Full, partial, and split-tender (multi-rail) customer payment posting
- Deposit / advance payment to a booking order
- Order-level allocation (default: null `payable_item_id`)
- Item-level explicit allocation (`payable_item_id` specified per allocation)
- Payment idempotency with conflict detection
- Resulting derived financial state (via `derive_order_payment_state`)
- Compatibility bridge: legacy `bookings.*` payment columns and `booking_payment_logs` left completely untouched
- Server adapter `recordOrderPayment` in `src/lib/cash-flow/payment-writer.ts`
- Domain contract types in `src/lib/cash-flow/financial-contract.ts`
- RPC type registration in `src/types/supabase.ts`
- Application-level unit tests
- Disposable DB verification harness

**NOT implemented (explicitly excluded):**
Cash Flow UI, expenses, refunds, vouchers, customer-credit application, tips, payroll, cash sessions, Day Close, digital reconciliation, retail-only POS, CRM redesign.

---

## 3. Files Delivered

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260927140000_cf4_atomic_payment_writer.sql` | Database migration: `post_order_payment_atomic` RPC + `derive_order_payment_state` helper |
| `src/lib/cash-flow/payment-writer.ts` | Server-side adapter `recordOrderPayment(client, payload)` |
| `tests/lib/cash-flow/payment-writer-contract.test.ts` | 26 application-level contract tests |
| `scripts/verification/validate-cf4-payment-writer.mjs` | Disposable Docker PostgreSQL verification harness (37 assertions) |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/cash-flow/financial-contract.ts` | Added `PaymentPartPayloadSchema`, `PaymentAllocationPayloadSchema`, `PostOrderPaymentPayloadSchema`, `PostOrderPaymentResult`, `FinancialPaymentMethodSchema` |
| `src/types/supabase.ts` | Registered `post_order_payment_atomic` RPC in type registry |

---

## 4. Database Migration: `post_order_payment_atomic`

### Signature
```sql
CREATE OR REPLACE FUNCTION public.post_order_payment_atomic(
  p_order_id          UUID,
  p_idempotency_key   TEXT,
  p_payments          JSONB,
  p_allocations       JSONB    DEFAULT NULL,
  p_business_date     DATE     DEFAULT NULL,
  p_external_reference TEXT    DEFAULT NULL,
  p_notes             TEXT     DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
```

### Security Controls
- `SECURITY DEFINER` with pinned `search_path = public, pg_temp`
- `GRANT EXECUTE` to `authenticated` role only (no `anon` grant)
- `auth.uid()` validated; unauthenticated callers raise `AUTH_REQUIRED`
- Staff resolution: active staff record required; inactive staff raise `STAFF_INACTIVE`
- Branch authorization: non-owner staff cannot post to other branches
- Advisory lock + `SELECT ... FOR UPDATE` on order row for concurrency safety
- No direct DML permissions on financial tables for `authenticated` role

### Guards & Validation
| Check | Error Code |
|-------|-----------|
| No `auth.uid()` | `AUTH_REQUIRED` |
| Staff not found | `STAFF_NOT_FOUND` |
| Staff inactive | `STAFF_INACTIVE` |
| Non-owner posting to other branch order | `BRANCH_UNAUTHORIZED` |
| Order not found | `ORDER_NOT_FOUND` |
| Account not found | `ACCOUNT_NOT_FOUND` |
| Account inactive | `ACCOUNT_INACTIVE` |
| Account belongs to wrong branch | `ACCOUNT_BRANCH_MISMATCH` |
| Payment method / account type mismatch | `ACCOUNT_TYPE_MISMATCH` |
| Amount <= 0 | `INVALID_PAYMENT_AMOUNT` |
| Order has zero payable | `ZERO_PAYABLE_ORDER` |
| Order already paid | `ORDER_ALREADY_PAID` |
| Payment exceeds remaining balance | `PAYMENT_EXCEEDS_REMAINING_BALANCE` |
| Idempotency key conflict | `IDEMPOTENCY_CONFLICT` |
| Allocation total != payment total | `ALLOCATION_TOTAL_MISMATCH` |
| Cross-order item allocation | `CROSS_ORDER_ITEM_MISMATCH` |

### Rail / Account-Type Compatibility
| Payment Method | Required Account Type |
|----------------|----------------------|
| `cash` | `cash_drawer` |
| `gcash` | `gcash` |
| `maya` | `maya` |
| `bank_transfer` | `bank_transfer` |
| `card` | `card_terminal` |

---

## 5. Quality Gates

### Unit Tests
| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| `tests/lib/cash-flow/` | 3 | 71 | PASS |
| `tests/lib/bookings/` | 21 | 159 | PASS |

### Type Check
`pnpm type-check` — exit 0, 0 errors

### Targeted ESLint (CF4 files only)
`pnpm eslint [CF4 files] --max-warnings=0` — exit 0, 0 errors, 0 warnings

### Full Repository Lint
`pnpm lint` — FAIL — PRE-EXISTING REPOSITORY BASELINE
114 problems (88 errors, 26 warnings) — all in `tests/lib/pwa/*`
Zero problems introduced by CF4.

### Build
`pnpm build` — exit 0, Next.js Turbopack build succeeded

### Git Whitespace Check
`git diff --check` — exit 0, no violations

---

## 6. Disposable DB Verification — All 37 Assertions Passed

Container: `public.ecr.aws/supabase/postgres:17.6.1.167` (disposable, destroyed after run)
Harness: `scripts/verification/validate-cf4-payment-writer.mjs`
Migration stack applied: CF2 → CF3 → CF4 on clean modeled schema

ALL CF4 DATABASE ASSERTIONS PASSED (37 checks passed)

| Assertion | Description | Result |
|-----------|-------------|--------|
| [A] | CF2 + CF3 + CF4 migrations apply cleanly | PASS |
| [B] | `post_order_payment_atomic` RPC exists | PASS |
| [C] | Unauthenticated execution denied | PASS |
| [D] | Unauthorized branch user denied | PASS |
| [E] | Inactive staff denied | PASS |
| [F] | Wrong branch financial account denied | PASS |
| [G] | Inactive financial account denied | PASS |
| [H] | Payment method / account type mismatch denied | PASS |
| [I] | Zero payment denied | PASS |
| [J] | Negative payment denied | PASS |
| [K] | Full payment succeeds; state = paid, remaining = 0 | PASS |
| [K.1-4] | Summary fields correct | PASS |
| [L] | Partial payment succeeds; state = partial, remaining = 1000 | PASS |
| [L.1-4] | Summary fields correct | PASS |
| [M] | Split Cash + GCash succeeds (1000 + 500) | PASS |
| [N] | Exactly one transaction header for split payment | PASS |
| [O] | Two movements with preserved tender attribution | PASS |
| [O.1-6] | Movement amounts, methods, external reference correct | PASS |
| [P] | Order-level allocation succeeds (null payable_item_id) | PASS |
| [Q] | Item-level allocation succeeds targeting explicit payable item | PASS |
| [Q.1-3] | Allocation record present, amount correct | PASS |
| [R] | Cross-order item allocation denied | PASS |
| [S] | Idempotency retry returns original transaction (is_idempotent_replay: true) | PASS |
| [T] | Idempotency replay does not create duplicate movements | PASS |
| [U] | Conflicting payload same idempotency key rejected | PASS |
| [V] | Transaction rollback leaves zero partial records on failure | PASS |
| [W] | Zero-payable order cannot accept payment | PASS |
| [X] | Negative-payable order rejected | PASS |
| [Y.1] | Payment on settled order rejected | PASS |
| [Y.2] | Payment exceeding remaining balance rejected | PASS |
| [Z.1] | Direct authenticated INSERT into financial_transactions denied (RLS) | PASS |
| [Z.2] | Direct authenticated INSERT into financial_account_movements denied (RLS) | PASS |
| [Z.3] | Direct authenticated INSERT into financial_order_allocations denied (RLS) | PASS |
| [AA] | Derived payment states for settled, partial, unpaid orders correct | PASS |
| [AB] | Historical booking rows without orders remain completely untouched | PASS |
| [AC] | Historical booking_payment_logs remain completely untouched | PASS |
| [AD] | Concurrent identical idempotency requests deduplicated safely | PASS |
| [AE] | Concurrent balance race handled safely without over-allocation | PASS |

---

## 7. Commit Record

| Commit | SHA | Message |
|--------|-----|---------|
| CF4 Implementation | `a880eb3` | `feat(cash-flow): add atomic payment posting engine (CF4)` |

Prior accepted commits (not amended):
CF2 Impl: `6a04af7e` | CF2 Evidence: `fdf72c61` | CF2 Correction: `93d00045` | CF3 Base: `0e2ea15f` | CF3 Impl: `c7c9a1c0` | CF4 Auth Base: `6fa758ec`

---

## 8. Production Safety

- Zero production mutations
- Zero push to remote
- Zero merge
- No git history rewrite, amend, force-push, or reset
- All verification against disposable Docker container — destroyed after run
- Database target: LOCAL/DISPOSABLE — confirmed

---

## 9. Stopping Condition

CF4 is complete. CF5 is NOT authorized and has NOT been started.
No further work proceeds without explicit owner authorization.

*Report generated: 2026-09-27T16:43:00+08:00*
