# CradleHub Web — PERF-8 CRM Cash Flow Retention & Reconciliation

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Cash Flow only  
**Program:** Web CONTROLLED STABILIZATION  
**Accepted Base / main:** `0c8455dfee87441970284175c0dd7b4c19fbb327`  
**Implementation Branch:** `stage/web-perf-8-crm-cash-flow`  
**Implementation Candidate HEAD before this report:** `2e61cc0d467b4b7c4722c2097da807e460b05cb1`  
**Draft PR:** #38  
**Status:** IMPLEMENTATION COMPLETE — QUALITY GATE EXECUTION REQUIRED — **DO NOT MERGE**

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

## G. Required focused verification

The following local quality gates have **not** been executed by this GitHub implementation environment.

Run:

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

Record exact file/test counts, skipped tests, duration and all failures.

Then:

```bash
pnpm type-check
```

Changed-file lint:

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

Then:

```bash
pnpm build
git diff --check
```

After focused gates pass:

1. run the accepted PERF-1 through PERF-7 regression suites;
2. run the full repository Vitest suite;
3. compare every failure with accepted main `0c8455dfee87441970284175c0dd7b4c19fbb327`;
4. do not classify a failure as baseline without reproducing it on accepted main.

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

**TEST EXECUTION REQUIRED — DO NOT MERGE PR #38**

Do not begin Owner operational conversion.

Do not begin loading/dialog prewarming.

Do not begin PERF-9.

PERF-8 may move to independent review only after all required quality gates are actually executed and this report is updated with measured results.
