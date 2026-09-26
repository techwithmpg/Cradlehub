# C5-CF1 Cash Flow Foundation

## Authorization and frozen scope — 2026-09-26

Target `E:\cradlehub`; branch `stage/c5-cash-flow-foundation`; clean starting HEAD and accepted main `f8977cce5c1286402eed2e6805ba0428c38dc660`. Fresh `git fetch origin main` confirms zero ahead/behind. Latest owner instruction supersedes the earlier full-ledger request. No previous Cash Flow branch/source is used. CF1 creates a financial read workspace only; no migrations, manual ledger, split tender, pricing changes, payroll changes, Desktop/Sheet changes, push, merge or deploy.

## Inspection report and decisions

| Area | Repository evidence and ownership | CF1 decision |
| --- | --- | --- |
| Payment state | `bookings.payment_method/payment_status/amount_paid/payment_reference`; creation in `lib/bookings/inhouse-booking-engine.ts` and public booking actions; validation in `lib/validations/booking.ts` | Read canonical current values; no new financial table or payment writer |
| Payment updates | CRM confirmation and manager updates call `recordBookingPaymentChange` → security-invoker `record_booking_payment_change` RPC. It locks the booking and inserts `booking_payment_logs` atomically with the update. Confirmation can set confirmed and clear the hold. Owner update separately inserts its log and updates booking. | Preserve all writers. Do not claim every existing path is transactional |
| Audit/events | `booking_payment_logs` retains before/after values, reference, reason, actor and created timestamp. Existing payment gates require reasons for significant changes. Writers revalidate operational paths/tags, resolve payment notifications and may notify assigned staff/driver. `BOOKINGS_CHANGED_EVENT` and branch-filtered booking Realtime exist. | Never sum audit snapshots as receipts. Reuse event invalidation; no polling, notification sending or payment mutation introduced |
| Daily totals | `getDailyPaymentSummary` uses current booking state by booking date; excludes cancelled/no_show/expired; collected sums amount_paid; outstanding only unpaid/pending balances against metadata.price_paid; method totals count positive payments | Extract its pure calculation unchanged for reuse and parity tests. Label booking date/time honestly; this is not an immutable receipt-time ledger |
| Day Close | `daily_cash_reconciliations`, unique branch/date, expected and actual cash/GCash/Maya/card/other, notes, draft/submitted/approved; `reconciliation/actions.ts`, `ReconciliationForm`, legacy `/crm/reconciliation` route | Embed the same form/actions. Keep the compatibility route and approval consumers. Approved records show saved expected values |
| Authorization | `getFrontDeskContext` verifies getUser, active staff/CRM role and canonical branch; owner/super-admin follows its existing branch context. Supabase cookie client plus RLS remains the boundary | No branch parameter accepted by Cash Flow reads; authenticate each range refresh. Owner does not gain a new cross-branch selector in CF1 |
| Existing reconciliation gaps | Save/read actions accept a branch argument and rely on RLS; approval action accepts the CRM-access role set, not a separate manager-only guard; save has no server-side approved-record lock. Form currently locks approved records visually. | Record as pre-existing limitations; CF1 does not change role policy or claim stronger concurrency/approval protection |
| RLS | Payment logs initially have authenticated read/insert policies; reconciliation migrations define owner access and branch-scoped desk roles. Actual deployed policy state is not verified. | No direct audit-table exposure or policy changes. This is repository evidence, not production verification |
| Home Service | Booking delivery_type/type, metadata price_paid, home_service_travel_fee and pricing_breakdown snapshot service/travel data | Show Home Service source and saved price/travel fields only. No inferred fee, travel re-entry or workflow change |
| Payroll | Pay profiles, periods, items, adjustments and fixed-monthly payment progress; calculations distinguish commission, reimbursements, advances, allowances and deductions | Future consumer only; no payroll expense or payout projection in CF1 |
| UI | `CrmOperationalPageShell`, attendance `WorkspaceSection/EmptyState/WorkspaceNotice`, Base UI tabs/dialog, payment labels/badges, CRM design tokens | Reuse existing components; compact mobile tabs, local filtering and details |
| Capability | Existing data supports collected/outstanding/mix, booking financial rows, pending attention, reconciliation and historical booking-date summaries. No reusable general expense/financial ledger exists in the inspected schema/types | Expenses and Net Flow remain unavailable; New Entry disabled. No fabricated profit or cash movements |

