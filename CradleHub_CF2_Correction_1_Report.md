# CradleHub CF2 — Correction Pass 1 Evidence Report

## A. TARGET
- **Target Repository:** `E:\cradlehub-booking-simplification`
- **Program:** CradleHub Web — CONTROLLED STABILIZATION
- **Stage:** CF2 — CORRECTION PASS 1 (SECURITY VALIDATION + MOVEMENT TAXONOMY CORRECTION)

## B. BRANCH
- `stage/cf-financial-foundation`

## C. CORRECTION BASE SHA
- `fdf72c612587da42f4960a2cc77f73628dc50d72`

## D. PRIOR CF2 IMPLEMENTATION SHA
- `6a04af7ee6463f02345ddb61500ba428f53959de`

## E. PRIOR CF2 EVIDENCE SHA
- `fdf72c612587da42f4960a2cc77f73628dc50d72`

## E.1. CF2 CORRECTION SHA
- `93d000453a2bc473a5d46da7831265129133bcde`

## F. DEFECTS CORRECTED
1. **Programmatic RLS Assertions:** Replaced passive SELECT console logging with strict, machine-checked assertions (`assertSuccess`, `assertFailure`, `assertEqual`, `assertRowCount`, `assertContains`, `assertNotContains`). Any assertion mismatch immediately throws and terminates the harness with a non-zero exit code.
2. **Authenticated Direct Financial Writes Proved Denied:** Validated that ordinary operational staff under simulated `authenticated` role cannot directly perform `INSERT`, `UPDATE`, or `DELETE` on canonical ledger tables (`financial_accounts`, `financial_transactions`, `financial_account_movements`).
3. **Movement Payment Method Taxonomy Narrowed to Real Money Rails:** Removed `voucher` and `customer_credit` from `financial_account_movements.payment_method`. Movements now strictly permit real financial account rails (`cash`, `gcash`, `maya`, `bank_transfer`, `card`).
4. **Reproducible Repository-Owned Validation Harness:** Created `scripts/verification/validate-cf2-financial-foundation.mjs`, dynamically resolving the repository root, provisioning a fresh disposable PostgreSQL container, asserting 32 checks, and cleaning up automatically.
5. **Accurate Full Repository Lint Classification:** Truthfully classified repository lint status as `FAIL — PRE-EXISTING REPOSITORY BASELINE` (114 inherited problems in `tests/lib/pwa/*`; 0 introduced by CF2) rather than misrepresenting it as passing.

## G. FILES CHANGED
1. `supabase/migrations/20260927120000_cf2_financial_foundation.sql` (Updated check constraint on `financial_account_movements.payment_method`)
2. `src/lib/cash-flow/financial-contract.ts` (Narrowed `FINANCIAL_PAYMENT_RAILS` and movement validation)
3. `src/types/supabase.ts` (Updated TypeScript database schema definitions for payment method)
4. `tests/lib/cash-flow/financial-foundation-contract.test.ts` (Added negative tests asserting rejection of non-money rails)
5. `scripts/verification/validate-cf2-financial-foundation.mjs` (New repository-owned reusable disposable DB validation harness)
6. `CradleHub_CF2_Financial_Foundation_Report.md` (Added prominent superseded header)
7. `CradleHub_CF2_Correction_1_Report.md` (This document)

## H. OLD MIGRATION SHA256
- `F25DDE0C5ADC74FF56E892E04F0E7500129B16A984C2441EC7E13476A151EF05`

## I. NEW MIGRATION SHA256
- `A8C6169D26CC7D7C62198D2DA63C2188AF98CD20186EBB519188B1DB96525B1A`

## J. PAYMENT METHOD TAXONOMY CORRECTION
- **Updated Definition:** `payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card')`
- **Removed:** `voucher`, `customer_credit`
- **Rationale:**
  - Vouchers settle customer payable value and generate zero new cash inflow at redemption time; settlement occurs via payment allocation logic in later stages.
  - Customer credit consumes previously received customer deposits and creates zero new movement into or out of financial accounts at application time.
  - Therefore, `financial_account_movements` is strictly confined to external or physical money rails entering or leaving accounts.

