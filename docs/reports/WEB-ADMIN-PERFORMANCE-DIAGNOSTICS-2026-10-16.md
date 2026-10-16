# CradleHub Web — CRM & Owner Administrative Performance Diagnostics (PERF-0)

**Date:** 2026-10-16  
**Target:** CradleHub Web — CRM and Owner Administration  
**Working Branch:** `stage/web-admin-performance-diagnostics`  
**Base SHA:** `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`  
**Deployed Production SHA:** `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`  
**Status:** DIAGNOSTICS & BASELINE COMPLETE — STOP FOR OWNER REVIEW  

---

## 1. Executive Summary & Governance Boundaries

The Owner approved the CRM and Owner administrative performance program governed by the architectural principle:
> **Events update the smallest necessary UI immediately.**  
> **Server truth reconciles in the background.**  
> **Navigation reveals retained state and must not restart the entire data journey.**

Per strict stage discipline, implementation (PERF-1) is **not authorized**. This document establishes the empirical baseline, analyzes architectural bottlenecks from static inspection and local runtime measurements, defines the tactical event and generation invalidation model, and presents a phased, gated implementation sequence for Owner review.

---

## 2. Evidence Classification & Release Baseline

To maintain strict truthfulness, evidence is categorized into four distinct tiers:

### A. Deployment Evidence (Repository-Recorded Production Evidence)
- **Production Deployment Target:** Vercel Production Environment
- **Recorded Deployment Status:** `READY` at SHA `7ae8849c127aeeb8154d31fb64cdd10ab0dd9ad9`.
- **Classification:** REPOSITORY-RECORDED PRODUCTION EVIDENCE. No live deployed administrative session or deployment mutation was initiated during this diagnostics pass.

### B. Local Runtime Evidence (Local Production Build Probes)
- **Environment:** Local Next.js 16.2.4 (Turbopack) production build running on Node.js 25.2.0 at `http://localhost:3000`.
- **Public Endpoints:**
  - `/book`: Responded `200 OK` (HTTP request latency: 878.9ms cold SSR).
- **Protected Endpoints (Unauthenticated Boundary Probes):**
  - Probed `/crm/today`, `/crm/bookings`, `/crm/schedule`, `/crm/attendance`, `/crm/customers`, `/crm/dispatch`, `/crm/cash-flow`, `/crm/setup`, `/owner`, `/owner/bookings`, `/owner/schedule`, `/owner/attendance`, `/owner/dispatch`, `/owner/cash-flow`, `/owner/staff`, `/owner/services`, `/owner/reports`.
  - All returned `307 Temporary Redirect` -> `/login` (server response latency: 6.9ms – 49.2ms).
- **Scope Restriction:** An unauthenticated `307 -> /login` proves strictly that the Next.js routing and middleware auth boundary responded without an uncaught server crash. **It does NOT prove that authenticated CRM or Owner operational screens rendered or functioned in deployed production.**

### C. Repository Test Evidence (Automated Quality Gates)
- **Home Service Distance Transportation Pricing:** ₱100 base fee, 1 km included, ₱40/km thereafter.
  - `pnpm vitest run tests/lib/home-service/distance-fee.test.ts tests/lib/home-service/home-service-pricing.test.ts` -> **PASS (65 / 65 tests)**.
- **Purchased Snapshot Immutability:** Enforces immutable commercial snapshots on booking updates.
  - `pnpm vitest run tests/lib/bookings/purchased-commercial-snapshot-immutability.test.ts` -> **PASS (14 / 14 tests)**.
- **CRM Read RLS Scope:** Scopes `booking_orders` and `booking_attendees` reads to authorized branch context.
  - `pnpm vitest run tests/lib/bookings/crm-booking-order-rls-scope.test.ts` -> **PASS (10 / 10 tests)**.
- **Grouped Bookings & Order Aggregation:** Preserves parent-order aggregation and attendee mapping.
  - `pnpm vitest run tests/lib/bookings/group-bookings-by-order.test.ts` -> **PASS (5 / 5 tests)**.
- **Duration Ladder Matrix:** Monotonically increasing quotations and price constraints.
  - `pnpm vitest run tests/lib/services/service-duration-extension-matrix.test.ts tests/lib/services/service-duration-price-correction.test.ts` -> **PASS (48 / 48 tests)**.
- **Type Checking:** `pnpm tsc --noEmit` -> **PASS (0 errors)**.
- **ESLint:** `pnpm eslint` across modified/inspected files -> **PASS (0 warnings/errors)**.

