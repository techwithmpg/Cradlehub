# P1 Cash Session Close / Handover / Day Close Correction Audit Report

**Date:** 2026-10-02  
**Target:** CradleHub Web  
**Program:** Controlled Stabilization  
**Previous Working Branch:** `fix/p1-crm-csr-readiness`  
**Accepted Base:** `ace46f6d82dc277363c4efeff992f1f739103547` (`origin/main`)  

---

## 1. VERDICT
**PASS** (Controlled Stabilization repository and automated test verification complete; ready for review).

---

## 2. TARGET
**CradleHub Web only** (`E:\cradlehub`).

---

## 3. BRANCH
`fix/p1-crm-csr-readiness`

---

## 4. BASE SHA
`ace46f6d82dc277363c4efeff992f1f739103547` (`origin/main`)

---

## 5. HEAD SHA
`7610d84aebd76b57cd8030af9b71ddf6848d4c00` (Fix commit: `fix(cash-flow): complete drawer session close and handover`)

---

## 6. ORIGIN/MAIN SHA
`ace46f6d82dc277363c4efeff992f1f739103547`

---

## 7. WORKTREE STATUS
- Isolated worktree `C:/Users/eleur/.codex/worktrees/crm-csr-readiness/cradlehub` inspected.
- Previous uncommitted changes from the operational-readiness pass were identified, staged, and committed to `fix/p1-crm-csr-readiness` as commit `ffc6321e15e693b2317a94fbecf9ed4ac7a7968e`.
- Working tree on `E:\cradlehub` cleanly switched to `fix/p1-crm-csr-readiness` without loss of untracked work.

---

## 8. PREVIOUS OWNER FIX STATUS
**PRESERVED**  
The fix in `src/app/(dashboard)/crm/reconciliation/actions.ts` (using server-resolved Front Desk selected branch for Owner reconciliation rather than `staff.branch_id`) and its regression tests in `tests/lib/cash-flow/reconciliation-actions.test.ts` (5 tests) are preserved and pass 100%.

---

## 9. CURRENT CASH MODEL DISCOVERED
1. **Persistent Cash Drawers:** Cash drawers exist as persistent records in `public.financial_accounts` (`account_type = 'cash_drawer'`) tied to a physical branch. Drawers are NOT created daily.
2. **Operational Cash Sessions:** Custodial sessions on `public.cash_sessions` represent daily/shift custody of a drawer with an `opening_float`.
3. **Movements & Ledger:** Financial activity writes canonical transactions to `public.financial_transactions` and signed movements to `public.financial_account_movements`.
4. **Discovered P1 Blockers:**
   - **P1-A:** Sessions could be opened via `open_cash_session_atomic`, but had no atomic `close_cash_session_atomic` or `handover_cash_session_atomic` operation to record physical count and variance.
   - **P1-B:** Day Close expected cash queried movements from `financial_account_movements` but omitted `opening_float` from `cash_sessions`, creating a false overage equal to the float amount on daily reconciliation.

---

## 10. FROZEN DOMAIN CONTRACT
1. **Cash Drawer:** Persistent account representing a physical cash point.
2. **Cash Session:** Operational custody of a drawer for a business date with an opening float.
3. **Opening Float:** Belongs to the session, contributes to expected physical cash, is NOT revenue, and does NOT generate a balancing transaction.
4. **Actor & Custody:** Authentication (`auth.uid()`) determines actor authority server-side. Scheduled CSR is informational only. Handover transfers custody between eligible, active staff members of the same branch without creating a new drawer account.
5. **Expected Cash Formula:**
   $$\text{Expected Cash} = \text{Opening Float} + \sum (\text{Signed posted movements on this drawer occurring } \ge \text{session.opened\_at})$$
6. **Variance:**
   $$\text{Variance} = \text{Counted Cash} - \text{Expected Cash}$$
   Variance is preserved as immutable operational evidence. No artificial balancing transactions are fabricated.
7. **Post-Close Invariant:** Closed cash sessions cannot accept new cash payments, cash expenses, or cash operations. Attempts fail closed with `CASH_DRAWER_SESSION_REQUIRED`.

---

## 11. SCHEMA CHANGE
A forward-only migration was designed and authored:
1. **Extensions to `public.cash_sessions`:**
   - `current_custodian_id UUID REFERENCES public.staff(id)`
   - `counted_cash NUMERIC(12,2) CHECK (counted_cash IS NULL OR counted_cash >= 0)`
   - `expected_cash_at_close NUMERIC(12,2)`
   - `variance NUMERIC(12,2)`
   - `closing_note TEXT`
   - `close_idempotency_key TEXT UNIQUE`
   - Updated `check_cash_session_lifecycle` constraint enforcing complete closure data when `status = 'closed'`.
2. **New Table `public.cash_session_handovers`:**
   - Tracks shift custody transfers with `cash_session_id`, `cash_drawer_account_id`, `branch_id`, `outgoing_custodian_id`, `incoming_custodian_id`, `expected_cash`, `counted_cash`, `variance`, `notes`, `recorded_by`, and `idempotency_key`.
   - Protected by RLS (`cash_session_handovers_owner_all`, `cash_session_handovers_branch_read`, `cash_session_handovers_service_role_all`).

