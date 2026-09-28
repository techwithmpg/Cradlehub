# CradleHub CF6 — Operational Cash Flow Wiring Report

## 1. Executive Summary & Baseline Reconciliation

This report documents the completion of stage **CF6 — Operational Cash Flow Wiring** on branch `stage/cf-financial-foundation`.

### Baseline Reconciliation Record
- **ORIGINAL PROPOSED CF6 BASE:** `f2aa8d98ebfb4030975ea50dbe0c55a820fe509e`
- **SUPERSEDING CF5.1 LAYOUT COMMITS:**
  - `d7f5ee64`: `fix(cash-flow): expand financial entry modal to desktop width and fix layout`
  - `65560586`: `docs(cash-flow): update CF5.1 evidence report with layout dimensions`
- **FINAL AUTHORIZED CF6 BASE:** `655605864dd36fc94136681617504d471c9e02c2`
- **Reason:** Owner-authorized CF5.1 modal sizing and layout correction completed after the initial CF6 prompt was written. The superseding diff was verified before beginning implementation and confirmed to contain strictly visual/layout adjustments without schema or financial state modifications.

---

## 2. Operational Wiring Architecture

### A. Customer Payment (Preserved CF4 Engine)
- Dispatches through `recordOrderPaymentAction` to `post_order_payment_atomic`.
- Enforces strict order balance verification, idempotency keys, atomic ledger writes, split tender, and payment rail validation.
- Preserves Home Service travel/gas fee separation from service charges.
- Locks submission on fully-paid bookings with informative feedback.

### B. Operational Expenses (CF6 Additive)
- **Database Schema:**
  - `financial_expense_categories`: Canonical business expense taxonomy (`supplies`, `utilities`, `repairs`, `marketing`, `transport`, `food_beverage`, `miscellaneous`).
  - `financial_expense_details`: Metadata linking financial transactions to category, payee, description, receipt reference, and tax notes.
- **RPC:** `post_expense_atomic(p_branch_id, p_idempotency_key, p_amount, p_category_id, p_financial_account_id, p_payee, p_description, p_receipt_reference, p_business_date, p_notes)`
- **Server Action:** `recordExpenseAction` with authentication gate, input validation, and automatic `revalidatePath('/crm/cash-flow')`.
- **UI:** Two-column desktop layout featuring expense category dropdown, payment account selector, vendor/payee, receipt OR reference, amount, and purpose summary card.

### C. Staff Tips (CF6 Additive - Rule CF1-D09)
- **Database Schema:**
  - `financial_tip_details`: Records beneficiary staff member, tip custody model (`direct_cash` vs `company_custodied`), payout status, and payment method.
- **Custody Rules (CF1-D09):**
  - `direct_cash`: Cash handed directly to therapist. Recorded as an informational financial transaction with 0 shop account movements (zero company custody).
  - `company_custodied`: Customer pays via digital rail (GCash, Maya, Card) or Cash Drawer. Writes positive account movement and creates a pending liability for future staff payout.
- **RPC:** `post_tip_atomic(p_branch_id, p_beneficiary_staff_id, p_custody_type, p_amount, p_financial_account_id, p_payment_method, p_business_date, p_notes, p_idempotency_key)`
- **Server Action:** `recordTipAction` with full staff attribution and path revalidation.

### D. Other Financial Entries (CF6 Additive)
- **Database Schema:**
  - `financial_commercial_details`: Extended audit trail for misc income, cash drawer adjustments, and intra-branch transfers.
- **RPCs:**
  - `post_misc_income_atomic`: Records non-service revenue (space rentals, scrap sales, vending).
  - `post_cash_adjustment_atomic`: Safe replenishment or drop for cash drawers with strict audit reasons.
  - `post_transfer_atomic`: Transfers between branch accounts (e.g. drawer to bank drop) ensuring net-zero branch position.
- **Locked Boundaries (CF1-D20):**
  - General / unstructured adjustments remain locked in the UI pending formal management reconciliation policy.

### E. Real Read Models & Workspace Queries
- `cash-flow-queries.ts`:
  - Dynamically fetches active `financial_expense_categories` and branch `staff` options.
  - Surfaces categorized expenses, tips, and other entries into both the Today and Ledger read models.
  - Maintains strict branch isolation across all financial views.

---

## 3. Verification & Evidence Matrix

### 1. Database Integrity Verification (Disposable Docker Postgres)
- Script: `scripts/verification/validate-cf6-operational-writers.mjs`
- Test assertions: **29 / 29 passed (100%)**
  - Seeded branch, accounts, categories, and staff.
  - Verified `post_expense_atomic` writes transaction, details, negative account movement, and idempotency replay.
  - Verified `post_tip_atomic` direct cash writes 0 movements.
  - Verified `post_tip_atomic` company custodied writes positive movement on account.
  - Verified `post_misc_income_atomic` writes positive movement and details.
  - Verified `post_cash_adjustment_atomic` handles additions and removals accurately.
  - Verified `post_transfer_atomic` creates paired debit and credit movements.
  - Zero mutations on production database.

### 2. Automated Test Suites
- **Cash Flow Vitest Suite (`tests/lib/cash-flow/`):**
  - `financial-foundation-contract.test.ts`: 22 / 22 passed
  - `order-payable-contract.test.ts`: 23 / 23 passed
  - `payment-writer-contract.test.ts`: 26 / 26 passed
  - `cash-flow-ui.test.tsx`: 19 / 19 passed (including 4 new operational modal tests)
  - **Total Cash Flow Tests:** **90 / 90 passed (100%)**

### 3. Code Quality & Build Verification
- **TypeScript:** `pnpm type-check` passed with exit code 0 (`tsc --noEmit`).
- **ESLint:** `pnpm eslint` on all touched files passed with exit code 0 (0 errors, 0 warnings, zero `any` casts).
- **Production Build:** `pnpm build` passed with exit code 0 (Next.js 16.2.4 Turbopack, 149/149 routes compiled).
- **Git Diff:** `git diff --check` passed with exit code 0 (zero whitespace/CRLF errors).

---

## 4. Governed Scope & Constraints Preserved

1. **CF1–CF4 Foundations:** Unmodified and preserved.
2. **CF5 & CF5.1 Visuals:** Modal visual design and desktop sizing preserved without redesign.
3. **Master Sheet (CF1-D24):** Preserved in read-only / dual-run posture.
4. **Day Close Finalization:** Backend day close finalization remains gated pending explicit owner authorization.
5. **Git Safety:** Zero pushes to remote, zero force-pushes, zero merges to `main`.
