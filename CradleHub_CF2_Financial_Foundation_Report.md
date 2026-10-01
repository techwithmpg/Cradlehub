# CradleHub CF2 — Financial Foundation Evidence Report

> **SUPERSEDED FOR FINAL CF2 ACCEPTANCE BY [CradleHub_CF2_Correction_1_Report.md](CradleHub_CF2_Correction_1_Report.md)**

## A. TARGET / STAGE
- **Target Repository:** `E:\cradlehub-booking-simplification`
- **Program:** CradleHub Web — CONTROLLED STABILIZATION
- **Stage:** CF2 — FINANCIAL ACCOUNTS + CANONICAL TRANSACTION FOUNDATION

## B. BRANCH
- `stage/cf-financial-foundation`

## C. IMPLEMENTATION BASE SHA
- `2f62622cef757078f9007dacb3725fc199c50807`

## D. PRE-IMPLEMENTATION WORKING TREE
- Verified clean prior to implementation:
  ```text
  branch: stage/cf-financial-foundation
  HEAD: 2f62622cef757078f9007dacb3725fc199c50807
  working tree: CLEAN
  ```

## E. CF1 CONTRACT REFERENCES IMPLEMENTED
- **CF1-D01 — Operational Financial Movement Ledger:** Established append-only movements on relational financial accounts rather than mutable balance ledgers.
- **CF1-D02 — Single Canonical Transaction Boundary:** Implemented `financial_transactions` as the single event identity header holding context and business date, with zero independent monetary amount.
- **CF1-D03 — Signed Movement Convention:** Enforced strict signed convention where `amount > 0` represents value entering the account (inflow), `amount < 0` represents value leaving the account (outflow), and `amount = 0` is strictly rejected via `CHECK (amount <> 0)`.
- **CF1-D04 — Relational Financial Accounts:** Implemented `financial_accounts` catalog representing cash drawers, GCash accounts, Maya accounts, bank accounts, and card terminals without hardcoding 1-drawer-per-branch constraints.
- **CF1-D13 — Append-Only Reversals & Refunds:** Established `reversal_of_transaction_id` self-referencing relationship with constraint prohibiting self-reversal (`CHECK (reversal_of_transaction_id <> id)`).
- **CF1-D18 — Temporal Triple (occurred_at / recorded_at / business_date):** Explicitly separated wall-clock time (`occurred_at`), database audit time (`recorded_at`), and operating date (`business_date`).
- **CF1-D21 — No Fabricated Historical Movements:** Established clean schema foundation without backfilling or synthesizing synthetic historical movements.
- **CF1-D22 — Server Authorization + RLS + Transactional Boundaries:** Activated RLS, locked tables against direct client mutations with deny-by-default write policies, and enforced branch-level access control.

## F. FILES CHANGED
1. `supabase/migrations/20260927120000_cf2_financial_foundation.sql` (New database migration)
2. `src/lib/cash-flow/financial-contract.ts` (New domain contracts, types, and invariant validation helpers)
3. `src/types/supabase.ts` (Updated Supabase database types including tables and masked view)
4. `tests/lib/cash-flow/financial-foundation-contract.test.ts` (New automated unit and invariant contract tests)
5. `CradleHub_CF2_Financial_Foundation_Report.md` (Implementation and evidence report)

## G. MIGRATION FILE(S)
- **File:** `supabase/migrations/20260927120000_cf2_financial_foundation.sql`
- **SHA256:** `F25DDE0C5ADC74FF56E892E04F0E7500129B16A984C2441EC7E13476A151EF05`

## H. FINANCIAL_ACCOUNTS CONTRACT
- **Table:** `public.financial_accounts`
- **Columns:**
  - `id`: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - `branch_id`: UUID NULL REFERENCES public.branches(id) ON DELETE RESTRICT (NULL indicates corporate/cross-branch account)
  - `name`: TEXT NOT NULL
  - `account_type`: TEXT NOT NULL CHECK (`account_type IN ('cash_drawer', 'gcash', 'maya', 'bank_transfer', 'card_terminal')`)
  - `identifier_mask`: TEXT NOT NULL (safe display mask, e.g. `*1234` or `0917-***-5678`)
  - `currency`: TEXT NOT NULL DEFAULT 'PHP' CHECK (`currency = 'PHP'`)
  - `is_active`: BOOLEAN NOT NULL DEFAULT true
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT now()