### D. Authenticated Production Browser Evidence
- **Status:** **AUTHENTICATED BROWSER PERFORMANCE MEASUREMENT = NOT COMPLETED**
- **Limitation:** In this offline agent environment, automated browser control (Playwright driver) cannot install due to network isolation. Live operational mutations (real cash drawer closures, live employee attendance scans, destructive payment bookings) are marked **MANUAL / OPERATIONAL VERIFICATION REQUIRED**. Zero artificial records were created.

### Bounded Baseline Release Statement
> **No P0/P1 regression was detected by the completed repository and local runtime checks. Authenticated deployed-production operational smoke was not completed and remains a limitation.**

---

## 3. Performance Timing Classification & Baseline Tables

Every timing figure is explicitly labeled by its measurement source:
- **[LOCAL HTTP MEASURED]:** Network fetch latency against the local production-build HTTP server.
- **[SOURCE-DERIVED ESTIMATE]:** Engineering estimate based on database query depth, serial waterfalls, and payload size.
- **[TARGET]:** Operational SLA target defined by architecture; **not a performance claim**.

*Note: HTTP request timing cannot measure DOM paint, component mount, or perceived visual reveal.*

### 3.1 CRM Navigation Baseline

| Route | Local HTTP Server Probe `[LOCAL HTTP MEASURED]` | Server Query Stages `[REPOSITORY INSPECTED]` | Estimated Content Visible `[SOURCE-DERIVED ESTIMATE]` | Warm Navigation Objective `[TARGET]` | Retention Mode `[REPOSITORY VERIFIED]` | Remount Key Risks `[REPOSITORY INSPECTED]` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/crm/today` | 49.2ms (307) | 5-stage waterfall | 450–750ms cold | <100ms | Retained in policy | 0 |
| `/crm/bookings` | 12.5ms (307) | 3-stage waterfall | 350–550ms cold | <100ms | Retained in policy | 0 |
| `/crm/schedule` | 10.7ms (307) | 2-stage parallel | 500–850ms cold | <100ms | Retained in policy | 0 (Activity cleans effects) |
| `/crm/attendance`| 10.7ms (307) | 2-stage parallel | 300–450ms cold | <100ms | Retained in policy | 0 |
| `/crm/customers` | 9.2ms (307) | 1-stage query | 250–400ms cold | <100ms | Retained in policy | Route-driven `?tab=` |
| `/crm/dispatch` | 38.8ms (307) | 2-stage parallel | 450–700ms cold | <100ms | **UNRETAINED** | Full unmount on nav |
| `/crm/staff` | 7.1ms (307) | 6 parallel heavy | 400–650ms cold | <100ms | **UNRETAINED** | Full unmount on nav |
| `/crm/cash-flow` | 8.1ms (307) | Multi-ledger read | 350–550ms cold | <100ms | **UNRETAINED** | Full unmount on nav |
| `/crm/setup` | 7.2ms (307) | 6 parallel heavy | 500–800ms cold | <100ms | **UNRETAINED** | Full unmount on nav |

### 3.2 Owner Navigation Baseline

*Repository Fact: `isRetainedWorkspaceEnabled("owner")` evaluates to `false` by default in production. All Owner routes are currently unretained.*

| Route | Local HTTP Server Probe `[LOCAL HTTP MEASURED]` | Server Query Depth `[REPOSITORY INSPECTED]` | Estimated Content Visible `[SOURCE-DERIVED ESTIMATE]` | Warm Navigation Objective `[TARGET]` | Retention Mode `[VERIFIED CURRENT STATE]` | Remount Key Risks `[REPOSITORY INSPECTED]` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/owner` | 8.8ms (307) | Multi-branch overview | 350–500ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |
| `/owner/bookings`| 8.4ms (307) | Multi-branch bookings | 350–550ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |
| `/owner/schedule`| 7.3ms (307) | Daily timeline read | 500–850ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |
| `/owner/attendance`|7.3ms (307)| Category/staff rules | 300–450ms cold | <100ms | **DISABLED (Unretained)** | `key={activeTab}` (Remounts on tab) |
| `/owner/dispatch`| 6.9ms (307) | Fleet dispatch query | 450–700ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |
| `/owner/cash-flow`|7.4ms (307) | Central ledger query | 380–600ms cold | <100ms | **DISABLED (Unretained)** | `key={`${branch.id}:${date}`}` |
| `/owner/staff` | 7.6ms (307) | Roster & onboarding | 400–600ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |
| `/owner/services`| 8.2ms (307) | Full service catalog | 350–500ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |
| `/owner/reports` | 7.1ms (307) | Multi-metric rollup | 600–1,100ms cold | <100ms | **DISABLED (Unretained)** | Full unmount on nav |

