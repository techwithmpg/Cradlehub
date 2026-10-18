# CradleHub Web — PERF-8 CRM Cash Flow Retention & Reconciliation

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Cash Flow only  
**Program:** Web CONTROLLED STABILIZATION
**Accepted Base / main:** `0c8455dfee87441970284175c0dd7b4c19fbb327`
**Implementation Branch:** `stage/web-perf-8-crm-cash-flow`
**Starting Verification HEAD:** `ac25bfed546d59bd6f0127961380cfc92e2417f4`
**Quality-Gated Implementation SHA:** `65205ac09aa2996b98e816c2c7295561220318ed`
**Current Documentation Delivery / PR HEAD:** Delivered via subsequent documentation-only commit on PR #38
**Draft PR:** #38
**Status:** READY FOR INDEPENDENT REVIEW — **DO NOT MERGE**

---

## A. Authorized scope

Owner authorization was received after the PERF-8 Cash Flow scope freeze.

PERF-8 targets only:

`/crm/cash-flow`

Owner Cash Flow remains outside the retained-performance conversion.

No database, migration, RLS, RPC, payment-writer, cash-session formula, reconciliation rule, or accounting rule change is authorized.

---

## B. Current-system truth preserved

Before PERF-8, CRM Cash Flow:

- was not a retained CRM module;
- performed a cold aggregate financial read on return navigation;
- used `router.refresh()` for manual Refresh and after successful financial operations;
- loaded one aggregate `CashFlowWorkspaceData` snapshot for Today, Ledger, Day Close, History and financial-entry dialogs;
- already kept Ledger filtering/pagination client-local;
- used server-authoritative and atomic/idempotent financial write contracts;
- used the same shared `CashFlowWorkspace` component in Owner Cash Flow.

PERF-8 preserves the aggregate read and all financial write ownership.

---

## C. Implementation

### 1. Retained CRM Cash Flow module

Added:

- module: `crm-cash-flow`
- route: `/crm/cash-flow`
- exact route match
- stable restoration state: `date`, `tab`
- stale classification: 10 seconds
- cost: high

Transactional query parameters are intentionally excluded from restoration:

- `entry`
- `handover`

This prevents a prior payment/expense modal or handover workflow from being reopened merely because Cash Flow was retained.

### 2. Canonical request/data contract

Added:

`src/components/features/cash-flow/crm-cash-flow-workspace-data.ts`

The client request contains only presentation/read selectors:

- business date
- search
- category
- method
- status
- page

Branch, user, role, balances, totals, sessions, payment state and reconciliation state are not client authority.

Business date is validated as a real ISO calendar date. Invalid/impossible dates fall back to the server branch business date.

### 3. Shared server-authoritative loader

Added:

`src/lib/queries/crm-cash-flow-workspace.ts`

The loader derives:

- authenticated Front Desk context;
- branch ID;
- branch name;
- user ID;
- role;
- server branch business date.

It then calls the existing aggregate:

`getCashFlowData(...)`

No financial query decomposition is introduced.

### 4. Authoritative refresh action

Added:

`src/lib/actions/crm-cash-flow-data-actions.ts`

The action accepts only the read request and delegates branch/user/role resolution to the server loader.

A browser-supplied branch field is ignored by the loader contract.

### 5. Generation-aware reconciliation

Added:

`src/components/features/cash-flow/use-live-crm-cash-flow-data.ts`

Uses:

`useGenerationAwareWorkspaceSWR("crm-cash-flow", requestKey, ...)`

Expected lifecycle:

- initial SSR fallback: zero duplicate canonical fetch;
- hidden dirty Cash Flow: zero canonical reads;
- hidden focus/reconnect: zero reads;
- dirty reveal: one authoritative reconciliation;
- clean-but-stale reveal: one reconciliation per activation;
- stale response: cannot overwrite a newer financial generation;
- failed refresh: last validated financial snapshot remains visible.

### 6. CRM-specific retained wrapper

Added:

`src/components/features/cash-flow/crm-cash-flow-retained-workspace.tsx`

The wrapper:

- consumes generation-aware canonical data;
- exposes retry feedback;
- maps confirmed mutation success to exactly one `crm-cash-flow` invalidation;
- maps manual Refresh to canonical `revalidate()`;
- supplies CRM-only route-state synchronization.

It contains no financial calculation logic.

