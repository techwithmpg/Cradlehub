# Phase 2X — Operations Unification Audit

> **Audit date:** 2026-05-21  
> **Auditor:** Claude Code (Phase 2X-A)  
> **Scope:** Full operations workflow — scheduling, availability, dispatch, public booking, and assignment recommendation  
> **Mode:** Audit only — no code changed.

---

## Executive Summary

The operations layer has grown organically across Phases 2C–2I and now contains significant duplication, several disconnected workflows, and one high-severity integration gap: **`staff_group_schedule_rules` (Phase 2H) is completely ignored by every consumer except the Schedule Setup UI.** Group rules never flow to the booking engine, the recommendation engine, the daily schedule display, or CRM availability. This means staff configuration work done in the group rules UI has zero operational effect today.

Secondary findings: the CRM and manager schedule pages duplicate identical auth context code; the dispatch query and workspace component each define the same `fmt12h()` helper; presence/shift badge styling is duplicated across 4 files; and `manager/staff-availability` was not updated in Phase 2E and is now running a generation-old individual-only editor.

**Risk level before remediation:** Medium-high. The group rules gap creates a false sense of configuration fidelity — managers set group schedules expecting them to affect bookings, but they don't.

---

## Duplicate Pages

| Route | Component Used | Auth helper | Gap |
|---|---|---|---|
| `/crm/schedule` | `ScheduleWorkspace` | inline `getCRMContext()` | — |
| `/manager/schedule` | `ScheduleWorkspace` | inline `getManagerContext()` | — |
| `/owner/schedule` | `ScheduleWorkspace` | inline `getOwnerContext()` | — |
| `/crm/staff-availability` | `ScheduleSetupWorkspace` | `getManagerBranchId()` | — |
| `/manager/staff-availability` | `StaffSchedulePageClient` | `getManagerBranchId()` | **Stuck on legacy (Phase 2E not applied)** |

**`/crm/schedule` and `/manager/schedule` are near-identical files.** Both call `getDailySchedule`, `getManagerDashboardStats`, and `branch_resources.select("*")` with the same logic. The only differences are `workspaceContext`, `viewerRole`, and the `viewBookingsHref`. This is a clear 2X-B target for a shared `getSchedulePageData(branchId, date)` helper.

---

## Duplicate Components

### 1. Shift badge / style constants (4 locations)

| File | Symbol | Type |
|---|---|---|
| `crm-availability-board.tsx` | `SHIFT_BADGE` | inline `Record<string, {bg, text}>` |
| `crm-availability-client.tsx` | `SHIFT_BADGE` | inline `Record<string, {bg, text}>` |
| `group-schedule-rules-panel.tsx` | `SHIFT_STYLE` | inline `Record<string, {bg, color}>` |
| `staff-schedule-row.tsx` | `SHIFT_BADGE` | inline `Record<string, {bg, text}>` |

These encode the same `opening/closing/single` visual mapping. Should become a single exported `ShiftTypeBadge` component in `src/components/shared/`.

### 2. Presence / live-status badge components (3 locations)

| File | Symbol | Notes |
|---|---|---|
| `crm-availability-board.tsx` | `PresenceBadge` | inline component |
| `crm-availability-client.tsx` | `PresencePill` | separate inline component, near-identical intent |
| `motion-status-dot.tsx` | `StatusDot` | animated dot variant, different visual but same semantic |

Should consolidate into `PresenceStatusBadge` and `AvailabilityStatusBadge` in shared.

### 3. `fmt12h` / `shortTime` time-format helpers (2 direct duplicates + 47 files total)

| File | Symbol |
|---|---|
| `dispatch-workspace.tsx` | `fmt12h()` — defined inline |
| `dispatch-queries.ts` | `fmt12h()` — **exact same function, defined again in a server query file** |
| `group-schedule-rules-panel.tsx` | `shortTime()` — same conversion, different name |

The server query file (`dispatch-queries.ts`) should not contain UI formatting helpers. `fmt12h` there is dead weight — the query returns raw `start_time: string` values and formatting belongs in the workspace component.

---

## Duplicate Query Functions

### 4. Staff IDs helper duplicated inside `assignment-recommendations.ts`

`getActiveBranchStaffIds(branchId)` is a private helper called 5 times inside the same file (for `getStaffServicesForScoring`, `getStaffSchedulesForScoring`, `getScheduleOverridesForScoring`, `getBlockedTimesForScoring`, `getStaffPreferencesForScoring`). Each of these N+1-queries independently. The `buildRecommendationContext` caller already has the `staffList` in scope — this should be passed down to avoid 5 redundant `staff.select("id")` queries.