## Frozen implementation plan

1. Extract the existing pure daily summary calculation, preserving current consumers and semantics.
2. Add authenticated, paginated and date-bounded booking/reconciliation reads. Load a default 14-day window once; explicit range changes may fetch, tab clicks never fetch. Keep today's summary independently available when browsing older windows. Surface read errors rather than zero totals.
3. Add one `/crm/cash-flow` server route and a client workspace with Today, Ledger, Day Close and History. Reuse loaded data and keep Day Close drafts mounted between tabs. Ledger filters and transaction dialog are local.
4. Reuse `ReconciliationForm` and actions; add an optional completion callback for localized workspace refresh, preserving old callers. Do not add correction/refund/approval controls.
5. Add one navigation entry and hover-prefetch registry entry. Reuse booking-change invalidation and focus refresh without polling or route navigation.
6. Test pure summary parity, source/closed-state handling, filters/history, branch isolation, error handling, pagination, internal tabs and Day Close reuse. Run targeted existing payment tests, lint, type-check and inspect the diff. Use TEST fixtures for rendered validation; unknown remote database target is not accessed.

## Evidence

### Target and local state

- Target: **CradleHub Web**, `E:\cradlehub`.
- Stage: **C5-CF1 Cash Flow Foundation**.
- Branch: `stage/c5-cash-flow-foundation`.
- Base SHA and current local HEAD: `f8977cce5c1286402eed2e6805ba0428c38dc660`.
- Implementation is uncommitted in this branch. No commit, push, merge, deployment or migration was performed. A final `git fetch origin main` and `git rev-list --left-right --count HEAD...origin/main` returned **0 / 0**; accepted main did not move during this task.
- Starting system: existing booking payment fields/writers/audit, daily summary, reconciliation form/actions/table and payroll; no Cash Flow route or general financial ledger in the accepted baseline. The inspection above preceded implementation.

### Changed files and purpose

All paths below are relative to `E:\cradlehub` (22 files total).

| File | Purpose |
| --- | --- |
| `docs/audits/C5-CF1-CASH-FLOW-FOUNDATION.md` | Inspection, frozen plan, decisions and final evidence/handoff |
| `src/app/(dashboard)/crm/cash-flow/page.tsx` | Single authenticated server route loading the workspace |
| `src/app/(dashboard)/crm/cash-flow/actions.ts` | Authenticated range/refresh read boundary |
| `src/app/(dashboard)/crm/cash-flow/error.tsx` | Failed initial reads show an error/retry, never fabricated zero balances |
| `src/components/features/cash-flow/cash-flow-workspace.tsx` | Four client-state tabs, shared data, explicit ranges, event/focus refresh, stale-response protection |
| `src/components/features/cash-flow/cash-flow-today.tsx` | Collected/outstanding, unavailable expenses/net flow, mix, canonical attention and booking balances |
| `src/components/features/cash-flow/cash-flow-ledger.tsx` | Read-only local filters, 50-row display pagination and record selection |
| `src/components/features/cash-flow/cash-flow-day-close.tsx` | Reuses existing form and displays saved reconciliation counts/status/notes |
| `src/components/features/cash-flow/cash-flow-history.tsx` | Booking-date daily rows with saved Day Close status/variance |
| `src/components/features/cash-flow/cash-flow-transaction-detail.tsx` | Read-only record details and existing Open Booking link |
| `src/components/features/cash-flow/cash-flow-ui.tsx` | Existing workspace section/token styling, status, money formatting and cards |
| `src/lib/cash-flow/read-model.ts` | Sanitized booking snapshots, date validation, filters, Home Service attribution and approved reconciliation snapshot |
| `src/lib/queries/cash-flow.ts` | Cookie/RLS client, canonical context branch, 500-row pages, bounded date reads and independent Today data |
| `src/lib/bookings/payment-summary.ts` | Shared pure extraction of accepted daily-summary calculations |
| `src/lib/queries/bookings.ts` | Delegates existing daily-summary calculation to the shared helper; existing fallback queries retained |
| `src/app/(dashboard)/crm/reconciliation/reconciliation-form.tsx` | Optional success callback only; existing callers/actions remain compatible |
| `src/components/features/dashboard/nav-config.ts` | One CRM Cash Flow navigation item |
| `src/components/features/workspace/workspace-prefetch-config.ts` | One CRM hover-prefetch entry |
| `tests/lib/cash-flow/fixtures.ts` | Synthetic TEST booking/reconciliation data |
| `tests/lib/cash-flow/read-model.test.ts` | Totals, all methods, partial/refunded/closed/completed semantics, deduplication, Home Service, historical dates and filters |
| `tests/lib/cash-flow/query.test.ts` | Canonical branch boundary, unauthorized context rejection, pagination, table sources, read errors and server route |
| `tests/components/cash-flow/workspace.test.tsx` | Internal tabs, details, retained draft/filters, existing save action, approved lock, history, range validation and refresh races/errors |

