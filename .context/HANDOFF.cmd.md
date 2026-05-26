# HANDOFF — CradleHub

> Last updated: 2026-05-26

## Current Phase
FRONTDESK-UI-REDESIGN-001 Phase 2 complete — Availability Board Deep Redesign

## What Just Happened (Availability Board Deep Redesign)
The Live Availability & Check-In Center board was too sparse and wide (Kanban-style tall cards). Three files were completely rewritten into a dense 4-column operations board/table hybrid.

**Files rewritten:**
- `src/components/features/crm/availability/crm-availability-board.tsx` — 4-column fixed-height board (380px with overflow-y:auto): Not Checked In (amber) | Available Now (green) | Busy/Assigned (blue) | Needs Attention (orange). Compact 72px rows with Avatar + name/role/time/booking + StatusChip + CheckinAction. `NeedsAttentionContent` groups by `scheduleStatus` (No Schedule Set vs. Needs Review) with group headers and overflow "+N more" count.
- `src/components/features/crm/availability/crm-availability-summary.tsx` — Replaced `StatCard` (tall 1.75rem values) with compact `MetricChip` components (7px dot + 10px uppercase label + 14px bold value, flex-wrap layout). Chips: Scheduled N/N | Checked In | Available | Busy | Not In | Drivers N/N | Attention (conditional).
- `src/components/features/crm/availability/crm-availability-client.tsx` — Added quick action buttons right of tab bar: ⚠ Schedule Issues (conditional), 🚗 Drivers (conditional), Staff List (conditional), ↺ Refresh (always). Tab bar font tightened (12px/600 active). All four tab panels (live_board, staff_list, schedule_issues, driver_readiness) preserved in behavior.

**What was NOT changed:** Business logic, availability calculations, check-in server actions, schedule logic, dispatch logic, RBAC, query layer, other pages.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
FRONTDESK-UI-REDESIGN-001 Phase 1 complete — Front Desk Pages UI Redesign (Today, Setup, Availability)

## What Just Happened (Front Desk Pages Redesign)
Refactored three CRM front-desk pages so main content is visible above the fold, readiness
warnings are accessible but not dominant, and each page reads like a focused professional tool.

**Shared components created:**
- `src/components/shared/system-readiness-bar.tsx` — compact 36px-tall bar; opens a Sheet panel with full issue details grouped by scope
- `src/components/shared/page-help-disclosure.tsx` — collapsible help section, defaults closed

**Pages changed:**
- `/crm/today` — SystemReadinessBar replaces TodayReadinessStrip; quick actions and KPI strip now appear immediately after the header; TodaySystemMatchStatus removed (info in panel); booking queue + right rail unchanged
- `/crm/setup` — SystemReadinessBar replaces verbose banner + inline ReadinessIssueList; booking flow cards, health cards, workspace tiles, and impact matrix all preserved
- `/crm/availability` — SystemReadinessBar added; CheckInExplainer collapsed into PageHelpDisclosure; StartDayChecklist collapsed into PageHelpDisclosure; 4-tab board moves up; KPI summary unchanged

**Schedule Setup Center (`/crm/staff-availability`) is completely unchanged.**

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
DISPATCH-CENTER-3TAB-001 complete — Build Complete Home-Service Dispatch Center with 3 Tabs

## What Just Happened (Dispatch Center 3-Tab Rebuild)
Redesigned `/crm/dispatch` (shared with `/manager/dispatch`) into a polished
3-tab Home-Service Dispatch Center. The existing `HomeServiceDispatchWorkspace`
component was replaced; page server files are unchanged.

**Files changed (6 new + 1 updated):**

`dispatch-workspace.tsx` (updated):
- Same export interface (`HomeServiceDispatchWorkspace`, `HomeServiceDispatchWorkspaceProps`)
- Tab shell with `flow | map | progress` state
- Always-visible: KPI cards, dispatch alerts (ReadinessIssueList), emergency + related links

`dispatch-summary-cards.tsx` (new):
- 6 KPI cards: Needs Driver, Ready, En Route, In Service, Completed, Alerts
- All counts derived from `DispatchData.items` + `DispatchData.alerts.length`

`dispatch-flow-tab.tsx` (new):
- Left: booking queue — status badge, missing-info badge, payment badge, address/staff snippets
- Right: selected booking panel — dispatch readiness checklist (therapist/driver/address/GPS/payment) + trip timeline + `AssignmentRecommendationPanel` for awaiting-driver items
- Ready bookings: honest note ("trip start handled by driver via Driver Portal")

`dispatch-live-map-tab.tsx` (new):
- Left: active trips (in_route + arrived + service_started) with live status badges and location indicator
- Center: honest map placeholder — no fake map; shows live location snapshot count + missing-coords count + link to fix addresses
- Right: selected trip detail (driver, therapist, address, ETA, timestamps, last location coords)

`dispatch-travel-progress-tab.tsx` (new):
- Desktop: sortable table with progress dots (6 stages: Confirmed/Driver/En Route/Arrived/In Service/Done)
- Mobile: stacked cards with same progress visualization
- Columns: #, Customer, Service, Time, Therapist, Driver, Progress, ETA, Last Update, Status

