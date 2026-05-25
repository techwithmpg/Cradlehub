# CRM Operations Readiness Audit
> Phase 9A — Audit Existing Readiness & Condition Checks  
> Date: 2026-05-25  
> Status: Complete — no source code changed

---

## Overview

CradleHub already has substantial readiness / issue-checking infrastructure — but it grew
organically across seven distinct type systems, eleven UI components, and at least seven
independent query/computation functions. The core concepts (title, severity, impact, fix link)
appear in every system, but are never the same shape twice.

This document maps what exists, where logic is duplicated, what is missing, and proposes a
single **Operations Readiness Engine** model that can unify everything in Phase 9B+.

---

## A. Existing Readiness System Map

### `/crm/setup` — Rules & Setup Center
| Layer | Name | File |
|---|---|---|
| Query | `getCrmSetupHealth(branchId)` | `src/lib/queries/crm-setup.ts` |
| Issue type | `SetupIssue` | same file |
| Health data type | `CrmSetupHealthData` | same file |
| UI — health cards | `CrmSetupHealthCards` | `src/components/features/crm/setup/crm-setup-health-cards.tsx` |
| UI — issues list | `CrmSetupIssuesList` + internal `IssueCard` | `src/components/features/crm/setup/crm-setup-issues-list.tsx` |

**Checks computed:**
- `no-schedule` — service staff with no schedule row (warning)
- `no-staff-for-service` — active services with zero staff_services assignments (error)
- `no-drivers` — home service enabled but 0 active driver staff (error)
- `no-resources` — no active branch_resources (warning)
- `default-rules` — booking rules using system defaults (info)
- `unassigned-bookings` — confirmed bookings today with no staff_id (error)

**Fix links:** Hard-coded string `fixHref` per issue pointing to `/crm/staff-availability`,
`/crm/services`, `/crm/dispatch`, `/crm/spaces-rules`, `/crm/control`.

---

### `/crm/availability` — Live Availability & Check-In Center
| Layer | Name | File |
|---|---|---|
| Query | `getCrmAvailabilitySnapshot()` | `src/lib/queries/crm-availability.ts` |
| Per-staff flag | `needsAttention` (= `scheduleStatus === "no_schedule"`) | same file |
| Summary field | `needsAttention: number` on `CrmAvailabilitySummary` | same file |
| UI — summary | `CrmAvailabilitySummary` (stat cards) | `src/components/features/crm/availability/crm-availability-summary.tsx` |
| UI — board | `CrmAvailabilityBoard` columns: Available / Busy / Not Checked In / Off / Needs Attention | `src/components/features/crm/availability/crm-availability-board.tsx` |

**Checks surfaced:**
- `needsAttention` per staff row — staff has no schedule (flagged in board + summary stat card)
- `not_checked_in` — scheduled but not yet present
- `no_schedule` — no saved schedule row
- `off_today` — day-off override active

---

### `/crm/staff-availability` — Schedule Setup Center
| Layer | Name | File |
|---|---|---|
| Health summary | `ScheduleSetupHealthSummary` | `src/components/features/staff-schedule/schedule-setup-health-summary.tsx` |
| Issues view | `ScheduleCoverageIssues` | `src/components/features/staff-schedule/schedule-coverage-issues.tsx` |

**Checks surfaced:**
- No active schedule rows at all (`noSchedule` list)
- No individual schedule AND no group rules (`noGroupOrIndividual` list — the critical case)
- No opening shift today
- On leave today (day-off override)

**No shared type used** — inline computation from `StaffScheduleItem[]`.  
**No action links** — issues listed but no "go fix it" button.

---

### `/crm/spaces-rules` — Spaces & Booking Rules Center
| Layer | Name | File |
|---|---|---|
| Conflict compute | `computeResourceConflicts()` | `src/components/features/spaces-rules/spaces-rules-utils.ts` |
| Conflict type | `ResourceConflict` | same file |
| KPI compute | `computeKpiData()` | same file |
| Health summary | `SpacesRulesHealthSummary` | `src/components/features/spaces-rules/spaces-rules-health-summary.tsx` |

