# CradleHub Web — PERF-6 CRM Customers Client-Segment Optimization

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Customers only  
**Program:** Web CONTROLLED STABILIZATION — performance correction pass  
**Branch:** `stage/web-perf-6-crm-customers`  
**Accepted Base / main:** `ac20bb18dbab00994046507a6997f026a6ab2562`  
**Implementation HEAD before this evidence report:** `bbb1116ecc2950904095b24e66331f9bb5789e29`  
**Status:** IMPLEMENTATION COMPLETE — QUALITY GATE EXECUTION REQUIRED — **DO NOT MERGE**

---

## A. Owner authorization and frozen scope

The Owner explicitly authorized PERF-6 after PERF-5 was merged into accepted `main`.

PERF-0 records the next remaining CRM optimization as:

- Customer segment client-side tab switching.

PERF-6 is frozen to `/crm/customers` only.

Explicitly out of scope:

- Staff optimization;
- Cash Flow optimization;
- Setup optimization;
- Owner operational conversions;
- customer schema redesign;
- new customer features;
- Desktop;
- database schema, migrations, or RLS;
- PERF-7 or later work.

---

## B. Current-system truth inspected before replacement

### Existing consumer

`/crm/customers` already participates in retained workspace policy as `crm-customers`.

Before PERF-6:

- segment tabs were URL links;
- every tab change entered the Server Component page again;
- the page executed one segment-specific read and then always executed `getCrmStats(branchId)`;
- search and pagination were also route-driven;
- selection/preview state lived in the retained client workspace but route data was still server-page driven.

### Canonical sources of truth

Customer data remains server-authoritative through existing queries:

- `getCustomersPage`
- `getRepeatCustomers`
- `getLapsedCustomers`
- `getCrmStats`
- existing CRM waitlist read/action

Branch scope remains server-authoritative through:

- `getCrmContext()`

No browser-supplied branch identifier is accepted by the new refresh action.

---

## C. Official framework verification

Current Next.js App Router documentation states that native:

- `window.history.pushState`
- `window.history.replaceState`

integrate with the Next.js Router and synchronize with `usePathname` / `useSearchParams` without reloading the page.

PERF-6 therefore uses native history for Customers segment/search/pagination URL state rather than route navigation.

This preserves:

- bookmarkable/shareable URLs;
- browser back/forward state;
- direct deep-link reload behavior;
- client-side workspace continuity.

---

## D. Implementation

### 1. Shared Customers workspace contract

Added:

`src/components/features/crm/customers/customer-workspace-data.ts`

It defines:

- normalized tab/page/search request state;
- canonical Customers URL generation;
- aggregate Customers workspace data contract.

### 2. Shared server-authoritative loader

Added:

`src/lib/queries/crm-customers-workspace.ts`

The server page and client refresh action now use the same loader.

Behavior preserved:

- All → paginated/search customer list;
- Repeat → repeat client query;
- Lapsed → existing 30+ day query;
- Follow-up → existing waitlist query;
- existing KPI formulas preserved.

Performance correction:

- `getCrmStats` is now fetched only for the All segment;
- Repeat, Lapsed, and Follow-up do not recompute unrelated base CRM stats;
- All list + base stats execute concurrently.

### 3. Server-authoritative refresh action

Added:

`src/lib/actions/crm-customers-data-actions.ts`

The action:

- accepts only tab/page/search request state;
- normalizes runtime-untrusted input;
- derives branch identity from `getCrmContext()`;
- does not accept a branch override;
- returns the aggregate canonical Customers payload.

### 4. Generation-aware Customers hook

Added:

`src/components/features/crm/customers/use-live-crm-customers-data.ts`

It uses:

`useGenerationAwareWorkspaceSWR("crm-customers", ...)`

Expected lifecycle:

- initial SSR payload renders with zero duplicate fetch;
- hidden retained Customers performs zero canonical reads;
- request identity changes reconcile only the Customers data payload;
- stale responses cannot validate a newer generation;
- `customer.changed` and existing semantic invalidations continue to target `crm-customers`.