### Workspace and displayed data contract

**Today, Ledger, Day Close and History are internal tabs at `/crm/cash-flow`.** There are no per-tab routes, router calls or tab-triggered reads. Panels remain mounted; filters and unfinished Day Close inputs survive tab changes. History drilldown stays in the same workspace. Open Booking intentionally opens the existing booking route.

| Display | Exact source/meaning |
| --- | --- |
| Branch / business date | Existing `getFrontDeskContext` branch/name and `getBranchBusinessDate` |
| Collected | Sum of current `bookings.amount_paid` for that booking date, excluding cancelled/no_show/expired; completed bookings remain included |
| Outstanding | For unpaid/pending bookings only, sum of `max(0, metadata.price_paid - amount_paid)` under the same exclusion rules |
| Payment mix | Positive current `amount_paid` grouped by existing payment_method: cash, gcash, maya, card, pay_on_site, other |
| Recent payments / Ledger | One current canonical booking snapshot per ID, not payment-log revisions; appointment date/time is explicitly labeled as booking time |
| Home Service | Existing delivery_type/type; service line price from saved pricing_breakdown; full quote travel fee appears only when travel_fee_applied_to_booking is true, zero when false, otherwise unavailable |
| Attention | Existing unpaid/pending count, absent/draft/submitted reconciliation and saved nonzero variance |
| Day status | Existing reconciliation status, or Open when no record exists |
| Day Close | Existing `daily_cash_reconciliations` and `ReconciliationForm`/upsert action; actual counts, notes and draft/submitted lifecycle unchanged; approved form uses saved expected values and existing visual lock |
| History | Current booking balances grouped by historical booking date, plus saved reconciliation counts/status/variance; balances can change when historical bookings are edited |
| Saved variance | Sum of saved actual cash/gcash/maya/card/other minus the corresponding saved expected values |
| Expenses / Net Flow | Unavailable markers; no calculations or fake zero values |

The date window defaults to 14 days, permits at most 31 inclusive days per request, and explicitly loads another range. Reads paginate in 500-row batches. Ledger renders 50 filtered records at a time. No new cache or polling was introduced. Existing booking-change events, window focus, the Refresh button and successful Day Close save refresh the data; tab switching does not. There is no new cross-client Realtime subscription.

### Executed checks

Environment: **LOCAL application code / TEST fixtures and mocked Supabase adapters**. No database target was contacted. Bundled Node **v24.19.0** was used because the repository requires Node >=24 and <25.

The following PowerShell variable is used only to shorten the exact commands below:

```powershell
$cfNode = 'C:\Users\eleur\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
```

All repository commands ran from `E:\cradlehub`.

1. Before edits, baseline regression command — **12 files, 76 tests passed**:

```powershell
& $cfNode node_modules/vitest/vitest.mjs run tests/lib/bookings/payment-gate.test.ts tests/lib/bookings/crm-booking-status.test.ts tests/lib/bookings/bookings-client-events.test.ts tests/app/crm/booking-actions.test.ts tests/lib/payroll
```

2. Final integrated regression command — **17 files, 108 tests passed**, 4.63 seconds. This includes **26 new Cash Flow tests** and existing payment, booking-status/event, payroll and navigation coverage:

```powershell
& $cfNode node_modules/vitest/vitest.mjs run tests/lib/cash-flow tests/components/cash-flow tests/lib/bookings/payment-gate.test.ts tests/lib/bookings/crm-booking-status.test.ts tests/lib/bookings/bookings-client-events.test.ts tests/app/crm/booking-actions.test.ts tests/lib/payroll tests/components/dashboard/nav-config.contract.test.ts
```

3. Route types — **passed**. First type-check found stale generated references to removed Desktop routes and one new source-union inference error. The inference was corrected and route types regenerated; no Desktop source was changed:

```powershell
& $cfNode node_modules/next/dist/bin/next typegen
& $cfNode node_modules/typescript/bin/tsc --noEmit --incremental false
```

4. Scoped lint — **passed, no errors or warnings** after correcting the refresh cleanup ref warning:

```powershell
$cfFiles = @(@(git diff --name-only -- 'src/*') + @(git ls-files --others --exclude-standard -- 'src/*' 'tests/*'))
& $cfNode node_modules/eslint/bin/eslint.js @cfFiles
```

5. New source/test formatting — **passed**. Existing files retain their local style to avoid unrelated formatting churn:

```powershell
$cfNewFiles = @(git ls-files --others --exclude-standard -- 'src/*' 'tests/*')
& $cfNode node_modules/prettier/bin/prettier.cjs --check @cfNewFiles
git diff --check
```

6. Rendered QA — **passed** in headless Chromium at **1440×1000 and 390×1000**. Real workspace components and repository CSS rendered via a disposable Vite harness; Next Link/server actions replaced with TEST stubs, synthetic fixtures, local font fallback. Browser-plugin skill was unavailable, so regular Playwright fallback was used. No new dependencies were installed. Harness and screenshots remain outside the repository:

```powershell
& $cfNode 'C:\Users\eleur\.codex\visualizations\2026\09\25\01a0d778-0164-7ac3-9b1b-ebddc5365c26\cf1-qa.mjs'
```

- Verified all four tab controls and selected-panel behavior, no tab-triggered fetches, filters, detail dialog, internal history drilldown, retained actual counts, disabled New Entry.
- Each tested view had exactly one visible panel and no page-level horizontal overflow. Existing Day Close actual-count grid retains its internal horizontal scroll on mobile.
- Synthetic tab interaction measurements (automation overhead included): desktop **34/44/88/64 ms**, mobile **37/52/65/62 ms**, ordered Today/Ledger/Day Close/History. This is fixture evidence, not production latency or load testing.
- **0 browser exceptions and 0 external network requests** in the final run. Initial harness failures were a missing relative server-action mock and an exact label selector; both were fixed in the harness.
- Screenshots: `cf1-browser/1440-{today,ledger,day-close,history,details}.png` and matching `390-*`; metrics `cf1-browser/results.json`, alongside the harness. Inspected desktop Today/History/Ledger and mobile Day Close/Ledger images.

7. Final branch/diff review — accepted main **0 ahead / 0 behind**; `git diff --check` passed. Changed paths are limited to the 22 listed files. No migration, environment/config/package/lockfile, Desktop, Sheet, pricing or payroll implementation changes. The four pre-existing files have only the shared-calculation extraction, optional save callback and two navigation additions.

### Limitations, production impact and rollback

- This is a booking financial read model, not an immutable cash-receipt/general ledger. Refunded rows retain the existing summary semantics: if amount_paid remains positive, it remains included. CF1 does not infer cash refund events or sum audit log revisions.
- General expenses, manual income/adjustments, tips, advances, transfers, vouchers, discounts, split tender, profit/net income and Sheet projection remain later unauthorized stages.
- Actual deployed RLS, migrations, live data, multi-user save/approval concurrency and production payment/Day Close behavior were **not verified**. The pre-existing reconciliation authorization/approved-write gaps above remain unchanged. No separate reconciliation test suite existed in the searched baseline; CF1 tests the real form with its existing action mocked.
- Browser evidence covers the real workspace components using TEST fixtures, not the authenticated Next.js application end to end. Type generation and full repository TypeScript checking passed; a full Next production build was not run.
- No cache/performance claims are made for real data volumes. Paging prevents a silent API row-cap truncation, but multiple offset pages are not a transactionally consistent database snapshot under concurrent edits.
- **NO PRODUCTION CHANGES PERFORMED.** No production-oriented result is inferred from repository inspection.
- Rollback: the entire implementation is uncommitted and isolated on `stage/c5-cash-flow-foundation`. Preserve/export the patch if desired, then discard only the 22 listed CF1 changes or abandon this local branch/checkout; accepted `main` and remote state are unaffected. Do not discard unrelated work.
- Next permitted action: owner/reviewer inspection and local corrections within CF1. Push, merge, deployment, production verification/mutations and later CF stages require separate authorization.