---

## 4. Repository Inspection Findings (Architecture & Bottlenecks)

### 4.1 `router.refresh()` Inventory (42 Occurrences in Repository)
Inspection reveals routine reliance on Next.js App Router `router.refresh()`, triggering full monolithic React Server Component (RSC) re-evaluations instead of localized state or SWR mutations:

1. **`src/components/features/crm/today/cradle-flow-dashboard.tsx` (3 calls: Lines 111, 205, 303):**
   - Line 111: `const refreshBookings = () => router.refresh();` attached to `BOOKINGS_CHANGED_EVENT`.
   - Line 205: Manual refresh button.
   - Line 303: Order ticket status transitions (check-in, start service, complete).
2. **`src/components/features/crm/availability/crm-availability-client.tsx` & `crm-availability-board.tsx` (7 calls):**
   - Attached to shift toggle, staff presence edits, and therapist assignment adjustments.
3. **`src/components/features/cash-flow/cash-flow-workspace.tsx` (5 calls):**
   - Attached to cash drawer reconciliation, manual entries, and expense recordings.
4. **`src/components/features/services/services-page-client.tsx` (2 calls):**
   - Attached to service active toggle and service profile saves in Owner.
5. **`src/components/features/staff/staff-approval-workspace.tsx` (2 calls):**
   - Attached to staff onboarding approval and rejection in Owner.
6. **`src/components/features/manager-settings/` (3 calls):**
   - Attached to booking rules, scheduling automation, and service offered updates.

### 4.2 Monolithic Event Invalidation Storm
Current administrative event wiring relies almost exclusively on `BOOKINGS_CHANGED_EVENT` (`cradlehub:bookings-changed`):
- When dispatched by any minor change (e.g. attendance flag or single order update), it triggers:
  1. `cradle-flow-dashboard.tsx` -> `router.refresh()` (full RSC re-query of Today).
  2. `retained-workspace-provider.tsx` -> marks `crm-work-queue`, `crm-bookings`, and `crm-schedule` dirty.
  3. `crm-bookings-view.tsx` -> triggers SWR `refresh()`.
  4. `owner-bookings-view.tsx` -> triggers SWR `refresh()`.
  5. `dispatch-workspace.tsx` -> triggers `revalidate()`.
- **Deficiency:** A single localized change triggers multiple simultaneous network round-trips across visible and background modules.

### 4.3 Server Query Dependency Waterfall on `/crm/today`
On initial render or `router.refresh()` of `/crm/today/page.tsx`, the server executes a **5-stage sequential waterfall**:
- **Stage 1:** `getFrontDeskContext()` + `getBranchBusinessDate()`.
- **Stage 2:** Parallel execution of 9 queries (schedule, pending queue, upcoming bookings, today snapshot, readiness cache, duty context, notifications, attendance feed, schedule exceptions).
- **Stage 3:** Extracts `futureOrderIds` from Stage 2 results -> awaits `getCrmOrderServiceLines()`.
- **Stage 4:** Extracts `orderIds` from all accumulated bookings -> awaits `v_booking_order_financial_summaries` and `booking_orders.metadata`.
- **Stage 5:** Extracts `resourceIds` -> awaits `branch_resources`, active drivers, trip locations, and tracking tokens.

### 4.4 Destructive Remount Keys
- **`src/app/(dashboard)/owner/attendance/page.tsx` line 53:**  
  `<OwnerAttendanceWorkspace key={activeTab} ... />`  
  *Impact:* Switching between Today, History, and Exceptions tabs completely unmounts and remounts the workspace DOM, destroying scroll and component state.
- **`src/app/(dashboard)/owner/cash-flow/page.tsx` line 100:**  
  `<OwnerCashFlowWorkspace key={`${branch.id}:${selectedDate}`} ... />`  
  *Impact:* Selecting a branch or date in Owner Cash Flow destroys and remounts the component tree.

