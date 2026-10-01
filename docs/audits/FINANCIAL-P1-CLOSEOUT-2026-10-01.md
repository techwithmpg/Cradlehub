# CradleHub Web — Financial P1 closeout (2026-10-01)

## Target and checkpoint

| Field | Result |
| --- | --- |
| TARGET | CradleHub Web |
| PROGRAM | Controlled Stabilization |
| SCOPE | P1-A closed booking safety / P1-B cash drawer / P1-C Day Close |
| BRANCH | `fix/p1-financial-safety` |
| BASE SHA | `03242a0bfbcfe6c4b1b03ba624510004cae7cc6a` (local `origin/main` and merge base at review; no remote fetch was made) |
| START HEAD SHA | `0a5f4bf846326c97b44bea5414377cbed574b2af` |
| FINAL HEAD SHA | `8f1b8f0e6e5fdc2ccc38a7a23d0f06a8880e567b` (financial correction checkpoints; this report remains uncommitted) |
| RELEVANT COMMITS | `d58cdaa7e2d0e4a0a88d19bbb236ce7fbb009cb6` P1-B; `c3fcc904ad2bdac6f98259f1b9fbc0db37cbe622` P1-C; `0a5f4bf846326c97b44bea5414377cbed574b2af` P1-A; `0be1182fd03e7287477ba5e76090199b27c0b9c5` closeout correction; `8f1b8f0e6e5fdc2ccc38a7a23d0f06a8880e567b` persisted approval guard |

**Evidence labels:** All implementation and test findings below are **REPOSITORY-RECORDED WORKING EVIDENCE**. The owner's statement that P1-A has not been applied to production is **REPOSITORY-RECORDED PRODUCTION EVIDENCE** only; no live production verification was performed.

## Changed files

Checkpoint `0be1182` contains only:

- `supabase/migrations/20261001090000_p1a_closed_booking_financial_safety.sql`
- `tests/lib/cash-flow/p1a-closed-booking-financial-safety.test.ts`
- `src/lib/cash-flow/reconciliation-expected.ts`
- `src/app/(dashboard)/crm/reconciliation/actions.ts`
- `src/app/(dashboard)/crm/reconciliation/page.tsx`
- `src/app/(dashboard)/crm/reconciliation/reconciliation-form.tsx`
- `tests/lib/cash-flow/reconciliation-expected.test.ts`
- `tests/lib/cash-flow/reconciliation-actions.test.ts`

Checkpoint `8f1b8f0` contains only:

- `supabase/migrations/20261001015057_p1c_reconciliation_status_guard.sql`
- `tests/lib/cash-flow/reconciliation-status-guard.test.ts`

This report is the sole uncommitted file created for this closeout. Existing Front Desk branch selector changes, the modified prior audit and `_inspection/` were not staged, reset, deleted, or included in either checkpoint.

## P1-A CONTRACT RESULT

**PASS at repository level, with PostgreSQL runtime unverified.** The unapplied P1-A forward migration had two malformed regex literals in the lazy payable preflight. Each had an extra quote after the closing regex string, so that function could not compile as written. The correction removes those quotes, removes a stale comment claiming the writer had not yet been copied forward, and adds a regression assertion. No previously accepted migration was changed.

The reviewed SQL locks the booking/order during reconciliation; retains positive service payables, posted transactions, account movements and allocations; inserts only a negative `manual_adjustment`; caps it by the smaller of unwaived service value and remaining order collectible; excludes closed lines from lazy materialization; and reconciles stale materialized closed lines before a new order payment. A closed booking rejects positive direct booking payment deltas. The replay path returns before new reconciliation or money writes. Completed lines are not included in the closed status rule.

| Scenario | Repository contract evidence |
| --- | --- |
| A. Unpaid cancellation | 1,800 payable less 800 closed-service waiver leaves 1,000 collectible. |
| B. Partial payment | 1,800 payable less 1,200 allocations leaves 600; waiver is 600, then remaining is zero. No refund is fabricated. |
| C. Fully paid | Remaining collectible is zero, so waiver is zero and received money remains. |
| D. Mixed sibling | Waiver is capped to the closed service and leaves the active/completed sibling payable. |
| E. No-show | Uses the same closed-line predicate as cancellation. |
| F. Completed | Excluded from the waiver and direct payment rejection predicates. |
| G. Stale direct booking payment | Positive delta on cancelled/no-show is rejected. |
| H. Stale order payment | Closed materialized services are reconciled before balance validation for new money. |
| I. Idempotent replay | Existing matching transaction returns before fresh reconciliation and inserts. |
| J. Repeated reconciliation | Cumulative adjustment plus remaining-order cap makes a second unchanged pass zero. |

These are code-path and arithmetic conclusions, not executed database scenarios.

## P1-B CONTRACT RESULT

**PASS at repository level, with PostgreSQL runtime unverified.** The P1-B migration retains a cash-session guard in order, booking and in-house payment writers. It matches the selected cash drawer account and branch, requires `status = 'open'`, and locks that session `FOR SHARE` before new cash writes. Account branch, currency, active state and rail/type checks precede posting. Split tenders are checked part by part. Digital rails bypass only the physical-drawer requirement. In-house payment calls the guarded order writer after its own preflight. Matching idempotent replay returns without new collection. Static contract tests cover these paths; no live payment was posted.

## P1-C CONTRACT RESULT

