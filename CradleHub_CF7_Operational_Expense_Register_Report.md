# CradleHub CF7 Operational Expense Register & Receipts Report

**TARGET:** CradleHub Web — Cash Flow  
**STAGE:** CF7 — Operational Expense Register UI  
**BRANCH:** `stage/cf-financial-foundation`  
**BASE SHA:** `d0d7f105521abf17b90fd0c542c753b7362c0ae4`  
**IMPLEMENTATION SHA:** `c5873dcb1cb89e851f06f1c0b5776b02e7e6c36c`  
**DOCUMENTATION DATE:** 2026-09-29  

---

## 1. Executive Summary

CF7 implements the Operational Expense Register and private receipt evidence architecture on top of the accepted CF6 operational writer baseline. All changes are additive and preserve existing financial architecture:
- Canonical financial tables (`financial_transactions`, `financial_account_movements`, `financial_expense_details`, `financial_expense_categories`, `financial_accounts`) remain intact.
- The atomic expense flow (`recordExpenseAction` → `post_expense_atomic`) continues to enforce positive input amounts, signed negative ledger movements, branch isolation, and idempotent execution.
- Added private Supabase Storage bucket `expense-receipts` (5 MB file size limit, restricted MIME types: JPEG, PNG, WebP, PDF) with row-level security (RLS) policies using the current Supabase convention `storage.objects.owner_id = (SELECT auth.uid()::text)`.
- Enforces private receipt storage where database records only the durable private object path `{branchId}/{YYYY}/{MM}/rec_{businessDate}_{random}.{ext}` in `financial_expense_details.receipt_image_url`, never signed or public URLs.
- Added orphan cleanup: if receipt upload succeeds but financial entry posting fails, the newly uploaded object is immediately and securely removed by the uploader.
- Updated Today tab with real same-business-date operational expense outflows and counts, replacing the historical "Not yet configured" placeholder while retaining canonical financial transaction queries.

---

## 2. Changed Files Scope

Exact repository changes implemented in CF7:

1. `supabase/migrations/20260929120000_cf7_expense_receipt_storage.sql` (additive migration provisioning `expense-receipts` private bucket, RLS policies, and 11-argument `post_expense_atomic` overload with `p_receipt_image_path TEXT DEFAULT NULL`)
2. `src/lib/cash-flow/cash-flow-types.ts` (added optional `receiptImagePath?: string` to `RecordExpenseInput`)
3. `src/lib/cash-flow/cash-flow-actions.ts` (passes `p_receipt_image_path` to `post_expense_atomic` RPC in `recordExpenseAction`)
4. `src/lib/cash-flow/cash-flow-queries.ts` (aggregates same-business-date operational expenses for the Today coverage summary)
5. `src/components/features/cash-flow/record-financial-entry-modal.tsx` (receipt attachment UI, client-side validation, private storage upload, orphan cleanup, `initialMode` support)
6. `src/components/features/cash-flow/cash-flow-workspace.tsx` (added "Record Expense" quick action button in header wired to `initialMode="expense"`)
7. `src/components/features/cash-flow/today-tab.tsx` (displays real operational expense totals and count, wired click handler to open expense modal)
8. `scripts/verification/validate-cf7-expense-register.mjs` (disposable verification harness covering all 13 CF7 test assertions)
9. `tests/lib/cash-flow/cash-flow-ui.test.tsx` (expanded Cash Flow Vitest suite covering UI expense recording, file validation, storage upload, and orphan cleanup)

---

## 3. Migration Checksum

- **Migration File:** `supabase/migrations/20260929120000_cf7_expense_receipt_storage.sql`
- **SHA-256 Checksum:** `9d745a1bcea914096de570f9fb640ec6b2fdf68dc36a4304326f037cab021d8c`

---

## 4. Verification Evidence

### 4.1. Disposable Database & Storage RLS Verification (`validate-cf7-expense-register.mjs`)

Tested against isolated disposable PostgreSQL container `68bb605b8232` (Docker image `public.ecr.aws/supabase/postgres:17.6.1.167`):
- **Part A: Storage Bucket Configuration**
  - `expense-receipts` bucket exists with `public = false`.
  - `file_size_limit` strictly enforced at 5,242,880 bytes (5 MB).
  - `allowed_mime_types` restricted to `['image/jpeg', 'image/png', 'image/webp', 'application/pdf']`.