### 7. Shared workspace refresh boundary

`CashFlowWorkspace` now accepts optional:

- `onRefresh`
- `onConfirmedMutation`
- `externallyRefreshing`
- `syncCrmRouteState`

CRM supplies these retained callbacks.

Owner/non-retained consumers do not supply them and therefore preserve the existing `router.refresh()` fallback.

### 8. CRM route-state preservation

When `syncCrmRouteState` is enabled:

- `tab` is synchronized by native history;
- retained deep links can activate Today/Ledger/Day Close/History without remount;
- `entry=payment|expense|cash-operations` can open the requested financial-entry mode on an already-retained Cash Flow module;
- closing the deep-linked entry removes only the `entry` parameter;
- transactional `entry` state is not stored in retention restoration metadata.

Owner behavior remains unchanged because this mode is opt-in.

### 9. Handover deep-link preservation

The page continues to resolve the incoming CRM staff identity server-side for a requested handover.

A successful review handover preserves the existing redirect to:

`/crm/today?handover=...`

The retained registry replaces the stored server node when a fresh route response arrives, allowing new handover props to reach an already-retained Cash Flow module.

### 10. No optimistic financial truth

PERF-8 intentionally does not locally patch:

- expected drawer cash;
- counted cash;
- variance;
- total inflow/outflow;
- net flow;
- payment state;
- amount paid;
- remaining balance;
- ledger records;
- reconciliation state;
- day-close state.

After successful mutation, the existing success UI may complete/close, but displayed financial truth changes only when a new canonical server payload is received.

### 11. Confirmed mutation reconciliation

Successful operations route through the shared `onConfirmedMutation` callback:

- open drawer;
- close drawer;
- handover;
- customer/order payment;
- legacy booking payment;
- expense;
- tip;
- misc income;
- cash adjustment;
- transfer.

CRM maps that callback to:

`invalidate("crm-cash-flow")`

Failed mutations never call the success callback and therefore do not invalidate the retained Cash Flow module.

### 12. Duplicate self-route revalidation removal

The existing action layer contained nine direct:

`revalidatePath("/crm/cash-flow")`

or equivalent single-quoted calls.

Those direct CRM self-route revalidations were removed because retained generation reconciliation now owns the CRM Cash Flow self-refresh.

Preserved downstream effects include:

- booking operational surface revalidation after payments;
- `/crm/reconciliation` after drawer close;
- `/owner/cash-flow` after drawer close/handover.

No broad revalidation cleanup is performed.

### 13. Required-data fail-closed behavior

Initial CRM Cash Flow still renders the existing explicit unavailable state for `CashFlowRequiredDataError`.

Unexpected errors continue to reach the route error boundary.

A refresh failure preserves the last previously validated snapshot instead of inventing a zero financial state.

---

## D. Financial authorization boundaries preserved

1. Authentication remains server-side.
2. Active CRM branch remains server-derived.
3. Payment eligibility remains server-authoritative.
4. Closed booking protection remains unchanged.
5. Legacy and order payment sources remain separate.
6. Open cash-session requirements remain unchanged.
7. Expense account/branch validation remains unchanged.
8. Receipt paths remain server-generated.
9. Atomic RPC contracts remain unchanged.
10. Cash close/handover locking, variance and idempotency remain database-owned.
11. No client balance/total becomes authoritative.
12. No service-role secret is exposed to the browser.
13. No RLS changes or bypasses are introduced.
14. No local/offline financial authority is introduced.

---

## E. Changed files before evidence report

Implementation:

1. `src/app/(dashboard)/crm/cash-flow/page.tsx`
2. `src/components/features/cash-flow/cash-flow-workspace.tsx`
3. `src/components/features/cash-flow/crm-cash-flow-retained-workspace.tsx`
4. `src/components/features/cash-flow/crm-cash-flow-workspace-data.ts`
5. `src/components/features/cash-flow/use-live-crm-cash-flow-data.ts`
6. `src/components/features/dashboard/workspace-retention-policy.ts`
7. `src/lib/actions/crm-cash-flow-data-actions.ts`
8. `src/lib/cash-flow/cash-flow-actions.ts`
9. `src/lib/queries/crm-cash-flow-workspace.ts`

Tests:

10. `tests/components/cash-flow/crm-cash-flow-client-navigation.test.tsx`
11. `tests/components/cash-flow/crm-cash-flow-confirmed-mutation-reconciliation.test.tsx`
12. `tests/components/cash-flow/crm-cash-flow-failed-mutation.test.tsx`
13. `tests/components/cash-flow/crm-cash-flow-generation-swr.test.tsx`
14. `tests/components/cash-flow/crm-cash-flow-retained-wrapper.test.tsx`
15. `tests/components/cash-flow/crm-cash-flow-stale-reactivation.test.tsx`
16. `tests/lib/cash-flow/cash-flow-page-tabs.test.tsx`
17. `tests/lib/cash-flow/cash-flow-ui.test.tsx`
18. `tests/lib/cash-flow/cash-session-close-handover.test.ts`
19. `tests/lib/cash-flow/crm-cash-flow-retained-mutation-contract.test.ts`
20. `tests/lib/cash-flow/crm-cash-flow-workspace-authority.test.ts`
21. `tests/lib/navigation/workspace-retention-policy-cash-flow.test.ts`

Evidence:

22. `docs/reports/WEB-PERF-8-CRM-CASH-FLOW-2026-10-18.md`

No Owner page, Manager page, Desktop, SQL, migration, RLS, generated DB type, RPC definition, or production-operation file is changed.

---

## F. New regression contracts

New PERF-8 tests encode:

- zero duplicate initial canonical request;
- zero hidden Cash Flow reads;
- zero hidden focus/reconnect reads;
- dirty reveal reconciliation;
- stale-response rejection;
- stale clean reveal once per activation;
- retention policy for `date` + `tab`;
- exclusion of transactional `entry` + `handover` from restoration;
- server branch authority;
- real calendar-date validation;
- confirmed mutation callback behavior;
- manual canonical refresh;
- no optimistic expected-cash mutation;
- Owner/non-retained router-refresh fallback;
- failed open/close/handover operations do not signal success;
- CRM self-route revalidation is absent;
- booking/reconciliation/Owner downstream revalidations remain;
- atomic RPC names remain present;
- retained tab/entry deep-link intent;
- existing route fail-closed behavior;
- server-side handover identity resolution.

Existing Cash Flow safety suites remain required.

---

## G. Quality gate verification evidence

All local quality gates have been executed by this verification pass.

### 1. Focused PERF-8 Test Gate

```bash
pnpm exec vitest run \
  tests/components/cash-flow/crm-cash-flow-client-navigation.test.tsx \
  tests/components/cash-flow/crm-cash-flow-confirmed-mutation-reconciliation.test.tsx \
  tests/components/cash-flow/crm-cash-flow-failed-mutation.test.tsx \
  tests/components/cash-flow/crm-cash-flow-generation-swr.test.tsx \
  tests/components/cash-flow/crm-cash-flow-retained-wrapper.test.tsx \
  tests/components/cash-flow/crm-cash-flow-stale-reactivation.test.tsx \
  tests/lib/navigation/workspace-retention-policy-cash-flow.test.ts \
  tests/lib/cash-flow/crm-cash-flow-workspace-authority.test.ts \
  tests/lib/cash-flow/crm-cash-flow-retained-mutation-contract.test.ts \
  tests/lib/cash-flow/cash-flow-page-tabs.test.tsx \
  tests/lib/cash-flow/cash-flow-ui.test.tsx \
  tests/lib/cash-flow/cash-flow-mixed-read-model.test.ts \
  tests/lib/cash-flow/c02-payment-safety.test.ts \
  tests/lib/cash-flow/cash-payment-session-guard.test.ts \
  tests/lib/cash-flow/cash-session-close-handover.test.ts \
  tests/lib/cash-flow/cash-session-contract.test.ts \
  tests/lib/cash-flow/cf7-receipt-correction.test.ts \
  tests/lib/cash-flow/cf8-database-reconciliation.test.ts \
  tests/lib/cash-flow/cf8c-cash-operations-integrity.test.ts \
  tests/lib/cash-flow/cf8c-review-corrections.test.ts \
  tests/lib/cash-flow/financial-entry-context.test.ts \
  tests/lib/cash-flow/financial-foundation-contract.test.ts \
  tests/lib/cash-flow/legacy-payment-action.test.ts \
  tests/lib/cash-flow/order-payable-contract.test.ts \
  tests/lib/cash-flow/order-payment-eligibility.test.ts \
  tests/lib/cash-flow/owner-cash-flow-page.test.tsx \
  tests/lib/cash-flow/payment-reconciliation-ui.test.tsx \
  tests/lib/cash-flow/payment-writer-contract.test.ts \
  tests/lib/cash-flow/reconciliation-actions.test.ts \
  tests/lib/cash-flow/reconciliation-expected.test.ts \
  tests/lib/cash-flow/reconciliation-status-guard.test.ts
```