**Checks computed:**
- `missing_assignment` (warning) — non-home-service booking has no resource assigned
- `overlap` (critical) — two bookings on same resource at same time
- `capacity_overflow` (critical) — bookings exceed resource capacity

---

### `/crm/services` — Services & Therapist Setup
| Layer | Name | File |
|---|---|---|
| Panel | `CrmServiceTherapistPanel` | `src/components/features/crm/services/crm-service-therapist-panel.tsx` |

**Checks surfaced:**
- ⛔ critical banner — public service with 0 valid providers (affects online booking)
- ⚠️ warning banner — non-public service with 0 valid providers (affects CRM bookings)

**No shared type** — inline in server component with hardcoded styling.

---

### `/crm/today` — Daily Operations Center
| Layer | Name | File |
|---|---|---|
| Snapshot | `getCrmTodaySnapshot()` | `src/lib/queries/crm-today.ts` |
| Priority strip | `TodayPriorityStrip` | `src/components/features/crm/today/today-priority-strip.tsx` |
| Attention strip | `TodayAttentionStrip` | `src/components/features/crm/today/today-attention-strip.tsx` |
| Action required | `ActionRequiredList` | `src/components/features/notifications/action-required-list.tsx` |
| System match | `TodaySystemMatchStatus` | `src/components/features/crm/today/today-system-match-status.tsx` |

**Checks surfaced (live, numeric):**
- `In Progress` — active bookings count
- `Unassigned` — confirmed bookings with no staff (links to /crm/bookings)
- `Not Checked In` — scheduled but not yet present (links to /crm/staff-availability ← wrong! should be /crm/availability)
- `Awaiting Dispatch` — home-service bookings without driver (links to /crm/dispatch)
- `Unpaid` — overdue/unpaid payments (links to /crm/payments)
- `Urgent Actions` — count from workspace_notifications (links to /crm/notifications)

---

### Manager Today / Manager Scheduling (manager workspace)
| Layer | Name | File |
|---|---|---|
| Alert compute | `computeAlerts()` | `src/components/features/manager-today/manager-today-utils.ts` |
| Alert type | `TodayAlert` | same file |
| Alert UI | `ManagerAlertsPanel` | `src/components/features/manager-today/manager-alerts-panel.tsx` |
| Schedule health | `evaluateScheduleHealth()` | `src/lib/scheduling/rules/evaluate-schedule-health.ts` |
| Schedule health types | `ScheduleHealthIssue`, `HealthEvaluationResult` | `src/lib/scheduling/types.ts` |
| Schedule health UI | `ScheduleHealthPanel` | `src/components/features/scheduling/schedule-health-panel.tsx` |

**Manager-side checks:**
- Missing rooms, pending confirmations, unassigned staff, overlapping bookings, home service prep, starting soon
- Scheduling: understaffed, no_therapist, no_driver, overtime_risk, missing_break, too_many_off

---

### Dispatch / Live Operations
| Layer | Name | File |
|---|---|---|
| Operational warnings | `computeOperationalWarnings()` | `src/lib/bookings/ops-warnings.ts` |
| Warning type | `OperationalWarning` | same file |
| Dispatch alert type | `DispatchAlert` | `src/features/dispatch/types.ts` |
| Dispatch workspace | `DispatchWorkspace` (AlertBanner) | `src/components/features/dispatch/dispatch-workspace.tsx` |

**Dispatch checks:**
- `missing_driver` — no driver assigned to home-service trip
- `missing_location` — no live location yet
- `location_stale` — last location > 15 min old
- `missing_destination_coordinates` — ETA impossible
- `traffic_delay` — live ETA exceeds planned buffer by >1.5×
- `next_booking_conflict` — estimated return overlaps next appointment

---

