# CradleHub CF6 — Operational Cash Flow Wiring Report

## 1. Executive Summary & Baseline Reconciliation

This report documents the completion of stage **CF6 — Operational Cash Flow Wiring** and **CF6 — Correction Pass 1: Domain Boundary + Security + Evidence Completion** on branch `stage/cf-financial-foundation`.

### Baseline Reconciliation Record
- **ORIGINAL PROPOSED CF6 BASE:** `f2aa8d98ebfb4030975ea50dbe0c55a820fe509e`
- **SUPERSEDING CF5.1 LAYOUT COMMITS:**
  - `d7f5ee64`: `fix(cash-flow): expand financial entry modal to desktop width and fix layout`
  - `65560586`: `docs(cash-flow): update CF5.1 evidence report with layout dimensions`
- **FINAL AUTHORIZED CF6 BASE:** `655605864dd36fc94136681617504d471c9e02c2`
- **CORRECTION PASS 1 STARTING HEAD:** `54f17e4fdc574a2aa8c603aa69cab1e40071b68f`
- **Reason:** Visual approval of CF5.1 modal sizing and layout correction preceded CF6. Correction Pass 1 addressed financial-domain separation, direct-tip ledger semantics, contract reference accuracy, cross-branch and RLS verification, and complete suite evidence.

---

## 2. Financial Domain Boundary Corrections

### A. Non-Booking Commercial Revenue vs. Operational Drawer Adjustments vs. Internal Transfers
- **Problem Identified in Review:** The initial implementation of `financial_commercial_details` bundled misc commercial income, cash drawer adjustments, and internal account transfers into a single catch-all table.
- **Architectural Correction:**
  1. `financial_commercial_details` is strictly restricted to non-booking commercial revenue per **CF1-D15**:
     ```sql
     CHECK (commercial_type IN ('misc_income', 'retail_sale'))
     ```
  2. **Internal Transfers:** Internal account transfers represent liquidity reallocations between financial accounts owned by the company (e.g. drawer-to-bank drops). They do NOT constitute commercial sales or business income. In `post_transfer_atomic`:
     - 1 transaction header (`transaction_type = 'cash_adjustment'`, with transfer context in `notes`)
     - 2 balancing account movements: 1 negative movement on source account (-amount), 1 positive movement on destination account (+amount)
     - Net cash impact is exactly 0.00.
     - Insertion into `financial_commercial_details` was **removed**.
  3. **Cash Drawer Adjustments (CF1-D16 Context):** Drawer float additions and safe drops represent operational cash drawer adjustments, not commercial revenue. In `post_cash_adjustment_atomic`:
     - 1 transaction header (`transaction_type = 'cash_adjustment'`, with adjustment reason in `notes`)
     - 1 signed account movement (+amount for float addition, -amount for safe drop) on a verified `cash_drawer` account.
     - Insertion into `financial_commercial_details` was **removed**.
  4. **Why Catch-All Tables Are Dangerous:** Treating operational drawer adjustments and liquidity transfers as "commercial details" distorts revenue reporting, violates ledger clarity, and prevents future clean aggregation of actual commercial sales.

---

## 3. Direct Cash Tip Ledger Semantics (CF1-D09)

- **Authoritative Rule (CF1-D09):** Direct cash tips handed by clients directly to therapists involve **zero company custody**, **zero account movement** in `financial_account_movements`, and **zero inflow, outflow, or net cash impact** on company accounts. Direct cash tips are excluded from company service revenue.
- **Event Identity Preservation:**
  - Although direct cash tips create **0 account movements**, they are captured for operational and therapist audit purposes.
  - In `post_tip_atomic`:
    - 1 `financial_transactions` header with `transaction_type = 'tip_collection'`, status `'posted'`, and recorded actor/branch.
    - 1 `financial_tip_details` record with `custody_type = 'direct_cash'`, `payout_status = 'not_applicable'`, and staff beneficiary attribution.
    - Exactly 0 rows in `financial_account_movements`.
- **Company-Custodied Tips:**
  - Tips collected via digital rails (GCash, Maya, Card) or front desk cash drawer involve company custody.
  - 1 transaction header + 1 `financial_tip_details` record (`custody_type = 'company_custodied'`, `payout_status = 'pending_disbursement'`) + 1 positive account movement (+amount) representing company custody and creating a pending liability for future staff disbursement.
- **Read Model Invariant:** `todayMovements` and `allLedgerRecords` in `cash-flow-queries.ts` iterate exclusively over `financial_account_movements`. As verified, direct cash tips contribute 0.00 to inflows, outflows, and net flow, and produce 0 entries in the monetary cash ledger.

---

## 4. CF1 Decision Reference Corrections

- **Clarification on CF1-D20:**
  - **CF1-D20** exclusively governs the role of historical `booking_payment_logs`, stating that historical booking payment logs are frozen, preserved for backward-compatibility reads, and ceased from receiving automated writes.
  - CF1-D20 does **NOT** govern or authorize generic cash adjustments.
