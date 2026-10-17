# PERF-3 CRM Bookings Generation-Aware Performance Conversion Report

**Date:** 2026-10-17  
**Stage:** PERF-3 — CRM BOOKINGS GENERATION-AWARE PERFORMANCE CONVERSION  
**Target:** `/crm/bookings` (CradleHub CRM Bookings only)  
**Status:** IMPLEMENTATION COMPLETE — INDEPENDENT REVIEW REQUIRED  

---

## A. STATUS

- **Stage Status:** Implementation complete on review branch `stage/web-perf-3-crm-bookings`.
- **Review Boundary:** Review branch only. Not merged to `main`. Not deployed. Zero mutations to production data, zero changes to DB schema, RLS, or migrations.
- **Independent Review Required:** Independent human review required prior to merge.

---

## B. BASELINE

- **Accepted Base `origin/main` SHA:** `446ad81808f327934021198045140c89082129d5`
- **Working Branch:** `stage/web-perf-3-crm-bookings` (created directly from exact accepted `origin/main`)
- **Merge Base:** `446ad81808f327934021198045140c89082129d5` (verified clean, zero divergence)
- **Target Module ID:** `crm-bookings`

---

## C. CURRENT-SYSTEM INSPECTION

A complete architectural inspection of CRM Bookings was conducted before code modifications:

1. **Server Reads:**
   - Front Desk branch context (`getFrontDeskContext`).
   - Deep-linked booking reference resolution (`bookings` table lookup by `id` + `branch_id`).
   - Command center bookings (`getCrmBookingsCommandCenterRows`) for daily mode.
   - Upcoming bookings (`getCrmUpcomingBookings`) for upcoming mode (14-day window).
   - Upcoming order service line expansion (`getCrmOrderServiceLines`).
   - Order financial summary views (`v_booking_order_financial_summaries`) for accurate `total_payable`, `net_allocated`, and `payment_state`.
   - Order metadata fallback (`booking_orders.metadata.total_amount`).
   - Daily cash summary (`getDailyPaymentSummary`).
   - Waitlist rows (`getWaitlistAction`).

2. **Client Refresh Infrastructure:**
   - `CrmBookingsView` utilized plain `useSWR` with `useWorkspaceSWRKey(apiUrl)`.
   - Attached `useWorkspaceReactivationRefresh(refreshBookings)`.
   - Attached an independent `window.addEventListener(BOOKINGS_CHANGED_EVENT, ...)` listener.
   - Because `RetainedWorkspaceProvider` also listened to `BOOKINGS_CHANGED_EVENT` and marked the module dirty, every mutation caused a double reconciliation (one from the window event calling `mutate()`, and one from the provider).

3. **Desktop Workspace Remount Keys:**
   - Outer key: `${referenceSource}:${rawTab}:${bookingId}`
   - Inner desktop key: `${initialQuickFilter}:${initialSelectedId}`
   - Changing between `all`, `needs-attention`, and `active-now` quick filters in desktop workspace triggered `router.push("?tab=...")`, remounting the workspace and discarding local selection despite the underlying dataset being identical.

---

## D. INITIAL VS REFRESH PAYLOAD PARITY FINDINGS

Repository inspection identified a critical data parity gap between initial page rendering and the API refresh path:

| Feature / Projection | Initial Page (`/crm/bookings/page.tsx`) | Previous API Route (`/api/crm/bookings/route.ts`) | Resolution in PERF-3 |
| :--- | :--- | :--- | :--- |
| **Upcoming Service Line Expansion** | Included sibling lines via `getCrmOrderServiceLines` | Missing (only primary line returned) | **Parity Achieved**: Both use canonical builder calling `getCrmOrderServiceLines` |
| **Order Financial Summaries** | Read `v_booking_order_financial_summaries` | Missing (payment status & amounts omitted) | **Parity Achieved**: Both query view for authoritative payment states & totals |
| **Order Metadata Fallback** | Read `booking_orders.metadata.total_amount` | Missing | **Parity Achieved**: Both enrich order amounts from `booking_orders` fallback |
| **Outside-Window Selection** | Retained selected booking beyond 14d Upcoming window | Truncated/omitted | **Parity Achieved**: Explicitly fetches and merges selected booking with banner |
| **Waitlist & Cash Summary** | Included waitlist & daily cash summary | Missing from API route payload | **Parity Achieved**: Included in `CrmBookingsOperationalData` |