### Notification System (DB-backed)
| Layer | Name | File |
|---|---|---|
| Types | `WorkspaceNotification`, `NotificationType`, `NotificationPriority` | `src/lib/notifications/types.ts` |
| Create | `createNotification()` | `src/lib/notifications/create.ts` |
| Setup triggers | `ensureBranchSetupWarningNotifications()` | `src/lib/notifications/setup-warnings.ts` |
| Attention strips | `TodayAttentionStrip`, `WorkspaceAttentionStrip`, `ActionRequiredList` | multiple |

**Setup checks that write to DB:**
- `service_setup_warning` — home service enabled but no eligible services
- `branch_setup_warning` — driver capacity is zero
- `system_warning` — Google Maps API key missing

---

### Shared Warning Infrastructure (most mature)
| Layer | Name | File |
|---|---|---|
| Warning type | `ActionableWarning` | `src/types/warnings.ts` |
| Target type | `ActionableWarningTarget` (scroll/focus/navigate/open-panel/modal/custom) | same |
| Component | `ActionableWarning` | `src/components/shared/actionable-warning.tsx` |
| List component | `ActionableWarningList` | `src/components/shared/actionable-warning-list.tsx` |
| Target factories | `warningTargets.*` (30+ factories) | `src/lib/warnings/action-targets.ts` |

**Used by:** `manager-settings-workspace.tsx`, `settings-warning-card.tsx`, `staff-approval-workspace.tsx`.  
**NOT yet used by:** CRM pages (crm-setup uses its own `SetupIssue` instead).

---

## B. Current Issue/Warning Shapes

Seven distinct shapes are in use. They cover the same concepts differently:

```ts
// 1. ActionableWarning  (src/types/warnings.ts) — MOST MATURE
type WarningSeverity = "info" | "success" | "warning" | "danger";
type ActionableWarning = {
  id: string;
  severity: WarningSeverity;
  title: string;
  description?: string;
  impact?: string;
  actionLabel?: string;
  target: ActionableWarningTarget;  // multi-type action routing
};

// 2. SetupIssue  (src/lib/queries/crm-setup.ts) — CRM Setup only
type SetupIssue = {
  id: string;
  severity: "error" | "warning" | "info";  // "error" ≠ "danger"
  title: string;
  detail: string;        // ≠ description
  impact: string;
  fixHref: string;       // ≠ target
  fixLabel: string;      // ≠ actionLabel
};

// 3. OperationalWarning  (src/lib/bookings/ops-warnings.ts) — Dispatch only
type OperationalWarning = {
  type: string;
  severity: "info" | "warning" | "critical";  // "critical" not in ActionableWarning
  message: string;       // collapsed title+description
  // NO action link
};

// 4. TodayAlert  (src/components/features/manager-today/manager-today-utils.ts)
type TodayAlert = {
  id: string;
  label: string;
  count: number;         // unique — shows a numeric count
  href: string;
  severity: "critical" | "warning" | "info";
};

// 5. DispatchAlert  (src/features/dispatch/types.ts)
type DispatchAlert = {
  id: string;
  title: string;
  description: string;
  timeAgo: string;       // unique — age of alert
  severity: "warning" | "danger";
  dispatchNumber: string;
  bookingId: string;
};

// 6. ManagerSettingsWarning  (src/components/features/manager-settings/types.ts)
type ManagerSettingsWarning = {
  id: string;
  title: string;
  description: string;
  severity: "warning" | "critical";
  // NO action link
};

// 7. ScheduleHealthIssue  (src/lib/scheduling/types.ts) — Scheduling engine
type ScheduleHealthIssue = {
  type: string;
  severity: "critical" | "warning";
  message: string;
  affected_staff_ids?: string[];
  affected_booking_ids?: string[];
  // NO action link
};
```

**Severity vocabulary mismatch summary:**