`dispatch-emergency-actions.tsx` (new):
- 6 emergency link shortcuts to operational pages

`dispatch-related-tools.tsx` (new):
- 6 related tool link cards

**Intentionally unchanged:**
- `dispatch-readiness-utils.ts` — `buildAlertIssues` still in use
- `AssignmentRecommendationPanel` — reused in Tab 1
- `assignBookingDriverAction` / `getDriverRecommendationsAction` — unchanged server actions
- `/crm/dispatch/page.tsx` + `/manager/dispatch/page.tsx` — unchanged
- `/crm/today` dispatch snapshot, `/crm/setup` readiness, `/crm/availability`
- Online booking logic, dispatch actions, DB schema, public /book

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
CRM-READINESS-PHASE9G-2-001 complete — Add Dispatch Missing Readiness Checks

## What Just Happened (Phase 9G-2 — Dispatch Missing Readiness Checks)
Phase 9G-2 — One file changed. No UI changes. No dispatch actions changed. No booking logic changed. No DB schema changed.

**File changed:**

`src/lib/queries/crm-readiness.ts` (updated):
- Added `extractHomeServiceAddress(metadata)` — safe JSONB accessor for `home_service_address` sub-object in booking metadata
- Added `getAssignedDriverNotCheckedInIssue(branchId, today)` — emits `dispatch:assigned-driver-not-checked-in` (critical). Two-query strategy: (1) bookings with driver_id + HS filter + active status → unique driver IDs; (2) staff_shift_checkins for those IDs today → diff gives unchecked-in drivers; returns bookings whose driver is absent.
- Added `getHomeServiceMissingAddressIssue(branchId, today)` — emits `dispatch:home-service-missing-address` (critical). Single query; TypeScript filter on `metadata.home_service_address.full_address` for null/empty.
- Added `getHomeServiceMissingCoordinatesIssue(branchId, today)` — emits `dispatch:home-service-missing-destination-coordinates` (warning). Same query pattern; checks `lat`/`lng` are numeric and non-NaN.
- Added `getDispatchMissingReadinessIssues(branchId, today)` — `Promise.allSettled` coordinator for all three checks; always resolves.
- `getCrmReadinessIssues` now runs 4 source groups in parallel (was 3); Source 4 failure emits `system:failure:dispatch-missing`.

**Check 4 (active HS no driver) deliberately skipped:**
Covered by existing `dispatch:awaiting-driver` from `mapDispatchStatsToReadinessIssues` / `getCrmTodaySnapshot`. Emitting a second ID for the same condition would create duplicate operator noise.

**Query patterns:**
- Home-service detection: `.or("type.eq.home_service,delivery_type.eq.home_service")` (both legacy `type` and newer `delivery_type` fields)
- Active status exclusions: `.neq("status","cancelled").neq("status","completed").neq("status","no_show")`
- All queries: branch-scoped (`branch_id`), date-scoped (`booking_date = today`), column-minimal, `limit(50)` on booking fetches; entity IDs capped at 20

**Intentionally Left Unchanged:**
- All dispatch actions (`src/lib/actions/dispatch*`, `src/components/features/dispatch/*`)
- `src/app/(dashboard)/crm/dispatch/page.tsx`
- `src/app/(dashboard)/crm/layout.tsx`
- All booking logic, availability engine, schedule engine
- No DB schema changed. No public `/book` behavior changed.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Recommended Next Step
**Phase 9G-3** — Payment & Follow-Up Readiness Checks:
- completed booking with unpaid/overdue payment
- pending payment holds close to expiry
- CRM payment confirmation overdue
- booking completed but no payment log

## Previous Phase
CRM-READINESS-PHASE9E-G-001 complete — Migrate CRM Availability Needs-Attention Warnings to Shared Readiness Components

## What Just Happened (Phase 9E-G — CRM Availability Warnings → ReadinessIssueList)
Phase 9E-G — Three files changed. Display-only migration; check-in/check-out actions, availability snapshot query, and all booking logic unchanged.

**Files (commit pending):**

`src/components/features/crm/availability/availability-readiness-utils.ts` (new):
- `buildAvailabilityReadinessIssues(summary: CrmAvailabilitySummary): ReadinessIssue[]` — up to 3 issues: notCheckedIn (daily/warning), needsAttention (schedule/warning), drivers-not-ready (dispatch/warning when driversTotal>0 && driversReady===0)
- `buildNoScheduleStaffIssue(count: number): ReadinessIssue` — for ScheduleIssuesView tab banner

`src/app/(dashboard)/crm/availability/page.tsx` (updated):
- `<ReadinessIssueList compact>` added between CrmAvailabilitySummary and CrmAvailabilityClient
- Built from `buildAvailabilityReadinessIssues(snapshot.summary)` — no extra query
- emptyTitle: "Live availability looks ready" / emptyDescription when no issues