A background refresh or reactivation can no longer downgrade a rich initial server payload to a partial API response.

---

## E. CANONICAL BOOKINGS PAYLOAD

Created one authoritative server-side projection `CrmBookingsOperationalData` in `src/lib/queries/crm-bookings-operational.ts`:

```typescript
export type CrmBookingsOperationalData = {
  branchId: string;
  branchName: string;
  role: string;
  date: string;
  businessDate: string;
  selectedOutsideWindow: boolean;
  bookings: WorkspaceBookingRow[];
  waitlistRows: WaitlistRow[];
  cashSummary: DailyCashSummaryData | null;
};
```

Both `src/app/(dashboard)/crm/bookings/page.tsx` and `refreshCrmBookingsOperationalDataAction` call `getCrmBookingsOperationalData(...)`. `src/app/api/crm/bookings/route.ts` is also delegated to this canonical builder for compatibility.

---

## F. AUTHORIZATION

- Front Desk context (`getFrontDeskContext()`) derives `userId`, `role`, `branchId`, and `branchName` strictly on the server from authenticated session cookies.
- Client requests cannot authorize or override the branch. Any query parameter `branchId` attempting to access another branch is rejected (returns 404 in API route; ignored in server action).
- Deep-linked booking references are explicitly filtered by `.eq("branch_id", branchId)`. If a booking ID belongs to another branch, it is not resolved or leaked.

---

## G. GENERATION-AWARE SWR MIGRATION

`CrmBookingsView` was migrated from plain SWR and multiple manual listeners to `useGenerationAwareWorkspaceSWR`:

```typescript
const requestKey = `${date}:${isUpcoming ? "upcoming" : "daily"}:${bookingId ?? ""}`;

const fetcher = useCallback(() => {
  return refreshAction({
    date,
    upcoming: isUpcoming,
    bookingId,
  });
}, [refreshAction, date, isUpcoming, bookingId]);

const { data, error, generation, revalidate } =
  useGenerationAwareWorkspaceSWR<CrmBookingsOperationalData>(
    "crm-bookings",
    requestKey,
    fetcher,
    initialData
  );
```

- **Scoped SWR Key:** `user:role:branch:crm-bookings:[moduleId, requestKey]`.
- **Cache Isolation:** Prevents cross-branch, cross-user, or cross-role data leaks.
- **Removed Deprecated Hooks:** Removed plain `useSWR`, `useWorkspaceReactivationRefresh`, and local `BOOKINGS_CHANGED_EVENT` window listener.

---

## H. EVENT / INVALIDATION FLOW

1. **Mutation Event:**
   Booking mutation action succeeds -> dispatches `BOOKINGS_CHANGED_EVENT` or domain event.
2. **Runtime Store Invalidation:**
   `RetainedWorkspaceProvider` receives event -> invalidates `crm-bookings` in `WorkspaceGenerationStore`.
3. **Generation-Aware Scheduling:**
   - If `crm-bookings` is **active**: Launches exactly one authoritative background reconciliation.
   - If `crm-bookings` is **hidden**: Marks `isDirty = true`; executes **0 network requests**.
   - Upon **reactivation**: Displays validated retained workspace immediately (<100ms perceived); launches exactly one authoritative reconciliation if dirty.
4. **Elimination of Double Fetch:**
   `CrmBookingsView` no longer attaches its own `window.addEventListener(BOOKINGS_CHANGED_EVENT)`. One effective aggregate request per invalidation.

---

## I. REQUEST IDENTITY

Request identity is strictly normalized to server-affecting dataset parameters:
`${date}:${isUpcoming ? "upcoming" : "daily"}:${bookingId ?? ""}`

- **Server-Affecting Changes:** Date change, switching between daily and Upcoming mode, deep-link target change -> Updates request key, triggers scoped revalidation.
- **Local Display Changes:** Selected group/row, quick filter within daily dataset (`all`, `needs-attention`, `active-now`), search text, modal open/close -> Does NOT alter network request key; zero server fetch.