| Level | types/warnings | crm-setup | ops-warnings | manager-today | dispatch | scheduling |
|-------|---------------|-----------|--------------|--------------|---------|------------|
| Highest | `danger` | `error` | `critical` | `critical` | `danger` | `critical` |
| Middle | `warning` | `warning` | `warning` | `warning` | `warning` | `warning` |
| Low | `info` | `info` | `info` | `info` | — | — |
| OK | `success` | — | — | — | — | `ok` (status) |

---

## C. Reusable Components (Existing & Candidates)

### Already reusable (shared folder)
- **`ActionableWarning`** (`src/components/shared/actionable-warning.tsx`) — The gold standard. Has icon, severity colors, title, description, impact, action button with full routing. Should become the standard for ALL single-issue cards.
- **`ActionableWarningList`** (`src/components/shared/actionable-warning-list.tsx`) — Renders a stack of `ActionableWarning` cards, zero when empty. Already usable anywhere.

### Should be standardized
- **`CrmSetupIssuesList`** / internal `IssueCard` — Same intent as `ActionableWarningList` but uses `SetupIssue` instead of `ActionableWarning`. Should be rewritten to use the shared type.
- **`CrmSetupHealthCards`** / `HealthCardView` — The "color-coded health card grid" pattern. Also appears independently in `ScheduleSetupHealthSummary`, `SpacesRulesHealthSummary`, `CrmAvailabilitySummary`. Should become a shared `ReadinessHealthGrid` or `HealthStatCard` component.
- **`TodayPriorityStrip`** — The "big number + color tint + link" pattern. Useful abstraction, currently CRM-Today-specific. Could become a shared `ReadinessPriorityStrip`.

### Candidates for creation (Phase 9B)
- `ReadinessIssueCard` — Based on `ActionableWarning` but with the `problem`/`fix` vocabulary
- `ReadinessHealthGrid` — Standardized stat-card grid with status coloring
- `ReadinessActionStrip` — Lightweight "N items need attention" banner (unify `TodayAttentionStrip`, `ActionRequiredList`, `WorkspaceAttentionStrip`)
- `ReadinessSummarySection` — Section header + health grid + issue list in one block

---

## D. Duplicate Logic

| Condition | First occurrence | Duplicated in |
|---|---|---|
| Staff with no schedule | `crm-setup.ts → "no-schedule"` issue | `schedule-coverage-issues.tsx` (inline) + `crm-availability.ts needsAttention` |
| Service with 0 valid providers | `crm-setup.ts → "no-staff-for-service"` | `crm-service-therapist-panel.tsx` (inline critical banner) |
| Home service, no drivers | `crm-setup.ts → "no-drivers"` | `setup-warnings.ts` (DB notification) |
| Home service, no eligible services | `setup-warnings.ts` (DB notification) | not in CRM UI — only in owner/manager notifications |
| Unassigned confirmed bookings | `crm-setup.ts → "unassigned-bookings"` | `manager-today-utils.ts → computeAlerts "unassigned-staff"` + `TodayPriorityStrip "Unassigned"` |
| Missing room assignments | `spaces-rules-utils.ts → computeResourceConflicts "missing_assignment"` | `manager-today-utils.ts → computeAlerts "missing-rooms"` |
| Staff not checked in | `crm-availability.ts → presenceStatus "not_checked_in"` | `TodayPriorityStrip "Not Checked In"` + `CrmAvailabilitySummary "notCheckedIn"` |
| Action items count | `TodayAttentionStrip` (WorkspaceNotification[]) | `ActionRequiredList` (server, same notifications) |

**Which should be the source of truth:**
- Staff schedule missing → `getCrmSetupHealth` (already centralized, also has count)
- Service provider missing → `getCrmSetupHealth` (add detail for public vs non-public)
- Booking unassigned → `getCrmTodaySnapshot` (already aggregates from multiple sources)
- Room conflict → `computeResourceConflicts` (pure function, already has full logic)
- Check-in status → `getCrmAvailabilitySnapshot` (already the source)
- Attention strip → `TodayAttentionStrip` / `ActionRequiredList` should merge into one component

---

## E. Missing Condition Checks