### 4.5 Route-Driven Segment Switching & Over-fetching
- **`/crm/customers`:** Tab switches (`all`, `repeat`, `lapsed`, `followup`) navigate the route (`?tab=...`), executing server RSC fetches and re-running `getCrmStats` on every tab click.
- **`/crm/setup` & `/crm/staff`:** Execute 6 heavy relational queries in parallel on every visit (staff, assignments, catalog, booking rules, health checks) without an SWR caching layer.
- **Patterns to Preserve:** Schedule (`ScheduleWorkspaceShell`) and Attendance (`CrmAttendanceWorkspace`) already feature disciplined SWR integration and should serve as architectural reference patterns.

---

## 5. Owner Branch Scope Safety & Retention Analysis

### Verified Current State
- `NEXT_PUBLIC_RETAINED_WORKSPACES` defaults to `"crm"`.
- Owner retained workspaces are **disabled by default in production**.

### Latent Risk & Safety Blocker
- In `src/app/(dashboard)/owner/layout.tsx` (lines 33–38):
  ```tsx
  <RetainedWorkspaceProvider
    workspace="owner"
    userId={ctx.user.id}
    role={me.system_role}
    branchId={me.branch_id ?? "all-branches"}
    enabled={isRetainedWorkspaceEnabled("owner")}
  >
  ```
- `me.branch_id` is the staff profile's primary assigned branch in Postgres. When an Owner selects a different operational branch via URL (`?branch=...`) or header dropdown, `me.branch_id` **remains static**.
- If Owner retention were enabled without fixing this scope, SWR cache keys and retained module instances would be keyed under the profile branch rather than the active operational branch. This creates a severe latent risk of cross-branch retention or displaying stale branch data after switching.
- **Classification:** **P1 — OWNER RETENTION ACTIVATION BLOCKER** *(not a current active production leak, because Owner retention is currently disabled, but an essential blocker before activation)*.

---

## 6. The Five Slowest Administrative Interactions (Source-Derived Estimates)

1. **Owner Operational Branch Switch (`Main` <-> `SM`):** Full layout unmount, cold RSC re-render, re-querying branches, staff, bookings, and financial metrics (**estimated 650–1,200ms**).
2. **Cold First Navigation to `/crm/today`:** 5-tier sequential server waterfall loading schedule, pending queue, upcoming bookings, order lines, financial summaries, and telemetry (**estimated 500–950ms**).
3. **Booking Status Update in `/crm/today`:** Order ticket status change triggers `router.refresh()`, re-executing the entire 5-tier server waterfall over RSC (**estimated 450–800ms**).
4. **Navigation across `/crm/setup` and `/crm/staff`:** Unretained cold mount executing 6 heavy queries (staff, assignments, catalog, booking rules, health checks) (**estimated 400–750ms**).
5. **Customer Segment Switching in `/crm/customers`:** Tab clicks (`all` -> `repeat` -> `lapsed` -> `followup`) drive full route transitions and re-execute server queries rather than client segment switching (**estimated 350–650ms**).

---

## 7. Target Architecture: Generation Invalidation & Event Model

### 7.1 Two-Counter Generation Model
To ensure background reconciliation never blocks navigation and stale responses are deterministically discarded:

$$\text{isDirty} \iff \text{invalidationGeneration} > \text{validatedGeneration}$$

```text
Counters (per module):
  invalidationGeneration: number (incremented when domain changes occur)
  validatedGeneration:    number (tracks latest authoritative response received)

Rules:
1. When a tactical event fires:
   invalidationGeneration++
2. If module is ACTIVE (visible):
   Initiate background SWR reconciliation for invalidationGeneration.
   Keep existing validated data rendered (no skeleton, no blank screen).
   Show subtle "Refreshing…" indicator.
   On success: validatedGeneration = invalidationGeneration.
3. If module is INACTIVE (hidden):
   Increment invalidationGeneration only.
   ZERO network requests dispatched while hidden.
   On reactivate: reveal retained DOM immediately; reconcile in background.
4. Stale Response Rejection:
   If a response returns from generation G where G < invalidationGeneration:
   DISCARD STALE RESPONSE immediately.
```

### 7.2 Tactical Event-Driven Domain Mapping

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

*Rule:* Complex pricing and financial snapshot formulas remain 100% server-authoritative. Tactical patches update only discrete, deterministic UI fields.

### 7.3 Retention Model: Current vs. Proposed
- **CURRENT:** Count-limited retention (CRM limit: 4; Owner limit: 3 defined in policy, but Owner is currently disabled).
- **PROPOSED:** Cost-aware / weighted retention.
  - Conceptual cost model: `low = 1`, `medium = 2`, `high = 3`.
  - Exact memory/slot budgets will not be frozen until authenticated browser memory and heap profiling are conducted under load.