### 5. Double booking fetch in `buildDriverRecommendationContext`

`buildDriverRecommendationContext(bookingId)` calls `buildRecommendationContext(bookingId)` which calls `getBookingForRecommendation(bookingId)` internally, then immediately calls `getBookingForRecommendation(bookingId)` again at line 386 to get `booking.branch_id` and `booking.booking_date`. The booking is fetched twice.

---

## Schedule Logic Map

Five separate code paths answer the question "is staff available / scheduled?":

```
1. get_available_slots (Postgres RPC)
   Reads: staff_schedules, schedule_overrides, blocked_times, bookings
   Ignores: staff_group_schedule_rules ← GAP

2. get_daily_schedule (Postgres RPC) ← via getDailySchedule() query
   Reads: staff_schedules, schedule_overrides, blocked_times, bookings
   Ignores: staff_group_schedule_rules ← GAP

3. getCrmAvailabilitySnapshot() ← CRM Live Availability
   Reads: getDailySchedule() result, staff_schedules (shift map), staff_shift_checkins
   Ignores: staff_group_schedule_rules ← GAP

4. buildRecommendationContext() ← Recommendation engine
   Reads: staff_schedules, schedule_overrides, blocked_times, staff_shift_checkins
   Ignores: staff_group_schedule_rules ← GAP

5. getStaffWithAvailability() ← Schedule Setup / individual editor
   Reads: staff_schedules, schedule_overrides, blocked_times
   Used by: ScheduleSetupWorkspace, StaffSchedulePageClient
   Ignores: staff_group_schedule_rules at query level (only read by ScheduleSetupWorkspace for display)
```

**None of the five paths consume `staff_group_schedule_rules`.** Phase 2H created the table and the Phase 2E UI allows setting group rules, but group rules have zero effect on any downstream system.

---

## Availability Logic Map

Two query functions both named "availability" serve different purposes and should not be confused:

| Function | File | Purpose | Used by |
|---|---|---|---|
| `getCrmAvailabilitySnapshot()` | `crm-availability.ts` | **Live operational view** — who is checked in, busy, or off right now | CRM Live Availability page |
| `getStaffWithAvailability()` | `staff.ts` | **Schedule configuration view** — staff + their weekly schedules, overrides, blocked times | Schedule Setup, manager staff-availability |

These are correctly separated. The naming is slightly confusing (`getStaffWithAvailability` sounds operational) but the code is sound.

---

## Booking Assignment Logic Map

```
Public booking wizard (/book) 
  → availability.ts (getAvailableSlots engine)
  → get_available_slots RPC
  → staff_schedules (no group rules)

CRM / Manager booking panel
  → getAssignmentRecommendationsAction (server action)
  → buildRecommendationContext() (query layer)
  → recommendation-engine.ts (scoring)
  → Returns ScoredStaff[] for therapist + driver

CRM Dispatch workspace
  → getDriverRecommendationsAction (server action)
  → buildDriverRecommendationContext()
  → scoreDriverCandidates()
  → assignBookingDriverAction() on confirm
```

Therapist assignment via recommendation panel is **recommendation-only** — no "apply" action exists for therapists. Driver assignment is fully wired via `assignBookingDriverAction`.

---

## Dispatch Logic Map

```
src/lib/queries/dispatch-queries.ts
  getDispatchData(args) → DispatchData
  - Queries bookings with home_service filter
  - Joins staff, customers, services
  - Fetches staff_location_snapshots
  - Computes DispatchStatus from booking_progress_status
  - Computes alerts (no-driver, location, delayed)
  - Contains fmt12h() ← should not be here (UI concern)

src/components/features/dispatch/dispatch-workspace.tsx
  HomeServiceDispatchWorkspace
  - Renders DispatchData
  - Duplicate fmt12h() ← copy of the one in dispatch-queries.ts
  - Inline recommendation panel for awaiting_driver items
  - Calls getDriverRecommendationsAction + assignBookingDriverAction
```

The query correctly uses `or("type.eq.home_service,delivery_type.eq.home_service")` to catch both legacy and new home-service bookings.

---

## Frontend-Backend Integration Gaps

### [CRITICAL] Group rules not wired to any operational system

Phase 2H created `staff_schedule_groups` + `staff_group_schedule_rules`. Phase 2E–2G built the full Schedule Setup UI for configuring them. **But no downstream system reads these tables:**