Checks that do not yet exist anywhere in the codebase:

| # | Check | Scope | Severity | Suggested fix link |
|---|---|---|---|---|
| 1 | Public service enabled for home-service but no home-service capable therapist assigned | service | critical | `/crm/services` |
| 2 | Home service enabled but no active home-service branch services | setup | critical | `/crm/services` (or owner) |
| 3 | Staff assigned to service but no schedule set for any day | schedule | warning | `/crm/staff-availability` |
| 4 | Manual schedule import applied but names were skipped/left unmatched | schedule | warning | `/crm/staff-availability` |
| 5 | Driver assigned to dispatch trip but not checked in today | dispatch | critical | `/crm/availability` |
| 6 | Staff checked in but not scheduled for today (ghost check-in) | daily | warning | `/crm/availability` |
| 7 | No opening-shift staff configured for today | schedule | warning | `/crm/staff-availability` |
| 8 | Home-service booking has no customer address/coordinates | dispatch | critical | `/crm/dispatch` |
| 9 | Payment overdue for confirmed completed booking | payment | critical | `/crm/payments` |
| 10 | Booking request created but no CRM follow-up after 30+ minutes | daily | warning | `/crm/bookings` |
| 11 | Room capacity lower than peak same-slot booking demand on a given date | spaces | warning | `/crm/spaces-rules` |
| 12 | Booking rules last updated >90 days ago (staleness check) | setup | info | `/crm/spaces-rules` |
| 13 | Staff schedule set but shift times don't cover any booking's time window | schedule | warning | `/crm/staff-availability` |
| 14 | No staff checked in by X minutes after branch open time | daily | critical | `/crm/availability` |

---

## F. Recommended Uniform Readiness Model

Based on the audit, the canonical shape should extend `ActionableWarning` (which already
has the best infrastructure) while adding the missing metadata fields used across all domains.

```ts
// src/types/readiness.ts  (proposed new file)

export type ReadinessSeverity = "critical" | "warning" | "info" | "success";

/**
 * The domain/area this issue belongs to.
 * Used for filtering, grouping, and routing in the global readiness strip.
 */
export type ReadinessScope =
  | "setup"      // branch configuration — services, rules, resources
  | "schedule"   // staff schedules, overrides, blocked time
  | "daily"      // same-day operations — check-in, unassigned, attendance
  | "service"    // service / provider assignment
  | "space"      // rooms, resources, capacity
  | "dispatch"   // home-service, driver, routing
  | "payment"    // payment status, overdue
  | "system";    // env config, external APIs

/**
 * The full Operations Readiness Issue model.
 *
 * Designed to be a superset of all existing warning types:
 *   - SetupIssue: maps detail→problem, fixHref/fixLabel→actionHref/actionLabel
 *   - ActionableWarning: maps description→problem, target.href→actionHref
 *   - OperationalWarning: maps message→title+problem, no action
 *   - TodayAlert: maps label→title, href→actionHref, count→metadata.count
 *   - DispatchAlert: maps description→problem, bookingId→entityId
 */
export type ReadinessIssue = {
  /** Stable unique key for React lists, deduplication, and tracking. */
  id: string;

  /** Scope determines grouping, icon, and global routing. */
  scope: ReadinessScope;

  /** Urgency level. */
  severity: ReadinessSeverity;

  /**
   * Short problem statement (1 sentence, past-tense noun clause).
   * Example: "3 services have no valid therapist assigned."
   */
  title: string;

  /**
   * One sentence describing what is wrong in more detail.
   * Example: "Customers cannot select a therapist during online booking for these services."
   */
  problem: string;

  /**
   * One sentence describing the operational consequence if left unfixed.
   * Example: "Online bookings for these services may silently fail or show no therapist options."
   */
  impact: string;

  /**
   * One sentence describing how to fix this.
   * Example: "Assign at least one valid provider (therapist / nail_tech / aesthetician)."
   */
  fix: string;

  /** Label for the CTA button. */
  actionLabel: string;

  /** Destination URL for the fix. */
  actionHref: string;

  /**
   * Which query or component computed this issue.
   * Used for deduplication when multiple aggregators run.
   * Example: "getCrmSetupHealth", "getCrmAvailabilitySnapshot"
   */
  source: string;

  /** Optional: entity type affected (e.g. "service", "staff", "booking"). */
  entityType?: string;

  /** Optional: entity IDs affected (for count badges and drill-down links). */
  entityIds?: string[];

  /** Optional: computed count if different from entityIds.length. */
  count?: number;
};

/** Convenience alias — a list of issues with a summary status. */
export type ReadinessResult = {
  issues: ReadinessIssue[];
  /** Derived from highest severity across all issues. */
  status: "ok" | "warning" | "critical";
};
```

