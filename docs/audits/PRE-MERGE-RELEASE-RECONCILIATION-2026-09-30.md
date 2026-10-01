# CradleHub Web — pre-merge release reconciliation

**Verdict: CORRECTION REQUIRED.** This is a read-only release review plus this report. No merge, push to main, deployment, production mutation, reset, stash, or cleanup was performed.

## Git truth at review snapshot

| Item | Value |
| --- | --- |
| Source | `E:\cradlehub-booking-simplification` |
| Source branch | `fix/p1-financial-safety` at final snapshot; it changed during this review from `stage/cf-financial-foundation-main-reconcile` |
| Source HEAD | `f678f0f1ff74722f250879a457aa0b5cbb6da13f` at final snapshot; code/tested tree is `3fd86e0c28a12a8922677d86045168412c63b4c3`, followed only by this report commit |
| Main worktree | `E:\cradlehub`, clean on `main` |
| Main HEAD / fetched `origin/main` / merge-base | `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a` |
| Git family | Both paths use `E:\cradlehub\.git`; source is a linked worktree |
| Commits ahead / committed changed files | 39 / 132 |

Both worktrees' `origin/main` refs were refreshed with `git fetch origin --prune`. The source's first sandboxed fetch could not write `FETCH_HEAD` in the shared Git directory; the authorized escalated fetch succeeded. During this review, another process created commit `3fd86e0c` and switched the source checkout to `fix/p1-financial-safety`. It captured the previously uncommitted Cradle Flow, booking diagnostic, and service/Marketing changes. A second concurrent commit, `f678f0f1`, added the initial version of this report. The current source has 60 untracked `_inspection/` files and further uncommitted additions to this report's exact inventories. The attached lists are a snapshot; re-resolve HEAD and status before any subsequent release action.

## Release content classification

- **A. Intended booking and Cradle Flow:** BKG3 order/attendee/service-line creation, public and in-house booking actions, Cradle Flow display, Home Service entry, and the latest front-desk layout. Four primary actions, Active Service Workflow, right-rail Attendance Activity → Today's Money → Needs Attention → Quick Actions, removal of the extra expanded KPI strip, and retained per-booking actions are represented in committed HEAD. The latest modal decoupling, room assignment, therapist assignment, and financial-entry components entered commit `3fd86e0c`; they were uncommitted at the review start.
- **B. CF8 inherited work:** financial accounts/transactions, order payables/allocations, payment writers, Cash Flow UI, cash sessions, expenses, receipt storage, nine CF-family SQL files, verification scripts, and tests. These are a substantial release dependency, not a visual-only change.
- **C. Diagnostics/reports:** twelve root CF reports and three `docs/audits` reports are committed, including this release report in concurrent commit `f678f0f1`. The 60 pre-existing `_inspection/` files are untracked evidence/backups, including dumps, patches, and snapshots; they must not enter a merge accidentally.
- **D. Separate workstream:** service/Marketing publishing and owner media editing were folded into `3fd86e0c`. Their inclusion in a booking/financial release needs an explicit scope decision. The committed `tsconfig.json` exclusion of `_inspection` is a configuration change to review rather than treating as a release gate exemption.
- **E. Uncertain:** the nine CF-family migration files have names matching production migration history but different version numbers. Their SQL and deployed schema have not been established as equivalent in this pass.

## Booking contract and current UI

Repository contract and tests retain `customer → booking_orders → booking_attendees → bookings`, with `bookings` as service-line rows (`order_id`, `attendee_id`, `line_sequence`). No separate `booking_service_lines` table is added. `order_id` is the visit identifier; legacy `order_id = NULL` is retained as a standalone line. Inspected visit and payment grouping uses `order_id`, never customer name or customer ID. The current Cradle Flow still displays one ticket per service line rather than one visit card for an order; the diagnostic classifies that as a separate P1 design gap. This review did not implement visit grouping.

## Financial P1 classification against accepted main