`src/components/features/crm/availability/crm-availability-client.tsx` (minimal — ScheduleIssuesView only):
- Description paragraph → `ReadinessIssueCard compact` (buildNoScheduleStaffIssue)
- Per-staff orange-bordered grid preserved below the card
- Custom empty state → `ReadinessIssueList issues={[]}` with emptyTitle/emptyDescription
- StaffListView, DriverReadinessView, CrmAvailabilityBoard — all untouched

**Intentionally Left Unchanged:**
- CrmAvailabilitySummary stat cards (not warning banners)
- All check-in/check-out buttons and actions
- getCrmAvailabilitySnapshot, crm-availability board columns
- No booking logic changed. No DB schema changed.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
CRM-READINESS-PHASE9E-E-001 complete — Migrate Spaces & Rules Resource Conflicts to Shared Readiness Components

## What Just Happened (Phase 9E-E — Spaces & Rules Conflicts → ReadinessIssueCard)
Phase 9E-E — Three files changed. Display-only migration; no conflict computation, resource/rule editing, or booking logic changed.

**Files (commit pending):**

`src/components/features/spaces-rules/spaces-readiness-utils.ts` (new):
- `mapResourceConflictToReadinessIssue(conflict, index)` — per-conflict mapping; `conflict.description` → `problem` so detail is preserved; severity: missing_assignment=warning, overlap/capacity_overflow=critical
- `buildConflictSummaryIssues(conflicts)` — aggregate: one issue per conflict type with count badge; used in OverviewTab

`src/components/features/spaces-rules/conflicts-tab.tsx` (rewritten):
- Removed `ConflictRow` sub-component and all lucide-react icon imports
- Maps conflicts via `mapResourceConflictToReadinessIssue` → `ReadinessIssueList` (non-compact, full detail visible)

`src/components/features/spaces-rules/overview-tab.tsx` (updated):
- Removed custom amber/red inline alert divs + AlertTriangle, CircleDashed imports
- "Alerts" card body replaced with `ReadinessIssueList compact` fed by `buildConflictSummaryIssues(conflicts)`

**Intentionally Left Unchanged:**
- `computeResourceConflicts()`, `ResourceConflict` type, `computeKpiData()` — all conflict logic preserved
- `SpacesRulesHealthSummary` (pure stat cards — no banner), `SpacesRulesKpiCards`
- `spaces-rules-workspace.tsx`, `spaces-tab.tsx`, `booking-rules-tab.tsx`
- resource/rule editing actions — untouched
- No booking logic changed. No DB schema changed.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
CRM-READINESS-PHASE9E-C-001 complete — Migrate Schedule Setup Warnings to Shared Readiness Components

## What Just Happened (Phase 9E-C — Schedule Setup Warnings → ReadinessIssueCard)
Phase 9E-C — Three files changed. Display-only migration; no schedule save logic, manual import, or booking logic changed.

**Files (commit pending):**

`src/components/features/staff-schedule/schedule-readiness-utils.ts` (new):
- 5 pure helper functions returning `ReadinessIssue`: `buildMissingScheduleIssue`, `buildNoGroupOrIndividualIssue`, `buildNoActiveScheduleIssue`, `buildNoOpeningShiftIssue`, `buildOnLeaveTodayIssue`
- No React. No server-only APIs. Works in both server and client component contexts.

`src/components/features/staff-schedule/schedule-coverage-issues.tsx` (updated):
- Removed `IssueSection` sub-component (hand-rolled title/badge/description header)
- Each coverage section now uses `ReadinessIssueCard compact` from the helper + `StaffGrid` of `IssueCard`s below
- Issue order: critical (noGroupOrIndividual) → warning (noSchedule) → warning (noOpeningToday) → info (onLeaveToday)
- Empty state updated to `ReadinessIssueList issues={[]} emptyTitle/emptyDescription`

`src/components/features/staff-schedule/schedule-setup-health-summary.tsx` (updated):
- Replaced ⚠️ banner div with `<ReadinessIssueCard issue={buildMissingScheduleIssue(stats.missingSchedule)} />` (full mode — shows problem/impact/fix with "View Coverage Issues" action)
- Stat cards grid unchanged

**Intentionally Left Unchanged:**
- All data computation (noSchedule, noGroupOrIndividual, noOpeningToday, onLeaveToday filters)
- Per-staff `IssueCard` detail grids
- `ManualScheduleImport` wizard and `applyManualScheduleImportAction`
- `ScheduleSetupWorkspace`, `ScheduleSetupExplainer`, `ScheduleRelatedTools`
- No booking logic changed. No DB schema changed.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
CRM-READINESS-PHASE9E-B-001 complete — Migrate CRM Services Provider Warnings to ReadinessIssueCard

## What Just Happened (Phase 9E-B — CRM Services Provider Warnings → ReadinessIssueCard)
Phase 9E-B — Two files changed. Display-only migration; no assignment logic, booking logic, or DB schema changed.

**Files (commit pending):**

`src/components/features/crm/services/crm-service-therapist-panel.tsx` (updated):
- Added `ReadinessIssueList` import + `ReadinessIssue` type import
- Exported `createNoProviderReadinessIssue(row: ServiceRow): ReadinessIssue | null` — produces a `critical` issue for public services with no valid providers, `warning` for non-public/internal ones
- Replaced hand-rolled aggregate banner div (with criticalCount/warningCount inline text) with `<ReadinessIssueList issues={providerIssues} compact />` — one card per affected service

