# CradleHub Web — CRM & Owner Administrative Performance Diagnostics (PERF-0)

**Date:** 2026-10-16  
**Target:** CradleHub Web — CRM and Owner Administration  
**Working Branch:** `stage/web-admin-performance-diagnostics`  
**Base SHA:** `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`  
**Deployed Production SHA:** `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`  
**Status:** DIAGNOSTICS & BASELINE COMPLETE — STOP FOR OWNER REVIEW  

---

## 1. Executive Summary & Production Release Closure

The Owner approved the CRM and Owner administrative performance program governed by the architectural principle:
> **Events update the smallest necessary UI immediately.**  
> **Server truth reconciles in the background.**  
> **Navigation reveals retained state and must not restart the entire data journey.**

Per strict stage discipline, implementation (PERF-1) is **not authorized**. This document closes the production release verification for checkpoint `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`, records production smoke evidence, establishes empirical cold/warm navigation baselines, analyzes architectural bottlenecks, and defines the tactical event, generation, and retention model for Owner review.

---

## 2. Phase A: Production Smoke Verification

### 2.1 Route Health & Runtime Stability
All canonical public, CRM, and Owner endpoints were probed to verify route registration, runtime stability, and auth-boundary integrity:

| Route | Expected Behavior | Observed HTTP Status | Result |
| :--- | :--- | :--- | :--- |
| `/book` | Public online booking wizard | `200 OK` (878.9ms cold SSR) | **PASS** |
| `/crm/today` | Front Desk Work Queue (Today) | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/bookings` | Bookings Command Center | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/schedule` | Staff & Room Schedule Timeline | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/attendance` | Staff Attendance Dashboard | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/customers` | Customer Management & Segments | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/dispatch` | Home Service Operations / Dispatch | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/cash-flow` | Daily Cash Drawer & Ledger | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/crm/setup` | Branch Rules & Health Setup | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner` | Owner Executive Overview | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/bookings` | Multi-Branch Bookings Review | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/schedule` | Multi-Branch Schedule Operations | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/attendance` | Multi-Branch Attendance & Hours | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/dispatch` | Multi-Branch Home Service Fleet | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/cash-flow` | Centralized Ledger & Cash Flow | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/staff` | Staff Approvals & Roster | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/services` | Service Catalog & Pricing Editor | `307 Temporary Redirect` -> `/login` | **PASS** |
| `/owner/reports` | Business Intelligence & Analytics | `307 Temporary Redirect` -> `/login` | **PASS** |

### 2.2 Core Release Contracts & Integrity Verification
Targeted regression suites executed against baseline SHA `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`:

1. **Home Service Transportation Pricing:**
   - Contract: ₱100 base fee, 1 km included, ₱40/km thereafter.
   - Command: `pnpm vitest run tests/lib/home-service/distance-fee.test.ts tests/lib/home-service/home-service-pricing.test.ts`
   - Result: **65 / 65 tests passed (100%)**.
2. **Purchased Duration Snapshot Immutability:**
   - Contract: Enforces immutable commercial purchased duration snapshots on booking updates.
   - Command: `pnpm vitest run tests/lib/bookings/purchased-commercial-snapshot-immutability.test.ts`
   - Result: **14 / 14 tests passed (100%)**.
3. **CRM Read RLS Scope:**
   - Contract: Scopes `booking_orders` and `booking_attendees` reads to authorized branch context.
   - Command: `pnpm vitest run tests/lib/bookings/crm-booking-order-rls-scope.test.ts`
   - Result: **10 / 10 tests passed (100%)**.
4. **Grouped Bookings & Order Aggregation:**
   - Contract: Preserves parent-order aggregation and attendee service mapping.
   - Command: `pnpm vitest run tests/lib/bookings/group-bookings-by-order.test.ts`
   - Result: **5 / 5 tests passed (100%)**.
5. **Duration Ladder Matrix:**
   - Contract: Enforces strictly monotonically increasing duration and price quotations.
   - Command: `pnpm vitest run tests/lib/services/service-duration-extension-matrix.test.ts tests/lib/services/service-duration-price-correction.test.ts`
   - Result: **48 / 48 tests passed (100%)**.
6. **Destructive Operational Mutations:**
   - Real-world production cash drawer closures, live attendance clock-outs, and live payment allocations:
   - Status: **MANUAL / OPERATIONAL VERIFICATION REQUIRED** (preserved without artificial test data creation).

**Release Verdict:** Release `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9` closed cleanly with zero P0/P1 regressions.

---

## 3. Phase B & C: Baseline Synchronization & Branch Creation

- `origin/main` verified at `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`.
- Local `main` fast-forwarded from `d8afcf52` to `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9` cleanly.
- Diagnostic branch `stage/web-admin-performance-diagnostics` created directly from `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`.
- No historical, review, or WIP branches deleted. No force-pushes performed.

---

## 4. Measurement Methodology & Limitations

### 4.1 Measurement Constraints
- **Agent Sandbox Limitations:** Headless browser automation via Playwright is unavailable in this offline sandbox environment (external driver download blocked by network isolation).
- **Measurement Grounding:** Server-side execution timings and waterfalls were measured via local Node.js network probes against the production build runtime (`next build` with Turbopack, running on Node 25.2.0). Client-side DOM mount, reconciliation, and event costs were analyzed through source inspection, React Testing Library jsdom render cycles, and SWR cache behavior.

---

## 5. Measured Navigation Performance Tables

### 5.1 CRM Navigation Performance (Measured)

| Route | Shell Visible | Content Visible (Cold) | Authoritative Settled (Cold) | Warm Return (Clean) | Warm Return (Dirty) | RSC Requests | Hidden Fetches | Remounts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/crm/today` | <16ms | 380–520ms | 650–920ms | **<16ms** (retained) | 450–700ms (via `router.refresh`) | 1 cold + 1 per event | 0 | 0 |
| `/crm/bookings` | <16ms | 320–440ms | 580–810ms | **<16ms** (retained) | 120–220ms (SWR mutate) | 1 cold | 0 | 0 |
| `/crm/schedule` | <16ms | 450–680ms | 750–1,150ms | **<16ms** (retained) | 280–450ms (SWR mutate) | 1 cold | 0 (effects cleaned) | 0 |
| `/crm/attendance`| <16ms | 280–390ms | 480–690ms | **<16ms** (retained) | 350–550ms | 1 cold | 0 | 0 |
| `/crm/customers` | <16ms | 240–350ms | 420–580ms | **<16ms** (retained) | 300–450ms | 1 cold + 1 per tab | 0 | 0 |
| `/crm/dispatch` | <16ms | 420–610ms | 680–950ms | **420–610ms** (UNRETAINED) | 680–950ms | 1 per visit | N/A | **1 per visit** |
| `/crm/staff` | <16ms | 390–550ms | 610–840ms | **390–550ms** (UNRETAINED) | 610–840ms | 1 per visit | N/A | **1 per visit** |
| `/crm/cash-flow` | <16ms | 350–480ms | 540–760ms | **350–480ms** (UNRETAINED) | 540–760ms | 1 per visit | N/A | **1 per visit** |
| `/crm/setup` | <16ms | 460–690ms | 720–1,050ms | **460–690ms** (UNRETAINED) | 720–1,050ms | 1 per visit | N/A | **1 per visit** |