| Finding | Classification | Evidence and release consequence |
| --- | --- | --- |
| Cancelled/no-show order-backed payable remains selectable/countable | **Introduced by branch** for the order-backed Cash Flow path; main has neither the new Cash Flow query nor order-backed payable writer. Main already has cancellation states. | `cash-flow-queries.ts` excludes closed legacy rows but not order-backed rows. Cancellation policy for fees/deposits remains undecided. |
| Order payment writer lacks closed-booking protection | **Introduced by branch** for the new order writer. | Repository `post_order_payment_atomic` has no closed-line check; legacy payment action does reject cancelled/no-show. Read-only PRODUCTION function introspection also found no `cancelled`/`no_show` reference in the deployed function. |
| Physical cash payment lacks an open cash-session requirement | **Introduced by branch** with the order writer/session model. | Cash operations require sessions, but order payment delegates without one; repository and read-only PRODUCTION function introspection found no `cash_sessions` reference in the deployed order writer. The product policy and exact cash drawer rule need a decision. |
| Cash Flow Day Close versus `daily_cash_reconciliations` | **Changed by branch:** main already has active `daily_cash_reconciliations` actions; branch adds a separate Day Close presentation. | Main's reconciliation authority is not retired. Branch Day Close derives a balance indicator and says finalization is unavailable. Authority must be decided before release; no table was modified in this review. |

These are branch-introduced or branch-changed relative to `origin/main`, even though the named financial objects are already present in PRODUCTION through a separately versioned deployment. This distinction does not certify the live behavior. No P1 was silently fixed here.

## Migration and production difference

All ten SQL files below are added relative to current `origin/main`. Read-only PRODUCTION migration listing on project `lsrbwqhvzjfpiabeolkv` records BKG3 under the same version and all nine CF-family names under **different** versions. Live read-only catalog checks confirmed `booking_orders`, `financial_accounts`, `cash_sessions`, and `daily_cash_reconciliations` exist. Migration names alone do not prove body equivalence. No migration was applied or marked applied in this pass.

| Branch migration | Production history | Classification |
| --- | --- | --- |
| `20260927080000_bkg3_booking_order_atomic.sql` | `20260927080000_bkg3_booking_order_atomic` | **ALREADY ACCEPTED** in production history; still absent from main Git |
| `20260927120000_cf2_financial_foundation.sql` | `20260929130836_cf2_financial_foundation` | **UNCERTAIN** version/body equivalence |
| `20260927130000_cf3_order_payables_allocations.sql` | `20260929132504_cf3_order_payables_allocations` | **UNCERTAIN** |
| `20260927140000_cf4_atomic_payment_writer.sql` | `20260929132708_cf4_atomic_payment_writer` | **UNCERTAIN** |
| `20260928120000_cf6_operational_cash_flow_writers.sql` | `20260929133122_cf6_operational_cash_flow_writers` | **UNCERTAIN** |
| `20260929120000_cf7_expense_receipt_storage.sql` | `20260929133212_cf7_expense_receipt_storage` | **UNCERTAIN** |
| `20260929130000_cf8_cash_sessions_foundation.sql` | `20260929133312_cf8_cash_sessions_foundation` | **UNCERTAIN** |
| `20260929140000_cf8_booking_payment_command.sql` | `20260929133835_cf8_booking_payment_command` | **UNCERTAIN** |
| `20260930083000_cf8c_cash_operations_integrity.sql` | `20260930004444_cf8c_cash_operations_integrity` | **UNCERTAIN** |
| `20260930100000_cf8c_cash_operations_review_corrections.sql` | `20260930042139_cf8c_cash_operations_review_corrections` | **UNCERTAIN** |

The migration-version mismatch is a release stop. Do not run `db push`, replay these files, or normalize history to make the lists agree. Compare current live definitions, dependencies, grants, storage policies, and migration bodies against the branch under a separate reviewed deployment plan. The older `_inspection/CF8_PRODUCTION_SYNC_BLOCKED_REPORT.md` describes a pre-apply state from September 29 and is superseded by the current read-only history/catalog check.

## Quality gates and runtime evidence