`src/components/features/crm/services/provider-assignment-card.tsx` (updated):
- Added `ReadinessIssueCard` import + `ReadinessIssue` type import
- Added local `buildNoProviderIssue(row: ServiceRow): ReadinessIssue | null` (self-contained; mirrors `createNoProviderReadinessIssue` but lives in the "use client" file to avoid cross-boundary import issues)
- Computes `noProviderIssue` in component body
- Replaced ⛔/⚠️ italic text block in the else branch of the assigned-providers conditional with `<ReadinessIssueCard issue={noProviderIssue} compact />`

**Intentionally Left Unchanged:**
- Assign Provider dropdown, ProviderChip remove buttons, StatusMessage, router.refresh(), server action calls, last-provider protection
- /crm/today ReadinessStrip, /crm/setup ReadinessIssueList — unaffected
- No booking logic changed. No DB schema changed.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Previous Phase
CRM-READINESS-PHASE9E-A-001 complete — Add Compact System Readiness Strip to /crm/today

## What Just Happened (Phase 9E-A — Compact Readiness Strip on /crm/today)
Phase 9E-A — Second UI integration. Two files changed.

**Files (commit b5a7679):**

`src/components/features/crm/today/today-readiness-strip.tsx` (new):
- Server component; `{ readiness: ReadinessResult | null }`
- Header row: "System Readiness" + status badge (⛔ Critical / ⚠️ Warning / ✅ All Clear) + count summary + "View all issues ›" → /crm/setup
- Body: `ReadinessIssueList compact maxItems={3}` — top 3 critical-first issues; each card shows severity badge, scope badge, title, action link
- Null fallback: soft card + "Open Rules & Setup ›" link

`src/app/(dashboard)/crm/today/page.tsx` (updated):
- `getCrmReadiness(branchId).catch(() => null)` added to existing `Promise.all` (4th slot) — no extra waterfall
- `TodayReadinessStrip` placed after `TodayWorkflowStrip`, before "Serve Customers" section

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Current Phase
CRM-READINESS-PHASE9D-001 complete — Wire /crm/setup to Shared ReadinessIssueList

## What Just Happened (Phase 9D — Wire /crm/setup to Shared ReadinessIssueList)
Phase 9D — First UI migration. Only `src/app/(dashboard)/crm/setup/page.tsx` changed.

**Changes (commit d3aaf73):**
- `getCrmReadiness(branchId)` and `getCrmSetupHealth(branchId)` now run in parallel via `Promise.all`. getCrmReadiness uses `.catch(() => null)` so a readiness source failure never crashes health-card rendering.
- **Summary banner** now uses `readiness.issues` counts (full operational picture: setup + availability + dispatch + payment) with health.issues as fallback. New **overall status badge** (Critical / Warning / OK) derived from `readiness.status`.
- **Issues section** renamed "Readiness Issues" and now renders `ReadinessIssueList` with `readiness.issues`. Shows severity badge, scope badge, problem, impact, fix, and action link per issue. Falls back to a safe text message if readiness is null.
- `CrmSetupHealthCards` unchanged — still powered by `getCrmSetupHealth`.
- `CrmSetupIssuesList` not deleted — just no longer rendered on `/crm/setup`.
- No other CRM pages touched. No booking logic changed. No DB schema changed.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Current Phase
CRM-READINESS-PHASE9C-001 complete — CRM Operations Readiness Aggregator

## What Just Happened (Phase 9C — CRM Operations Readiness Aggregator)
Phase 9C — Central query aggregator. No CRM pages touched.

**File created (commit 10a8062):**

`src/lib/queries/crm-readiness.ts` — exports:
- `getCrmReadinessIssues(branchId: string): Promise<ReadinessIssue[]>` — main aggregator
- `getCrmReadiness(branchId: string): Promise<ReadinessResult>` — convenience wrapper

**Sources aggregated (Promise.allSettled — never throws):**
1. `getCrmSetupHealth(branchId)` → maps 6 SetupIssue types: no-schedule, no-staff-for-service, no-drivers, no-resources, default-rules, unassigned-bookings
2. `getCrmTodaySnapshot({branchId, date})` → maps availability (3 issue types), dispatch (1), payment (1). Today snapshot internally calls getCrmAvailabilitySnapshot, so no redundant second call.

**Issue IDs emitted (11 types + system:failure:* on source error):**
- setup:no-schedule / setup:no-staff-for-service / setup:no-drivers / setup:no-resources / setup:default-rules / setup:unassigned-bookings
- availability:not-checked-in / availability:needs-attention / availability:drivers-not-ready
- dispatch:awaiting-driver / payment:unpaid-bookings

**Internal helpers:** mapSetupIssuesToReadinessIssues, mapStaffReadinessToReadinessIssues, mapDispatchStatsToReadinessIssues, mapPaymentSummaryToReadinessIssues, dedupeReadinessIssues, createSourceFailureIssue

