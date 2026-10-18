# CradleHub Web — PERF-9A Owner Overview Retention & Reconciliation

**Date:** 2026-10-18  
**Target:** CradleHub Web — Owner Overview only  
**Program:** Web CONTROLLED STABILIZATION  
**Accepted Base / main:** `70b4f3004e77989329a2310e5e82fa37a417555f`  
**Implementation Branch:** `stage/web-perf-9a-owner-overview`  
**Executable Implementation Candidate:** `69dd71e6d14dda1e7a1e1ad62d90c05f75f118dc`  
**Draft PR:** #39  
**Status:** IMPLEMENTATION COMPLETE — QUALITY GATE EXECUTION REQUIRED — **DO NOT MERGE**

---

## A. Authorization and scope

Owner authorized PERF-9A after the PERF-9 Owner operational roadmap scope freeze.

PERF-9A targets only:

`/owner`

The route remains the Owner-wide **all-branches aggregate**.

PERF-9A does not convert:

- Owner Bookings;
- Owner Reports;
- Owner Schedule;
- Owner Attendance;
- Owner Dispatch;
- Owner Cash Flow;
- Owner Staff;
- Owner Services.

Owner retention rollout remains OFF.

No deployment flag or environment value is changed.

---

## B. Current-system truth preserved

Before PERF-9A:

- `/owner` was already wrapped in `RetainedWorkspaceModule("owner-overview")`;
- Owner retention remained disabled under the CRM-only rollout;
- every ordinary return to Overview therefore performed a new server page load;
- `getOwnerOverviewDashboardData()` owned Owner authorization and aggregate dashboard reads;
- the page separately loaded the initial recent attendance scan feed;
- the attendance card itself already owned its realtime/refresh behavior;
- PERF-1B already provided all-branches/branch/global Owner runtime isolation.

PERF-9A preserves these authority boundaries and converts only the Owner Overview read lifecycle.

---

## C. Implementation

### 1. Canonical Owner Overview payload

Added:

`src/components/features/owner/dashboard/owner-overview-workspace-data.ts`

The payload contains:

- canonical Owner dashboard data;
- initial attendance scan feed.

The canonical request identity is constant:

`/owner`

No client branch ID, date, role, user ID, KPI, payroll total, attendance total or revenue figure is accepted as refresh authority.

---

### 2. Shared server-authoritative loader

Added:

`src/lib/queries/owner-overview-workspace.ts`

The loader calls:

`getOwnerOverviewDashboardData()`

first.

That existing function continues to own:

- Owner workspace authorization;
- aggregate branch reads;
- staff reads;
- booking reads;
- schedule/check-in reads;
- notifications/tasks;
- payroll dashboard data;
- all derived Owner KPI/business calculations.

Only after successful Owner dashboard authorization/data loading does the loader request the initial attendance feed.

Therefore an Owner access failure occurs before privileged attendance feed loading.

---

### 3. Attendance feed fallback preserved

The new loader preserves the exact existing behavior:

- attendance feed failure does not fabricate dashboard metrics;
- dashboard remains available;
- the attendance feed becomes the existing explicit fallback with:
  `Attendance activity could not be refreshed.`

The embedded `AttendanceScanFeedCard` still owns its own client realtime/refresh lifecycle.

PERF-9A changes only the initial feed delivery.

---

### 4. Owner access redirect preserved

`src/app/(dashboard)/owner/page.tsx` continues to catch:

`OwnerDashboardAccessError`

and redirect to the existing destination.

Unexpected errors still reach the route error boundary.

---

### 5. Generation-aware Owner Overview reconciliation

Added:

`src/components/features/owner/dashboard/use-live-owner-overview-data.ts`

Uses:

`useGenerationAwareWorkspaceSWR("owner-overview", "/owner", ...)`

Expected lifecycle:

- initial SSR payload = zero duplicate fetch;
- hidden dirty Overview = zero canonical reads;
- hidden focus/reconnect = zero reads;
- dirty active reveal = one canonical reconciliation;
- clean stale reveal = one reconciliation per activation;
- stale response cannot overwrite a newer Owner Overview generation;
- refresh failure retains the last validated dashboard payload.

---

### 6. Retained Owner Overview wrapper

Added:

`src/components/features/owner/dashboard/owner-overview-retained-workspace.tsx`

The wrapper:

- renders the canonical retained payload;
- preserves the last validated dashboard on refresh error;
- exposes bounded Retry through canonical `revalidate()`;
- does not call `router.refresh()`;
- performs no local KPI/business calculation.

---

### 7. Retention metadata correction

PERF-1B established that:

`/owner`

is an all-branches aggregate and ignores operational `branch` or `date` query parameters.

Before PERF-9A, the retention policy incorrectly recorded:

- `branch`
- `date`

as stable restoration state for Owner Overview.

PERF-9A changes Owner Overview stable search params to:

`[]`

Therefore stray query parameters cannot be remembered/restored as Owner Overview operational state.

---

### 8. Existing domain-event dependencies reused

No new Owner-wide event system is introduced.

Existing repository dependencies already invalidate `owner-overview` for applicable booking events such as:

- `booking.status_changed`
- `booking.created`
- `booking.cancelled`

PERF-9A relies on the accepted generation/event architecture.

---

### 9. No optimistic Owner business truth

PERF-9A does not locally fabricate or estimate:

- revenue;
- booking counts;
- branch KPIs;
- payroll totals;
- staff counts;
- attendance state;
- pending actions;
- branch performance.

Displayed Owner business data changes only after canonical server data is received.

---

## D. Owner retention remains OFF

PERF-9A does **not** change:

`NEXT_PUBLIC_RETAINED_WORKSPACES`

The existing default/CRM rollout continues to make:

`isRetainedWorkspaceEnabled("owner") === false`

unless a later separately authorized PERF-9D activation changes deployment configuration.

The new lifecycle is testable under isolated retained-provider tests without activating Owner retention in the application.

---

## E. Authorization/security boundaries preserved

1. Owner workspace access remains server-authoritative.
2. `/owner` remains all-branches aggregate.
3. Browser query parameters do not choose Owner Overview branch authority.
4. RLS remains unchanged.
5. Service-role credentials remain server-only.
6. Attendance admin reads happen only after Owner dashboard authorization succeeds.
7. No protected business query moves into a Client Component.
8. No local/offline data becomes Owner authority.
9. No payroll/analytics formula changes are made.

---

## F. Changed files before evidence report

Implementation:

1. `src/app/(dashboard)/owner/page.tsx`
2. `src/components/features/dashboard/workspace-retention-policy.ts`
3. `src/components/features/owner/dashboard/owner-overview-retained-workspace.tsx`
4. `src/components/features/owner/dashboard/owner-overview-workspace-data.ts`
5. `src/components/features/owner/dashboard/use-live-owner-overview-data.ts`
6. `src/lib/actions/owner-overview-data-actions.ts`
7. `src/lib/queries/owner-overview-workspace.ts`

Tests:

8. `tests/app/owner/owner-overview-page.test.tsx`
9. `tests/components/owner/owner-overview-generation-swr.test.tsx`
10. `tests/components/owner/owner-overview-retained-wrapper.test.tsx`
11. `tests/components/owner/owner-overview-stale-reactivation.test.tsx`
12. `tests/lib/navigation/workspace-retention-policy-owner-overview.test.ts`
13. `tests/lib/owner/owner-overview-workspace.test.ts`

Evidence:

14. `docs/reports/WEB-PERF-9A-OWNER-OVERVIEW-2026-10-18.md`

No Owner Bookings/Reports implementation file is changed.

No DB, SQL, migration, RLS, generated DB type, analytics formula, payroll formula, or deployment configuration file is changed.

---

## G. New regression contracts

New PERF-9A tests encode:

- zero duplicate initial canonical fetch;
- zero hidden reads;
- zero hidden focus/reconnect reads;
- one dirty active reconciliation;
- stale response rejection;
- one clean-stale reconciliation per activation;
- hidden stale zero fetch;
- last validated payload remains visible after refresh failure;
- Retry uses canonical reconciliation;
- Owner Overview loader accepts no branch input;
- dashboard authorization happens before attendance read;
- attendance fallback is preserved;
- Owner access redirect remains;
- unexpected route errors remain visible to error boundary;
- Owner Overview stable restoration state is empty;
- Owner child routes are not accidentally matched by Overview;
- Owner retention remains disabled under CRM-only rollout.

---

## H. Required focused quality gate

The GitHub implementation environment has **not** executed the local test suite.

Run:

```bash
pnpm exec vitest run \
  tests/app/owner/owner-overview-page.test.tsx \
  tests/components/owner/owner-overview-generation-swr.test.tsx \
  tests/components/owner/owner-overview-retained-wrapper.test.tsx \
  tests/components/owner/owner-overview-stale-reactivation.test.tsx \
  tests/lib/navigation/workspace-retention-policy-owner-overview.test.ts \
  tests/lib/owner/owner-overview-workspace.test.ts \
  tests/components/dashboard/owner-runtime-scope.test.tsx \
  tests/lib/owner/operational-scope.test.ts \
  tests/lib/owner/operational-scope-server.test.ts \
  tests/lib/owner/dashboard.test.ts \
  tests/components/attendance/attendance-scan-feed-row.test.tsx \
  tests/lib/attendance/recent-scan-grouping.test.ts \
  tests/lib/attendance/recent-scans.test.ts \
  tests/lib/attendance/scan-feed.test.ts
```