### 5. Client URL state

`CustomersWorkspace` now derives active:

- `tab`
- `page`
- `q`

from `useSearchParams()`.

Internal Customers interactions use:

`window.history.pushState(...)`

rather than route navigation.

Segment switch behavior:

- tab updates immediately;
- page resets to 1;
- prior search is cleared, matching previous segment-link behavior.

Search behavior:

- active tab is preserved;
- page resets to 1;
- URL remains shareable.

Pagination behavior:

- active tab and search remain preserved;
- page changes in native browser history.

The current browser URL is the sole client navigation state; omitted params normalize to:

- All
- page 1
- no search

instead of falling back to an earlier server snapshot.

### 6. Local segment loading only

When a first-time segment request has no cached payload:

- PageHeader remains mounted;
- segment controls remain mounted;
- only the Customers KPI/table region shows a bounded loading state.

No full Customers workspace blank/remount is introduced.

### 7. Selection preservation

Selected customer preview remains if that customer still exists in the reconciled visible dataset.

If the selected customer is no longer present after segment/search/page reconciliation, the preview closes safely.

### 8. Waitlist mutation reconciliation

Successful waitlist status changes now invalidate `crm-customers` so the active Follow-up segment reconciles authoritative server state.

Existing server mutation and authorization behavior is preserved.

---

## E. Changed files

Implementation:

1. `src/app/(dashboard)/crm/customers/page.tsx`
2. `src/components/features/crm/customers/customer-segment-tabs.tsx`
3. `src/components/features/crm/customers/customer-toolbar.tsx`
4. `src/components/features/crm/customers/customer-workspace-data.ts`
5. `src/components/features/crm/customers/customers-workspace.tsx`
6. `src/components/features/crm/customers/use-live-crm-customers-data.ts`
7. `src/components/features/crm/customers/waitlist-followup-table.tsx`
8. `src/lib/actions/crm-customers-data-actions.ts`
9. `src/lib/queries/crm-customers-workspace.ts`

Tests:

10. `tests/components/crm/customers-generation-swr.test.tsx`
11. `tests/components/crm/customers-client-navigation.test.tsx`
12. `tests/lib/crm/customer-workspace-data.test.ts`
13. `tests/lib/crm/crm-customers-workspace.test.ts`
14. `tests/lib/crm/crm-customers-data-action.test.ts`

No migration, SQL, RLS, generated database type, Desktop, Owner, Staff, Cash Flow, or production-operation file is changed.

---

## F. Regression contracts encoded

Tests now cover:

- initial Customers fallback produces zero duplicate canonical fetch;
- hidden Customers invalidation produces zero network reads;
- focus/reconnect events do not fetch hidden Customers;
- active request identity change performs one authoritative Customers reconciliation;
- stale Customer responses cannot overwrite newer generation state;
- canonical shareable URLs normalize tab/page/search correctly;
- segment switching uses native history;
- search resets page while preserving active segment;
- pagination updates URL without replacing the workspace;
- back/forward-style searchParam changes become the current request;
- Repeat/Lapsed/Follow-up segment reads do not recompute base `getCrmStats`;
- server refresh action derives branch from `getCrmContext`;
- untrusted tab/page input is normalized before query execution.

---

## G. Required focused gate

The following verification is required and has **not** been executed by this agent environment.

Run:

```bash
pnpm exec vitest run \
  tests/components/crm/customers-generation-swr.test.tsx \
  tests/components/crm/customers-client-navigation.test.tsx \
  tests/lib/crm/customer-workspace-data.test.ts \
  tests/lib/crm/crm-customers-workspace.test.ts \
  tests/lib/crm/crm-customers-data-action.test.ts \
  tests/components/dashboard/retained-workspace-provider.test.tsx \
  tests/components/dashboard/workspace-generation-swr.test.tsx \
  tests/lib/navigation/workspace-generation.test.ts \
  tests/api/crm-customer-search-scope.test.ts \
  tests/lib/crm/customer-search-branch-filter.test.ts \
  tests/lib/crm/customer-phone-lookup-scope.test.ts
```