**PASS at repository level, with database and browser behavior unverified.** Day Close reads `daily_cash_reconciliations` for the selected branch/business date. Its saved status, actual, expected and variance fields remain distinct from customer outstanding balance. The Cash Flow screen does not create a second persisted close or auto-approve one.

The closeout inspection found that the existing reconciliation save action calculated expected channel totals through a booking-date summary and could silently use zero if that query failed. The correction now sums signed movements from `posted` financial transactions for the selected branch and business date, including cash outflow and digital channels. Both the form and saved record use that source; failed movement reads prevent a save. The server action prevents a direct save from demoting an approved record and permits only Owner/Manager approval of a submitted record.

The existing branch RLS policy also permitted direct authenticated Data API writes that bypassed those action checks. A separate new forward migration adds a trigger on the existing `daily_cash_reconciliations` table: insert cannot start as approved; approval requires a submitted record and an active Owner/Manager identity; approved records cannot be updated or deleted; branch/date identity cannot be moved. It does not create another persistence authority or rewrite existing rows. PostgreSQL runtime behavior of this trigger remains unverified.

## AUTHORIZATION REVIEW

The financial payment writers remain `SECURITY DEFINER` with explicit empty `search_path`, authenticated staff/role checks, branch checks and account/rail checks. The P1-A reconciliation helper remains revoked from `PUBLIC`, `anon` and `authenticated` and granted to `service_role` for internal use. The new reconciliation trigger is also a restricted `SECURITY DEFINER` function with explicit empty `search_path`; it reads the active staff role from `auth.uid()`. No RLS policy, service-role browser exposure or client-authoritative financial validation was added. The reconciliation actions authenticate server-side; approval now checks role and submitted state. Existing branch RLS and the branch filter remain in place.

## MIGRATION SAFETY REVIEW

P1-B `20260930145947_require_open_drawer_for_cash_payments.sql` SHA-256 matched the prior record: `560EA1277976ABC82CF3D4BF7295C01D61B648283890995F7D89C0F9492F3F3C`. It was not edited. The SQL changes were limited to the new P1-A forward migration identified by the owner as not applied to production and the CLI-generated P1-C forward guard `20261001015057_p1c_reconciliation_status_guard.sql`. Neither was applied here. No migration history was repaired, marked applied or replayed.

## TEST RESULTS

- P1-A, P1-B, P1-C, payment writer and Cash Flow release set: **26 files, 264 tests passed** after both correction checkpoints' content was finalized.
- TypeScript (`tsc --noEmit --incremental false`): **PASS**.
- Targeted ESLint on changed/relevant TS/TSX: **PASS**.
- `git diff --check` on the financial files: **PASS** (line-ending advisory only).
- Broader `vitest run` (before the final P1-C guard test was added): **257 files passed, 13 failed; 2,182 tests passed, 16 failed**. The final guard test passed in the later release-scoped run. Classification below.

## BUILD RESULT

`pnpm build`: **PASS** for the final application source state, including the `/crm/reconciliation` route. The subsequently added SQL guard and its test do not enter the Next.js build; they were checked by the release test set.

## DATABASE RUNTIME STATUS

**DATABASE MUTATION QA: NOT PERFORMED.** No approved LOCAL/TEST PostgreSQL mutation target was available. The SQL was reviewed and static tests ran, but the full P1-A function and new P1-C trigger were not compiled or exercised against PostgreSQL. No database target was mutated.

## BROWSER QA STATUS

**NOT PERFORMED.** The reconciliation form and Day Close read path were checked in source and tests. Authenticated Owner/Manager/CRM browser flows were not exercised in this closeout.

## PRODUCTION IMPACT

None from this task. No deployment, migration application, production mutation, merge or push occurred. Production schema parity and behavior were not independently verified. The repository-recorded owner checkpoint says P1-A is not yet applied to production.

## KNOWN LIMITATIONS

The repository tests are static/unit evidence, not proof that the SQL migrations compile or that RLS and triggers behave as expected on the target database. Day Close still depends on the pre-existing reconciliation workflow and its persisted records; no historical reconciliation was rewritten. The separate, uncommitted Front Desk changes were present during build/tests and are outside these financial checkpoints.

## INHERITED FAILURES

The broader suite failures were **PRE-EXISTING / INHERITED relative to this financial correction pass**: Attendance migration/source and read tests, staff branch correction contract tests, service catalog migration tests, CRM navigation contract, agent follow-up server-only import, maintenance script parsing, and duplicate `_inspection/` CF8-C tests. None targets a changed financial file. Some may reflect unrelated local work or line-ending-sensitive source assertions; this pass did not alter those systems. They remain outside the financial release-scoped gate and need separate owners.

## ROLLBACK CONSIDERATIONS

Before production application, the code checkpoints can be reverted normally. After application, P1-A creates triggers/functions and may append legitimate negative payable adjustments; P1-C adds a finalization guard on the existing table. Rollback must preserve posted financial and reconciliation history and must not delete those rows. Any deployment rollback needs a reviewed forward database plan, not migration-history repair or a blind down migration.

## UNRESOLVED RELEASE BLOCKERS

No further P0/P1 defect was identified in the repository-level P1-A/B/C contract after correction. External review, safe PostgreSQL compile/mutation QA, target parity review and owner release authorization remain required before production use. The unrelated full-suite failures are recorded above and are not counted as financial-contract PASS evidence.

## FINAL VERDICT

**PASS** — repository-level financial P1 closeout is ready for external review and the owner's release decision, subject to the runtime, browser and production limits above.