- **Files Passed:** 31 passed (31)
- **Files Failed:** 0
- **Tests Passed:** 315 passed (315)
- **Tests Failed:** 0
- **Tests Skipped:** 0
- **Duration:** 9.97s

### 2. Demonstrated Corrections Applied During Pass

1. **`cash-flow-workspace.tsx` Retained Route State & Dismissal:**
   - **Symptom:** In `crm-cash-flow-client-navigation.test.tsx`, closing the deep-linked `entry=expense` modal failed because `routeEntryMode` remained non-null during re-render, and clicking the "Today" tab failed to switch views.
   - **Root Cause:** Next.js `window.history.replaceState` does not update `searchParams` hook state during synthetic tests or client renders. Furthermore, `activeTab` was derived statically from `searchParams` without synchronizing local state on tab selection.
   - **Fix:** Tracked `dismissedRouteEntry` in local state upon modal close (`handleRecordPaymentOpenChange(false)`), allowing immediate closure, and synchronized `activeTab` state so tab clicks directly transition panels and update the URL.
   - **Regression Test:** `tests/components/cash-flow/crm-cash-flow-client-navigation.test.tsx`.

2. **`crm-cash-flow-retained-workspace.tsx` Hook Dependencies & Return Types:**
   - **Symptom:** `pnpm type-check` error TS2322 (revalidate return type mismatch) and ESLint warning `react-hooks/exhaustive-deps`.
   - **Root Cause:** `live.revalidate()` returned `Promise<"skipped" | "stale" | "validated">` which was incompatible with `() => void | Promise<void>`, and accessing `live.revalidate` in callback without destructuring triggered lint warnings.
   - **Fix:** Widened `CashFlowWorkspaceProps.onRefresh` to `() => void | Promise<unknown>`, made `handleRefresh` an `async` function, and destructured `const { revalidate } = live;`.

3. **`crm-cash-flow-failed-mutation.test.tsx` Label Pattern Matching:**
   - **Symptom:** Strict string match failed for `screen.getByLabelText("Physical counted cash")` and `screen.getByLabelText("Physical count")`.
   - **Root Cause:** The actual rendered label contains an inner required asterisk (`<span className="text-rose-500">*</span>`).
   - **Fix:** Updated the query to use regex pattern matching (`/Physical counted cash/i` and `/Physical count/i`).

### 3. Type-Check Gate

```bash
pnpm type-check
# underlying command: tsc --noEmit
```

- **Result:** Exit code 0, 0 errors.

### 4. Changed-File ESLint Gate

```bash
pnpm eslint \
  "src/app/(dashboard)/crm/cash-flow/page.tsx" \
  src/components/features/cash-flow/cash-flow-workspace.tsx \
  src/components/features/cash-flow/crm-cash-flow-retained-workspace.tsx \
  src/components/features/cash-flow/crm-cash-flow-workspace-data.ts \
  src/components/features/cash-flow/use-live-crm-cash-flow-data.ts \
  src/components/features/dashboard/workspace-retention-policy.ts \
  src/lib/actions/crm-cash-flow-data-actions.ts \
  src/lib/cash-flow/cash-flow-actions.ts \
  src/lib/queries/crm-cash-flow-workspace.ts \
  tests/components/cash-flow/crm-cash-flow-client-navigation.test.tsx \
  tests/components/cash-flow/crm-cash-flow-confirmed-mutation-reconciliation.test.tsx \
  tests/components/cash-flow/crm-cash-flow-failed-mutation.test.tsx \
  tests/components/cash-flow/crm-cash-flow-generation-swr.test.tsx \
  tests/components/cash-flow/crm-cash-flow-retained-wrapper.test.tsx \
  tests/components/cash-flow/crm-cash-flow-stale-reactivation.test.tsx \
  tests/lib/cash-flow/cash-flow-page-tabs.test.tsx \
  tests/lib/cash-flow/cash-flow-ui.test.tsx \
  tests/lib/cash-flow/cash-session-close-handover.test.ts \
  tests/lib/cash-flow/crm-cash-flow-retained-mutation-contract.test.ts \
  tests/lib/cash-flow/crm-cash-flow-workspace-authority.test.ts \
  tests/lib/navigation/workspace-retention-policy-cash-flow.test.ts
```

