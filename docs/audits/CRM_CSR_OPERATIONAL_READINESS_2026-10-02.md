# CradleHub Web — CRM / CSR operational readiness, 2026-10-02

## A–G. Verdict, target, revision, and tree

**Verdict: CORRECTION REQUIRED.** Target: CradleHub Web. Evidence class: **REPOSITORY-RECORDED WORKING EVIDENCE**. No hosted application or production database was verified.

| Item | Value |
| --- | --- |
| Branch | `fix/p1-crm-csr-readiness` in an isolated worktree |
| Base SHA | `ace46f6d82dc277363c4efeff992f1f739103547` |
| HEAD SHA at report creation | `ace46f6d82dc277363c4efeff992f1f739103547` |
| Fetched `origin/main` SHA | `ace46f6d82dc277363c4efeff992f1f739103547` |
| Working tree | Uncommitted change to `src/app/(dashboard)/crm/reconciliation/actions.ts`, `tests/lib/cash-flow/reconciliation-actions.test.ts`, and this report; no tracked source change in the original checkout |
| Original checkout | `fix/public-booking-mobile-step2` at `eb55d5fc380890abbccccb09a0387695877696af`, with pre-existing changes to `next.config.ts`, `src/components/shared/mobile-first-visit-preloader.tsx`, and an untracked backup. Preserved untouched. |

The owner authorized this Web stabilization pass and bounded fixes for proven P0/P1 operational defects. No merge, deployment, production mutation, schema change, or migration is authorized by this pass. Active governance was read from `AI_CONTEXT.md`, `docs/11-DECISION-LOG.md`, `docs/09-TESTING-QUALITY-GATES.md`, `docs/10-HANDOFF-PROTOCOL.md`, and `docs/14-BRANCH-STRATEGY.md`. The local Next.js 16.2.4 forms guide was read before the Server Action edit.

## H. Current workflow and authority discovered

| Surface | Current consumer / source of truth / authority and side effects |
| --- | --- |
| Cradle Flow / Today | `/crm/today` combines branch bookings, pending queue, payment snapshot, readiness, attendance feed, driver assignment and location. `getFrontDeskContext()` supplies server resolved branch and role. Actions lead to booking, dispatch and Cash Flow flows. |
| Bookings / wizard / details | `/crm/bookings`, `/crm/bookings/new`, and Cradle Flow use booking queries, quick booking options, booking actions and `QuickBookingForm`; the public `booking-wizard.tsx` is a separate customer flow. Booking/order/payment RPCs are the mutation authority. |
| Customers | `/crm/customers` and customer profile use branch scoped customer queries; customer creation and lookup feed the booking flow. |
| Schedule / Attendance | `/crm/schedule` reads daily schedule and staff availability; `/crm/attendance` reads branch attendance records/feed and uses separate correction actions. Neither is the financial actor authority. |
| Home Service | Cradle Flow and `/crm/dispatch` use booking dispatch actions, driver recommendation/assignment, location and status data. `confirmHomeServiceHandoffAction` is the direct Confirm & Dispatch entry; no old multi-gate flow was found in this path. |
| Cash Flow | `/crm/cash-flow` and `/owner/cash-flow` read `financial_accounts`, posted `financial_transactions` and movements, order summaries, cash sessions, and saved reconciliation. Missing required tables fail closed with an unavailable message. |
| Financial writes | `recordOrderPaymentAction`, legacy booking payment, expense, cash operation and session opening actions call server RPCs. Current SQL resolves `auth.uid()` to active staff, checks role/branch/account, and uses idempotency keys for payment, cash operation and session opening. Client supplied IDs select objects; they are not actor proof. |
| Owner branch | `getFrontDeskContext()` resolves the selected Owner branch server side. `/owner/cash-flow` has its own branch selector. The reconciliation action previously used the Owner staff row's nullable `branch_id` instead of the selected Front Desk branch; this pass corrects that mismatch. |

## I. Complete simulated day results

This is a **code and automated-test simulation**, not a signed-in operating day. No authenticated browser session or classified database target was available. “Path present” means inspected code plus the named test slice where applicable; it does not mean a transaction was performed.