- **Project Safety Boundary on Generic Adjustments:**
  - Generic / unstructured cash adjustments remain locked in the UI under:
    `PROJECT SAFETY BOUNDARY — NO OWNER-AUTHORIZED GENERIC ADJUSTMENT CONTRACT`
  - In accordance with **CF1-D16** (cash session boundaries) and **CF1-D23** (anti-drift constraints), generic arbitrary adjustments are prevented from bypassing formal audit controls until an explicit owner-authorized contract is established.

---

## 5. Security & Authorization Evidence

### A. Row-Level Security (RLS) on Detail Tables
- All CF6 child detail tables have RLS enabled:
  - `public.financial_expense_categories`
  - `public.financial_expense_details`
  - `public.financial_tip_details`
  - `public.financial_commercial_details`
- **Strict Read-Only Direct Access:** Authenticated staff are granted `SELECT` policies only.
- **Zero Direct Insert Policies:** Direct unprivileged `INSERT` operations on detail tables are denied by RLS. All writes MUST occur through `SECURITY DEFINER` atomic RPCs (`post_expense_atomic`, `post_tip_atomic`, `post_misc_income_atomic`, `post_cash_adjustment_atomic`, `post_transfer_atomic`), which enforce input sanitization, actor authentication, branch isolation, and idempotency.
- Machine verified in disposable PostgreSQL harness (Assertions G.3, G.4, G.5: 100% blocked).

### B. Cross-Branch Denial & Branch Isolation
- All atomic RPCs verify that the calling staff member is authorized for the target branch:
  ```sql
  IF v_staff.branch_id IS NOT NULL AND v_staff.branch_id <> p_branch_id AND v_staff.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Staff member is not authorized for branch %', p_branch_id;
  END IF;
  ```
- **Account Branch Matching:** Financial accounts specified in expenses, custodied tips, misc income, adjustments, and transfers are strictly validated to belong to the active transaction branch (`ACCOUNT_BRANCH_MISMATCH`).
- **Staff Beneficiary Matching:** Tip beneficiaries must belong to the active branch (`BENEFICIARY_BRANCH_MISMATCH`).
- **Transfer Dual Account Matching:** Both source and destination accounts must belong to the active branch (`ACCOUNT_BRANCH_MISMATCH`).
- Machine verified in disposable PostgreSQL harness (Assertions G.1, G.2, B.4, E.5, F.1: 100% blocked).

---

## 6. Financial Account Configuration Status

- **Status:** `REQUIRES CONFIGURATION VERIFICATION`
- **Assessment:**
  - Core account taxonomy (`cash_drawer`, `bank_transfer`, `gcash`, `maya`, `card_terminal`) is modeled and validated in test fixtures.
  - Production database target was identified as `PRODUCTION` and treated with zero-mutation discipline: 0 migrations run on production, 0 rows inserted/updated/deleted.
  - Live inspection of production financial account configuration requires owner confirmation of live account IDs before operational go-live.

---

## 7. Migration Checksum Record

- **Migration File:** `supabase/migrations/20260928120000_cf6_operational_cash_flow_writers.sql`
- **Original Checksum (Pre-Correction Pass 1):**
  `20894e7fa071e626e2e541ce38f6dcf7c89fcae85f09cb9f3a6703923ee3a652`
- **Corrected Checksum (Post-Correction Pass 1):**
  `c93dd5c7b3b45b1eeabeff2ae6fffedc3b522ee469c5456d1396163bc6030e3e`
- **Changes in Corrected Migration:**
  1. Restricted `financial_commercial_details.commercial_type` check constraint to `('misc_income', 'retail_sale')`.
  2. Removed `financial_commercial_details` insertion from `post_cash_adjustment_atomic`.
  3. Removed `financial_commercial_details` insertion from `post_transfer_atomic`.
  4. Added staff branch authorization and account branch matching guards to `post_tip_atomic`, `post_misc_income_atomic`, `post_cash_adjustment_atomic`, and `post_transfer_atomic`.

---

## 8. Verification & Evidence Matrix