- **Result:** Exit code 0, 0 errors, 0 warnings (clean).

### 5. Production Build Gate

```bash
pnpm build
# underlying command: next build
```

- **Result:** Exit code 0. Compiled successfully, 153/153 static pages generated.

### 6. Git Diff Whitespace Gate

```bash
git diff --check
```

- **Result:** Exit code 0, clean whitespace.

### 7. PERF-1 Through PERF-7 Regression Gate

```bash
pnpm exec vitest run \
  tests/lib/navigation/workspace-generation.test.ts \
  tests/lib/navigation/workspace-module-registry.test.ts \
  tests/components/dashboard/retained-workspace-provider.test.tsx \
  tests/components/dashboard/workspace-generation-swr.test.tsx \
  tests/components/dashboard/owner-runtime-scope.test.tsx \
  tests/lib/owner/operational-scope.test.ts \
  tests/lib/owner/operational-scope-server.test.ts \
  tests/components/crm/today-generation-swr.test.tsx \
  tests/lib/crm/crm-today-operational.test.ts \
  tests/app/crm/today-parallel-reads.test.tsx \
  tests/components/crm/bookings-generation-swr.test.tsx \
  tests/lib/crm/crm-bookings-operational.test.ts \
  tests/lib/bookings/crm-bookings-page.test.tsx \
  tests/lib/bookings/crm-bookings-api.test.ts \
  tests/app/crm/quick-booking-customer-callers.test.tsx \
  tests/components/crm/quick-booking-customer-autocomplete.test.tsx \
  tests/components/crm/quick-booking-deferred-options.test.tsx \
  tests/components/crm/quick-booking-service-duration-dropdown.test.tsx \
  tests/lib/crm/quick-booking-customer-prefill-scope.test.ts \
  tests/lib/schedule/use-schedule-realtime.test.tsx \
  tests/lib/schedule/use-live-daily-schedule-generation.test.tsx \
  tests/lib/schedule/schedule-workspace-realtime-merge.test.ts \
  tests/lib/attendance/attendance-workspace-realtime-merge.test.ts \
  tests/lib/attendance/attendance-realtime-resilience-contract.test.ts \
  tests/components/dispatch/use-live-crm-dispatch-data-generation.test.tsx \
  tests/lib/navigation/workspace-retention-policy-dispatch.test.ts \
  tests/components/dispatch/home-service-nav-cleanup.test.tsx \
  tests/lib/bookings/crm-dispatch-deep-link.test.ts \
  tests/lib/bookings/upcoming-dispatch.test.ts \
  tests/components/crm/customers-generation-swr.test.tsx \
  tests/components/crm/customers-client-navigation.test.tsx \
  tests/lib/crm/customer-workspace-data.test.ts \
  tests/lib/crm/crm-customers-workspace.test.ts \
  tests/lib/crm/crm-customers-data-action.test.ts \
  tests/api/crm-customer-search-scope.test.ts \
  tests/lib/crm/customer-search-branch-filter.test.ts \
  tests/lib/crm/customer-phone-lookup-scope.test.ts \
  tests/components/crm/customers-waitlist-mutation.test.tsx \
  tests/lib/crm/crm-waitlist-status-action.test.ts \
  tests/components/crm/staff-generation-swr.test.tsx \
  tests/components/crm/staff-stale-reactivation.test.tsx \
  tests/components/crm/staff-confirmed-mutation-reconciliation.test.tsx \
  tests/components/crm/staff-onboarding-retained-completion.test.tsx \
  tests/lib/crm/crm-staff-data-action.test.ts \
  tests/lib/crm/crm-staff-retained-mutation-contract.test.ts \
  tests/lib/crm/crm-staff-workspace.test.ts \
  tests/lib/navigation/workspace-retention-policy-staff.test.ts \
  tests/components/crm/staff-management-retention.test.tsx \
  tests/components/crm/crm-staff-branch-corrections-tab.test.tsx \
  tests/lib/staff/approval-branch-safety.test.ts \
  tests/lib/staff/service-assignment-state.test.ts \
  tests/lib/staff/service-providers.test.ts \
  tests/lib/staff/operational-staff.test.ts \
  tests/lib/staff/staff-mutation-service.test.ts \
  tests/lib/staff/staff-onboarding-service.test.ts \
  tests/lib/staff/branch-correction-policy.test.ts \
  tests/lib/staff/branch-correction-resolution-contract.test.ts
```