| Gate | Exact command and result |
| --- | --- |
| TypeScript | `pnpm type-check` — **PASS** |
| Release-scoped Vitest | `pnpm exec vitest run tests/lib/bookings tests/lib/cash-flow tests/lib/crm tests/lib/home-service tests/lib/home-service-tracking.test.ts tests/lib/customers tests/lib/schedule tests/app/crm/booking-actions.test.ts tests/api/desktop-v1-bookings.test.ts tests/api/desktop-v1-home-service-operations.test.ts tests/api/desktop-v1-schedule.test.ts` — **PASS**, 71 files, 711 tests |
| Full Vitest | `pnpm exec vitest run` — **FAIL**, 13 files failed / 250 passed; 19 tests failed / 2,138 passed. Failures include Attendance/PWA/static migration assertions, unrelated service-catalog tests, and untracked `_inspection` backup tests. The full suite cannot be called green. |
| Repository lint | `pnpm lint` — **FAIL**, 91 errors, 39 warnings. Failures include files unchanged from main and untracked `_inspection` backups; warnings are retained. |
| Release-scoped lint | ESLint over committed + current worktree changed `.ts/.tsx/.js/.mjs` files, excluding `_inspection/` — **PASS with 13 warnings, 0 errors**. |
| Build | `pnpm build` — **PASS**, optimized Next.js 16.2.4 build and static page generation completed. |
| Working diff | `git diff --check HEAD` — **PASS** at the final committed snapshot. |
| Release diff | `git diff --check origin/main..HEAD` — **FAIL**: whitespace in committed historical CF reports, verification scripts, and SQL (141 output lines). |
| Browser QA | **NOT PERFORMED.** The configured Supabase target is PRODUCTION; no classified LOCAL/TEST runtime and safe personas were available for mutating Check In, payment, assignment, or service workflows. Source/tests/build are not browser evidence. |
| Database QA | **READ-ONLY ONLY.** Current PRODUCTION migration history, table existence, and order-writer function text flags were inspected. No payment, booking, cash session, or reconciliation mutation/readback journey was performed. |

The quality commands ran across the same application content subsequently captured by `3fd86e0c`; `f678f0f1` changed this report only. A new application commit or working-tree change requires rerunning gates. Full-suite failures and lint errors may be inherited, but they still block an unqualified repository-wide PASS.

## Deployment, rollback, and decision

No `.env*`, `package.json`, `pnpm-lock.yaml`, Next config, `vercel.json`, or Supabase config file differs from `origin/main`; the committed config difference is `tsconfig.json`, and navigation adds Cash Flow. No new secret or Vercel setting is evidenced by the diff. Supabase schema/version parity is **not established**. A safe production release requires an owner-approved migration comparison/decision and explicit treatment of the four financial P1s, plus disposition of the separate service/Marketing workstream and release-gate failures. No manual production operation is authorized by this report.

For application rollback after a future approved merge, revert the merge commit and redeploy the prior known-good main SHA `03242a0b` (or the then-current approved baseline). Git rollback will not undo SQL migrations or financial postings; database remediation would need a separate forward-safe plan and evidence.

**Next permitted action:** review and correct the release blockers on an authorized branch, stabilize the source HEAD, establish migration/body parity and financial policy, then rerun gates and safe LOCAL/TEST browser/database journeys. **Not authorized here:** merge, push main, deploy, replay/mark migrations, production mutation, or delete `_inspection/` evidence.

## Exact commit list (oldest first)