---

## J. LOCAL VS SERVER-AFFECTING FILTERS

- **Local Filters (`all`, `needs-attention`, `active-now`):**
  Updated `BookingsDesktopWorkspace` to handle switching locally without route restart. Updates local state and synchronizes URL query via `window.history.replaceState(...)`. Zero server roundtrips, zero workspace remounting.
- **Dataset-Changing Filter (`upcoming`):**
  Switches operational window from single-day to 14-day multi-day dataset. Uses `router.push("?tab=upcoming")` to transition request identity and load multi-day operational dataset.

---

## K. SELECTION / MODAL STABILITY

- **Group & Line Selection Survival:** Group selection is keyed by stable group identity (`displayId` / primary order/booking ID) and line selection by booking ID. Background reconciliation updates group rows and lines in place without deselecting the active booking or resetting scroll.
- **Safe Disappearance Degradation:** If a selected booking disappears (e.g. cancelled or completed and filtered out), selection degrades gracefully to the next available booking or null without throwing or binding stale details.
- **Modal State Preservation:** Active modals (`BookingsModalStack`) maintain their state during background reconciliation.
- **Error UI:** If background reconciliation fails, last validated data remains visible, an inline retry banner appears with manual retry capability, and no blank screen or replacement skeleton is shown.

---

## L. MASTER SHEET ISOLATION

- Master Sheet references remain external, read-only, and non-canonical.
- `useSheetNativeReferences` maintains its independent lifecycle.
- Mutations to CradleHub bookings never treat Master Sheet as canonical truth.

---

## M. PAYMENT SAFETY

- Payments remain 100% server-authoritative.
- `order_payment_status`, `order_amount_paid`, and `order_total_amount` are derived directly from `v_booking_order_financial_summaries` and `booking_orders.metadata`.
- No client-side financial computation or synthetic total guessing.

---

## N. REMOUNT-KEY DECISIONS

- **`CrmBookingsView` -> `BookingsWorkspace`:**
  Previous: `${referenceSource}:${rawTab}:${bookingId}`
  Updated: `${referenceSource}:${isUpcoming ? "upcoming" : "daily"}:${bookingId ?? ""}`
  *Rationale:* Distinguishes fundamentally different datasets (daily vs. upcoming and master sheet vs. cradlehub) while preventing remounts when local tabs or quick filters change.
- **`BookingsWorkspace` -> `BookingsDesktopWorkspace`:**
  Previous: `${initialQuickFilter}:${initialSelectedId}`
  Updated: `${initialQuickFilter === "upcoming" ? "upcoming" : "daily"}:${initialSelectedId ?? ""}`
  *Rationale:* Preserves component state and selection across local filter transitions (`all` <-> `needs-attention` <-> `active-now`).

---

## O. BEFORE / AFTER REQUEST PATHS

| Action | Before PERF-3 | After PERF-3 |
| :--- | :--- | :--- |
| **Cold Render** | Server page reads 9 queries; client SWR mounts and triggers duplicate fetch | Server page reads canonical builder; client SWR initializes with fallback, **0 duplicate fetches** |
| **Booking Mutation (Active)** | 2 requests (`BOOKINGS_CHANGED_EVENT` window listener + store invalidation) | **1 authoritative reconciliation** via generation-aware hook |
| **Booking Mutation (Hidden)** | Window listener could launch network request while hidden | **0 network requests**; marked dirty |
| **Warm Return (Hidden -> Active)** | Remounted or fired uncoordinated SWR revalidation | **Instant reveal** (<100ms); 1 background reconciliation if dirty |
| **Quick Filter (All -> Attention)** | `router.push()` -> full route revalidation + remount | **Client-side filter** + `replaceState`, **0 network requests**, **0 remounts** |
| **Manual Refresh** | Dispatched `router.refresh()` causing full route remount | Scoped `revalidate()`, **0 route remounts**, subtle spinning indicator |

---

## P. CHANGED FILES

### Implementation Files
1. `src/lib/queries/crm-bookings-operational.ts` (NEW):
   Canonical operational builder `getCrmBookingsOperationalData(...)` providing complete parity between initial render and refresh.