| Workflow | Expected | Actual | Evidence type | Result | Severity | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Start: CRM login and workspace | Authorized CSR enters correct branch | `getFrontDeskContext()` checks authenticated user, active staff/role and branch; runtime login not exercised | Code inspection | NOT VERIFIED at runtime | — | No isolated-worktree credentials |
| Start: Today bookings | Today's branch work appears | `/crm/today` queries branch/date schedule and pending queue | Code inspection | Path present | — | Data not loaded in browser |
| Start: Schedule / Attendance / Customers | Correct branch data | Each route has branch scoped query path; test slices passed | Code + automated test | Path present | — | Actual rows not verified |
| Open drawer/session | Persistent drawer, one active shift session and float | Account is persistent; `open_cash_session_atomic` has one-open-session index, actor and idempotency | Code + automated test | Path present | — | No actual session opened |
| Scheduled CSR / custodian | Schedule suggests; custodian accepts | Schedule exists; no cash-session custodian/handover link | Code inspection | Gap | P3 as standalone feature | Becomes P1 with required handover/day close |
| New normal / walk-in booking | Customer, service, staff, time, confirm and visibility | Quick booking form and atomic booking path exist; booking tests passed | Code + automated test | Path present | — | No real booking created |
| Multi-guest booking | Per-attendee services persist across Steps 2/4 | Public wizard and Step 2/4 tests inspected; no viewport or live confirmation | Code + automated test | NOT VERIFIED at runtime | — | Public wizard is distinct from CRM quick booking |
| Existing booking management | Search, filter, edit/reschedule/assign/cancel | Routes/actions and booking tests exist | Code + automated test | Path present | — | Audit and concurrency not live verified |
| Cash payment ₱1,000 | Movement allocated; drawer session required | Atomic order writer and open-session guard present | Code + automated test | NOT VERIFIED at runtime | — | No database transaction posted |
| Digital payment ₱1,500 | Correct rail/account | Payment payload supports methods and accounts; RPC validates branch/account | Code + automated test | NOT VERIFIED at runtime | — | No account balance verified |
| Split ₱500 cash + ₱1,500 GCash | Two tenders and allocation | Canonical `payments[]` plus allocation RPC path present | Code + automated test | NOT VERIFIED at runtime | — | No split transaction posted |
| Deposit ₱1,000 then ₱1,500 | Two historical transactions and balance | Order writer is append based with idempotency and derived order summary | Code + automated test | NOT VERIFIED at runtime | — | No serial transaction executed |
| Expense ₱300 from drawer | Category, source, actor, movement, session | Expense action calls `post_expense_atomic`; account and receipt handling present | Code + automated test | NOT VERIFIED at runtime | — | No expense posted |
| Cash in/out/safe drop | Distinct from revenue/expense | Cash operation/transfer RPC and tests preserve transaction distinctions and open-session guard | Code + automated test | NOT VERIFIED at runtime | — | No physical count |
| Home Service dispatch/progress | Assign therapist/driver; dispatch then monitor | Direct dispatch action and monitoring paths exist; Home Service tests passed | Code + automated test | NOT VERIFIED at runtime | — | No location/driver runtime stream |
| Mid-shift handover | Count, variance, accepting custodian | No custodian/handover model or writer found | Code inspection | BLOCKED | P1 | Requires forward-only schema/domain decision |
| Day Close | Expected incl. float, count, variance, close session | Saved branch/date reconciliation exists; no session close writer; reconciliation cash expected omits opening float | Code inspection | BLOCKED | P1 | See J and findings below |
| Owner branch transition | Selected branch consistent across Front Desk and Cash Flow | Reconciliation action mismatch reproduced and fixed; whole cross-module transition untested | Regression test + code | PARTIAL | P1 fixed | Owner route runtime not verified |
| Failures/retries | No false success; no double post | Server RPCs include idempotency and errors; focused tests pass | Code + automated test | PARTIAL | — | Refresh/network/concurrency not browser verified |
| Responsive 390×844, 1366×768, 1920×1080 | All controls usable | No authenticated browser environment | NOT VERIFIED | NOT VERIFIED | — | No physical device evidence |

## J. Cash Flow and drawer findings