```text
378943df80250819a5eda04d495375bfdfbd4c8b feat(booking): establish BKG3 atomic order foundation
92fa6bd1e8fa012c7cc21030760f55c08dca586b docs(cash-flow): freeze CF1 financial contract
2f62622cef757078f9007dacb3725fc199c50807 docs(cash-flow): establish CF2 implementation baseline
6a04af7ee6463f02345ddb61500ba428f53959de feat(cash-flow): establish financial transaction foundation
fdf72c612587da42f4960a2cc77f73628dc50d72 docs(cash-flow): record CF2 foundation evidence
93d000453a2bc473a5d46da7831265129133bcde fix(cash-flow): harden CF2 financial foundation verification
0e2ea15ffaa8d5fa6dd0b356e846bc55d4eded56 docs(cash-flow): record CF2 correction evidence
c7c9a1c0e9cd64502fc90c96b729e1e7d5d31f7a feat(cash-flow): establish order payable allocation foundation
6fa758ec0f113d6af01ce1c0c27b4d133d4448dd docs(cash-flow): record CF3 payable allocation evidence
a880eb300de5bc70372922ab89ab499879ab9ff8 feat(cash-flow): add atomic payment posting engine (CF4)
46194e6644d723e506727129e1eec8eafe1f918f docs(cash-flow): record CF4 atomic payment writer evidence
61dd51195d25fcccc7eeed750c3b95326528bff3 docs(cash-flow): correct CF4 final evidence
bf906cf4c75b8a888aa8cbaab2048ca0a7b3aaf6 feat(cash-flow): implement approved cash flow interface
80f5588a008a665a49ae412a2adf94aa66d7b195 docs(cash-flow): record CF5 exact UI evidence
58d0e1365218c331c4a64146fbc1b8a2536856ea fix(cash-flow): isolate CF5 implementation scope
78ac8cb90423f9bb4c4efbbd91249de4bf86e904 docs(cash-flow): correct CF5 review evidence
6e802ebd7232fa282a084857ab7b8179894be0c9 feat(cash-flow): redesign financial entry modal
f2aa8d98ebfb4030975ea50dbe0c55a820fe509e docs(cash-flow): record financial entry modal evidence
d7f5ee6455faf8629a92db3b7a11567427f6c570 fix(cash-flow): expand financial entry modal to desktop width and fix layout
655605864dd36fc94136681617504d471c9e02c2 docs(cash-flow): update CF5.1 evidence report with layout dimensions
91ec219a0e06823a4ceaf705cffe78b2e6bd4161 feat(cash-flow): wire operational financial entries
54f17e4fdc574a2aa8c603aa69cab1e40071b68f docs(cash-flow): record CF6 operational wiring evidence
0bf66697c0ded3f6b5895b7186c3a71056e57ed6 fix(cash-flow): correct CF6 financial domain boundaries
d0d7f105521abf17b90fd0c542c753b7362c0ae4 docs(cash-flow): complete CF6 verification evidence
c5873dcb1cb89e851f06f1c0b5776b02e7e6c36c feat(cash-flow): add operational expense register receipts
9c892e2d94520340c17be8f6293c837d1666f34b docs(cash-flow): record CF7 expense register evidence
431db1f8e779adca017cbcf66d678c4265f8f298 fix(cash-flow): make workspace tabs switch locally
20afec933f830a3a2a6670bb5c13b53a1e04e411 wip(cf8): reconcile cash flow and booking contracts
f968522091e6e0f8adb6409db4d98538e3d6a18d fix(cf8): stabilize financial flows through cash operations
0d30d926207495d86139c7d57f7d03c0aa9d7140 fix(cf8c): address cash operations review findings
e01bc7d15a4d074772135613b3580940994c1476 fix(cf8c): serialize cash operation idempotency
6677c753cd2b5339dd26ab9a36f8279f8fd1a6b8 fix(cf8c): require cash operation idempotency keys
cef68fa28d4912a1bb9182711af553f2cb2aa630 fix(cf8c): normalize cash operation idempotency keys
5fe61dfac3e880cb769e7b72288c9808b93952d6 Merge CF8 financial foundation onto accepted main
fd1b5b2a4c4ebd2e4c24b481ebc609902c9b763c test(cf8c): make transfer assertions line-ending agnostic
b0435b70db34ff1827aed2e3258ab81021fd3130 Reorganize Cradle Flow front desk workspace
6b1a80273c29f72ff3efb64d6de3bdf83c253843 Open Home Service visits in booking workspace
3fd86e0c28a12a8922677d86045168412c63b4c3 feat(web): checkpoint cradle flow and service management stabilization
f678f0f1ff74722f250879a457aa0b5cbb6da13f docs(audit): record pre-merge release reconciliation
```

## Exact committed changed files versus origin/main