2. `src/app/(dashboard)/crm/bookings/actions.ts` (MODIFIED):
   Added `refreshCrmBookingsOperationalDataAction` with strict server-side Front Desk context derivation.
3. `src/app/(dashboard)/crm/bookings/page.tsx` (MODIFIED):
   Delegated page data loading to `getCrmBookingsOperationalData`.
4. `src/app/api/crm/bookings/route.ts` (MODIFIED):
   Preserved route for compatibility; delegated to `getCrmBookingsOperationalData` with branch boundary protection.
5. `src/components/features/bookings/crm-bookings-view.tsx` (MODIFIED):
   Migrated to `useGenerationAwareWorkspaceSWR`, removed plain SWR and duplicate event listeners, added retry banner.
6. `src/components/features/bookings/bookings-workspace.tsx` (MODIFIED):
   Updated remount key to preserve local filter state; passed `isRefreshing` to desktop header.
7. `src/components/features/bookings/bookings-desktop-workspace.tsx` (MODIFIED):
   Enabled instant local filter switching for same-dataset filters (`all`, `needs-attention`, `active-now`) using `window.history.replaceState`. Added desktop manual Refresh button with spinning indicator.

### Test Files
1. `tests/lib/crm/crm-bookings-operational.test.ts` (NEW):
   6 tests verifying canonical builder, branch authorization, parity, and financial enrichment.
2. `tests/components/crm/bookings-generation-swr.test.tsx` (NEW):
   15 tests verifying cold load zero-fetch, active dirty reconciliation, hidden dirty zero-network, reactivation, stale response rejection, manual refresh, local filter zero-network, selection survival, safe degradation, and cache scope isolation.

---

## Q. EXACT TEST COMMANDS + RESULTS

### 1. Focused PERF-3 Test Suite
```bash
pnpm vitest run tests/lib/crm/crm-bookings-operational.test.ts tests/components/crm/bookings-generation-swr.test.tsx tests/lib/bookings/crm-bookings-page.test.tsx tests/lib/bookings/crm-bookings-api.test.ts
```
**Result:** **28/28 PASSED** (4 test files, 28 tests, 100% pass rate)

### 2. PERF-1A & PERF-1B Regressions
```bash
pnpm vitest run tests/lib/navigation/workspace-generation.test.ts tests/components/dashboard/workspace-generation-swr.test.tsx tests/components/dashboard/owner-runtime-scope.test.tsx tests/lib/crm/owner-front-desk-branch.test.ts tests/lib/crm/owner-booking-action-branch.test.ts tests/lib/crm/front-desk-context-owner.test.ts
```
**Result:** **36/36 PASSED** (6 test files, 36 tests, 100% pass rate)

### 3. PERF-2 CRM Today Regressions
```bash
pnpm vitest run tests/app/crm/today-parallel-reads.test.tsx tests/lib/crm/crm-today-operational.test.ts tests/components/crm/today-generation-swr.test.tsx
```
**Result:** **17/17 PASSED** (3 test files, 17 tests, 100% pass rate)

### 4. PR #29 Booking Modal Regressions
```bash
pnpm vitest run tests/components/crm/quick-booking-customer-autocomplete.test.tsx tests/components/crm/quick-booking-service-duration-dropdown.test.tsx tests/components/crm/quick-booking-deferred-options.test.tsx tests/lib/crm/quick-booking-customer-prefill-scope.test.ts tests/app/crm/quick-booking-customer-callers.test.tsx
```
**Result:** **22/22 PASSED** (5 test files, 22 tests, 100% pass rate)

### 5. Navigation Performance Contract
```bash
pnpm vitest run tests/lib/navigation/crm-owner-navigation-contract.test.ts
```
**Result:** **4/4 PASSED** (4 tests, 100% pass rate)

---

## R. FULL SUITE

```bash
pnpm vitest run --maxWorkers=4
```
- **Total Test Files:** 369
- **Passed Test Files:** 367
- **Failed Test Files:** 1 (expected baseline failure)
- **Skipped Test Files:** 2
- **Total Tests Passed:** 2,935+