## K. REPRODUCIBLE VALIDATION HARNESS PATH
- `scripts/verification/validate-cf2-financial-foundation.mjs`
- **Characteristics:**
  - Dynamic root resolution via `path.resolve(__dirname, '..', '..')`
  - Ephemeral Docker PostgreSQL container creation and automatic cleanup in `finally`
  - Synthetic test fixtures only (deterministic UUIDs, zero customer data, zero production secrets)
  - Exit code non-zero upon any assertion failure

## L. DISPOSABLE DB MODEL
- **Classification:** DISPOSABLE MODELED PRE-CF2 SCHEMA VALIDATION
- **Scope:** Created minimal prerequisite schema (`branches`, `staff`, Supabase auth schema and helper functions `auth.uid()`, `auth.jwt()`) to faithfully reproduce runtime conditions without replaying or mutating historical migrations.

## M. AUTH / JWT SIMULATION METHOD
- Simulated Supabase PostgREST connection state:
  ```sql
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '<staff_auth_user_id>';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';
  ```
- Evaluated against `public.staff` records matching `auth.uid()` to determine branch and role.

## N. RLS ASSERTIONS
- **Staff A Isolation:**
  - `financial_accounts`: Sees Branch A accounts; Branch B accounts invisible (PASS).
  - `financial_transactions`: Sees Branch A transactions; Branch B transactions invisible (PASS).
  - `financial_account_movements`: Sees Branch A movements; Branch B movements invisible (PASS).
- **Staff B Isolation:**
  - `financial_accounts`: Sees Branch B accounts; Branch A accounts invisible (PASS).
  - `financial_transactions`: Sees Branch B transactions; Branch A transactions invisible (PASS).
  - `financial_account_movements`: Sees Branch B movements; Branch A movements invisible (PASS).
- **Owner Cross-Branch Visibility:**
  - `financial_accounts`: Sees all accounts across Branch A and Branch B (PASS).
  - `financial_transactions`: Sees all transactions across Branch A and Branch B (PASS).
  - `financial_account_movements`: Sees all movements across Branch A and Branch B (PASS).

## O. DIRECT AUTHENTICATED WRITE-DENIAL RESULTS
- Attempted as simulated operational Staff A under `ROLE authenticated`:
  - `INSERT INTO financial_accounts`: Rejected via RLS (PASS).
  - `INSERT INTO financial_transactions`: Rejected via RLS (PASS).
  - `INSERT INTO financial_account_movements`: Rejected via RLS (PASS).
- Immutability trigger checks:
  - `UPDATE financial_transactions`: Rejected via `TRG_ENFORCE_FINANCIAL_TRANSACTION_IMMUTABLE` (PASS).
  - `DELETE financial_transactions`: Rejected via `TRG_ENFORCE_FINANCIAL_TRANSACTION_IMMUTABLE` (PASS).
  - `UPDATE financial_account_movements`: Rejected via `TRG_ENFORCE_FINANCIAL_MOVEMENT_IMMUTABLE` (PASS).
  - `DELETE financial_account_movements`: Rejected via `TRG_ENFORCE_FINANCIAL_MOVEMENT_IMMUTABLE` (PASS).

## P. MOVEMENT RLS RESULTS
- Specifically verified without relying on parent transaction policy.
- Direct queries on `public.financial_account_movements` verify strict branch scoping:
  - Staff A queries movements: returns only Branch A movements (PASS).
  - Staff B queries movements: returns only Branch B movements (PASS).
  - Owner queries movements: returns movements across all branches (PASS).

## Q. MASKED VIEW RESULTS
- `public.v_financial_accounts` created `WITH (security_invoker = true)`:
  - Evaluated under Staff A: sees only Branch A accounts (PASS).
  - Evaluated under Staff B: sees only Branch B accounts (PASS).
  - Evaluated under Owner: sees both Branch A and Branch B accounts (PASS).
  - Column inspection confirms columns exposed are: `id`, `branch_id`, `name`, `account_type`, `identifier_mask`, `is_active`, `created_at`, `updated_at`.
  - Full secret credentials or raw bank account numbers are not stored or exposed (PASS).

