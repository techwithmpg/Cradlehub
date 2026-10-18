# CradleHub Web — PERF-6 CRM Customers Client-Segment Optimization

**Date:** 2026-10-18  
**Target:** CradleHub Web — CRM Customers only  
**Program:** Web CONTROLLED STABILIZATION — performance correction pass  
**Branch:** `stage/web-perf-6-crm-customers`  
**Accepted Base / main:** `ac20bb18dbab00994046507a6997f026a6ab2562`  
**Starting Handoff HEAD:** `140c568dba3cbd42c82424a44d4ba9e7ffb90d0a`  
**Status:** VERIFICATION COMPLETE — READY FOR INDEPENDENT REVIEW — **DO NOT MERGE**

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

## D. Implementation and demonstrated defect corrections

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
- All list + base stats execute concurrently via `Promise.all`.

### 3. Server-authoritative refresh action

Added:

`src/lib/actions/crm-customers-data-actions.ts`

The action:

- accepts only tab/page/search request state;
- normalizes runtime-untrusted input;
- derives branch identity from `getCrmContext()`;
- does not accept a branch override;
- returns the aggregate canonical Customers payload.

### 4. Generation-aware Customers hook & defect correction

File:

`src/components/features/crm/customers/use-live-crm-customers-data.ts`

Uses `useGenerationAwareWorkspaceSWR("crm-customers", ...)`.

**Demonstrated defect:**
- ESLint reported `react-hooks/refs` on line 38 (`Cannot access refs during render`).
- *Root cause:* `initialKeyRef.current` was accessed during render to check whether `requestKey === initialKeyRef.current`.
- *Correction:* Converted `initialKeyRef` to React state via `useState(() => customerWorkspaceRequestKey(...))`, eliminating ref access during render while preserving initial fallback data association.

### 5. Client URL state & toolbar synchronization correction

Files:
- `src/components/features/crm/customers/customers-workspace.tsx`
- `src/components/features/crm/customers/customer-toolbar.tsx`

`CustomersWorkspace` derives active `tab`, `page`, and `q` from `useSearchParams()`.

Internal Customers interactions use:

`window.history.pushState(...)`

rather than route navigation.

**Demonstrated defects:**
1. `customer-toolbar.tsx`:
   - ESLint reported `react-hooks/set-state-in-effect` (`Calling setState synchronously within an effect can trigger cascading renders`).
   - *Root cause:* `useEffect` was used to call `setQuery(search ?? "")` on `[search, tab]` changes.
   - *Correction:* Migrated to React's standard pattern of adjusting state during render (`prevSearch !== search || prevTab !== tab`), eliminating the effect and cascading renders.
2. `customers-workspace.tsx`:
   - ESLint reported `react-hooks/set-state-in-effect` (`Calling setState synchronously within an effect can trigger cascading renders`).
   - *Root cause:* `useEffect` was used to clear `selectedCustomer` and `isMobileRailOpen` when the selected customer was no longer present in `visibleCustomerIds`.
   - *Correction:* Adjusted state during render when `selectedCustomer && !visibleCustomerIds.has(selectedCustomer.id)`, immediately closing the preview safely without extra render cascade cycles.

### 6. Test type-safety correction & regression tests

Files:
- `tests/components/crm/customers-generation-swr.test.tsx`
- `tests/components/crm/customers-client-navigation.test.tsx`

**Demonstrated defect:**
- `pnpm type-check` reported `TS2322: Type '"repeat"' is not assignable to type '"all"'` in `customers-generation-swr.test.tsx(145, 16)`.
- *Root cause:* `renderHook` inferred `{ tab: "all" }` from `initialProps: { tab: "all" as const }`, rejecting `rerender({ tab: "repeat" })`.
- *Correction:* Explicitly typed `tab` as `CrmCustomersWorkspaceRequest["tab"]`.
- Added test coverage in `customers-client-navigation.test.tsx`:
  - Clearing search removes `q` and preserves active tab in the URL;
  - Closes customer preview rail safely when selected customer is no longer visible in reconciled list.

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

Evidence:

15. `docs/reports/WEB-PERF-6-CRM-CUSTOMERS-2026-10-18.md`

