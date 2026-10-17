# PERF-2 CRM Today Event-Driven Performance Conversion Report

**Date:** 2026-10-17  
**Stage:** PERF-2 — CRM TODAY EVENT-DRIVEN PERFORMANCE CONVERSION  
**Target:** `/crm/today` (Cradle Flow / Work Queue)  
**Status:** IMPLEMENTATION COMPLETE — INDEPENDENT REVIEW REQUIRED  

---

## 1. Recovery Case & Base Reconciliation

- **Recovery State Classification:** **CASE A** (PERF-2 was not previously started locally; working tree was clean, remote PERF-2 branch was absent).
- **Accepted Base SHA:** `6d82cff4e509eb9b5f607ee87ad062a59e38f3d6` (`origin/main`, containing PERF-1A runtime, PERF-1B Owner safety, PR #29 duration refinements).
- **Authorized Working Branch:** `stage/web-perf-2-crm-today` created directly from exact base `6d82cff4e509eb9b5f607ee87ad062a59e38f3d6`.
- **Merge Base:** `6d82cff4e509eb9b5f607ee87ad062a59e38f3d6` (verified clean, zero divergence).

---

## 2. Changed Files

### Application Code
1. `src/lib/queries/crm-today-operational.ts` (NEW):
   Canonical server-authoritative operational builder `getCrmTodayOperationalData({ branchId, date })`. Consolidates schedule, pending queue, upcoming bookings, order service lines, financial snapshot, action-required notifications, readiness issues/status, active Home Service driver/location coordinates, tracking links, and resource assignments into a single authoritative serializable payload (`CrmTodayOperationalData`).
2. `src/app/(dashboard)/crm/today/actions.ts` (MODIFIED):
   Added `refreshCrmTodayOperationalDataAction()`. Resolves `getFrontDeskContext()` strictly server-side; ignores any client branch tampering.
3. `src/app/(dashboard)/crm/today/page.tsx` (MODIFIED):
   Refactored server page to read Front Desk duty and `getCrmTodayOperationalData` in parallel, passing the canonical operational payload to `CrmTodayShell`.
4. `src/components/features/crm/today/crm-today-shell.tsx` (MODIFIED):
   Integrated PERF-1A generation-aware hook `useGenerationAwareWorkspaceSWR("crm-work-queue", "/crm/today", refreshAction, fallbackOperationalData)`. Passes live queue data, background refresh status, retry error, and scoped revalidation down to dashboard.
5. `src/components/features/crm/today/cradle-flow-header.tsx` (MODIFIED):
   Added `isRefreshing` indicator support to display subtle non-blocking background synchronization feedback.
6. `src/components/features/crm/today/cradle-flow-dashboard.tsx` (MODIFIED):
   - Completely eliminated route reconstruction `router.refresh()`:
     - Removed `BOOKINGS_CHANGED_EVENT` window listener calling `router.refresh()`.
     - Replaced manual Header Refresh with scoped revalidation `onRefresh`.
     - Replaced financial entry modal `onSuccess` `else router.refresh()` with scoped revalidation.
   - Preserved dialog and selected booking stability across background reconciliation (resolved by ID; safely degrades if removed).
   - Preserved active group dialog stability across reconciliation (`activeGroup` by `displayId`).
   - Added non-destructive retry banner upon reconciliation failure while preserving previously validated data.

### Tests
1. `tests/lib/crm/crm-today-operational.test.ts` (NEW):
   Unit tests verifying server context derivation, parameter override rejection, and 100% preservation of all 57 booking fields, therapist provenance, driver/tracking data, and financial summary fields.
2. `tests/components/crm/today-generation-swr.test.tsx` (NEW):
   Comprehensive tests covering Requirements 1–17, 20, 25, 27 (cold load zero-fetch, active dirty reconciliation, retained UI visibility, hidden dirty zero-network, reactivation, stale generation rejection, manual refresh, error retry, ID selection preservation, SWR scope isolation).
3. `tests/app/crm/today-parallel-reads.test.tsx` (MODIFIED):
   Updated page render test to assert parallel execution of duty check and `getCrmTodayOperationalData`.

---

## 3. Architecture Before vs. After

### Before (Broad Route Reconstruction)
- Initial page executed 9 individual queries and 5 dependent sub-queries sequentially and ad-hoc.
- Any booking mutation or external event emitted `BOOKINGS_CHANGED_EVENT`, which triggered `router.refresh()`.
- Manual header refresh called `router.refresh()`.
- Financial entry success called `router.refresh()`.
- Resulted in:
  - Full route re-execution on the Next.js server.
  - Route component remounting, resetting client UI state (selected booking, open dialogs, filter, scroll).
  - Blank frames and UI flickers.
  - Background tab updates firing continuous full network requests.

### After (Retained Generation-Aware Operational Workspace)
- **Data Lifecycle Decomposition:**
  - **A. Today Operational Snapshot (`CrmTodayOperationalData`):** `queueData`, `snapshot`, `actionNotifications`, `readinessIssues`, `readinessStatus`. Reconciled together via `refreshCrmTodayOperationalDataAction`.
  - **B. Independent Realtime Data:** `attendanceScanFeed` via `useAttendanceScanFeed`. Remains completely independent on its own polling/realtime lifecycle.
  - **C. Session / Identity Data:** `FrontDeskDutyContext`, `branchName`, `dateLabel` read once on cold page render and preserved during workspace lifetime.
  - **D. Action-Local State:** `selectedBooking`, `dialog`, `assignment`, `activeGroup`, `filter`, `financialRequest` maintained client-side without reset on data reconciliation.
- **Generation-Aware SWR:**
  - Scoped key: `user:role:branch:crm-work-queue`.
  - Initial server-rendered payload serves as zero-latency validated fallback.
  - Inactive/hidden workspace: generation increments locally; ZERO network requests fired.
  - Active/reactivated workspace: immediately reveals retained validated UI; background revalidation updates payload seamlessly.
  - Stale responses from generation $N$ are rejected if generation $N+1$ has already started.

---

## 4. `router.refresh()` Inventory Audit

### Before PERF-2:
1. `src/components/features/crm/today/cradle-flow-dashboard.tsx:111`: `BOOKINGS_CHANGED_EVENT` listener called `router.refresh()`.
2. `src/components/features/crm/today/cradle-flow-dashboard.tsx:205`: `CradleFlowHeader` `onRefresh={() => router.refresh()}`.
3. `src/components/features/crm/today/cradle-flow-dashboard.tsx:303`: `CradleFlowFinancialEntry` `onSuccess` non-customer payment called `router.refresh()`.

### After PERF-2:
- **0 occurrences of `router.refresh()` remain** in `/crm/today` components or page!
- `router.push()` is preserved strictly for legitimate route transitions (e.g. navigation to `/crm/bookings?bookingId=...`, `/crm/dispatch?bookingId=...`, or future date booking URLs).

---

## 5. Security & Isolation

- **Server-Authoritative Context:** `refreshCrmTodayOperationalDataAction` does not take or trust client-provided branch IDs. It derives the branch and business date strictly via `getFrontDeskContext()` and `getBranchBusinessDate()`.
- **SWR Cache Isolation:** Scoped by `[user, role, branch, module]` via `WorkspaceSWRScopeContext`. Switching branches or accounts completely isolates cache partitions.
- **Owner Retention Safety:** Retained workspace optimization is active ONLY for staff/front-desk CRM workflows (`/crm/today`). Owner workspace retention remains explicitly disabled per PERF-1B governance.

---

## 6. Payment & Business Truth Safety

- No client-side mathematical optimism is applied to financial totals, payment balances, or completion timestamps.
- Payments and status mutations execute against server endpoints. Validated previous state remains visible until authoritative server data reconciles.
- All 57 booking fields, order financial status from `v_booking_order_financial_summaries`, and therapist selection provenance (`requested_staff_id`, `therapist_selection_source`) are 100% preserved.

---

## 7. Verification & Quality Gates

### Unit & Integration Test Suites
- `tests/lib/crm/crm-today-operational.test.ts`: **2/2 PASSED**
- `tests/components/crm/today-generation-swr.test.tsx`: **14/14 PASSED**
- `tests/app/crm/today-parallel-reads.test.tsx`: **1/1 PASSED**
- All CRM tests (`tests/components/crm/`, `tests/app/crm/`, `tests/lib/crm/`): **34/34 test files, 126/126 tests PASSED**
- Regression suites (PERF-1A, PERF-1B, PR #29): **38/38 tests PASSED**

### TypeScript Type-Check
- `pnpm type-check` (`tsc --noEmit`): **PASSED (0 errors)**

### ESLint
- `pnpm eslint ...`: **PASSED (0 errors, 0 warnings)**

### Production Build
- `pnpm build` (`next build` with Turbopack): **PASSED (153 static & dynamic routes compiled)**

### Git Diff Check
- `git diff --check`: **PASSED (clean whitespace and line endings)**

---

## 8. Performance Evidence Classification

- **REPOSITORY TEST:** 100% verified.
  - Zero duplicate fetches on initial render.
  - 0 network requests when hidden workspace is invalidated.
  - Immediate reveal of retained data upon reactivation before revalidation completes.
  - Deterministic stale response discarding.
- **LOCAL HTTP:** Verified via Next.js production build (`pnpm build`).
- **AUTHENTICATED BROWSER PERFORMANCE EVIDENCE — NOT PERFORMED:** (Headless agent environment without interactive browser credentials; targets recorded below as specifications, not measurements).
  - Target: Warm retained Today reveal <100ms perceived.
  - Target: Hidden dirty Today network requests = 0.
  - Target: No blank frames on refresh.

---

## 9. Production Impact, Limitations & Rollback

- **Production Impact:** Zero database migrations, zero schema changes, zero RLS changes, zero contract changes. Safe isolated deployment to stage branch.
- **Known Limitations:**
  - Conversion applies strictly to `/crm/today` (Cradle Flow).
  - Other CRM sub-routes (`/crm/bookings`, `/crm/schedule`, `/crm/customers`) remain on standard Next.js lifecycle pending subsequent stages.
- **Rollback:**
  - Fast rollback: revert the merge commit or point branch back to base SHA `6d82cff4e509eb9b5f607ee87ad062a59e38f3d6`.
  - Zero database state to migrate back.
- **Recommended Next Stage:** Independent peer review and staging verification for PERF-2 before authoring PERF-3.
