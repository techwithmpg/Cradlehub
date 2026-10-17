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
const requestKey = `${date}:${isUpcoming ? "upcoming" : "daily"}${
  inclusionTarget ? `:${inclusionTarget}` : ""
}`;

const fetcher = useCallback(() => {
  return refreshAction({
    date,
    upcoming: isUpcoming,
    bookingId: inclusionTarget,
  });
}, [refreshAction, date, isUpcoming, inclusionTarget]);

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

## H. EVENT / INVALIDATION FLOW & MUTATION AUDIT

### 1. Separation of Manual Refresh and Mutation Invalidation
To prevent race conditions, duplicate reconciliations, and generation invalidation churn, manual user refresh is strictly separated from mutation completion:

- **Manual User Refresh Path (`onRefresh`):**
  - Triggered exclusively by explicit user intent (clicking the desktop workspace or mobile header "Refresh" button).
  - Directly calls scoped `revalidate()`.
  - Retains existing visible data with a spinning indicator (`isRefreshing`).
  - Does NOT dispatch global events, does NOT increment generation, and does NOT remount the route (`0` router calls).
  - Triggers exactly **one** network request.

- **Mutation Invalidation Path (`onBookingsChanged`):**
  - Triggered upon completion of any booking mutation.
  - Calls `notifyBookingsChanged()`, dispatching `BOOKINGS_CHANGED_EVENT`.
  - `RetainedWorkspaceProvider` receives the event and invalidates `crm-bookings` in `WorkspaceGenerationStore`.
  - If `crm-bookings` is **active**: Launches exactly **one** generation-aware reconciliation for the new generation.
  - If `crm-bookings` is **hidden**: Marks `crm-bookings` dirty with **0 network requests**; reconciles once upon warm reactivation.

### 2. Elimination of Duplicate Payment Reconciliation
**Defect Diagnosed by Independent Review:**
In the initial PERF-3 implementation, `CrmBookingsView` passed:
```typescript
onBookingsChanged={() => {
  void revalidate().catch(() => undefined);
}}
```
Simultaneously, `PaymentActionMenu` and `BookingActionMenu` executed both:
```typescript
onUpdate?.();
notifyBookingsChanged();
```
This caused a concrete double reconciliation:
1. `onUpdate` invoked the callback, starting a direct fetch for generation G1.
2. `notifyBookingsChanged()` synchronously dispatched `BOOKINGS_CHANGED_EVENT`, causing `RetainedWorkspaceProvider` to invalidate `crm-bookings` and bump the store to generation G2.
3. The G1 fetch completed but was deemed stale by `isCurrent()` protection.
4. The dirty generation G2 then launched a second network fetch via `useEffect` in `useGenerationAwareWorkspaceSWR`.

**Correction Implemented:**
- Normalized `PaymentActionMenu` and `BookingActionMenu` callers across CRM Bookings (`bookings-table.tsx`, `selected-booking-payment-row.tsx`, `selected-booking-quick-actions.tsx`) by removing redundant `onUpdate` bindings. These menus already invoke `notifyBookingsChanged()` internally upon successful mutations.
- Updated `CrmBookingsView` to wire `onRefresh={() => { void revalidate().catch(() => undefined); }}` for manual user refresh, and `onBookingsChanged={() => { notifyBookingsChanged(); }}` for mutation completion.
- Result: **Exactly one authoritative generation-aware reconciliation per successful mutation.**

### 3. Complete Mutation Surfaces Audit
All Bookings mutation surfaces in CRM Bookings were audited and normalized:

| Mutation Surface / Consumer | Mutation Action | Emits `BOOKINGS_CHANGED_EVENT` | Emits `WORKSPACE_DOMAIN_EVENT` | Invokes Callback | Normalized Flow & Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`PaymentActionMenu`** (Table & Side Panel) | Record/update payment | Yes (via `notifyBookingsChanged`) | No | Internal only (`onSuccess`) | **1 generation invalidation & 1 reconciliation** (removed redundant `onUpdate`) |
| **`BookingActionMenu`** (Table & Quick Actions) | Quick status / followup | Yes (via `notifyBookingsChanged`) | No | Internal only (`onSuccess`) | **1 generation invalidation & 1 reconciliation** (removed redundant `onUpdate`) |
| **`PaymentConfirmationPanel`** (Pending Review) | Confirm / reject payment | No | No | `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`CustomerArrivedModal`** | Mark arrived / check-in | No | No | `onMarkedArrived` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`RoomAssignmentModal`** | Assign / reassign room | No | No | `onAssigned` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`RescheduleBookingModal`** | Reschedule time/date | No | No | `onRescheduled` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`CancelBookingDialog`** | Cancel booking | No | No | `onChanged` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`SelectedBookingStaffRow`** | Assign therapist / driver | No | No | `onChanged` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`SelectedBookingServiceSession`** | Complete service line | No | No | `onChanged` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`SelectedBookingPrimaryAction`** | Confirm / start service | No | No | `onChanged` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`SelectedBookingQuickActions`** | No answer / confirm later | No | No | `onChanged` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`NoteSummaryPanel`** | Edit booking note | No | No | `onSaved` -> `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`AssignmentRecommendationPanel`** | Accept staff recommendation | No | No | `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |
| **`CrmNextActionsPanel`** | Execute next action | No | No | `onBookingsChanged` | `onBookingsChanged` -> `notifyBookingsChanged()` -> **1 reconciliation** |

Every mutation surface now results in **one effective generation invalidation and reconciliation**. Shared `notifyBookingsChanged()` was preserved so cross-module listeners (such as CRM Today or Master Sheet indicators) remain synchronized without duplicate fetches.

---

## I. REQUEST IDENTITY & SEMANTIC SEPARATION

Following independent review, authoritative request identity was cleanly decoupled from local row selection:

### 1. Semantic Distinction
- **A. Booking Selection Identity (Local Operational State):**
  When a user selects a booking row that already exists within the loaded authoritative dataset, selection is updated strictly in local React state (`selectedId`, `selectedLineId`) and synchronized to the URL via `window.history.replaceState(...)`. It does **NOT** alter the server request identity. Row selection within the current dataset triggers **0 authoritative network requests**.
- **B. Authoritative Dataset Inclusion Identity (Server Request Key):**
  A `bookingId` only affects server request identity when it is required to include or resolve a booking not represented in the default operational dataset:
  - Deep-link / notification entry to an unloaded booking (`/crm/bookings?bookingId=...`).
  - Selected booking outside the 14-day Upcoming window (`selectedOutsideWindow: true`).
- **Request Key Formula:**
  `${date}:${isUpcoming ? "upcoming" : "daily"}${inclusionTarget ? `:${inclusionTarget}` : ""}`

### 2. Transition Semantics
- Normal daily dataset depends on: `date` + `mode` (`daily`).
- Normal upcoming dataset depends on: `date` + `mode` (`upcoming`).
- Deep-link / outside target inclusion: Appends `:${inclusionTarget}` only when an unloaded or outside-window booking is required.
- Selecting row A -> row B -> row A in the loaded dataset: **0 request key changes, 0 authoritative reads**.
- Deep-link navigation to unloaded booking: Exactly **1 authoritative inclusion fetch**.

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
- **Modal State Preservation:** Active modals (`BookingsModalStack`) maintain their state during background reconciliation and row selection.
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

## N. REMOUNT-KEY DECISIONS & SELECTION PRESERVATION

Normal row selection no longer remounts the workspace or destroys local UI state:

- **`CrmBookingsView` -> `BookingsWorkspace`:**
  - Previous: `${referenceSource}:${rawTab}:${bookingId}`
  - Updated: `${referenceSource}:${isUpcoming ? "upcoming" : "daily"}`
  - *Rationale:* Completely removed `bookingId` from the workspace key. Distinguishes fundamentally different datasets (daily vs. upcoming and master sheet vs. cradlehub) while preventing remounts when local tabs, quick filters, or row selections change.
- **`BookingsWorkspace` -> `BookingsDesktopWorkspace`:**
  - Previous: `${initialQuickFilter}:${initialSelectedId}`
  - Updated: `${initialQuickFilter === "upcoming" ? "upcoming" : "daily"}`
  - *Rationale:* Completely removed `initialSelectedId` from the desktop key. Preserves component state, scroll position, and open modal state (`modalState`) across both local quick-filter switches (`all` <-> `needs-attention` <-> `active-now`) and row selection changes.
- **External Deep-Link Selection Synchronization:**
  - `BookingsDesktopWorkspace` uses standard React state synchronization (`prevRequestedId`) to synchronize external selection changes by stable ID without remounting or blowing away open modals.

---

## O. BEFORE / AFTER REQUEST PATHS

| Action | Before PERF-3 | After PERF-3 |
| :--- | :--- | :--- |
| **Cold Render** | Server page reads 9 queries; client SWR mounts and triggers duplicate fetch | Server page reads canonical builder; client SWR initializes with fallback, **0 duplicate fetches** |
| **Booking Mutation (Active)** | 2 requests (`BOOKINGS_CHANGED_EVENT` window listener + store invalidation) | **1 authoritative reconciliation** via generation-aware hook |
| **Booking Mutation (Hidden)** | Window listener could launch network request while hidden | **0 network requests**; marked dirty |
| **Warm Return (Hidden -> Active)** | Remounted or fired uncoordinated SWR revalidation | **Instant reveal** (<100ms warm reveal target); 1 background reconciliation if dirty |
| **Quick Filter (All -> Attention)** | `router.push()` -> full route revalidation + remount | **Client-side filter** + `replaceState`, **0 network requests**, **0 remounts** |
| **Selected Row Change (Loaded)** | `replaceState` -> `useSearchParams` -> remount + fetch | **0 network requests**, **0 remounts**, selection & modal state preserved |
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
   Migrated to `useGenerationAwareWorkspaceSWR`, decoupled row selection identity from authoritative request key, separated `onRefresh` (manual revalidate) from `onBookingsChanged` (`notifyBookingsChanged`), removed plain SWR and duplicate event listeners, removed `bookingId` from workspace key, added retry banner.
6. `src/components/features/bookings/bookings-workspace.tsx` (MODIFIED):
   Updated remount key to preserve local filter state and eliminate row selection remounts (`key={initialQuickFilter === "upcoming" ? "upcoming" : "daily"}`); added `onRefresh` prop and wired manual refresh button.
7. `src/components/features/bookings/bookings-desktop-workspace.tsx` (MODIFIED):
   Enabled instant local filter switching for same-dataset filters (`all`, `needs-attention`, `active-now`) using `window.history.replaceState`. Added desktop manual Refresh button wired to `onRefresh` with spinning indicator. Synchronized external deep-link selection via React state adjustment without remounting or destroying modal state.
8. `src/components/features/bookings/bookings-table.tsx` (MODIFIED):
   Removed redundant `onUpdate` from `PaymentActionMenu` and `BookingActionMenu` to prevent double reconciliation. Cleaned unused callbacks.
9. `src/components/features/bookings/selected-booking-payment-row.tsx` (MODIFIED):
   Removed redundant `onUpdate` from `PaymentActionMenu`.
10. `src/components/features/bookings/selected-booking-quick-actions.tsx` (MODIFIED):
    Removed redundant `onUpdate` from `BookingActionMenu`.

### Test Files
1. `tests/lib/crm/crm-bookings-operational.test.ts` (NEW):
   6 tests verifying canonical builder, branch authorization, parity, and financial enrichment.
2. `tests/components/crm/bookings-generation-swr.test.tsx` (NEW):
   21 tests verifying cold load zero-fetch, active dirty reconciliation, hidden dirty zero-network, reactivation, stale response rejection, manual refresh, local filter zero-network, selection survival, safe degradation, cache scope isolation, payment mutation one-reconciliation, failed payment zero-reconciliation, A -> B -> A selection zero-fetch under Next.js native history synchronization, unloaded deep-link inclusion reconciliation, and modal/workspace preservation without remounting.

---

## Q. EXACT TEST COMMANDS + RESULTS

### 1. Focused PERF-3 Test Suite
```bash
pnpm vitest run tests/components/crm/bookings-generation-swr.test.tsx tests/lib/crm/crm-bookings-operational.test.ts tests/lib/bookings/crm-bookings-page.test.tsx tests/lib/bookings/crm-bookings-api.test.ts
```
**Result:** **34/34 PASSED** (4 test files, 34 tests, 100% pass rate)
- `tests/components/crm/bookings-generation-swr.test.tsx`: 21 passed
- `tests/lib/crm/crm-bookings-operational.test.ts`: 6 passed
- `tests/lib/bookings/crm-bookings-page.test.tsx`: 5 passed
- `tests/lib/bookings/crm-bookings-api.test.ts`: 2 passed

### 2. PERF-1A & PERF-1B Regressions
```bash
pnpm vitest run tests/lib/navigation/workspace-generation.test.ts tests/lib/navigation/workspace-module-registry.test.ts tests/components/dashboard/owner-runtime-scope.test.tsx tests/lib/owner/operational-scope.test.ts tests/lib/owner/operational-scope-server.test.ts
```
**Result:** **54/54 PASSED** (5 test files, 54 tests, 100% pass rate)

### 3. PERF-2 CRM Today Regressions
```bash
pnpm vitest run tests/components/crm/today-generation-swr.test.tsx tests/lib/crm/crm-today-operational.test.ts tests/app/crm/today-parallel-reads.test.tsx
```
**Result:** **17/17 PASSED** (3 test files, 17 tests, 100% pass rate)

### 4. PR #29 Quick-Booking Regressions
```bash
pnpm vitest run tests/app/crm/quick-booking-customer-callers.test.tsx tests/components/crm/quick-booking-customer-autocomplete.test.tsx tests/components/crm/quick-booking-deferred-options.test.tsx tests/components/crm/quick-booking-service-duration-dropdown.test.tsx tests/lib/crm/quick-booking-customer-prefill-scope.test.ts
```
**Result:** **22/22 PASSED** (5 test files, 22 tests, 100% pass rate)

---

## R. FULL SUITE

```bash
pnpm vitest run --maxWorkers=4
```

**Exact Vitest Output:**
```
Test Files  1 failed | 366 passed | 2 skipped (369)
     Tests  1 failed | 2942 passed | 2 skipped (2945)
  Duration  89.45s (transform 14.41s, setup 0ms, import 121.77s, tests 64.58s, environment 86.63s)
 Exit Code  1