No migrations, SQL, RLS, generated database types, Desktop, Owner, Staff, Cash Flow, or production-operation files were changed.

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
- clearing search removes query parameter and retains active segment;
- pagination updates URL without replacing the workspace;
- back/forward-style searchParam changes become the current request;
- customer preview closes safely when selected customer is filtered or reconciled out;
- Repeat/Lapsed/Follow-up segment reads do not recompute base `getCrmStats`;
- server refresh action derives branch from `getCrmContext`;
- untrusted tab/page input is normalized before query execution.

---

## G. Executed quality gates

### 1. Focused PERF-6 Quality Gate

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

- **Test Files:** 11 passed (11)
- **Tests:** 58 passed (58)
- **Failures:** 0
- **Skipped:** 0
- **Duration:** 2.56s

### 2. Type-Check Gate

```bash
pnpm type-check
```

- **Command executed:** `tsc --noEmit`
- **Result:** PASSED (exit code 0, 0 errors)

### 3. Changed-File ESLint Gate

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

- **Result:** PASSED (exit code 0, 0 errors, 0 warnings)

### 4. Build Gate

```bash
pnpm build
```

- **Result:** PASSED (exit code 0)
- **Compilation:** Turbopack compiled successfully in 47s
- **TypeScript Check in Build:** Passed in 102s
- **Static Generation:** 153/153 pages generated in 1178ms

### 5. Git Diff Check Gate

```bash
git diff --check
```

- **Result:** PASSED (clean, 0 whitespace errors)

### 6. PERF-1 Through PERF-5 Regression Gate

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
  tests/lib/bookings/upcoming-dispatch.test.ts
```

- **Test Files:** 29 passed (29)
- **Tests:** 184 passed (184)
- **Failures:** 0
- **Skipped:** 0
- **Duration:** 14.76s

### 7. Full Repository Vitest Suite

```bash
pnpm exec vitest run --maxWorkers=4
```

- **Test Files:** 376 passed | 1 failed | 2 skipped (379 total)
- **Tests:** 2985 passed | 1 failed | 2 skipped (2988 total)
- **Duration:** 94.60s
- **Sole Failure:** `tests/components/bookings/c03-mobile-booking-wizard.test.tsx > C-03: Mobile New Booking Wizard Responsive Layout > renders all core booking controls reachable and readable on mobile`
- **Failure Classification:** **ACCEPTED-MAIN BASELINE**
  - Verified by checking against accepted `origin/main` commit `ac20bb18dbab00994046507a6997f026a6ab2562`. The test file and component `quick-booking-form.tsx` have 0 diff against `main`, and the failure is byte-for-byte identical on `main` and completely unrelated to CRM Customers.
- **PERF-6 Introduced Failures:** 0

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

### MEASURED
- Focused PERF-6 test suite: 11 files, 58 tests passed in 2.56s
- PERF-1–5 regression test suite: 29 files, 184 tests passed in 14.76s
- Full repository test suite: 376 passed files, 2985 passed tests in 94.60s
- Build compilation: 153/153 static and dynamic routes compiled in 47s, static generation in 1178ms
- Type-check duration: `tsc --noEmit` completed in ~7s

### REPOSITORY-VERIFIED BY IMPLEMENTATION
- segment/search/page URL state no longer requires a Customers route navigation;
- Customers canonical refresh uses the accepted generation-aware adapter;
- Repeat/Lapsed/Follow-up no longer execute unrelated base CRM stats;
- All segment executes customer list query and CRM stats concurrently;
- current URL state is explicit and shareable;
- branch authority remains server-side.

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

**READY FOR INDEPENDENT REVIEW — DO NOT MERGE**

Do not begin PERF-7.

All required conditions have passed:

1. focused Customers tests passed (58/58);
2. type-check passed (`tsc --noEmit`, exit code 0);
3. changed-file lint passed (exit code 0, 0 errors, 0 warnings);
4. build passed (`pnpm build`, 153/153 routes, exit code 0);
5. `git diff --check` passed (clean);
6. PERF-1 through PERF-5 regressions passed (184/184 tests);
7. full-suite results verified against accepted main (sole failure is pre-existing baseline);
8. evidence report updated with actual executed commands and counts;
9. independent review required before any merge consideration.