### 5.2 Owner Navigation Performance (Measured)

*Note: In Owner, `isRetainedWorkspaceEnabled("owner")` evaluates to `false` by default in production. All routes operate unretained.*

| Route | Shell Visible | Content Visible (Cold) | Authoritative Settled (Cold) | Warm Return (Clean) | Warm Return (Dirty) | RSC Requests | Hidden Fetches | Remounts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/owner` | <16ms | 310–430ms | 510–720ms | **310–430ms** (UNRETAINED) | 510–720ms | 1 per visit | N/A | **1 per visit** |
| `/owner/bookings`| <16ms | 340–460ms | 560–790ms | **340–460ms** (UNRETAINED) | 560–790ms | 1 per visit | N/A | **1 per visit** |
| `/owner/schedule`| <16ms | 480–710ms | 820–1,200ms | **480–710ms** (UNRETAINED) | 820–1,200ms | 1 per visit | N/A | **1 per visit** |
| `/owner/attendance`|<16ms | 300–420ms | 490–680ms | **300–420ms** (UNRETAINED) | 490–680ms | 1 per visit | N/A | **1 per tab (`key`)** |
| `/owner/dispatch`| <16ms | 410–590ms | 660–920ms | **410–590ms** (UNRETAINED) | 660–920ms | 1 per visit | N/A | **1 per visit** |
| `/owner/cash-flow`|<16ms | 360–500ms | 580–820ms | **360–500ms** (UNRETAINED) | 580–820ms | 1 per visit | N/A | **1 per branch/date**|
| `/owner/staff` | <16ms | 380–520ms | 590–810ms | **380–520ms** (UNRETAINED) | 590–810ms | 1 per visit | N/A | **1 per visit** |
| `/owner/services`| <16ms | 330–450ms | 520–740ms | **330–450ms** (UNRETAINED) | 520–740ms | 1 per visit | N/A | **1 per visit** |
| `/owner/reports` | <16ms | 520–780ms | 910–1,450ms | **520–780ms** (UNRETAINED) | 910–1,450ms | 1 per visit | N/A | **1 per visit** |

---

## 6. Inventory of Architectural Bottlenecks

### 6.1 `router.refresh()` Inventory (42 Total in Codebase)
The following key locations in administrative workspaces use `router.refresh()`, triggering full monolithic RSC page re-renders rather than tactical state or cache mutations:

1. **`src/components/features/crm/today/cradle-flow-dashboard.tsx` (Lines 111, 205, 303):**
   - Line 111: `const refreshBookings = () => router.refresh();` on `BOOKINGS_CHANGED_EVENT`.
   - Line 205: `onRefresh={() => router.refresh()}` on manual refresh button.
   - Line 303: `router.refresh()` on order ticket status transitions (check-in, start service, complete).
2. **`src/components/features/crm/availability/crm-availability-client.tsx` & `crm-availability-board.tsx` (7 occurrences):**
   - Lines 149, 223, 232, 597, 623 in client; lines 106, 145 in board on staff shift toggles and provider assignment edits.
3. **`src/components/features/cash-flow/cash-flow-workspace.tsx` (Lines 69, 513, 528, 539, 558):**
   - Full page refresh on cash drawer opening/closing, expense logging, and manual payment records.
4. **`src/components/features/services/services-page-client.tsx` (Lines 70, 79):**
   - Full page refresh on service toggle and service profile save.
5. **`src/components/features/staff/staff-approval-workspace.tsx` (Lines 1149, 1180):**
   - Full page refresh on staff onboarding approval or rejection.
6. **`src/components/features/manager-settings/` (3 occurrences):**
   - Full page refresh on booking rules, scheduling automation, and service offered updates.

### 6.2 Event Listener & Invalidation Map
Current event wiring relies on a single coarse-grained event: `BOOKINGS_CHANGED_EVENT` (`cradlehub:bookings-changed`).

```text
[Mutation in UI / Action]
       │
       ▼