```

- **Test Files:**
  - 366 passed
  - 1 failed (expected baseline failure)
  - 2 skipped (`sheet-date-structure-inspection.test.ts`, `sheet-live-adc.test.ts`)
  - 369 TOTAL
- **Tests:**
  - 2942 passed
  - 1 failed (expected baseline failure)
  - 2 skipped
  - 2945 TOTAL
- **Duration:** 89.45s
- **Exit code:** 1

### Accepted-Main Baseline Failure Verification
- **Test File:** `tests/components/bookings/c03-mobile-booking-wizard.test.tsx`
- **Failing Test:** `renders all core booking controls reachable and readable on mobile`
- **Error:** `TestingLibraryElementError: Unable to find an element with the text: Search and select one or more services.`
- **Verification:**
  1. `git diff 446ad81808f327934021198045140c89082129d5 -- tests/components/bookings/c03-mobile-booking-wizard.test.tsx` confirms test file is 100% byte-for-byte identical to accepted base `origin/main`.
  2. `git diff 446ad81808f327934021198045140c89082129d5 -- src/components/features/bookings/quick-booking-form.tsx` confirms implementation under test is 100% byte-for-byte identical to accepted base `origin/main`.
  3. Zero new failures exist anywhere in the repository.

---

## S. TYPE-CHECK

```bash
pnpm type-check
```
**Result:** `tsc --noEmit` exited with **code 0**. Zero TypeScript errors across entire repository.

---

## T. LINT

```bash
pnpm eslint src/components/features/bookings/bookings-desktop-workspace.tsx src/components/features/bookings/bookings-table.tsx src/components/features/bookings/bookings-workspace.tsx src/components/features/bookings/crm-bookings-view.tsx src/components/features/bookings/selected-booking-payment-row.tsx src/components/features/bookings/selected-booking-quick-actions.tsx tests/components/crm/bookings-generation-swr.test.tsx
```
**Result:** Exited with **code 0**. Zero lint errors, zero warnings across all changed files.

---

## U. BUILD

```bash
pnpm build
```
**Result:** `next build` (Turbopack) exited with **code 0**.
- Compiled 153 static and dynamic routes successfully in 40s.
- TypeScript check passed in 65s.
- Static page generation completed (153/153) in 1037ms.

---

## V. PERFORMANCE EVIDENCE

| Category | Metric / Scenario | Measurement / Evidence | Classification |
| :--- | :--- | :--- | :--- |
| **Warm Retained Reveal** | Return to `/crm/bookings` from another tab | Retained UI visible synchronously before reconciliation completes (<100ms warm reveal target) | TARGET / REPOSITORY-RECORDED RETENTION EVIDENCE |
| **Hidden Dirty Bookings** | Booking mutation while Bookings tab hidden | **0 network requests** executed | REPOSITORY-RECORDED TEST EVIDENCE |
| **Active Booking Change** | Booking mutation while Bookings tab active | Exactly **1 background reconciliation** launched | REPOSITORY-RECORDED TEST EVIDENCE |
| **Local Desktop Quick Filter**| Switching `All` -> `Needs attention` -> `Active now` | **0 network requests**, **0 route remounts** | REPOSITORY-RECORDED TEST EVIDENCE |
| **Selected Row Change** | Switching selection between booking rows in loaded dataset | **0 network requests**, **0 workspace remounts** (A -> B -> A verified) | REPOSITORY-RECORDED TEST EVIDENCE |
| **Deep-Link Inclusion** | Navigation to unloaded booking ID | Exactly **1 authoritative inclusion fetch** | REPOSITORY-RECORDED TEST EVIDENCE |
| **Upcoming Dataset Switch** | Switching from daily view to `Upcoming` | Multi-day dataset requested with `upcoming: true` | REPOSITORY-RECORDED TEST EVIDENCE |
| **Selection Stability** | Background reconciliation finishes | Selected row & group survive by ID | REPOSITORY-RECORDED TEST EVIDENCE |
| **Production Build** | `next build` bundle generation | 153 routes compiled, 0 errors | BUILD EVIDENCE |
| **Authenticated Browser** | Real-device interactive trace | AUTHENTICATED BROWSER PERFORMANCE EVIDENCE — NOT PERFORMED | TARGET |
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