- `get_available_slots` — reads `staff_schedules` only
- `get_daily_schedule` — reads `staff_schedules` only  
- `getCrmAvailabilitySnapshot` — reads `staff_schedules` only
- `getStaffSchedulesForScoring` — reads `staff_schedules` only
- `ScheduleCoverageIssues` — correctly shows "No group rules or individual schedule" but this flag has no effect on actual bookings

**Implication:** A staff member with no individual `staff_schedules` row but valid group rules will appear as unscheduled in the booking engine and CRM availability, regardless of what group rules say. The group rules UI gives operators false confidence.

### [HIGH] `manager/staff-availability` not updated to Phase 2E workspace

`src/app/(dashboard)/manager/staff-availability/page.tsx` still renders `StaffSchedulePageClient` — the individual-only editor from before Phase 2E. It does not fetch `getScheduleSetupOverview()` and does not show the `ScheduleSetupWorkspace` with group rules tabs.

- CRM staff at `/crm/staff-availability` → full Phase 2E workspace (group rules, individual adjustments, coverage issues)
- Managers at `/manager/staff-availability` → legacy individual-only editor

These should show the same workspace.

### [MEDIUM] Three schedule pages duplicate auth context setup

`/crm/schedule`, `/manager/schedule`, `/owner/schedule` each define a private `get*Context()` function that reads `supabase.auth.getUser()` then queries the `staff` table. The only difference is which fields are selected and whether it checks `system_role === "owner"`. A shared `getSchedulePageContext(role)` helper in `lib/queries/` would eliminate this.

### [LOW] `dev` branch_id leaks through recommendation actions

`requireRecommendationAccess()` in `assignment-recommendations.ts` (actions) returns `{ id: "dev", branch_id: "dev", system_role: "manager" }` when dev bypass is enabled. This fake `branch_id` is then used for branch-scope verification (`ctx.me.branch_id !== booking.branch_id`). In dev, `booking.branch_id` will be a real UUID but `ctx.me.branch_id` is `"dev"` — and the code has `const isOwner = ctx.me.system_role === "owner"` which is false for `"manager"`, so the branch check fires. The dev bypass sets `system_role: "manager"` but the dev bypass pattern in other actions (check-ins, schedule groups) short-circuits before the branch check. This inconsistency means recommendations may fail silently in dev.

---

## Role / Permission Gaps

| Action | Allowed roles | Gap |
|---|---|---|
| `getAssignmentRecommendationsAction` | owner, manager, assistant_manager, store_manager, crm, csr_head, csr_staff, csr | Therapist assignment panel visible to all CRM roles but no "assign" server action for therapist |
| `getDriverRecommendationsAction` | Same set | Requires `delivery_type === "home_service"` — correct guard |
| `assignBookingDriverAction` | Not audited in this pass | Unknown role guard |

---

## Dead Code Candidates

| File | Symbol | Reason |
|---|---|---|
| `dispatch-queries.ts:fmt12h` | `fmt12h()` | Server query file — formatting belongs in UI layer, same function in `dispatch-workspace.tsx` |
| `schedule-setup-right-rail.tsx` | `QUICK_ACTIONS` array | All 4 items rendered at `opacity: 0.55` with "Coming in the next implementation step" note |
| `assignment-recommendations.ts:getActiveBranchStaffIds` | Private helper | Called 5× independently when the result could be computed once and passed down |
| `crm-availability-board.tsx:SHIFT_BADGE` | Local constant | Duplicate of 3 other definitions |

---

## Risk Areas

### R1 — `get_available_slots` RPC (very high)
Any change here breaks public booking. The function has been patched 5 times already (migration files `000006`, `000003_fix_time_wrap`, `000003_fix_staff_id_ambiguity`, `000001_booking_pending_payment_holds`, `000004_add_shift_type`). Wiring group rules into this RPC must be done with backward-compatibility (no group rules = same behavior as today).

### R2 — Group rules gap creates config fidelity illusion (high)
Operators using the Phase 2E Schedule Setup workspace to configure group schedules may not realize that those rules have no effect on bookings or CRM availability. This is the most operationally impactful gap.

### R3 — `manager/staff-availability` diverged (medium)
Manager staff can't access group rules configuration at all — they see only the legacy individual editor. If a manager is responsible for setting schedules, they cannot use the group rules feature.

### R4 — N+1 queries in recommendation context (medium)
`buildRecommendationContext` issues 5 separate `staff.select("id")` queries (one per scoring data type) before the main parallel fetch. On a branch with 30 staff this is 5 extra round-trips per recommendation request.

---

