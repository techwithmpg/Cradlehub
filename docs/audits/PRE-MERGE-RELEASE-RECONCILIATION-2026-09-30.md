# CradleHub Web — pre-merge release reconciliation

**Verdict: CORRECTION REQUIRED.** This is a read-only release review plus this report. No merge, push to main, deployment, production mutation, reset, stash, or cleanup was performed.

## Git truth at review snapshot

| Item | Value |
| --- | --- |
| Source | `E:\cradlehub-booking-simplification` |
| Source branch | `fix/p1-financial-safety` at final snapshot; it changed during this review from `stage/cf-financial-foundation-main-reconcile` |
| Source HEAD | `3fd86e0c28a12a8922677d86045168412c63b4c3` |
| Main worktree | `E:\cradlehub`, clean on `main` |
| Main HEAD / fetched `origin/main` / merge-base | `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a` |
| Git family | Both paths use `E:\cradlehub\.git`; source is a linked worktree |
| Commits ahead / committed changed files | 38 / 131 |

Both worktrees' `origin/main` refs were refreshed with `git fetch origin --prune`. The source's first sandboxed fetch could not write `FETCH_HEAD` in the shared Git directory; the authorized escalated fetch succeeded. During this review, another process created commit `3fd86e0c` and switched the source checkout to `fix/p1-financial-safety`. It captured the previously uncommitted Cradle Flow, booking diagnostic, and service/Marketing changes. The current source has only `_inspection/` and this report untracked. The attached exact inventories are a snapshot; re-resolve HEAD and status before any subsequent release action.

## Release content classification

- **A. Intended booking and Cradle Flow:** BKG3 order/attendee/service-line creation, public and in-house booking actions, Cradle Flow display, Home Service entry, and the latest front-desk layout. Four primary actions, Active Service Workflow, right-rail Attendance Activity → Today's Money → Needs Attention → Quick Actions, removal of the extra expanded KPI strip, and retained per-booking actions are represented in committed HEAD. The latest modal decoupling, room assignment, therapist assignment, and financial-entry components entered commit `3fd86e0c`; they were uncommitted at the review start.
- **B. CF8 inherited work:** financial accounts/transactions, order payables/allocations, payment writers, Cash Flow UI, cash sessions, expenses, receipt storage, nine CF-family SQL files, verification scripts, and tests. These are a substantial release dependency, not a visual-only change.
- **C. Diagnostics/reports:** twelve root CF reports and two `docs/audits` reports are committed. The 60 pre-existing `_inspection/` files are untracked evidence/backups, including dumps, patches, and snapshots; they must not enter a merge accidentally.
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

The quality commands ran across the same content subsequently captured by `3fd86e0c`; a new commit or working-tree change requires rerunning gates. Full-suite failures and lint errors may be inherited, but they still block an unqualified repository-wide PASS.

## Deployment, rollback, and decision

No `.env*`, `package.json`, `pnpm-lock.yaml`, Next config, `vercel.json`, or Supabase config file differs from `origin/main`; the committed config difference is `tsconfig.json`, and navigation adds Cash Flow. No new secret or Vercel setting is evidenced by the diff. Supabase schema/version parity is **not established**. A safe production release requires an owner-approved migration comparison/decision and explicit treatment of the four financial P1s, plus disposition of the separate service/Marketing workstream and release-gate failures. No manual production operation is authorized by this report.

For application rollback after a future approved merge, revert the merge commit and redeploy the prior known-good main SHA `03242a0b` (or the then-current approved baseline). Git rollback will not undo SQL migrations or financial postings; database remediation would need a separate forward-safe plan and evidence.

**Next permitted action:** review and correct the release blockers on an authorized branch, stabilize the source HEAD, establish migration/body parity and financial policy, then rerun gates and safe LOCAL/TEST browser/database journeys. **Not authorized here:** merge, push main, deploy, replay/mark migrations, production mutation, or delete `_inspection/` evidence.

## Exact commit list (oldest first)

```text