### Migration mapping

| Existing field | → | `ReadinessIssue` field |
|---|---|---|
| `SetupIssue.detail` | → | `problem` |
| `SetupIssue.fixHref` | → | `actionHref` |
| `SetupIssue.fixLabel` | → | `actionLabel` |
| `SetupIssue.severity: "error"` | → | `severity: "critical"` |
| `ActionableWarning.description` | → | `problem` |
| `ActionableWarning.target.href` | → | `actionHref` |
| `ActionableWarning.severity: "danger"` | → | `severity: "critical"` |
| `OperationalWarning.message` | → | `title` + `problem` (split) |
| `TodayAlert.label` | → | `title` |
| `TodayAlert.href` | → | `actionHref` |
| `DispatchAlert.description` | → | `problem` |

---

## G. Recommended Implementation Plan

### Phase 9B — Shared Types & Components
**Goal:** Create the shared type and the shared display component. No existing pages touched.
- Create `src/types/readiness.ts` — `ReadinessIssue`, `ReadinessSeverity`, `ReadinessScope`, `ReadinessResult`
- Create `src/components/shared/readiness-issue-card.tsx` — Uses `ReadinessIssue`, wraps `ActionableWarning` pattern with scope badge + problem + impact + fix + action button
- Create `src/components/shared/readiness-issue-list.tsx` — Stack of `ReadinessIssueCard`, zero-renders when empty, orders critical > warning > info
- Create `src/components/shared/readiness-health-grid.tsx` — Standardized stat-card grid (replaces bespoke grids in CrmSetupHealthCards, ScheduleSetupHealthSummary, SpacesRulesHealthSummary, CrmAvailabilitySummary)

**Acceptance:** TypeScript clean. No page behavior changed.

---

### Phase 9C — CRM Readiness Query Aggregator
**Goal:** One server function that aggregates all CRM-domain issues from existing checks.
- Create `src/lib/queries/crm-readiness.ts`
  - `getCrmReadinessIssues(branchId: string): Promise<ReadinessResult>`
  - Calls `getCrmSetupHealth()`, `getCrmAvailabilitySnapshot()`, and any new checks
  - Maps all results to `ReadinessIssue[]`, deduplicates by `id`
  - Returns `ReadinessResult` with derived `status`
- Add missing checks to this aggregator: items E-1, E-2, E-5, E-7, E-9 (highest priority)

**Acceptance:** Function returns correct results. No UI changes yet.

---

### Phase 9D — Replace Duplicate Displays with Shared Components
**Goal:** Remove duplicated issue rendering, use shared `ReadinessIssueList`.
- Replace `CrmSetupIssuesList` with `ReadinessIssueList` (migrate `SetupIssue` → `ReadinessIssue`)
- Replace inline critical/warning banners in `CrmServiceTherapistPanel` with `ReadinessIssueCard`
- Replace inline warning banner in `ScheduleSetupHealthSummary` with `ReadinessIssueCard`
- Replace bespoke health card grids with `ReadinessHealthGrid` where appropriate
- Unify `TodayAttentionStrip`, `WorkspaceAttentionStrip`, `ActionRequiredList` into one `ReadinessActionStrip`