**Deferred to Phase 9E:** service provider public/non-public distinction (needs staff_type filtering), resource conflict detection, schedule coverage detail, 14 missing checks from audit Section E.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Current Phase
CRM-READINESS-PHASE9B-001 complete — Shared Operations Readiness Types & Components

## What Just Happened (Phase 9B — Shared Operations Readiness Types & Components)
Phase 9B — Foundation layer for the unified readiness engine. No CRM pages touched.

**Files created (commit dbdef68):**

1. **`src/types/readiness.ts`**: Canonical types:
   - `ReadinessSeverity` ("critical" | "warning" | "info" | "success")
   - `ReadinessScope` (8 domains: setup/schedule/daily/service/space/dispatch/payment/system)
   - `ReadinessStatus` ("ok" | "warning" | "critical")
   - `ReadinessIssue` — superset of all 7 legacy warning shapes with: id, scope, severity, title, problem, impact, fix, actionLabel, actionHref, source, entityType?, entityIds?, count?
   - `ReadinessResult` — { issues, status }
   - `ReadinessHealthMetric` — (id, label, value, description?, status?, href?)
   - Helpers: `getReadinessStatusFromIssues()`, `sortReadinessIssues()`, `buildReadinessResult()`
   - `READINESS_SCOPE_META` — icon/label map for all 8 scopes

2. **`src/components/shared/readiness-issue-card.tsx`**: Server component. Severity badge + icon, scope badge, count badge, title, problem, impact, fix, action Link. Compact mode hides detail rows.

3. **`src/components/shared/readiness-issue-list.tsx`**: Server component. Sorted list (critical first), green empty-state, optional section header with count badge, maxItems cap with hidden-count footer.

4. **`src/components/shared/readiness-health-grid.tsx`**: Server component. Responsive grid (2/3/4 col) of metric cards; critical/warning/ok/neutral status colours; optional drill-down Link per card.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (85/85 routes)

## Current Phase
CRM-READINESS-PHASE9A-001 complete — Operations Readiness Audit

## What Just Happened (Phase 9A — Operations Readiness Audit)
Phase 9A — Full codebase audit of readiness, health, warning, issue, and notification logic.
Audit document produced at `docs/CRM_READINESS_AUDIT.md`. No source code changed.

**Key findings:**

1. **7 divergent severity/issue type systems** — `ActionableWarning` (`src/types/warnings.ts`),
   `SetupIssue` (crm-setup.ts), `OperationalWarning` (ops-warnings.ts), `TodayAlert`
   (manager-today-utils.ts), `DispatchAlert` (dispatch/types.ts), `ManagerSettingsWarning`
   (manager-settings/types.ts), `ScheduleHealthIssue` (scheduling/types.ts). All cover the
   same concept (what/why/fix) but are incompatible shapes.

2. **Best existing shared type:** `ActionableWarning` in `src/types/warnings.ts` —
   has id, severity, title, description, impact, actionLabel, target (multi-type routing).
   Already has `ActionableWarning` + `ActionableWarningList` shared components and 30+
   `warningTargets.*` factories. Should become the standard.

3. **Best existing query:** `getCrmSetupHealth(branchId)` in `src/lib/queries/crm-setup.ts` —
   8 parallel DB queries, derives 6 issues across 4 domains. The model for the future engine.

4. **8 duplicate checks found:**
   - Staff no schedule: crm-setup.ts + schedule-coverage-issues.tsx + crm-availability.ts
   - Service no provider: crm-setup.ts + crm-service-therapist-panel.tsx
   - No drivers: crm-setup.ts + setup-warnings.ts (DB notification)
   - Unassigned bookings: crm-setup.ts + manager-today-utils.ts + TodayPriorityStrip
   - Missing room: spaces-rules-utils.ts + manager-today-utils.ts
   - Home service not set up: crm-setup.ts + setup-warnings.ts
   - Not checked in: crm-availability.ts + TodayPriorityStrip + CrmAvailabilitySummary
   - Action item count: TodayAttentionStrip + ActionRequiredList (near-identical components)

5. **14 missing checks identified** (see audit doc Section E for full list with severity/links):
   E-1: Home-service service has no capable therapist assigned
   E-2: Home service enabled but no eligible branch services
   E-5: Driver assigned to trip but not checked in
   E-7: No opening-shift staff for today
   E-8: Home-service booking has no customer address/coordinates
   E-9: Payment overdue for completed booking (no CRM action)
   ... and 8 more (see audit doc)

6. **Proposed `ReadinessIssue` type** — superset of all existing shapes with scope, severity,
   title, problem, impact, fix, actionLabel, actionHref, source, entityType, entityIds, count.

7. **Proposed 7-phase plan:** 9B (shared types+components) → 9C (aggregator query) →
   9D (replace duplicate displays) → 9E (add missing checks) → 9F (global sidebar strip) →
   9G (extend to manager workspace).

## Current Phase
CRM-AVAILABILITY-PHASE7-001 complete — Live Availability & Check-In Center