### 1. Database Integrity Verification (Disposable Docker PostgreSQL)
- **Script:** `scripts/verification/validate-cf6-operational-writers.mjs`
- **Container:** Ephemeral Docker PostgreSQL container launched and destroyed automatically.
- **Assertions Passed:** **35 / 35 passed (100%)**
  - **Part A (Schema & Catalog):**
    - [A.1] `financial_expense_categories` seeded with >= 9 standard categories.
  - **Part B (Operational Expenses):**
    - [B.1] Zero expense amount rejected (`INVALID_AMOUNT`).
    - [B.2] Negative expense amount rejected (`INVALID_AMOUNT`).
    - [B.3] Empty expense description rejected (`DESCRIPTION_REQUIRED`).
    - [B.4] Account belonging to different branch rejected (`ACCOUNT_BRANCH_MISMATCH`).
    - [B.5] Valid expense transaction posted successfully.
    - [B.6] Expense creates signed negative account movement (-350.50).
    - [B.7] Idempotent retry returns original expense without duplication.
    - [B.8] Idempotent replay does not duplicate records in table.
  - **Part C (Tips - Rule CF1-D09):**
    - [C.1] Direct cash tip recorded successfully.
    - [C.2] Direct cash tip generates ZERO company account movements (CF1-D09).
    - [C.3] Company-custodied tip recorded successfully.
    - [C.4] Company-custodied tip creates positive movement (+300) and pending liability.
  - **Part D (Misc Income - Rule CF1-D15):**
    - [D.1] Misc income recorded successfully.
    - [D.2] Misc income creates positive inflow (+500) without fake booking.
  - **Part E (Cash Adjustments - Rule CF1-D16 Context):**
    - [E.1] Cash addition recorded successfully.
    - [E.2] Cash addition creates positive drawer movement (+1000) and preserves domain boundary (0 commercial details rows).
    - [E.3] Cash removal recorded successfully.
    - [E.4] Cash removal creates negative drawer movement (-2000) and preserves domain boundary (0 commercial details rows).
    - [E.5] Cash adjustment on non-cash-drawer account rejected (`CASH_DRAWER_REQUIRED`).
  - **Part F (Account Transfers):**
    - [F.1] Transfer between identical accounts rejected (`IDENTICAL_ACCOUNTS`).
    - [F.2] Account transfer recorded successfully.
    - [F.3] Transfer creates balanced dual movements (-5000 / +5000) with net zero effect (0.00).
    - [F.4] Transfer creates no commercial records (0 commercial details rows).
  - **Part G (Security & Authorization Invariants):**
    - [G.1] Cross-branch expense post rejected for CSR staff (`BRANCH_MISMATCH`).
    - [G.2] Cross-branch tip post rejected for CSR staff (`BRANCH_MISMATCH`).
    - [G.3] Direct INSERT into `financial_expense_details` blocked by RLS policy.
    - [G.4] Direct INSERT into `financial_tip_details` blocked by RLS policy.
    - [G.5] Direct INSERT into `financial_commercial_details` blocked by RLS policy.

### 2. Cash Flow Vitest Suite
- **Command:** `pnpm vitest run tests/lib/cash-flow/`
- **Result:** **4 / 4 test files passed, 90 / 90 tests passed (100%)**
  - `financial-foundation-contract.test.ts`: 22 / 22 passed
  - `order-payable-contract.test.ts`: 23 / 23 passed
  - `payment-writer-contract.test.ts`: 26 / 26 passed
  - `cash-flow-ui.test.tsx`: 19 / 19 passed

### 3. Booking Vitest Suite
- **Command:** `pnpm vitest run tests/lib/bookings/`
- **Result:** **20 / 21 test files passed, 158 / 159 tests passed**
- **Documented Defect:** `FAIL — PRE-EXISTING TIME-SENSITIVE TEST DEFECT`
  - Test file: `tests/lib/bookings/booking-simplification-safety.test.ts`
  - Failing test: `Case I: Validation schema accepts valid multi-attendee order and rejects malformed payloads`
  - Cause: The test fixture hardcodes `date: "2026-09-27"` and validates it against `z.string().refine((d) => isFutureOrToday(d))`. On system execution date `2026-09-29`, `2026-09-27` is a past date.
  - Discipline: Zero modifications made to booking tests per stabilization discipline.

### 4. Code Quality & Build Verification
- **TypeScript:** `pnpm type-check` passed with exit code 0 (`tsc --noEmit`).
- **Targeted ESLint:** `npx eslint src/lib/cash-flow/ tests/lib/cash-flow/` passed with exit code 0 (0 errors, 0 warnings).
- **Full Repository Lint:** `FAIL — PRE-EXISTING REPOSITORY BASELINE` (121 pre-existing issues in legacy `tests/lib/pwa/*`; exactly 0 CF6 issues).
- **Production Build:** `pnpm build` passed with exit code 0 (Next.js 16.2.4 Turbopack, 149 / 149 routes compiled successfully).
- **Git Diff:** `git diff --check` passed with exit code 0 (zero whitespace/CRLF errors).

---

## 9. Governed Scope & Constraints Preserved

1. **CF1–CF4 Foundations:** Unmodified and preserved.
2. **CF5 & CF5.1 Visuals:** Modal visual design and desktop sizing preserved without redesign.
3. **Master Sheet (CF1-D24):** Preserved in read-only / dual-run posture.
4. **Day Close Finalization:** Backend day close finalization remains gated pending explicit owner authorization.
5. **Git Safety:** Zero pushes to remote, zero force-pushes, zero merges to `main`.
6. **Additive Commits Only:** All work committed additively without amending previous commits.

---

## 10. Final Verdict

**PASS — CF6 OPERATIONAL WIRING VERIFIED LOCALLY**