- **Drawer model:** `financial_accounts` with `account_type = cash_drawer` represents a persistent physical account. The UI opens an existing unopened drawer; it does not create a new daily drawer.
- **Session model:** `cash_sessions` has branch, drawer, business date, opening float, opener, timestamps and open/closed state. A partial unique index allows only one open session per drawer. The only discovered writer is `open_cash_session_atomic`; there is no current close or handover writer.
- **Opening float:** stored on session, not posted as revenue. `getCashFlowData()` correctly derives *active drawer expected cash* as opening float plus posted movements on that drawer since opening. In contrast, `getPostedReconciliationExpected()` sums posted movements by branch/business date and omits opening float. The Day Close/reconciliation UI displays that saved cash expectation as if it were a drawer count.
- **Schedule / scheduled CSR:** Schedule can identify on-duty staff, but no financial session integration is implemented. The schedule is not changed by cashier activity.
- **Custodian:** opener is recorded; current custodian and handover are absent. Opener, custodian, authenticated actor and scheduled CSR cannot be represented separately for a shift change.
- **Actor:** payment, expense and cash operation RPCs derive active staff from `auth.uid()` and record `recorded_by`; opening records `opened_by`. Reconciliation records `recorded_by` from the authenticated staff row. This was inspected in source, not verified against a database.
- **Payment / expense / cash in/out:** canonical financial transactions and signed account movements are separate from booking snapshots; physical drawer operations require an open session. Expense is not modeled as a booking. Safe drop uses transfer semantics.
- **Handover / Day Close:** no safe close/handover command, physical count, session variance or next custodian acceptance. Saved daily reconciliation supports draft/submitted/approved and variance by payment channel, but does not close a drawer session. The approved state has a database trigger guard in the migration source.

## K–R. Module results

| Area | Result and evidence limit |
| --- | --- |
| K Booking | Booking wizard/quick booking, management and visibility paths inspected; selected booking tests passed. No customer, guest or walk-in booking was created. The broad suite has two stale date fixture failures in `crm-booking-time-normalization.test.ts` because it fixes 2026-10-01 while the current local date is 2026-10-02. |
| L Payment | Order payment uses atomic RPC with idempotency, multi-tender payload, account/branch/session checks and derived balance. Legacy payment uses a separate compatibility command. Four requested monetary examples were not posted. |
| M Expense | `recordExpenseAction` validates required category/account/amount/description and calls `post_expense_atomic`; receipt path is server generated. No receipt or expense was posted. |
| N Home Service | Direct Confirm & Dispatch and driver recommendation path inspected; unit tests passed. Trip status, live location, fee versus business cost, and payment independence were not runtime verified. |
| O Schedule | Daily branch schedule and staff availability queries inspected; relevant tests passed. No scheduled CSR to session custodian integration. |
| P Attendance | Branch scoped CRM view and navigation tests inspected/passed. A larger attendance test slice has baseline failures listed in W. No actual clock-in/correction was performed. |
| Q Customer | Customer list/search and quick booking prefill paths inspected; customer tests passed. Duplicate behavior and live history were not verified. |
| R Owner branch | Owner Front Desk selected branch is server resolved. The reconciliation action defect was reproduced/fixed/tested. Multi-page branch switching and Owner Cash Flow account matching remain unverified in a browser. |

## S–U. Findings and deferred work

**P0:** none proven by the available evidence. This is not a claim that no P0 exists in a live environment.

**P1 fixed — Owner reconciliation branch mismatch:** the page uses selected Owner Front Desk branch, while the action required `staff.branch_id`. An Owner without an assigned staff branch could reach the page but save returned `Unauthorized`; the action also accepted a caller supplied branch for lookup. The action now resolves the same server branch and rejects mismatches.

**P1 open — physical cash day close and handover:** only session opening is implemented. There is no authenticated, atomic close/handover command or persisted physical count and variance; a complete cashier day cannot be verified or finished safely. **MIGRATION REQUIRED.** A separate approved design should establish session count/variance and custody records (or justified columns), an atomic close/handover RPC, branch/role/idempotency/one-open-session enforcement, and tests for post-close cash rejection and duplicate close.

**P1 open — drawer expected versus reconciliation expected:** active drawer calculation includes the float, while branch daily reconciliation expected cash does not. A ₱500 opening float and zero movements gives active drawer expected ₱500 but reconciliation expected ₱0, so entering the correct physical ₱500 count shows a false ₱500 overage. **MIGRATION / DOMAIN DECISION REQUIRED** to define whether branch Day Close aggregates drawer sessions or reconciles each drawer, and to persist the session/count relationship without rewriting historical transactions. No migration was created.

**P2/P3 deferred:** schedule-to-CSR suggestion, explicit custodian history, generic adjustment policy, responsive refinements, and any broad Owner workspace changes require their own evidence/decision. No speculative implementation was made.

## V. Fix implemented

| Root cause | Changed files | Safety and regression coverage |
| --- | --- | --- |
| Reconciliation action read `staff.branch_id`, diverging from the page's server selected Owner Front Desk branch. | `src/app/(dashboard)/crm/reconciliation/actions.ts`; `tests/lib/cash-flow/reconciliation-actions.test.ts` | Uses existing `getFrontDeskContext()` branch authority, keeps active staff/role checks, rejects mismatch before reading/writing. New regression tests reproduced Owner `Unauthorized` and wrong-branch behavior before the change, then passed after it. No schema, RPC, RLS or financial transaction changes. |