## What Just Happened (Phase 7 — Live Availability & Check-In Center)
Phase 7 — /crm/availability upgraded into "Live Availability & Check-In Center":

1. **`checkin-explainer.tsx`**: 3 cards (In-House Operations / amber, Online Booking / blue, Home Service / green) explaining each booking flow's relationship to check-in. Cross-links to Schedule Setup and Spaces & Rules. Architecture note banner: "Online booking follows saved schedules and branch booking rules — not daily staff check-in."
2. **`start-day-checklist.tsx`**: 5-step morning checklist (check in arrivals → review missing → confirm drivers → check schedule issues → open Today). Steps link to Schedule Setup Center and Daily Operations Center.
3. **`live-availability-impact-card.tsx`**: "What This Affects" — 4 rows mapping check-in status to booking flows. Online booking = unaffected (no "Uses check-in" badge). In-house and Home-service = tagged "Uses check-in". Staff readiness = feeds Today.
4. **`availability-related-tools.tsx`**: 6 footer links — Daily Operations Center, Schedule Setup, Dispatch, Services & Therapist Setup, Spaces & Booking Rules, Rules & Setup Center.
5. **`page.tsx` updated**: New title + description, renders `CheckInExplainer` → `CrmAvailabilitySummary` → `CrmAvailabilityClient` → `StartDayChecklist` → `LiveAvailabilityImpactCard` → `AvailabilityRelatedTools`. Old inline awareness notice removed (explainer covers it).
6. **Preserved unchanged**: `CrmAvailabilitySummary` (7 stat cards), `CrmAvailabilityClient` (4-tab workspace: Live Board, Staff List, Schedule Issues, Driver Readiness), all check-in/check-out server actions.

## Current Phase
CRM-SCHEDULE-PHASE5B-001 complete — 2026 Manual Schedule Import

## What Just Happened (Phase 5B — 2026 Manual Schedule Import)
Phase 5B — "Current Manual Schedule Setup" collapsible wizard added to /crm/staff-availability:

1. **`manual-schedule-2026.ts`**: Paper schedule constants (ALL CAPS names, no IDs). Three maps: `MANUAL_DAY_OFF_2026`, `MANUAL_SALON_DAY_OFF_2026`, `MANUAL_OPENING_2026`. Helpers: `getAllPaperNames()`, `getNameScheduleSummary()`, `detectOpeningOffConflicts()`.
2. **`actions.ts`** (new route-level file): `applyManualScheduleImportAction` — CRM role guard (`owner/manager/assistant_manager/store_manager/crm/csr_head`), branch scope, staff ID verification, batch upsert to `staff_schedules` (7 rows per staff: off=`is_active:false/single`, opening=`is_active:true/opening`, regular=`is_active:true/single`). Revalidates `/crm/*` and `/book`.
3. **`ManualScheduleImport`** client component: 3-tab wizard:
   - **Preview**: Shows paper schedule in formatted cards per group
   - **Match Names**: Auto-matches by `full_name`/`nickname`/first-name; CRM resolves ambiguous/unmatched via dropdown; can skip any name; summary pills show counts
   - **Times & Apply**: Regular/opening shift time inputs (defaults: 10:00–22:00 / 09:00–21:30); conflict detection; readiness check; inline result feedback
4. **Page updated**: `ManualScheduleImport` placed between health summary and workspace, staff list derived from already-fetched items (no extra query).

## What Just Happened (Phase 6 — Spaces & Booking Rules Center)
Phase 6 — /crm/spaces-rules upgraded into "Spaces & Booking Rules Center":

1. **Permission extension** (`resources-actions.ts`): `requireOwnerOrManager` now includes `crm` and `csr_head` with branch-scope check — consistent with `requireOwnerOrBranchManager` pattern in `branches/actions.ts`. All three resource mutations also revalidate `/crm/spaces-rules`.
2. **CRM resource management enabled**: `canManageResources={true}` — CRM can add/edit/toggle rooms and resources. Server action validates role + branch_id.
3. **Booking rules kept read-only for CRM**: `canEditRules={false}` — booking rules control online booking time windows, home-service availability, and advance-booking limits. These settings directly affect live online booking; tightening to manager/owner only is the safe choice (documented here).
4. **Booking Rules tab now visible for CRM**: Changed `canViewBookingRules` and `showActiveRulesKpi` from `workspaceContext !== "crm"` to `true` so CRM can see (but not edit) the active rules.
5. **SpacesRulesExplainer** (`spaces-rules-explainer.tsx`): 3 cards for In-Spa, In-House/Walk-In, and Home-Service — explains what each booking flow uses and how spaces/rules affect them. Architecture note banner.
6. **SpacesRulesHealthSummary** (`spaces-rules-health-summary.tsx`): 8 stat cards from already-fetched `ResourceRow[]` + `BranchBookingRules` — no extra queries.
7. **SpacesRulesAccessNotice** (`spaces-rules-access-notice.tsx`): Clear can/cannot two-column notice for CRM scope.
8. **SpacesRulesRelatedTools** (`spaces-rules-related-tools.tsx`): Footer links to Today, Live Availability, Services, Schedule Setup, Rules & Setup.
9. **Page title** → "Spaces & Booking Rules Center" with `PageHeader`, description updated.