Record exact:

- files passed;
- files failed;
- tests passed;
- tests failed;
- skipped;
- duration;
- every failure.

---

## I. Static gates

Run:

```bash
pnpm type-check
```

Changed-file lint:

```bash
pnpm eslint \
  "src/app/(dashboard)/owner/page.tsx" \
  src/components/features/dashboard/workspace-retention-policy.ts \
  src/components/features/owner/dashboard/owner-overview-retained-workspace.tsx \
  src/components/features/owner/dashboard/owner-overview-workspace-data.ts \
  src/components/features/owner/dashboard/use-live-owner-overview-data.ts \
  src/lib/actions/owner-overview-data-actions.ts \
  src/lib/queries/owner-overview-workspace.ts \
  tests/app/owner/owner-overview-page.test.tsx \
  tests/components/owner/owner-overview-generation-swr.test.tsx \
  tests/components/owner/owner-overview-retained-wrapper.test.tsx \
  tests/components/owner/owner-overview-stale-reactivation.test.tsx \
  tests/lib/navigation/workspace-retention-policy-owner-overview.test.ts \
  tests/lib/owner/owner-overview-workspace.test.ts
```

Then:

```bash
pnpm build
git diff --check
```

Record exact results.

---

## J. PERF-1 through PERF-8 regression gate

After focused PERF-9A gates pass, rerun the accepted performance regression suites through PERF-8.

At minimum this must include:

- retained workspace generation/registry/provider tests;
- PERF-1B Owner scope isolation;
- CRM Today;
- CRM Bookings;
- Schedule + Attendance;
- CRM Dispatch;
- CRM Customers;
- CRM Staff;
- CRM Cash Flow and its financial safety suites.

Record the exact command and exact file/test counts.

Do not infer success from the focused PERF-9A suite.

---

## K. Full repository gate

Run:

```bash
pnpm exec vitest run --maxWorkers=4
```

For every failure:

1. reproduce/compare on accepted main:
   `70b4f3004e77989329a2310e5e82fa37a417555f`
2. classify:
   - PERF-9A INTRODUCED
   - ACCEPTED-MAIN BASELINE
   - UNRELATED / ENVIRONMENTAL
3. do not call a failure baseline without evidence.

---

## L. Repository-recorded build evidence

Executable candidate:

`69dd71e6d14dda1e7a1e1ad62d90c05f75f118dc`

At report preparation:

- Vercel preview: SUCCESS
- Netlify preview: pending

Classification:

**REPOSITORY-RECORDED PRODUCTION EVIDENCE ONLY — NOT LIVE PRODUCTION VERIFICATION**

Preview compilation does not prove authenticated Owner behavior or production performance.

---

## M. Database / production impact

- Migration created: **NO**
- Migration applied: **NO**
- Schema changed: **NO**
- RLS changed: **NO**
- Analytics formula changed: **NO**
- Payroll formula changed: **NO**
- Production database mutation: **NO**
- Owner retention activated: **NO**
- Deployment flag changed: **NO**
- Authenticated production Owner verification: **NOT PERFORMED**
- Production performance measurement: **NOT PERFORMED**

---

## N. Performance evidence classification

### REPOSITORY-VERIFIED

- Owner Overview has a canonical aggregate payload.
- refresh action accepts no client branch authority.
- Owner Overview is generation-aware.
- stable restoration state no longer includes branch/date.
- last validated payload is retained on refresh failure.
- Owner retention remains off in CRM-only rollout.

### REPOSITORY-RECORDED BUILD EVIDENCE

- Vercel preview compiled successfully at the executable candidate.

### TARGET

When Owner retention is later activated:
- warm Owner Overview reveal should show retained content immediately;
- hidden Overview should issue zero canonical reads;
- dirty/stale active Overview should reconcile once.

### NOT VERIFIED

- authenticated Owner browser lifecycle;
- production Main/SM/all-branches transitions;
- production database query latency;
- production memory impact;
- user-perceived speed improvement;
- Owner retention activation.

---

## O. Rollback

PERF-9A is Web-code only.

Rollback options:

- close PR #39 without merge; or
- revert the PERF-9A PR after merge if separately authorized.

Owner retention is still OFF, providing an additional rollout boundary.

No DB rollback is expected.

---

## P. Gate

**TEST EXECUTION REQUIRED — DO NOT MERGE PR #39**

Do not begin PERF-9B Owner Bookings.

Do not begin PERF-9C Owner Reports.

Do not activate Owner retention.

Do not begin PERF-10.

PERF-9A may move to independent review only after the required quality gates are actually executed and this report is updated with measured evidence.