## Recommended Phase 2X-B Plan

Priority order based on risk and effort:

### 2X-B — Shared UI Component Consolidation (low risk, high leverage)
**Files to create:**
- `src/components/shared/shift-type-badge.tsx` — replaces 4 inline `SHIFT_BADGE` definitions
- `src/components/shared/presence-status-badge.tsx` — replaces `PresenceBadge`, `PresencePill`
- `src/lib/utils/time-format.ts` — canonical `fmt12h()`, deduplicate from `dispatch-queries.ts`, `dispatch-workspace.tsx`, `group-schedule-rules-panel.tsx`

### 2X-C — Backend Schedule/Availability Utility Consolidation
- Extract shared `getSchedulePageContext()` helper for `/crm/schedule`, `/manager/schedule`, `/owner/schedule`
- Remove `fmt12h()` from `dispatch-queries.ts` (server query file)
- Fix double fetch in `buildDriverRecommendationContext` — pass the already-loaded booking
- Consolidate `getActiveBranchStaffIds` calls into a single pre-fetch passed to the parallel queries

### 2X-D — Public Booking Integration Review (high risk)
- Audit `get_available_slots` RPC to understand cost of adding group rules fallback
- Decision point: do group rules supplement `staff_schedules` (union) or replace them (override)? This architectural decision gates 2X-E.

### 2X-E — Wire Group Rules into Operational Systems
- Update `getStaffSchedulesForScoring` to merge `staff_group_schedule_rules` when a staff has no individual schedule
- Update `getCrmAvailabilitySnapshot` shift map to incorporate group rules
- Update `get_daily_schedule` RPC to union group rule windows
- Update `get_available_slots` RPC — highest risk, requires staging test

### 2X-F — Manager/Staff-Availability Parity
- Update `manager/staff-availability/page.tsx` to use `ScheduleSetupWorkspace` (same as CRM)
- Fetch `getScheduleSetupOverview` alongside `getStaffWithAvailability`

### 2X-G — Dead Code / Legacy Cleanup
- Remove `fmt12h()` from `dispatch-queries.ts`
- Remove inline `SHIFT_BADGE` from the 3 component files that will use `ShiftTypeBadge`
- Remove inline `PresenceBadge`/`PresencePill` from the 2 availability files

---

## Do Not Touch Yet

The following are explicitly out of scope for 2X-B through 2X-G:

- `src/lib/engine/availability.ts` — public booking engine core; only touch as part of 2X-E with explicit staging test
- `supabase/migrations/*.sql` — do not add migrations outside 2X-D/2X-E scope review
- `src/components/public/booking-wizard.tsx` — public booking UI; no changes until 2X-D
- `src/lib/assignments/recommendation-engine.ts` scoring constants — engine is correct, only wire group rules in context builder

---

## Files Inspected

### Pages
- `src/app/(dashboard)/crm/staff-availability/page.tsx`
- `src/app/(dashboard)/manager/staff-availability/page.tsx`
- `src/app/(dashboard)/crm/schedule/page.tsx`
- `src/app/(dashboard)/manager/schedule/page.tsx`
- `src/app/(dashboard)/owner/schedule/page.tsx`
- `src/app/(public)/book/page.tsx`

### Components
- `src/components/features/dispatch/dispatch-workspace.tsx`
- `src/components/features/schedule/schedule-workspace.tsx`
- `src/components/features/staff-schedule/group-schedule-rules-panel.tsx`
- `src/components/features/staff-schedule/schedule-setup-right-rail.tsx`
- `src/components/features/staff-schedule/schedule-coverage-issues.tsx`
- `src/components/features/staff-schedule/schedule-group-cards.tsx`

### Queries
- `src/lib/queries/schedule.ts`
- `src/lib/queries/dispatch-queries.ts`
- `src/lib/queries/crm-availability.ts`
- `src/lib/queries/assignment-recommendations.ts`
- `src/lib/queries/staff-schedule-groups.ts`
- `src/lib/queries/booking-resources.ts`

### Actions & Engine
- `src/lib/actions/assignment-recommendations.ts`
- `src/lib/assignments/recommendation-engine.ts`
- `src/lib/engine/availability.ts` (partial — first 80 lines + RPC call sites)

### Reference Docs
- `docs/phase-2-shift-aware-availability-audit.md`
- `.context/HANDOFF.cmd.md`
- `supabase/migrations/20260524000001_staff_group_schedule_rules.sql` (via grep)
- `supabase/migrations/20260429000006_availability_rpc.sql` (via grep)