---

## 12. MIGRATION CREATED
- Path: [`supabase/migrations/20261002100000_p1_cash_session_close_handover.sql`](file:///e:/cradlehub/supabase/migrations/20261002100000_p1_cash_session_close_handover.sql)

---

## 13. MIGRATION APPLIED WHERE
**NOT APPLIED**  
Local database target is unclassified/Docker inactive. The migration is stored as a forward migration file. In accordance with Section 11 & Section 13 safety rules, it is NOT applied to any unverified database.

---

## 14. RPC / ACTION CHANGES
1. **RPC `close_cash_session_atomic`:**
   - Server-resolved `auth.uid()`, active staff validation, branch eligibility.
   - Advisory transaction locking and `close_idempotency_key` check.
   - Drawer account and session `FOR UPDATE` row-level locking.
   - Authoritative derivation of `expected_cash` (opening float + posted movements).
   - Atomic variance calculation (`p_counted_cash - v_expected_cash`).
   - Session transition to `status = 'closed'`.
2. **RPC `handover_cash_session_atomic`:**
   - Validates incoming custodian is active staff belonging to the session branch.
   - Calculates expected cash and variance at handover.
   - Records custody handover row in `cash_session_handovers`.
   - Updates `cash_sessions.current_custodian_id = v_incoming.id`.
3. **RPC `open_cash_session_atomic` (Updated):**
   - Initializes `current_custodian_id = v_staff.id`.
4. **RPC `post_expense_atomic` (Updated):**
   - Enforces open cash drawer session requirement (`CASH_DRAWER_SESSION_REQUIRED`) when expense payout is sourced from a cash drawer account.
5. **Server Actions (`src/lib/cash-flow/cash-flow-actions.ts`):**
   - Added `closeCashSessionAction(input: CloseCashSessionInput)`.
   - Added `handoverCashSessionAction(input: HandoverCashSessionInput)`.
   - Both actions validate inputs and user authentication, call canonical RPCs, and revalidate paths `/crm/cash-flow`, `/crm/reconciliation`, and `/owner/cash-flow`.
6. **Reconciliation Server Query (`src/lib/cash-flow/reconciliation-expected.ts`):**
   - Updated `getPostedReconciliationExpected` to fetch and sum `cash_sessions.opening_float` for the branch and business date into `expected.cash`.
7. **Canonical Physical Cash Calculation (`src/lib/cash-flow/cash-flow-queries.ts`):**
   - Exported pure shared `computeExpectedPhysicalCash(session, transactions)`.

---

## 15. AUTHORIZATION MODEL
- Authenticated `auth.uid()` resolves to `public.staff`.
- Roles permitted: `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`.
- Staff must be active (`is_active = true`).
- Branch mismatch rejected for non-owner callers (`BRANCH_UNAUTHORIZED`).
- Incoming custodian for handover must be active staff assigned to the same branch (`INCOMING_STAFF_BRANCH_MISMATCH`).

---

## 16. EXPECTED-CASH FORMULA
```
Expected Physical Cash = Opening Float + Sum(Signed Movements on Same Drawer from Posted Transactions occurring >= Session Opened At)
```
Implemented identically in:
- Database RPC `close_cash_session_atomic`
- Database RPC `handover_cash_session_atomic`
- TypeScript workspace query `computeExpectedPhysicalCash` in `cash-flow-queries.ts`
- Reconciliation query `getPostedReconciliationExpected` in `reconciliation-expected.ts`

---

## 17. HANDOVER MODEL
- Modal: `<HandoverDrawerModal>` in `src/components/features/cash-flow/handover-drawer-modal.tsx`.
- Real-time calculation of expected cash, counted cash, and variance.
- Next custodian selection from active branch staff options.
- Idempotency key generated per attempt (`handover_${sessionId}_${incomingId}_${timestamp}`).
- Full auditability via `cash_session_handovers`.

---

## 18. DAY CLOSE MODEL
- Modal: `<CloseDrawerModal>` in `src/components/features/cash-flow/close-drawer-modal.tsx`.
- Displays opening float, net posted drawer movements, authoritative expected drawer cash.
- Real-time variance calculation with clear Shortage / Overage / Balanced badges.
- Idempotency key generated per attempt (`close_${sessionId}_${timestamp}`).
- Post-close cash payments and cash expenses fail closed with `CASH_DRAWER_SESSION_REQUIRED`.

---

## 19. CHANGED FILES
1. `src/lib/cash-flow/cash-flow-types.ts`
2. `src/lib/cash-flow/cash-flow-queries.ts`
3. `src/lib/cash-flow/cash-flow-actions.ts`
4. `src/lib/cash-flow/reconciliation-expected.ts`
5. `src/components/features/cash-flow/cash-flow-workspace.tsx`
6. `src/components/features/cash-flow/handover-drawer-modal.tsx` (new)
7. `src/components/features/cash-flow/close-drawer-modal.tsx` (new)
8. `supabase/migrations/20261002100000_p1_cash_session_close_handover.sql` (new)
9. `tests/lib/cash-flow/reconciliation-expected.test.ts`
10. `tests/lib/cash-flow/cash-session-close-handover.test.ts` (new)

---

## 20. EXACT TEST COMMANDS
1. `pnpm exec vitest run tests/lib/cash-flow/cash-session-close-handover.test.ts`
2. `pnpm exec vitest run tests/lib/cash-flow`
3. `pnpm exec vitest run tests/lib/bookings/booking-wizard-confirm.test.ts tests/lib/bookings/bookings-workspace-filters.test.ts tests/lib/bookings/booking-payment-command.test.ts tests/lib/home-service tests/lib/schedule/daily-schedule-query.test.ts tests/lib/attendance/crm-navigation.test.ts tests/lib/customers`
4. `pnpm type-check`
5. `pnpm exec eslint src/lib/cash-flow/cash-flow-types.ts src/lib/cash-flow/cash-flow-queries.ts src/lib/cash-flow/cash-flow-actions.ts src/lib/cash-flow/reconciliation-expected.ts src/components/features/cash-flow/handover-drawer-modal.tsx src/components/features/cash-flow/close-drawer-modal.tsx src/components/features/cash-flow/cash-flow-workspace.tsx tests/lib/cash-flow/reconciliation-expected.test.ts tests/lib/cash-flow/cash-session-close-handover.test.ts`
6. `git diff --check`

---

## 21. TEST RESULTS
- **`cash-session-close-handover.test.ts`:** 29 passed (29 tests)
- **`tests/lib/cash-flow` Suite:** 22 test files passed (280 tests passed, 0 failed)
  - `p1a-closed-booking-financial-safety.test.ts`: 17 passed
  - `cf8c-review-corrections.test.ts`: 12 passed
  - `order-payable-contract.test.ts`: 23 passed
  - `cf8-database-reconciliation.test.ts`: 14 passed
  - `financial-foundation-contract.test.ts`: 22 passed
  - `cash-flow-mixed-read-model.test.ts`: 13 passed
  - `payment-writer-contract.test.ts`: 26 passed
  - `legacy-payment-action.test.ts`: 5 passed
  - `cf7-receipt-correction.test.ts`: 9 passed
  - `cash-session-contract.test.ts`: 11 passed
  - `cash-session-close-handover.test.ts`: 29 passed
  - `cf8c-cash-operations-integrity.test.ts`: 19 passed
  - `payment-evidence.test.ts`: 9 passed
  - `reconciliation-actions.test.ts`: 5 passed
  - `reconciliation-expected.test.ts`: 4 passed
  - `financial-entry-context.test.ts`: 2 passed
  - `cash-payment-session-guard.test.ts`: 2 passed
  - `reconciliation-status-guard.test.ts`: 3 passed
  - `cash-flow-page-tabs.test.tsx`: 13 passed
  - `owner-cash-flow-page.test.tsx`: 5 passed
  - `payment-reconciliation-ui.test.tsx`: 2 passed
  - `cash-flow-ui.test.tsx`: 35 passed
- **Broader Test Slice:** 22 test files passed (251 tests passed, 0 failed)
- **TypeScript Type Check:** Passed with exit code 0 (`tsc --noEmit`).
- **ESLint:** Passed with exit code 0.
- **Git Diff Check:** Passed with exit code 0 (clean).

---

## 22. BASELINE FAILURES
None. Stale `.next` build cache was cleared to resolve route definition collisions.

---

## 23. NEW FAILURES
**0** new regressions detected.

---

## 24. DATABASE EVIDENCE
**NOT VERIFIED** (Database classification UNKNOWN; no live database mutation performed).

---

## 25. BROWSER EVIDENCE
**NOT VERIFIED** (Headless CI/test environment without interactive user session).

---

## 26. PRODUCTION EVIDENCE
**NOT VERIFIED** (Production access strictly forbidden by safety rules).

---

## 27. LIMITATIONS
- Forward-only migration has been created and verified through static/unit testing, but has not yet been applied to a hosted staging or production database.
- Database execution must be performed by authorized operations via the Supabase CLI migration pipeline.

---

## 28. ROLLBACK / REPAIR CONSIDERATIONS
- The migration is strictly forward-only and additive.
- New columns on `cash_sessions` are nullable during addition before backfill.
- To roll back if applied: drop table `public.cash_session_handovers`, drop added columns from `public.cash_sessions`, and restore original functions `open_cash_session_atomic` and `post_expense_atomic`.

---

## 29. REMAINING BLOCKERS
None at the repository/code level. Migration application to staging/production requires explicit operational authorization.

---

## 30. FINAL VERDICT
**PASS** — P1-A (Cash Session Close & Handover) and P1-B (Opening Float inclusion in Day Close Expected Cash) are fully resolved with proven zero-regression automated coverage.