## What Just Happened (Phase 5 — Schedule Setup Center)
Phase 5 — /crm/staff-availability upgraded into "Schedule Setup Center":

1. **ScheduleSetupExplainer** (`schedule-setup-explainer.tsx`): 3-card explanation of each schedule layer (Weekly Schedule → affects online booking, Overrides/Blocked Time → blocks specific slots, Live Check-In → in-house only). Architecture note banner: "Online booking follows saved schedules and blocked time — not daily staff check-in."
2. **ScheduleSetupHealthSummary** (`schedule-setup-health-summary.tsx`): 6 stat cards (Active Staff, With Schedule, Missing Schedule, Schedule Groups, Overrides This Week, Blocked Time This Week) computed from already-fetched `StaffScheduleItem[]` — no new query. Warning banner when any staff have no individual schedule, pointing to Coverage Issues tab.
3. **ScheduleRelatedTools** (`schedule-related-tools.tsx`): Footer link cards to Live Availability, Daily Operations Center, and Services & Therapist Setup.
4. **Page title**: "Schedule Setup" → "Schedule Setup Center", description updated to mention online booking + in-house + home-service.
5. **ScheduleSetupWorkspace** (4-tab editor) preserved exactly as-is.

## What Just Happened (Phase 4B — CRM Provider Assignment Management)
Phase 4B — CRM can now assign/remove service providers from /crm/services:

1. **Server actions** (`src/app/(dashboard)/crm/services/actions.ts`):
   - `assignProviderToServiceAction`: validates role → branch → service-active → staff-eligible → no-duplicate → inserts staff_services
   - `removeProviderFromServiceAction`: same guards + **last-provider protection** (blocks removal if it would leave a public active service with 0 valid providers)
2. **ProviderAssignmentCard** (client): per-service interactive row — assign dropdown (pre-filtered to valid/unassigned providers only), provider chips with ✕ remove buttons, inline status feedback
3. **ServiceRow shared type** in `types.ts` — used by both server panel and client card
4. **Panel refactored** from client to server/client split — server computes `ServiceRow[]` including `assignableProviders`, delegates interactivity to client cards
5. **MVP access notice** added to panel — explains temporary CRM permission and what types are excluded

## What Just Happened (Phase 4 — Services & Therapist Setup)
Phase 4 of CRM improvement — /crm/services upgraded into "Services & Therapist Setup":

1. **Title** changed to "Services & Therapist Setup" (icon: ✨)
2. **Section 1 — Active Services**: existing `ServicesOfferedTab` retained unchanged — manages active/in-spa/home-service flags, price overrides, visibility, adding/removing services
3. **Section 2 — Provider Assignments** (new): `CrmServiceTherapistPanel` shows per-service:
   - In-spa / Home / Visibility eligibility pills
   - Assigned provider chips (staff name + staff_type badge)
   - ⛔ critical banner for **public services with 0 valid providers** (online booking fails to show therapists)
   - ⚠️ warning for non-public services with 0 providers
   - "How provider matching works" footnote — explains `SERVICE_STAFF_TYPES` rule and hard-excluded roles
4. **New query**: `getBranchStaffAndServiceAssignments(branchId, serviceIds)` — parallel fetch of active branch staff + staff_services rows
5. **Architecture rule enforced** (display only): only `SERVICE_STAFF_TYPES` (therapist, nail_tech, aesthetician, salon_head) count as valid providers; driver and utility are hard-excluded regardless of staff_services entries

## Key Files Added (Phase 4)
- `src/lib/queries/crm-services.ts`
- `src/components/features/crm/services/crm-service-therapist-panel.tsx`

## Key Files Modified (Phase 4)
- `src/app/(dashboard)/crm/services/page.tsx`

## Phase 3 Summary (retained for context)
Phase 3 — /crm/setup into Rules & Setup Center (commit c9c3fe0):
- `src/components/features/crm/setup/crm-booking-flow-rules.tsx` (new)
- `src/components/features/crm/setup/crm-booking-impact-matrix.tsx` (new)
- `src/app/(dashboard)/crm/setup/page.tsx` (title + sections)
- `src/components/features/crm/setup/crm-setup-workspace-tiles.tsx` (updated tiles)

## Architecture Rule (carry forward)
Online booking remains strictly schedule-based.
CRM/in-house booking can use daily staff check-in and live resource readiness.
Home-service booking keeps its dispatch/location workflow.
All three flows share the scheduling/availability engine but apply it differently based on booking context.

## Known Limitations (carried forward)
1. **Group schedule shift_type in Live Availability:** getCrmAvailabilitySnapshot populates shifts[] only from individual staff_schedules. Staff with group rules but no individual row get shift_type "single" for check-in.
2. **Recommendation engine workload caps:** max_services_per_day / max_trips_per_day fetched but not used in scoring.
3. **Driver ETA scoring:** Geographic proximity / travel time not factored into driver recommendations.
4. **CRM provider assignment is MVP-broad:** CRM setup roles can manage assignments for immediate operational use. Tighten to manager/owner-only once stable (HANDOFF note, not a bug).
5. **staff_services has no branch_id column:** Assignments are global to the staff/service relationship, not branch-scoped. This matches the existing system design — staff_type and branch_id on the staff table provide indirect branch scoping.