- **Files Passed:** 57 passed (57)
- **Files Failed:** 0
- **Tests Passed:** 306 passed (306)
- **Failures:** 0
- **Duration:** 13.91s

### 8. Full Repository Vitest Suite

```bash
pnpm exec vitest run --maxWorkers=4
```

- **Files Passed:** 395 passed | 1 failed | 2 skipped (398 total)
- **Tests Passed:** 3043 passed | 1 failed | 2 skipped (3046 total)
- **Duration:** 94.78s
- **Sole Failure:** `tests/components/bookings/c03-mobile-booking-wizard.test.tsx > C-03: Mobile New Booking Wizard Responsive Layout > renders all core booking controls reachable and readable on mobile`
- **Failure Classification:** **ACCEPTED-MAIN BASELINE**
  - Confirmed byte-for-byte identical on accepted main commit `0c8455dfee87441970284175c0dd7b4c19fbb327`. Unrelated to Cash Flow.
- **PERF-8 Introduced Failures:** 0

### 9. Final SHA Reconciliation

- **Accepted Base / main:** `0c8455dfee87441970284175c0dd7b4c19fbb327`
- **Starting Verification HEAD:** `ac25bfed546d59bd6f0127961380cfc92e2417f4`
- **Quality-Gated Implementation SHA:** `65205ac09aa2996b98e816c2c7295561220318ed`
- **Current Documentation Delivery / PR HEAD:** Delivered via subsequent documentation-only commit on PR #38.

---

## H. Repository-recorded deployment evidence

PR #38 preview status at the implementation candidate:

- Vercel: success
- Netlify deploy preview: success

Classification:

**REPOSITORY-RECORDED PRODUCTION EVIDENCE ONLY — NOT LIVE PRODUCTION VERIFICATION**

This does not verify authenticated financial workflow behavior or production financial latency.

---

## I. Database / production impact

- Migration created: **NO**
- Migration applied: **NO**
- Database schema changed: **NO**
- Financial RPC changed: **NO**
- Payment writer changed: **NO**
- RLS changed: **NO**
- Production financial record mutated: **NO**
- Production cash session opened/closed/handed over: **NO**
- Production payment/expense/transfer posted: **NO**
- Authenticated deployed browser verification: **NOT PERFORMED**

---

## J. Performance evidence classification

### REPOSITORY-VERIFIED

- CRM Cash Flow is registered as a retained module.
- Canonical refresh is generation-aware.
- Manual CRM Refresh no longer requires `router.refresh()`.
- Confirmed CRM financial mutation success routes through retained invalidation.
- No optimistic financial totals are added.
- CRM Cash Flow direct self-route revalidation was removed from the action layer.
- Owner/non-retained shared workspace retains router-refresh fallback.
- transactional entry/handover parameters are not retained as restoration metadata.

### REPOSITORY-RECORDED BUILD EVIDENCE

- Vercel preview: success.
- Netlify preview: success.

### TARGET

- retained warm Cash Flow reveal: operationally near-instant;
- zero hidden Cash Flow canonical reads;
- one authoritative reconciliation after confirmed financial mutation.

### NOT VERIFIED

- authenticated live browser timing;
- production database query latency;
- real cash-session mutation behavior after deployment;
- production payment/expense/transfer operation;
- browser memory/heap cost.

---

## K. Rollback

PERF-8 is Web-code only.

Rollback options:

- close PR #38 without merging; or
- revert the complete PERF-8 PR after merge if separately authorized.

No database rollback is expected.

---

## L. Gate

**READY FOR INDEPENDENT REVIEW — DO NOT MERGE PR #38**

Do not begin Owner operational conversion.

Do not begin loading/dialog prewarming.

Do not begin PERF-9.

PERF-8 is ready for independent review. DO NOT MERGE pending independent PASS and explicit owner merge authorization.