---

## 8. Classified Diagnostics Severity Table

- **P0 — Critical Active Breaches:**
  - *None detected.* (No active cross-branch data leaks observed in repository or local runtime).
- **P1 — Safety Blockers & Primary Latency Drivers:**
  - **OWNER RETENTION ACTIVATION BLOCKER:** Owner layout scopes `RetainedWorkspaceProvider` by `me.branch_id` instead of active operational branch (`?branch=...`). Must be resolved before Owner retention can be safely enabled.
  - **Broad `router.refresh()`:** 42 occurrences triggering monolithic RSC re-renders across Today, Availability, Cash Flow, Staff, and Services.
  - **Monolithic Invalidation Storm:** `BOOKINGS_CHANGED_EVENT` broadcasts universal invalidation across all modules.
  - **Today 5-Stage Waterfall:** Sequential server dependency waterfall on `/crm/today/page.tsx`.
  - **Unretained CRM Workspaces:** Dispatch, Staff, Cash Flow, and Setup incur cold unmount/remount on every visit.
- **P2 — Unnecessary Remounts & Route Waterfalls:**
  - Destructive `key` props: `key={activeTab}` in `/owner/attendance` and `key={`${branch.id}:${selectedDate}`}` in `/owner/cash-flow`.
  - Route-driven customer segment switching (`/crm/customers?tab=...`) driving full server re-queries.
  - Gaps in SWR `isActive` gating in background/hidden components.
- **P3 — Loading Experience & Cache Gaps:**
  - Infrequently changing Setup and Staff datasets lack client-side stale-while-revalidate caching.
  - Inconsistent non-blocking "Refreshing…" feedback across secondary workspaces.

---

## 9. Revised Phased Implementation Sequence

To maintain architectural safety, the performance program is divided into focused, individually reviewed stages:

### PERF-1A — Tactical Runtime Foundation
- **Scope:**
  - Define semantic invalidation event contracts.
  - Implement per-module `invalidationGeneration` and `validatedGeneration` tracking.
  - Establish active vs. hidden workspace lifecycle semantics (0 network requests while hidden).
  - Implement stale-response rejection middleware.
  - Provide scoped SWR integration helpers.
  - Unit and component tests for foundation utilities.
- **Restrictions:**
  - **NO** large module conversions yet.
  - **NO** Owner retention activation.
  - **NO** broad `router.refresh()` removal yet.

### PERF-1B — Owner Branch Scope Safety
- **Scope:**
  - Establish canonical active operational Owner branch identity (incorporating URL/session branch).
  - Scope SWR keys and retained workspace identity to active operational branch.
  - Prove `Main -> SM -> Main` branch-switch isolation through targeted tests.
  - Implement cache purge and scope transition cleanup.
  - Retain server authorization as the sole authority.
- **Restrictions:**
  - **DO NOT** enable Owner retention globally (`NEXT_PUBLIC_RETAINED_WORKSPACES="all"`) until all 8 activation gates pass.

### Mandatory Gates Before Owner Retention Activation:
1. Active operational branch identity proven.
2. `Main -> SM -> Main` branch-switch test suite passing.
3. Zero cross-branch cache reuse verified.
4. Retained DOM branch isolation verified.
5. SWR key isolation verified.
6. Logout / role / branch cleanup verified.
7. Authenticated browser evidence collected.
8. Owner approval recorded.

### PERF-2 — CRM Today Conversion
- **Scope:**
  - Canonical Today data contract.
  - SWR retained lifecycle for Today Work Queue.
  - Eliminate broad `router.refresh()` in `cradle-flow-dashboard.tsx`.
  - Implement tactical booking status and assignment patches.
  - Background reconciliation with subtle "Refreshing…" feedback.
  - Ensure zero blank screens or layout jumps on warm refresh.

### PERF-3 — Bookings
- **Scope:**
  - Remove unnecessary destructive remount keys.
  - Preserve search, filter, selection, and scroll state across transitions.
  - Implement tactical event invalidation for Bookings Command Center.
  - Preserve server-authoritative quotation and financial logic.

### PERF-4+ — Remaining Modules
- Schedule & Attendance tactical updates.
- Home Service Dispatch SWR retention.
- Customer segment client-side tab switching.
- Staff & Cash Flow optimization.
- Owner operational module conversions (Overview, Bookings, Reports).
- Loading UX & dialog prewarming.
- *One independently reviewed checkpoint at a time.*