## R. DATABASE INTEGRITY RESULTS
All 32 test cases passed:
- [A] Migration applies cleanly: PASS
- [B] Expected tables exist: PASS
- [C] View `v_financial_accounts` exists: PASS
- [D] Account type taxonomy constraint enforced: PASS
- [E] PHP currency constraint enforced: PASS
- [F] Zero movement rejected (`CHECK (amount <> 0)`): PASS
- [G] Positive movement accepted: PASS
- [H] Negative movement accepted: PASS
- [I] Invalid account FK rejected: PASS
- [J] Invalid transaction FK rejected: PASS
- [K] Duplicate idempotency key rejected: PASS
- [L] Self-reversal rejected (`reversal_of_transaction_id <> id`): PASS
- [M] Account deletion with movements rejected (`ON DELETE RESTRICT`): PASS
- [N] Authenticated direct account INSERT rejected: PASS
- [O] Authenticated direct transaction INSERT rejected: PASS
- [P] Authenticated direct movement INSERT rejected: PASS
- [Q] Branch A read isolation verified: PASS
- [R] Branch B read isolation verified: PASS
- [S] Owner cross-branch read verified: PASS
- [T] Movement RLS specifically verified: PASS
- [U] Masked view verified: PASS
- [V] Direct transaction UPDATE rejected: PASS
- [W] Direct transaction DELETE rejected: PASS
- [X] Direct movement UPDATE rejected: PASS
- [Y] Direct movement DELETE rejected: PASS
- [Z] Multiple movements per transaction supported (split payment): PASS
- [AA] Rollback leaves zero partial financial rows: PASS
- [AB] Voucher rejected as movement payment method: PASS
- [AC] Customer credit rejected as movement payment method: PASS

## S. CF2 CONTRACT TESTS
- `pnpm test tests/lib/cash-flow/ --run`
- Result: PASS (1 test file, 22 passed)

## T. BOOKING REGRESSION TESTS
- `pnpm test tests/lib/bookings/ --run`
- Result: PASS (21 test files, 159 passed)

## U. TYPECHECK
- `pnpm type-check` (`tsc --noEmit`)
- Result: PASS (exit code 0)

## V. TARGETED ESLINT
- `pnpm eslint src/lib/cash-flow/financial-contract.ts src/types/supabase.ts tests/lib/cash-flow/financial-foundation-contract.test.ts scripts/verification/validate-cf2-financial-foundation.mjs`
- Result: PASS (0 errors, 0 warnings, exit code 0)

## W. FULL REPOSITORY LINT
- `pnpm lint`
- Result: `FAIL — PRE-EXISTING REPOSITORY BASELINE`
- Details: 114 problems (88 errors, 26 warnings in `tests/lib/pwa/*`). CF2 introduced errors: 0.

## X. BUILD
- `pnpm build` (`next build`)
- Result: PASS (exit code 0)

## Y. git diff --check
- `git diff --check`
- Result: PASS (exit code 0)

## Z. WORKING TREE
- Verified before staging and commits.

## AA. DISPOSABLE DATABASE OPERATIONS
- Ephemeral PostgreSQL Docker container launched, modeled, verified with 32 machine assertions, stopped, and removed.

## AB. PRODUCTION DATABASE OPERATIONS
- NONE

## AC. DEPLOYMENT
- NONE

## AD. PUSH / MERGE
- NONE

## AE. LIMITATIONS
- CF2 establishes the core relational foundation and validation rules. It does not introduce checkout actions, customer booking payment settlement, or UI pages.

## AF. OUT-OF-SCOPE CONFIRMATION
The following remain strictly NOT implemented in CF2:
- order payables
- payment allocations
- expenses
- customer credits
- vouchers
- tips
- cash sessions
- Day Close
- Cash Flow UI

## AG. FINAL VERDICT
- **PASS — CF2 FINANCIAL FOUNDATION CORRECTED AND VERIFIED LOCALLY**