## I. FINANCIAL_TRANSACTIONS CONTRACT
- **Table:** `public.financial_transactions`
- **Columns:**
  - `id`: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - `branch_id`: UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT
  - `transaction_type`: TEXT NOT NULL CHECK (`transaction_type IN ('customer_payment', 'customer_refund', 'customer_deposit', 'operational_expense', 'cash_adjustment', 'tip_collection', 'tip_disbursement', 'payroll_disbursement', 'voucher_sale', 'voucher_redemption', 'retail_sale', 'other_income')`)
  - `business_date`: DATE NOT NULL
  - `occurred_at`: TIMESTAMPTZ NOT NULL
  - `recorded_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
  - `recorded_by`: UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT
  - `currency`: TEXT NOT NULL DEFAULT 'PHP' CHECK (`currency = 'PHP'`)
  - `status`: TEXT NOT NULL DEFAULT 'posted' CHECK (`status IN ('posted', 'reversed', 'voided')`)
  - `idempotency_key`: TEXT NOT NULL UNIQUE
  - `source_type`: TEXT NULL CHECK (`source_type IS NULL OR source_type IN ('booking_order', 'cash_session', 'payroll_run', 'retail_sale', 'legacy_booking')`)
  - `source_id`: TEXT NULL
  - `external_reference`: TEXT NULL
  - `reversal_of_transaction_id`: UUID NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT
  - `notes`: TEXT NULL
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
- **Header Amount Contradiction Check:** Confirmed that `financial_transactions` contains NO monetary amount column. Monetary truth is strictly recorded in account movements.

## J. FINANCIAL_ACCOUNT_MOVEMENTS CONTRACT
- **Table:** `public.financial_account_movements`
- **Columns:**
  - `id`: UUID PRIMARY KEY DEFAULT gen_random_uuid()
  - `transaction_id`: UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT
  - `financial_account_id`: UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT
  - `amount`: NUMERIC(12,2) NOT NULL
  - `payment_method`: TEXT NOT NULL CHECK (`payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'card', 'voucher', 'customer_credit')`)
  - `external_reference`: TEXT NULL
  - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()

## K. SIGN CONVENTION
- Enforced via database constraint `check_financial_account_movement_non_zero`: `CHECK (amount <> 0)`.
- `amount > 0`: Inflow (value enters the specified financial account).
- `amount < 0`: Outflow (value leaves the specified financial account).
- Zero movement amount is strictly forbidden.

## L. IDEMPOTENCY
- Enforced via unique constraint on `public.financial_transactions(idempotency_key)`.
- Scope: Unique across all transactions, preventing duplicate execution and replay attacks on transaction creation.

## M. APPEND-ONLY PROTECTION
- Function `public.enforce_financial_ledger_immutability()` triggers `BEFORE UPDATE OR DELETE` on `financial_transactions` and `financial_account_movements`.
- Any direct `UPDATE` or `DELETE` statement raises exception `23505/IMMUTABLE` ("Financial transactions and account movements are append-only. UPDATE and DELETE are prohibited.").
- Foreign key constraints use `ON DELETE RESTRICT` to ensure financial accounts with historical movements cannot be deleted.

## N. RLS / AUTHORIZATION
- Row Level Security (RLS) is enabled on `financial_accounts`, `financial_transactions`, and `financial_account_movements`.
- **Read Policies:**
  - Branch-scoped users (CSR, Manager) can read accounts and transactions belonging to their assigned branch.
  - Owners and Finance hold cross-branch read permissions.
- **Write Policies:**
  - Deny-by-default for ordinary authenticated users. Direct client writes (`INSERT`, `UPDATE`, `DELETE`) are blocked.
  - Authorized financial mutations in subsequent stages will be executed through server-side SECURITY DEFINER atomic RPCs with domain validation.

## O. MASKED ACCOUNT DATA EXPOSURE
- Created safe view `public.v_financial_accounts` with `WITH (security_invoker = true)`.
- Selects only non-sensitive columns (`id`, `branch_id`, `name`, `account_type`, `identifier_mask`, `currency`, `is_active`, `created_at`).
- Respects the caller's RLS context, preventing unauthorized access across branches.

## P. CONSTRAINTS
- `financial_accounts`:
  - `account_type` check constraint (`cash_drawer`, `gcash`, `maya`, `bank_transfer`, `card_terminal`)
  - `currency` check constraint (`PHP`)
  - `branch_id` foreign key `ON DELETE RESTRICT`
- `financial_transactions`:
  - `transaction_type` check constraint
  - `currency` check constraint (`PHP`)
  - `status` check constraint (`posted`, `reversed`, `voided`)
  - `source_type` check constraint
  - `idempotency_key` UNIQUE constraint
  - `check_financial_transaction_no_self_reversal`: `CHECK (reversal_of_transaction_id IS NULL OR reversal_of_transaction_id <> id)`
  - `branch_id` foreign key `ON DELETE RESTRICT`
  - `recorded_by` foreign key `ON DELETE RESTRICT`
  - `reversal_of_transaction_id` foreign key `ON DELETE RESTRICT`
- `financial_account_movements`:
  - `check_financial_account_movement_non_zero`: `CHECK (amount <> 0)`
  - `payment_method` check constraint
  - `transaction_id` foreign key `ON DELETE RESTRICT`
  - `financial_account_id` foreign key `ON DELETE RESTRICT`

## Q. INDEXES
- `idx_financial_accounts_branch` ON `financial_accounts(branch_id)`
- `idx_financial_accounts_active` ON `financial_accounts(is_active)`
- `idx_financial_tx_branch_date` ON `financial_transactions(branch_id, business_date)`
- `idx_financial_tx_occurred_at` ON `financial_transactions(occurred_at)`
- `idx_financial_tx_recorded_at` ON `financial_transactions(recorded_at)`
- `idx_financial_tx_type` ON `financial_transactions(transaction_type)`
- `idx_financial_tx_idempotency` ON `financial_transactions(idempotency_key)`
- `idx_financial_tx_reversal` ON `financial_transactions(reversal_of_transaction_id)`
- `idx_financial_movements_tx` ON `financial_account_movements(transaction_id)`
- `idx_financial_movements_account` ON `financial_account_movements(financial_account_id)`

## R. ISOLATED DATABASE HARNESS
- **Harness Type:** Disposable Docker container `cf2-test-db` using official Supabase PostgreSQL 17 image (`public.ecr.aws/supabase/postgres:17.6.1.167`).
- **Target:** Completely isolated local container on mapped port 54399.
- **Preflight:** Ran repository migrations to establish base schema (`branches`, `staff`, etc.) prior to applying CF2 migration.
- **Teardown:** Container removed upon successful validation.

## S. ISOLATED DATABASE TEST RESULTS
Validated checks A through Q via automated test script:
- **A. Migration applies successfully:** PASS
- **B. Expected tables exist (`financial_accounts`, `financial_transactions`, `financial_account_movements`, `v_financial_accounts`):** PASS
- **C. Expected constraints exist (account type, currency):** PASS
- **D. Movement amount 0 rejected (`CHECK (amount <> 0)`):** PASS (PostgreSQL error 23514 check_violation)
- **E. Valid positive movement accepted (+1500.00 inflow):** PASS
- **F. Valid negative movement accepted (-500.00 outflow):** PASS
- **G. Invalid account FK rejected:** PASS (PostgreSQL error 23503 foreign_key_violation)
- **H. Invalid transaction FK rejected:** PASS (PostgreSQL error 23503 foreign_key_violation)
- **I. Duplicate idempotency key rejected:** PASS (PostgreSQL error 23505 unique_violation)
- **J. Self-reversal rejected:** PASS (PostgreSQL error 23514 check_violation)
- **K. Account deletion with financial history rejected:** PASS (PostgreSQL error 23503 foreign_key_violation)
- **L & O. Append-only update/delete protections:** PASS (PostgreSQL error 23505 raised by immutability trigger on direct UPDATE/DELETE)
- **M & N. Cross-branch read isolation and owner access:** PASS (Branch-scoped JWT role sees only assigned branch; owner sees cross-branch)
- **P. Multiple movements per transaction structurally supported:** PASS (Split payment with cash and GCash movements succeeded)
- **Q. Rollback leaves no partial financial transaction data:** PASS (Verified 0 rows created after aborted transaction)

## T. APPLICATION TEST RESULTS
- `tests/lib/cash-flow/financial-foundation-contract.test.ts`:
  - 18 tests passed across account taxonomy, signed movement semantics, net movement calculation, payload validations, and reversal checks.
  - Duration: 343ms.

## U. BOOKING REGRESSION RESULT
- `pnpm test tests/lib/bookings/ --run`:
  - 21 test files, 159 tests passed.
  - Zero failures or regressions.

## V. TYPECHECK
- `pnpm type-check`:
  - Output: `tsc --noEmit` exited with code 0.
  - Clean typecheck across the entire repository.

## W. TARGETED ESLINT
- `pnpm eslint src/lib/cash-flow/financial-contract.ts src/types/supabase.ts tests/lib/cash-flow/financial-foundation-contract.test.ts`:
  - Exited with code 0.
  - 0 errors, 0 warnings.

## X. FULL LINT
- `pnpm lint`:
  - 114 problems (88 errors, 26 warnings).
  - All 114 problems are confined to the pre-existing legacy baseline in `tests/lib/pwa/*`.
  - Zero new lint errors or warnings introduced by CF2.

## Y. BUILD
- `pnpm build`:
  - Next.js 16.2.4 (Turbopack) production build completed successfully.
  - 148 static and dynamic routes compiled and generated in 1209ms.
  - Exited with code 0.

## Z. git diff --check
- `git diff --check`:
  - Clean output, zero trailing whitespace or merge conflict markers.

## AA. SECURITY LIMITATIONS
- Direct client writes to financial tables are disabled via RLS.
- Full bank credentials/secrets are not stored; accounts only store safe display masks (`identifier_mask`). Full credential vaulting is deferred to future dedicated integration stages.

## AB. DATABASE OPERATIONS
- **DISPOSABLE LOCAL DATABASE OPERATIONS:**
  - Created and ran isolated Docker PostgreSQL 17 container `cf2-test-db` for migration and constraint verification.
  - Container stopped and destroyed after tests completed.
- **PRODUCTION DATABASE OPERATIONS:**
  - NONE. Zero production database connections, zero migrations pushed or executed against production.

## AC. PRODUCTION OPERATIONS
- NONE.

## AD. DEPLOYMENT
- NONE.

## AE. PUSH / MERGE
- NONE.

## AF. ROLLBACK
- Migration is encapsulated within a transactional `BEGIN ... COMMIT` block.
- Downward migration if required:
  ```sql
  DROP VIEW IF EXISTS public.v_financial_accounts;
  DROP TABLE IF EXISTS public.financial_account_movements;
  DROP TABLE IF EXISTS public.financial_transactions;
  DROP TABLE IF EXISTS public.financial_accounts;
  DROP FUNCTION IF EXISTS public.enforce_financial_ledger_immutability();
  ```

## AG. OUT-OF-SCOPE CONFIRMATION
The following capabilities were NOT implemented in CF2, strictly as mandated:
- [x] Order payables NOT implemented
- [x] Payment allocations NOT implemented
- [x] Checkout replacement NOT implemented
- [x] Expense details NOT implemented
- [x] Customer credits NOT implemented
- [x] Vouchers NOT implemented
- [x] Tips NOT implemented
- [x] Cash sessions NOT implemented
- [x] Day Close NOT implemented
- [x] Cash Flow UI NOT implemented

## AH. FINAL VERDICT
**PASS — CF2 FINANCIAL FOUNDATION IMPLEMENTED AND VERIFIED LOCALLY**