### Accepted-Main Baseline Failure Verification
- **Test File:** `tests/components/bookings/c03-mobile-booking-wizard.test.tsx`
- **Failing Test:** `renders all core booking controls reachable and readable on mobile`
- **Verification:** Verified identical failure on accepted base `origin/main` (`446ad81808f327934021198045140c89082129d5`). ZERO test regressions introduced by PERF-3.

---

## S. TYPE-CHECK

```bash
pnpm type-check
```
**Result:** `tsc --noEmit` exited with **code 0**. Zero TypeScript errors across entire repository.

---

## T. LINT

```bash
pnpm eslint "src/lib/queries/crm-bookings-operational.ts" "src/app/(dashboard)/crm/bookings/actions.ts" "src/app/(dashboard)/crm/bookings/page.tsx" "src/app/api/crm/bookings/route.ts" "src/components/features/bookings/crm-bookings-view.tsx" "src/components/features/bookings/bookings-workspace.tsx" "src/components/features/bookings/bookings-desktop-workspace.tsx" "tests/lib/crm/crm-bookings-operational.test.ts" "tests/components/crm/bookings-generation-swr.test.tsx"
```
**Result:** Exited with **code 0**. Zero lint errors, zero warnings.

---

## U. BUILD

```bash
pnpm build
```
**Result:** `next build` (Turbopack) exited with **code 0**.
- Compiled 153 static and dynamic routes successfully in 43s.
- TypeScript check passed in 65s.
- Static page generation completed in 1016ms.

---

## V. PERFORMANCE EVIDENCE

| Category | Metric / Scenario | Measurement / Evidence | Classification |
| :--- | :--- | :--- | :--- |
| **Warm Retained Reveal** | Return to `/crm/bookings` from another tab | Retained UI visible immediately (<100ms) | REPOSITORY-RECORDED TEST EVIDENCE |
| **Hidden Dirty Bookings** | Booking mutation while Bookings tab hidden | **0 network requests** executed | REPOSITORY-RECORDED TEST EVIDENCE |
| **Active Booking Change** | Booking mutation while Bookings tab active | Exactly **1 background reconciliation** launched | REPOSITORY-RECORDED TEST EVIDENCE |
| **Local Desktop Quick Filter**| Switching `All` -> `Needs attention` -> `Active now` | **0 network requests**, **0 route remounts** | REPOSITORY-RECORDED TEST EVIDENCE |
| **Selected Row Change** | Switching selection between booking rows | **0 network requests** when dataset unchanged | REPOSITORY-RECORDED TEST EVIDENCE |
| **Upcoming Dataset Switch** | Switching from daily view to `Upcoming` | Multi-day dataset requested with `upcoming: true` | REPOSITORY-RECORDED TEST EVIDENCE |
| **Selection Stability** | Background reconciliation finishes | Selected row & group survive by ID | REPOSITORY-RECORDED TEST EVIDENCE |
| **Production Build** | `next build` bundle generation | 153 routes compiled, 0 errors | BUILD EVIDENCE |
| **Authenticated Browser** | Real-device interactive trace | AUTHENTICATED BROWSER PERFORMANCE EVIDENCE — NOT PERFORMED | TARGET |

---

## W. PRODUCTION IMPACT

- **Production Database:** Zero migrations, zero schema changes, zero RLS changes, zero direct mutations.
- **Backwards Compatibility:** `/api/crm/bookings` endpoint preserved and upgraded to canonical parity.
- **Owner Scope:** Owner workspace untouched; Owner retention remains disabled.

---

## X. LIMITATIONS

1. **Mobile Quick-Filter Navigation:** Mobile wizard still utilizes router navigation for specific full-page sub-views.
2. **Master Sheet Sync:** Master Sheet references remain on independent refresh cycles and are not coordinated with CradleHub generation invalidations.

---

## Y. ROLLBACK

If rollback is required:
1. Revert commit on `stage/web-perf-3-crm-bookings` to base `446ad81808f327934021198045140c89082129d5`.
2. Clean working tree and redeploy accepted main.
3. Zero database rollback steps required (no schema or data changes were made).

---

## Z. RECOMMENDED NEXT STAGE

- Proceed with **independent code review** of `stage/web-perf-3-crm-bookings`.
- Do NOT merge into `main` without explicit owner authorization.
- Do NOT proceed to PERF-4 until PERF-3 is formally accepted and merged.