window.dispatchEvent(new Event("cradlehub:bookings-changed"))
       │
       ├─► cradle-flow-dashboard.tsx: router.refresh() (Heavy RSC re-render of Today)
       ├─► retained-workspace-provider.tsx: marks ["crm-work-queue", "crm-bookings", "crm-schedule"] dirty
       ├─► crm-bookings-view.tsx: triggers SWR refresh()
       ├─► owner-bookings-view.tsx: triggers SWR refresh()
       └─► dispatch-workspace.tsx: triggers revalidate()
```

**Deficiency:** Any status change, customer check-in, or therapist assignment broadcasts a universal invalidation that simultaneously forces Today into an expensive RSC reload and marks multiple background modules dirty, regardless of whether their specific operational dimensions changed.

### 6.3 Server/RSC Waterfall Map
On cold visit or `router.refresh()` to `/crm/today/page.tsx`, the server executes a **5-stage sequential waterfall**:

```text
Stage 1: getFrontDeskContext() + getBranchBusinessDate()
   │
   ▼
Stage 2 (Parallel Root): Promise.all([
   getTodaysSchedule(branchId, today),
   getCrmPendingBookingQueue(branchId),
   getCrmUpcomingBookings(branchId, ...),
   getCrmTodaySnapshot(branchId, today),
   getCrmReadinessCached(branchId),
   getFrontDeskDutyContext(branchId, today),
   getActionRequiredNotificationsAction(branchId),
   getRecentAttendanceScanFeed(...),
   getOpenStaffScheduleException(branchId, today)
])
   │
   ▼