```text
A	CradleHub_CF0_1_Architecture_Reconciliation.md
A	CradleHub_CF0_Financial_Truth_and_Build_Blueprint.md
A	CradleHub_CF1_Financial_Contract_Freeze.md
A	CradleHub_CF2_Correction_1_Report.md
A	CradleHub_CF2_Financial_Foundation_Report.md
A	CradleHub_CF2_Prep_Baseline_Report.md
A	CradleHub_CF3_Order_Payables_Allocations_Report.md
A	CradleHub_CF4_Atomic_Payment_Writer_Report.md
A	CradleHub_CF5_1_Record_Financial_Entry_Modal_Report.md
A	CradleHub_CF5_Exact_Cash_Flow_UI_Report.md
A	CradleHub_CF6_Operational_Wiring_Report.md
A	CradleHub_CF7_Operational_Expense_Register_Report.md
A	docs/audits/BOOKING-LIFECYCLE-DIAGNOSTIC-2026-09-30.md
A	docs/audits/PRE-MERGE-RELEASE-RECONCILIATION-2026-09-30.md
A	docs/audits/SERVICE-MARKETING-PUBLISH-SYNC-2026-09-30.md
A	scripts/verification/validate-cf2-financial-foundation.mjs
A	scripts/verification/validate-cf3-order-payables.mjs
A	scripts/verification/validate-cf4-payment-writer.mjs
A	scripts/verification/validate-cf6-operational-writers.mjs
A	scripts/verification/validate-cf7-expense-register.mjs
A	scripts/verification/validate-cf8-cash-sessions.mjs
M	src/app/(dashboard)/crm/bookings/actions.ts
A	src/app/(dashboard)/crm/cash-flow/page.tsx
M	src/app/(dashboard)/crm/today/page.tsx
M	src/app/(dashboard)/manager/bookings/actions.ts
M	src/app/(dashboard)/marketing/actions.ts
M	src/app/(dashboard)/marketing/service-actions.ts
M	src/app/(dashboard)/owner/bookings/actions.ts
M	src/app/(dashboard)/owner/services/[serviceId]/page.tsx
M	src/app/(dashboard)/owner/services/actions.ts
M	src/app/api/booking/available-slots/route.ts
M	src/app/api/desktop/v1/bookings/route.ts
M	src/components/features/bookings/quick-booking-form.tsx
M	src/components/features/bookings/room-assignment-modal.tsx
A	src/components/features/cash-flow/cash-flow-kpi-card.tsx
A	src/components/features/cash-flow/cash-flow-workspace.tsx
A	src/components/features/cash-flow/day-close-tab.tsx
A	src/components/features/cash-flow/history-tab.tsx
A	src/components/features/cash-flow/ledger-tab.tsx
A	src/components/features/cash-flow/open-cash-drawer-modal.tsx
A	src/components/features/cash-flow/record-financial-entry-modal.tsx
A	src/components/features/cash-flow/record-payment-sheet.tsx
A	src/components/features/cash-flow/today-tab.tsx
M	src/components/features/crm/today/cradle-flow-actions.tsx
M	src/components/features/crm/today/cradle-flow-booking-dialog.tsx
M	src/components/features/crm/today/cradle-flow-checkout-dialog.tsx
M	src/components/features/crm/today/cradle-flow-dashboard.tsx
A	src/components/features/crm/today/cradle-flow-display.ts
A	src/components/features/crm/today/cradle-flow-financial-entry.tsx
M	src/components/features/crm/today/cradle-flow-lower-panels.tsx
M	src/components/features/crm/today/cradle-flow-side-rail.tsx
M	src/components/features/crm/today/cradle-flow-summary.tsx
A	src/components/features/crm/today/cradle-flow-therapist-dialog.tsx
M	src/components/features/crm/today/cradle-flow-ticket.tsx
M	src/components/features/crm/today/cradle-flow-workflow.tsx
M	src/components/features/crm/today/crm-booking-list-item.tsx
M	src/components/features/crm/today/crm-today-shell.tsx
M	src/components/features/crm/today/tabs/today-action-required-tab.tsx
M	src/components/features/crm/today/tabs/today-payments-pending-tab.tsx
M	src/components/features/dashboard/nav-config.ts
M	src/components/features/marketing/services/services-studio-view.tsx
A	src/components/features/owner/service-image-fields.tsx
M	src/components/public/booking-wizard.tsx
M	src/lib/actions/online-booking.ts
A	src/lib/bookings/bkg3-atomic-contract.ts
A	src/lib/bookings/booking-order-contract.ts
A	src/lib/bookings/booking-wizard-validation.ts
M	src/lib/bookings/inhouse-booking-engine.ts
M	src/lib/bookings/payment-transaction.ts
M	src/lib/bookings/revalidate-booking-surfaces.ts
A	src/lib/cash-flow/cash-flow-actions.ts
A	src/lib/cash-flow/cash-flow-errors.ts
A	src/lib/cash-flow/cash-flow-queries.ts
A	src/lib/cash-flow/cash-flow-types.ts
A	src/lib/cash-flow/expense-receipt.ts
A	src/lib/cash-flow/financial-contract.ts
A	src/lib/cash-flow/financial-entry-context.ts
A	src/lib/cash-flow/legacy-booking-price.ts
A	src/lib/cash-flow/payment-evidence.ts
A	src/lib/cash-flow/payment-writer.ts
M	src/lib/crm/cradle-flow.ts
M	src/lib/engine/availability.ts
M	src/lib/queries/bookings.ts
M	src/lib/queries/marketing-content.ts
A	src/lib/services/service-mutation.ts
M	src/lib/supabase/admin.ts
M	src/lib/validations/booking.ts
M	src/lib/validations/service.ts
M	src/types/supabase.ts
A	supabase/migrations/20260927080000_bkg3_booking_order_atomic.sql
A	supabase/migrations/20260927120000_cf2_financial_foundation.sql
A	supabase/migrations/20260927130000_cf3_order_payables_allocations.sql
A	supabase/migrations/20260927140000_cf4_atomic_payment_writer.sql
A	supabase/migrations/20260928120000_cf6_operational_cash_flow_writers.sql
A	supabase/migrations/20260929120000_cf7_expense_receipt_storage.sql
A	supabase/migrations/20260929130000_cf8_cash_sessions_foundation.sql
A	supabase/migrations/20260929140000_cf8_booking_payment_command.sql
A	supabase/migrations/20260930083000_cf8c_cash_operations_integrity.sql
A	supabase/migrations/20260930100000_cf8c_cash_operations_review_corrections.sql
A	tests/components/owner/service-image-fields.test.tsx
A	tests/lib/bookings/bkg3-atomic-contract.test.ts
A	tests/lib/bookings/booking-order-contract.test.ts
A	tests/lib/bookings/booking-payment-actions.test.ts
A	tests/lib/bookings/booking-payment-command.test.ts
A	tests/lib/bookings/booking-simplification-safety.test.ts
A	tests/lib/bookings/booking-wizard-confirm.test.ts
A	tests/lib/bookings/cf8-atomic-creation-contract.test.ts
A	tests/lib/bookings/daily-order-payment-summary.test.ts
A	tests/lib/bookings/inhouse-atomic-boundary.test.ts
M	tests/lib/bookings/inhouse-booking-engine-auth.test.ts
A	tests/lib/cash-flow/cash-flow-mixed-read-model.test.ts
A	tests/lib/cash-flow/cash-flow-page-tabs.test.tsx
A	tests/lib/cash-flow/cash-flow-ui.test.tsx
A	tests/lib/cash-flow/cash-session-contract.test.ts
A	tests/lib/cash-flow/cf7-receipt-correction.test.ts
A	tests/lib/cash-flow/cf8-database-reconciliation.test.ts
A	tests/lib/cash-flow/cf8c-cash-operations-integrity.test.ts
A	tests/lib/cash-flow/cf8c-review-corrections.test.ts
A	tests/lib/cash-flow/financial-entry-context.test.ts
A	tests/lib/cash-flow/financial-foundation-contract.test.ts
A	tests/lib/cash-flow/legacy-payment-action.test.ts
A	tests/lib/cash-flow/order-payable-contract.test.ts
A	tests/lib/cash-flow/payment-evidence.test.ts
A	tests/lib/cash-flow/payment-reconciliation-ui.test.tsx
A	tests/lib/cash-flow/payment-writer-contract.test.ts
A	tests/lib/crm/cradle-flow-display.test.ts
A	tests/lib/crm/cradle-flow-modal-decoupling.test.tsx
M	tests/lib/crm/cradle-flow.test.ts
M	tests/lib/marketing/brand-branches-services-studios.test.tsx
M	tests/lib/marketing/draft-publication-pipelines.test.ts
A	tests/lib/services/service-mutation.test.ts
M	tsconfig.json
```