## Production Readiness
- Public booking: ✅ Ready
- CRM schedule setup: ✅ Ready
- Live availability: ✅ Ready (explainer + checklist + impact card + related tools; group shift_type gap is minor)
- CRM bookings: ✅ Ready
- Dispatch: ✅ Ready
- Staff portal: ✅ Ready
- CRM Setup Center (Rules & Setup): ✅ Ready
- CRM Today (Daily Operations Center): ✅ Ready
- CRM Services & Therapist Setup: ✅ Ready (editable provider assignments with guardrails)
- CRM Schedule Setup Center: ✅ Ready (explainer cards + health summary + workspace + related tools)
- CRM Spaces & Booking Rules Center: ✅ Ready (resource editing enabled, booking rules read-only for CRM)
- CRM Live Availability & Check-In Center: ✅ Ready (check-in explainer + health summary + 4-tab board + checklist + impact card + related tools)

## Known Limitations (updated Phase 7)
6. **CRM cannot edit booking rules**: `updateBranchBookingRules` in `branch-booking-rules.ts` gates on `manager/assistant_manager/store_manager/owner`. Booking rules control online booking time windows, home-service enable/disable, and advance-booking limits — higher risk than resource toggling. Keep manager/owner-only. If operational need arises, add `crm` to `canManageBranchRules` and revalidate booking paths.

## Build Status
- `npx tsc --noEmit`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing (85/85 routes)

## Recommended Next Step
**Phase 9E-F** — Migrate /crm/dispatch warnings to ReadinessIssueCard / ReadinessIssueList:
- Home-service dispatch warnings (no driver assigned, driver not checked in, location issues) use hand-rolled inline UI
- Replace those with shared readiness components
- No dispatch logic or booking logic changed

**Phase 9F** — Global CRM readiness badge in sidebar or header:
- `CrmAvailabilitySummary` and the Live Board tab in `CrmAvailabilityClient` use hand-rolled warning banners for staff not checked in, needing attention, and drivers not ready
- Replace those banners with `ReadinessIssueCard` / `ReadinessIssueList` from the shared library
- No new DB queries needed — availability data is already fetched

**Phase 9F** (after 9E-D) — Global CRM readiness badge in sidebar or header:
- Small count badge showing critical+warning issues across all domains
- Clicking navigates to /crm/setup for the full list
- Requires the sidebar or layout component to call getCrmReadiness

**Phase 9E** (after 9D) — Add 14 missing checks + service provider public/non-public distinction:
- Extend `getCrmReadiness` to add the missing checks from docs/CRM_READINESS_AUDIT.md Section E
- Service provider check: query branch_services + staff_services filtered by SERVICE_STAFF_TYPES, split by visibility

**Phase 9F** — Global CRM readiness strip/badge in sidebar or CRM header:
- Small badge showing critical/warning count
- Quick access to the full readiness list

**Phase 8** (independent):
- /crm/dispatch → Home-Service Dispatch Center
- Mobile responsiveness audit across CRM pages
- Tighten provider assignment permissions from CRM to manager/owner once system is stable

---

## Workspace Prefetch System (WORKSPACE-PREFETCH-001)

### New Components
- `WorkspaceRoutePrefetcher` — mount inside any workspace layout for background route warming
- `workspace-prefetch-config.ts` — defines immediate/idle/hover route lists per workspace

### Integration Points
| Workspace | File | Prefetcher mounted |
|---|---|---|
| CRM | `src/app/(dashboard)/crm/layout.tsx` | ✅ explicit CRM_PREFETCH config |
| Manager | `src/app/(dashboard)/manager/layout.tsx` | ✅ new layout wrapper |
| Owner | `src/app/(dashboard)/owner/layout.tsx` | ✅ new layout wrapper |

### Sidebar Hover Prefetch
All sidebar `NavLink` items now call `router.prefetch(href)` on `onMouseEnter`.

### Cache Tags Added
- `crm-workspace:{branchId}`
- `crm-bookings:{branchId}`
- `crm-dispatch:{branchId}`
- `crm-availability:{branchId}`
- `crm-setup:{branchId}`
- `manager-workspace:{branchId}`
- `owner-workspace:{branchId}`

### Batch Invalidation Helpers
- `invalidateCrmWorkspace(branchId)`
- `invalidateManagerWorkspace(branchId)`
- `invalidateOwnerWorkspace(branchId)`

### Cached Query Wrappers (new file: `src/lib/queries/workspace-cached.ts`)
- `getCrmSetupHealthCached(branchId)`
- `getCrmTodaySnapshotCached(branchId, date)`
- `getCrmAvailabilitySnapshotCached(branchId, date)`
- `getDispatchDataCached(branchId, date)`

These are **not yet wired into existing pages** — they are ready for gradual adoption.