Then:

```bash
pnpm type-check
```

Changed-file lint:

```bash
pnpm eslint \
  "src/app/(dashboard)/crm/customers/page.tsx" \
  src/components/features/crm/customers/customer-segment-tabs.tsx \
  src/components/features/crm/customers/customer-toolbar.tsx \
  src/components/features/crm/customers/customer-workspace-data.ts \
  src/components/features/crm/customers/customers-workspace.tsx \
  src/components/features/crm/customers/use-live-crm-customers-data.ts \
  src/components/features/crm/customers/waitlist-followup-table.tsx \
  src/lib/actions/crm-customers-data-actions.ts \
  src/lib/queries/crm-customers-workspace.ts \
  tests/components/crm/customers-generation-swr.test.tsx \
  tests/components/crm/customers-client-navigation.test.tsx \
  tests/lib/crm/customer-workspace-data.test.ts \
  tests/lib/crm/crm-customers-workspace.test.ts \
  tests/lib/crm/crm-customers-data-action.test.ts
```

Then:

```bash
pnpm build
git diff --check
```

After the focused gate, rerun the accepted PERF-1 through PERF-5 regression suites and the full repository Vitest suite.

Every full-suite failure must be compared with accepted `main` before classification.

---

## H. Security and authorization

Repository-inspected boundaries preserved:

- branch scope comes from `getCrmContext()`;
- client tab/page/search state grants no additional access;
- no branch ID is accepted by the client refresh action;
- no service-role secret is introduced to the browser;
- no RLS bypass is introduced;
- existing customer query branch scoping remains unchanged;
- waitlist mutations remain server-authorized;
- no customer data mutation is moved client-side.

---

## I. Database / production impact

- Migration created: **NO**
- Migration applied: **NO**
- Database schema changed: **NO**
- RLS changed: **NO**
- Production data mutated: **NO**
- Production operational workflow executed: **NO**
- Authenticated browser performance verification: **NOT PERFORMED**

Any deployment/check status associated with this branch must be classified as:

**REPOSITORY-RECORDED PRODUCTION EVIDENCE ONLY — NOT LIVE PRODUCTION VERIFICATION**

---

## J. Performance evidence classification

### REPOSITORY-VERIFIED BY IMPLEMENTATION

- segment/search/page URL state no longer requires a Customers route navigation;
- Customers canonical refresh uses the accepted generation-aware adapter;
- Repeat/Lapsed/Follow-up no longer execute unrelated base CRM stats;
- current URL state is explicit and shareable;
- branch authority remains server-side.

### TEST TARGETS — NOT YET VERIFIED

- zero hidden Customers reads;
- one active reconciliation per request identity transition;
- stale response rejection;
- native history tab/search/pagination behavior;
- back/forward synchronization;
- no redundant base stats on non-All segments.

### TARGET ONLY

- warm retained Customers reveal: <100ms;
- segment control response: immediate client feedback.

### NOT VERIFIED

- authenticated browser timing;
- deployed production customer-query latency.

---

## K. Rollback

Rollback is Web-code only:

- close the PERF-6 PR without merging; or
- revert the complete PERF-6 PR/commit range.

No database rollback is expected.

---

## L. Gate decision

**CORRECTION REQUIRED / TEST EXECUTION REQUIRED — DO NOT MERGE**

Do not begin PERF-7.

PERF-6 may move to independent review only after:

1. focused Customers tests pass;
2. type-check passes;
3. changed-file lint passes;
4. build passes;
5. `git diff --check` passes;
6. PERF-1 through PERF-5 regressions remain acceptable;
7. full-suite results are compared with accepted main;
8. evidence report is updated with actual executed commands and counts;
9. independent review returns PASS;
10. Owner explicitly authorizes merge.