- **Part B: Storage Security & RLS Policies**
  - `[T06]` Anonymous upload blocked by RLS (`violates row-level security policy`).
  - `[T07]` Anonymous read cannot view private receipts.
  - Authenticated staff can upload receipts only to their branch folder.
  - `[T05]` Cross-branch storage upload blocked by RLS.
  - Staff member can read receipts within their own branch folder.
  - Cross-branch staff read blocked by branch folder RLS.
  - Owner/admin can read receipts across all branch folders.
  - Unauthorized deletion blocked: `owner_id` ownership rule prevents deleting another staff member's uploaded receipt.
  - `[T13]` Orphan cleanup: uploader can delete their own uploaded receipt object before post confirmation.
- **Part C: Operational Expense Writer (`post_expense_atomic`)**
  - `[T01]` Operational expense without receipt succeeds.
  - `[T01b]` Expense without receipt persists with `receipt_image_url IS NULL`.
  - `[T02]` Operational expense with valid receipt path persists.
  - `[T11]` Receipt path belongs strictly to the correct expense detail record.
  - `[T08]` Exactly one `operational_expense` transaction header created with `posted` status.
  - `[T09]` Exactly one signed negative account movement posted (e.g., `-1450.00 PHP`).
  - `[T10]` Idempotent replay succeeds without duplicate transactions or account movements.
  - `[T12]` Pre-post failure (negative amount) rejects transaction creation.
  - Backwards compatibility: 10-argument callers continue to function cleanly.

**Result:** `ALL CF7 DISPOSABLE VERIFICATION ASSERTIONS PASSED (20 checks passed)`

### 4.2. CF6 Regression Verification (`validate-cf6-operational-writers.mjs`)

Executed against the same database environment:
- All CF6 operational writers (expenses, direct cash tips, company-custodied tips, misc income, cash drawer adjustments, account transfers, cross-branch RLS isolation) passed without regression.

**Result:** `ALL CF6 DATABASE ASSERTIONS PASSED (35 checks passed)`

### 4.3. Cash Flow Vitest Suite (`tests/lib/cash-flow/`)

Executed all unit and component tests:
- `financial-foundation-contract.test.ts` (22 tests) — PASS
- `order-payable-contract.test.ts` (23 tests) — PASS
- `payment-writer-contract.test.ts` (26 tests) — PASS
- `cash-flow-ui.test.tsx` (25 tests) — PASS:
  - T03: Invalid MIME (e.g. `text/plain`) blocked by client validation.
  - T04: Files > 5 MB blocked by client validation.
  - T01 & T02: Client uploads receipt to private storage, generates durable object path, and passes `receiptImagePath`.
  - T13: Orphan cleanup triggers immediate deletion of uploaded storage object if server action returns an error.
  - Workspace header "Record Expense" button opens modal with `initialMode="expense"`.
  - Today tab Expenses coverage card triggers expense recording callback.

**Total:** `4 passed, 96 passed (96 total)`

### 4.4. Quality Gates

- **TypeScript (`pnpm type-check`):** PASS (0 errors)
- **Targeted ESLint:** PASS (0 errors, 0 warnings across all 7 changed TypeScript/TSX files)
- **Full Repository Lint (`pnpm lint`):** 116 inherited failures confined entirely to legacy `tests/lib/pwa/*` files; 0 errors or warnings in Cash Flow code.
- **Production Build (`pnpm build`):** PASS (Next.js 16.2.4 Turbopack build succeeded, 149/149 static pages generated)
- **Git Diff Check (`git diff --check`):** PASS (clean whitespace)

---

## 5. Production Impact & Limitations

- **Production Mutation:** NONE. No migrations applied to remote/production database. No storage buckets created on production Supabase.
- **Production Verification:** NOT PERFORMED. Verification executed exclusively on isolated disposable container.
- **REPOSITORY-RECORDED PRODUCTION EVIDENCE:** Prior repository baseline `cf-financial-foundation` is recorded under `docs/11-DECISION-LOG.md` and `AI_CONTEXT.md`.
- **FINANCIAL ACCOUNT CONFIGURATION:** REQUIRES CONFIGURATION VERIFICATION. Operational expense recording requires an active financial account matching the branch and expense category.

---

## 6. Rollback Strategy

Should rollback be required prior to merge:
1. Discard working branch commits back to base `d0d7f105521abf17b90fd0c542c753b7362c0ae4`.
2. In disposable/staging environments, remove the `expense-receipts` bucket and drop the 11-argument `post_expense_atomic` function to restore the 10-argument signature from CF6.