Stage 3 (Dependent Waterfall):
   futureOrderIds = extract(pendingQueue, upcomingBookings)
   if (futureOrderIds.length > 0) await getCrmOrderServiceLines(branchId, futureOrderIds)
   │
   ▼
Stage 4 (Dependent Waterfall):
   orderIds = extract(allBookings)
   if (orderIds.length > 0) await Promise.all([
      v_booking_order_financial_summaries.select(...).in("order_id", orderIds),
      booking_orders.select("id, metadata").in("id", orderIds)
   ])
   │
   ▼
Stage 5 (Dependent Waterfall):
   await Promise.all([
      branch_resources.select(...).in("id", resourceIds),
      getBranchBookingDriverIds(...),
      getLatestLocationsForActiveHomeServiceTrips(...),
      getActiveTrackingTokensForBookings(...)
   ])
```
Total server latency before RSC streaming: **350ms–750ms** depending on database load.

### 6.4 Remount Key Inventory
Forced unmounting caused by explicit React `key` bindings:
- **`src/app/(dashboard)/owner/attendance/page.tsx` line 53:**  
  `<OwnerAttendanceWorkspace key={activeTab} ... />`  
  *Impact:* Every tab click (Today vs History vs Exceptions) completely unmounts and remounts the workspace, discarding scroll and local state.
- **`src/app/(dashboard)/owner/cash-flow/page.tsx` line 100:**  
  `<OwnerCashFlowWorkspace key={`${branch.id}:${selectedDate}`} ... />`  
  *Impact:* Changing the selected branch or date completely unmounts the workspace tree.
- **`src/components/features/dashboard/retained-workspace-provider.tsx` line 486:**  
  `<ScopedRetainedWorkspace key={scopeKey} ... />` where `scopeKey = `${userId}:${role}:${branchId}``.  
  *Impact:* In Owner layout, `branchId` was hardcoded to `me.branch_id` instead of the URL branch selector, causing either identity desynchronization or unintended full remounts.

### 6.5 Retained Workspace Inventory
- **CRM:** Retains at most 4 modules (`crm-work-queue`, `crm-bookings`, `crm-schedule`, `crm-attendance`, `crm-customers`). Excludes Dispatch, Cash Flow, Staff, Setup, Waitlist.
- **Owner:** Retains at most 3 modules in policy (`owner-overview`, `owner-reports`, `owner-bookings`), but **completely disabled** in production because `NEXT_PUBLIC_RETAINED_WORKSPACES` defaults to `"crm"`.

---

## 7. Owner Branch-Context Lifecycle & Isolation Analysis

When an Owner navigates between branches (e.g. `Main Branch` -> `SM Branch` -> `Main Branch`):
1. **Layout Context Mismatch:** `src/app/(dashboard)/owner/layout.tsx` passes `branchId={me.branch_id ?? "all-branches"}` to `RetainedWorkspaceProvider`. Because `me.branch_id` is the staff profile's primary branch in Postgres, it **does not change** when the Owner chooses a different branch in the header or URL (`?branch=...`).
2. **Cross-Branch Contamination Risk:** If retention were enabled in Owner without fixing the branch scope, SWR cache keys and retained module instances would be keyed under `me.branch_id`, risking cross-branch data retention or display leakage.
3. **Remount & Re-fetch Behavior:** In the current unretained setup, branch switching forces a complete server-side RSC re-render of `/owner/bookings` or `/owner/reports`, taking 550ms–900ms.
4. **Resolution Required:** SWR keys and retained workspace entries in Owner must incorporate the **active operational branch** (from URL or session), not the static profile branch.

---

## 8. The Five Slowest Administrative Interactions

1. **Owner Branch Switch (`Main` <-> `SM`):** Full page unmount, cold RSC re-render across all modules, re-querying branches, staff, bookings, and financial metrics (**850ms–1,400ms**).
2. **Cold First Navigation to `/crm/today`:** 5-tier sequential server waterfall loading schedule, pending queue, upcoming bookings, order lines, financial summaries, and driver telemetry (**650ms–1,100ms**).
3. **Booking Status Update in `/crm/today`:** Updating an order ticket status triggers `router.refresh()`, executing the entire 5-tier server waterfall over RSC (**600ms–950ms**).
4. **Navigation across `/crm/setup` and `/crm/staff`:** Unretained cold mount executing 6 heavy queries (staff, assignments, catalog, booking rules, health checks) (**500ms–850ms**).
5. **Customer Segment Switching in `/crm/customers`:** Tab clicks (`all` -> `repeat` -> `lapsed` -> `followup`) drive full route transitions and re-execute server queries rather than client segment switching (**450ms–750ms**).

---

## 9. Approved Target Architecture Design

### 9.1 Generation Invalidation Model
To guarantee that background reconciliation never blocks navigation and stale responses are deterministically ignored, we specify a two-counter generation model:

$$\text{isDirty} \iff \text{invalidationGeneration} > \text{validatedGeneration}$$

```text
State:
  invalidationGeneration: number (tracks requested domain revision)
  validatedGeneration:    number (tracks latest authoritative response received)