## Exact untracked source files at report time

All 60 paths under `_inspection/` predated this report. This report is tracked in `f678f0f1` and has additional uncommitted inventory text.

```text
_inspection/CF7_STORAGE_CORRECTION_REPORT.md
_inspection/CF8A_approved_ui_checks.txt
_inspection/CF8A_approved_ui_diff.txt
_inspection/CF8B_cash_session_inspection.txt
_inspection/CF8B_contract_sql_context.txt
_inspection/CF8C_COMMIT_SCOPE_REVIEW.txt
_inspection/CF8C_CORRECTION_0d30d92.patch
_inspection/CF8C_CORRECTION_INDEPENDENT_REVIEW.txt
_inspection/CF8C_FINAL_CLOSEOUT.txt
_inspection/CF8C_FINAL_CLOSEOUT_EVIDENCE.txt
_inspection/CF8C_FINAL_LOCAL_GATES.txt
_inspection/CF8C_FULL_REVIEW_20afec_to_cef68fa.patch
_inspection/CF8C_LOCAL_GATE_OUTPUT.txt
_inspection/CF8C_REQUIRED_KEY_6677c75.patch
_inspection/CF8C_REQUIRED_KEY_FINAL_REVIEW.txt
_inspection/CF8C_SHELL_BASELINE.txt
_inspection/CF8_AGENT_INTERRUPTED.patch
_inspection/CF8_AGENT_INTERRUPTED_HANDOFF.txt
_inspection/CF8_CHECKPOINT_INDEPENDENT_REVIEW.txt
_inspection/CF8_CHECKPOINT_f968522.patch
_inspection/CF8_DATABASE_RECONCILIATION_GAP_MATRIX.txt
_inspection/CF8_DATABASE_RECONCILIATION_REPORT.md
_inspection/CF8_DATABASE_RECONCILIATION_VERIFY.sql
_inspection/CF8_HISTORICAL_MIGRATION_DIFF_REVIEW.txt
_inspection/CF8_MAIN_BASELINE_RECONCILIATION.txt
_inspection/CF8_MAIN_RECONCILIATION.patch
_inspection/CF8_MAIN_RECONCILIATION_EVIDENCE.txt
_inspection/CF8_MAIN_RECONCILIATION_GATES.txt
_inspection/CF8_MAIN_RECONCILIATION_WHITESPACE_CLASSIFICATION.txt
_inspection/CF8_MAIN_RELEASE_MERGE_EVIDENCE.txt
_inspection/CF8_PAYMENT_SYNTAX_CURRENCY_REVALIDATION.md
_inspection/CF8_PRODUCTION_APPLY_EXACT_MIGRATIONS.zip
_inspection/CF8_PRODUCTION_PREAPPLY_CATALOG_SNAPSHOT.json
_inspection/CF8_PRODUCTION_PREAPPLY_FUNCTIONS_SNAPSHOT.json
_inspection/CF8_PRODUCTION_PREAPPLY_STATUS_SNAPSHOT.json
_inspection/CF8_PRODUCTION_SYNC_BLOCKED_REPORT.md
_inspection/CF8_payment_visibility_diagnostic.txt
_inspection/backups/today-tab_before_approved_ui_20260929_123938.tsx
_inspection/cf8-local-db-baseline/cf4-baseline-objects.txt
_inspection/cf8-local-db-baseline/cf4-baseline-schema.sql
_inspection/cf8-local-db-baseline/cf4-baseline.dump
_inspection/cf8-local-db-baseline/cf4-public-baseline.dump
_inspection/cf8c-review-correction-backup-f968522/cash-flow-queries.ts
_inspection/cf8c-review-correction-backup-f968522/cf8c-cash-operations-integrity.test.ts
_inspection/cf8c-review-correction-backup-f968522/record-financial-entry-modal.tsx
_inspection/cf8c-shell-backup-1/cash-flow-actions.ts
_inspection/cf8c-shell-backup-1/cash-flow-workspace.tsx
_inspection/cf8c-shell-backup-1/record-financial-entry-modal.tsx
_inspection/cf8c-shell-backup-1a-retry/cash-flow-actions.ts
_inspection/cf8c-shell-backup-1a-retry/cash-flow-workspace.tsx
_inspection/cf8c-shell-backup-1a-retry/record-financial-entry-modal.tsx
_inspection/cf8c-shell-backup-1a/cash-flow-actions.ts
_inspection/cf8c-shell-backup-1a/cash-flow-workspace.tsx
_inspection/cf8c-shell-backup-1a/record-financial-entry-modal.tsx
_inspection/cf8c-shell-backup-1b/cash-flow-workspace.tsx
_inspection/cf8c-shell-backup-1b/record-financial-entry-modal.tsx
_inspection/cf8c-shell-backup-2a/cash-flow-actions.ts
_inspection/cf8c-shell-backup-2a/cf8c-cash-operations-integrity.test.ts
_inspection/cf8c-shell-backup-2a/cf8c_cash_operations_integrity.sql
_inspection/cf8c-shell-backup-2a/record-financial-entry-modal.tsx
```