## W. Exact checks and results

| Command | Result |
| --- | --- |
| `git fetch origin` | PASS; `origin/main` resolved to SHA above |
| `pnpm install --offline --frozen-lockfile` | PASS; local store, no lockfile change |
| `pnpm exec vitest run tests/lib/cash-flow/reconciliation-actions.test.ts` before fix | Expected reproduction: 2 failed / 2 passed |
| `pnpm exec vitest run tests/lib/cash-flow/reconciliation-actions.test.ts tests/lib/cash-flow/reconciliation-status-guard.test.ts tests/lib/cash-flow/reconciliation-expected.test.ts` | PASS: 3 files, 9 tests; subsequently the history regression was added and included in the final 342-test slice below |
| `pnpm exec vitest run tests/lib/cash-flow tests/lib/bookings/booking-wizard-confirm.test.ts tests/lib/bookings/bookings-workspace-filters.test.ts tests/lib/bookings/booking-payment-command.test.ts tests/lib/home-service tests/lib/schedule/daily-schedule-query.test.ts tests/lib/attendance/crm-navigation.test.ts tests/lib/customers` | PASS after final edit: 31 files, 342 tests |
| `pnpm exec vitest run tests/lib/cash-flow tests/lib/bookings tests/lib/schedule tests/lib/attendance tests/lib/customers tests/lib/home-service tests/app/crm tests/components/booking tests/components/bookings` | FAIL at baseline: 118 files/964 tests pass, 7 files/7 tests fail plus 1 suite collection failure. Failures include stale 2026-10-01 booking fixture, exact-text/line-ending dependent attendance migration/UI assertions, and one attendance reader timeout. No source change preceded this run. |
| `pnpm type-check` | PASS after final source/test edit |
| `pnpm exec eslint 'src/app/(dashboard)/crm/reconciliation/actions.ts' 'tests/lib/cash-flow/reconciliation-actions.test.ts'` | PASS after final source/test edit |
| `pnpm lint` | FAIL on fetched baseline: 88 errors, 39 warnings across unrelated source/tests; affected files pass targeted lint |
| `pnpm build` | BLOCKED after successful compilation and TypeScript: prerender `/owner/marketing` raises `supabaseUrl is required` because isolated checkout has no `.env.local` |
| `git diff --check` | PASS after final source/test edit; report is untracked and separately reviewed |

## X–AA. Browser, database, production evidence and limitations

- **LOCAL BROWSER VERIFIED:** none. The isolated worktree has only `.env.example`. The original checkout's `.env.local` and `.env.database.local` were left untouched and not copied because their database target is not classified. Authenticated CRM/Owner navigation and the three requested viewports were **NOT VERIFIED**.
- **PHYSICAL DEVICE VERIFIED:** none.
- **DATABASE VERIFIED:** none. Target: **UNKNOWN**; no connection or query was made. Migration source was inspected only.
- **PRODUCTION VERIFIED:** none. No hosted route or production data was accessed.
- **NOT VERIFIED:** actual full-day sequence, customer records, amounts and cash count, real booking/payment/expense mutations, driver trip progression, branch switching, refresh/double-click/network failure behavior, and responsive usability. Test results do not upgrade these to runtime evidence.

## AB–AF. Migrations, impact, rollback, blockers, final verdict

- **Migrations created:** no. **Migrations applied:** no. **Production DB operations:** none. No data, RLS, Auth, Storage or service-role configuration was changed.
- **Production impact:** none from this uncommitted, unmerged worktree. The existing production state was not verified.
- **Rollback consideration:** the bounded action change can be reverted as one source/test diff. It writes no new data model. A future drawer close design needs its own forward-only rollback/repair plan; do not alter legitimate transactions to force balance.
- **Remaining operational blockers:** no drawer session close/handover/count authority; Day Close cash expectation disagrees with the active drawer when float is nonzero; runtime authentication/database/browser verification and full quality gates are outstanding.
- **Final operational readiness verdict: CORRECTION REQUIRED.** The narrow Owner action correction is ready for independent review, but this evidence cannot certify a real CSR's complete working day. Next permitted action is review of this branch/report and a separately authorized forward-only cash close/domain correction. Merge and deployment remain outside this pass.