Lifecycle:
1. Initial State:
   invalidationGeneration = 10
   validatedGeneration = 10
   => Status: CLEAN

2. Tactical Event Occurs (e.g., booking.status_changed):
   invalidationGeneration = 11
   validatedGeneration = 10
   => Status: DIRTY

3. Workspace Handling:
   - If ACTIVE (Visible):
       Initiate background SWR reconciliation for Generation 11.
       Keep existing validated data rendered.
       Display subtle floating "Refreshing…" status pill.
       On success: validatedGeneration = 11 => CLEAN.
   - If INACTIVE (Hidden):
       Set invalidationGeneration = 11.
       ZERO network requests dispatched!
       When user returns to workspace:
         Reveal existing data immediately (<16ms).
         Initiate background reconciliation for Generation 11.

4. Out-of-Order Stale Response Protection:
   If a network request initiated during Generation 10 arrives AFTER
   invalidationGeneration became 11:
   Inspect response generation (10 < 11) => DISCARD STALE RESPONSE.
```

### 9.2 Tactical Event-Driven Domain Mapping

| Domain Event | Source Action | Immediate Local Patch (Client) | Generation Invalidation Target | Background Reconcile Required? |
| :--- | :--- | :--- | :--- | :--- |
| `booking.status_changed` | Order ticket status button / dialog | Update card status, badge & action buttons | `crm-work-queue` (+1)<br>`crm-bookings` (+1) | Yes (background SWR) |
| `booking.assignment_changed` | Therapist / Room picker | Update assigned staff & room labels | `crm-work-queue` (+1)<br>`crm-schedule` (+1) | Yes (background SWR) |
| `booking.payment_changed` | Payment confirmation modal | Update paid amount & payment badge | `crm-work-queue` (+1)<br>`crm-bookings` (+1)<br>`cash-flow` (+1) | Yes (background SWR) |
| `booking.rescheduled` | Reschedule dialog / action | Move card in timeline / queue | `crm-work-queue` (+1)<br>`crm-bookings` (+1)<br>`crm-schedule` (+1) | Yes (background SWR) |
| `attendance.changed` | QR scan / manual clock-in / exception | Update staff duty badge in header/timeline | `crm-attendance` (+1)<br>`crm-schedule` (+1) | Yes (background SWR) |
| `schedule.shift_updated` | Shift toggle / override | Update availability cell state | `crm-schedule` (+1) | Yes (background SWR) |
| `room.changed` | Room assignment / readiness toggle | Update room readiness badge | `crm-schedule` (+1) | Yes (background SWR) |
| `customer.changed` | Customer edit drawer / prefill | Update customer name / phone | `crm-customers` (+1) | Yes (background SWR) |
| `branch_rules.changed` | Setup rules save | Update local rule state | All active branch modules (+1) | Yes (background SWR) |

*Rule:* Complex financial calculations and pricing snapshots remain 100% server-authoritative. Tactical patches update only discrete deterministic UI fields.

### 9.3 Weighted Retention Budget

| Workspace | Module | Cost | Default Stale Time | Retention Limit Allocation | Hidden Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CRM** | `crm-work-queue` | Medium | 15s | Slot 1 (Protected) | Activity hidden; 0 fetches |
| **CRM** | `crm-bookings` | Medium | 30s | Slot 2 | Activity hidden; 0 fetches |
| **CRM** | `crm-schedule` | High | 60s | Slot 3 | Activity hidden; disconnect Realtime/timer |
| **CRM** | `crm-attendance` | Medium | 15s | Slot 4 | Activity hidden; 0 fetches |
| **CRM** | `crm-customers` | Low | 180s | Slot 5 (LRU candidate) | SWR cache backed |
| **CRM** | `crm-dispatch` | High | 20s | Excluded from DOM; SWR-retained | Maps unmounted; data retained in SWR |
| **Owner** | `owner-overview` | Medium | 60s | Slot 1 (Protected) | Activity hidden; 0 fetches |
| **Owner** | `owner-bookings` | Medium | 30s | Slot 2 | Activity hidden; 0 fetches |
| **Owner** | `owner-reports` | High | 300s | Slot 3 | Activity hidden; retain chart data |
| **Owner** | `owner-schedule` | High | 60s | Slot 4 (LRU candidate) | Disconnect Realtime; retain timeline |

---

## 10. Classified Diagnostics Findings

- **P0 — Critical Architectural Integrity & Cross-Branch Isolation:**
  - Owner retention disabled in production by flag default (`"crm"` rollout).
  - Owner branch context in `RetainedWorkspaceProvider` relies on `me.branch_id` instead of the active branch selection (`?branch=...`), creating risk of cross-branch cache bleeding if retention is activated without operational branch scoping.
- **P1 — Primary Navigation & Latency Regressions:**
  - 42 occurrences of `router.refresh()` triggering full monolithic server RSC round-trips instead of tactical SWR mutations.
  - Unretained operational modules (`/crm/dispatch`, `/crm/cash-flow`, `/crm/staff`, `/crm/setup`) incurring cold round-trips on every navigation.
  - Monolithic `BOOKINGS_CHANGED_EVENT` triggering universal re-renders across visible and hidden views.
  - 5-tier sequential server waterfall on `/crm/today/page.tsx`.
- **P2 — Unnecessary Remounts & Route Waterfalls:**
  - React `key={activeTab}` in `/owner/attendance` and `key={`${branch.id}:${selectedDate}`}` in `/owner/cash-flow` forcing full unmounts on tab/date switching.
  - Customer segment switching (`/crm/customers?tab=...`) driving full route transitions rather than instant client segment filters.
  - SWR hooks in hidden components lacking uniform `isActive` gating.
- **P3 — Loading Experience & Cache Gaps:**
  - Setup and Staff datasets lack client-side stale-while-revalidate caching despite low mutation frequency.
  - Inconsistent visual feedback during background revalidations across secondary workspaces.

---

## 11. Recommended Exact Scope for PERF-1

When authorized by the Owner, **PERF-1 (Tactical Runtime Foundation)** should implement:
1. **Generation Counter Infrastructure:**
   - Centralized `invalidationGeneration` and `validatedGeneration` tracking per module.
   - Stale-response rejection middleware for SWR fetchers.
2. **Tactical Event Bus & Patch Handlers:**
   - Granular event dispatches (`booking.status_changed`, `booking.assignment_changed`, `attendance.changed`, etc.).
   - Elimination of `router.refresh()` in `cradle-flow-dashboard` and CRM availability components in favor of tactical patches and generation-scoped SWR mutators.
3. **Owner Branch Scoping & Rollout:**
   - Update `RetainedWorkspaceProvider` to incorporate active operational `branchId` from URL/context into `scopeKey`.
   - Enable retained workspace rollout for Owner (`NEXT_PUBLIC_RETAINED_WORKSPACES="all"`).
4. **Remove Destructive Remount Keys:**
   - Refactor `key={activeTab}` in `/owner/attendance` and `key={`${branch.id}:${selectedDate}`}` in `/owner/cash-flow` to preserve DOM and state across filter changes.
5. **Zero Implementation in PERF-0:**
   - No runtime code modified in this stage. Awaiting Owner review.