**Acceptance:** No visual regression. TypeScript clean. Build passes.

---

### Phase 9E — Add Missing Readiness Conditions
**Goal:** Add the missing checks from Section E.
- E-5: Driver assigned but not checked in → `getCrmReadinessIssues`
- E-7: No opening-shift staff → `getCrmReadinessIssues`
- E-1: Home-service service has no capable therapist → `getCrmReadinessIssues`
- E-8: Home-service booking has no address → add to dispatch queries
- E-9: Overdue payment with no action → payment queries
- E-4: Manual schedule import with skipped names → schedule query

**Acceptance:** Each new check appears in the aggregator output. CRM pages surface them.

---

### Phase 9F — Global CRM Readiness Strip in Sidebar/Header
**Goal:** One persistent indicator visible from any CRM page.
- Add a small readiness badge in the CRM sidebar navigation or header
- Shows total critical count + warning count
- Links to `/crm/setup` or a new `/crm/readiness` page
- Uses `getCrmReadinessIssues` (cached, revalidated on mutation)
- Does not add new queries on every page load (use server cache or edge function)

**Acceptance:** Badge appears in sidebar. Click navigates to full issue list.

---

### Phase 9G — Extend Readiness to Manager Workspace
**Goal:** Bring manager-workspace checks under the same umbrella.
- Map `TodayAlert`, `ScheduleHealthIssue`, `ManagerSettingsWarning` to `ReadinessIssue`
- Manager sidebar shows readiness badge
- Manager today page uses `ReadinessIssueList` instead of `ManagerAlertsPanel`

---

## H. Files to NOT Change (ever)

```
src/lib/actions/online-booking.ts
src/lib/actions/inhouse-booking.ts
src/lib/engine/availability.ts
src/lib/engine/resource-availability.ts
src/lib/bookings/dispatch-conflict.ts
src/lib/bookings/dispatch-slot-filter.ts
supabase/migrations/*
```

---

## I. Summary Table

| Page | Existing checks | Existing components | Issues shape | Has action links | Recommended action |
|---|---|---|---|---|---|
| `/crm/setup` | 6 (most complete) | `CrmSetupHealthCards`, `CrmSetupIssuesList` | `SetupIssue` (custom) | ✅ yes | Migrate to `ReadinessIssue` |
| `/crm/availability` | needsAttention flag only | `CrmAvailabilitySummary`, board columns | None (inline) | ❌ no | Add `ReadinessIssueList` |
| `/crm/staff-availability` | 4 (coverage issues) | `ScheduleSetupHealthSummary`, `ScheduleCoverageIssues` | None (inline) | ❌ no | Migrate + add links |
| `/crm/spaces-rules` | 3 (resource conflicts) | `SpacesRulesHealthSummary`, conflict tab | `ResourceConflict` (custom) | Partial | Migrate to `ReadinessIssue` |
| `/crm/services` | 2 (critical/warning banners) | Inline in `CrmServiceTherapistPanel` | None (inline) | Partial | Extract to `ReadinessIssueCard` |
| `/crm/today` | 6 (numeric strip) | `TodayPriorityStrip`, `TodayAttentionStrip` | `WorkspaceNotification` | ✅ yes | Keep; add `ReadinessActionStrip` |
| `/crm/dispatch` | 7 (dispatch warnings) | `DispatchWorkspace AlertBanner` | `DispatchAlert` (custom) | Partial | Migrate to `ReadinessIssue` |
| Shared | 2 components, 30+ target factories | `ActionableWarning`, `ActionableWarningList`, `warningTargets` | `ActionableWarning` (best) | ✅ full | Extend to `ReadinessIssue` |
| Notifications (DB) | 3 setup warning types | `TodayAttentionStrip`, `ActionRequiredList`, `WorkspaceAttentionStrip` | `WorkspaceNotification` | ✅ yes | Unify into `ReadinessActionStrip` |

---

*No source code changed in this phase. This document is the deliverable.*
