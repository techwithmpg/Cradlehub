# Phase 2A — Shift-Aware Availability Audit

**Task:** CRM-OPS-002A
**Date:** 2026-05-21
**Author:** Claude Code
**Branch:** main

---

## Executive Summary

CradleHub already has a solid foundation for scheduling: recurring weekly schedules, date-specific overrides, day-off support, manual time blocks, service capability mapping, and a working availability RPC. However, three critical gaps exist that prevent the system from being shift-aware in the way the spa actually operates:

1. **No shift type.** `staff_schedules` has no `shift_type` column. The table cannot distinguish between an opening shift (`09:00–17:00`) and a closing shift (`14:00–22:30`). A UNIQUE constraint `(staff_id, day_of_week)` means only one schedule row can exist per staff per day-of-week.

2. **No live staff state.** There is no staff-level check-in/check-out system. The system cannot answer "who is here right now" independent of bookings.

3. **Availability vs Schedule naming collision.** The page labeled "Availability" (`/crm/staff-availability`) actually renders a schedule setup editor, not a live operational view. The page labeled "Schedule" (`/crm/schedule`) shows a daily booking board. Neither page shows real-time assignability.

These gaps must be resolved before the CRM availability view can be accurate and actionable.

---

## Existing Schedule Foundation

### `staff_schedules` — Core recurring schedule table

**File:** `supabase/migrations/20260429000001_core_tables.sql`

| Column | Type | Notes |
|---|---|---|
| `staff_id` | UUID | FK to staff |
| `day_of_week` | SMALLINT | 0=Sun … 6=Sat |
| `start_time` | TIME | Work start |
| `end_time` | TIME | Work end |
| `is_active` | BOOLEAN | Soft toggle |
| UNIQUE | `(staff_id, day_of_week)` | **One row per staff per day** |

**What it supports:**
- ✅ Day-of-week recurring schedule
- ✅ Custom start/end time per day
- ✅ Soft disable (`is_active = false`)
- ✅ Branch scoped (via `staff.branch_id`)

**What it does NOT support:**
- ❌ `shift_type` — no opening vs closing distinction
- ❌ Multiple shifts per day — the UNIQUE constraint `(staff_id, day_of_week)` allows only one row per staff per weekday. A staff member on a closing shift on Monday cannot have both an `opening` and `closing` record.
- ❌ Shift overlap period — no mechanism to mark a 14:00–17:00 handover window
- ❌ Per-shift label (e.g. "Opening", "Closing", "Overlap", "Split")

**Impact on spa operations:**
The spa uses opening shifts (e.g. 09:00–17:00) and closing shifts (e.g. 14:00–22:30) with an overlap period (14:00–17:00). The current schema cannot represent this. A staff member assigned to the closing shift would either overwrite the opening row or require a separate staff record — neither is correct.

---

### `schedule_overrides` — Date-specific exceptions

**File:** `supabase/migrations/20260429000001_core_tables.sql`

| Column | Type | Notes |
|---|---|---|
| `staff_id` | UUID | FK to staff |
| `override_date` | DATE | Exact date |
| `start_time` | TIME | NULL when `is_day_off` |
| `end_time` | TIME | NULL when `is_day_off` |
| `is_day_off` | BOOLEAN | TRUE = zero slots |
| `reason` | TEXT | Free text |
| UNIQUE | `(staff_id, override_date)` | **One row per staff per date** |

**What it supports:**
- ✅ Day-off for a specific date (`is_day_off = true`)
- ✅ Custom hours for a specific date
- ✅ Override takes full precedence over recurring schedule (enforced in RPC)
- ✅ Already used by `adjustStaffScheduleAction` in `src/lib/actions/staff-schedule-adjustments.ts`

**What it does NOT support:**
- ❌ Multiple overrides per date — same UNIQUE constraint issue as `staff_schedules`. Cannot record both an opening and closing override for the same staff on the same date.
- ❌ `shift_type` column

---

### `blocked_times` — Intra-day manual blocks

**File:** `supabase/migrations/20260429000001_core_tables.sql`

| Column | Type | Notes |
|---|---|---|
| `reason` | TEXT | CHECK: break \| leave \| training \| other |

**What it supports:**
- ✅ Break, leave, training blocks within a working day
- ✅ Multiple blocks per staff per date (no UNIQUE constraint)
- ✅ Checked by `get_available_slots` RPC and `getAvailableSlots()` engine

**What it does NOT support:**
- ❌ No `shift_transition` or `overlap_window` reason type
- ❌ Not linked to a shift type (can't identify if a block is during overlap period)

---

### `scheduling_rules` — Branch-level scheduling config

**File:** `supabase/migrations/20260520000001_scheduling_rules_foundation.sql`

Supports min staffing thresholds, day-off limits, break rules, overtime caps, and home-service travel buffers. No opening/closing concept.

### `schedule_health_checks` — Daily coverage snapshot

Has `checked_in_staff_count` column (nullable integer), but no mechanism in the app currently populates it. It is intended for future use.

### `get_available_slots` RPC — Core booking engine

**File:** `supabase/migrations/20260429000006_availability_rpc.sql`

Algorithm:
1. Get service timing (duration + buffers)
2. Get branch slot interval
3. Build `working_hours` CTE: checks `schedule_overrides` first, falls back to `staff_schedules`
4. If `is_day_off = true` → staff excluded
5. Generate slot grid within working hours
6. Cross-check bookings + `blocked_times` for conflicts
7. Return `available: boolean` for each slot

**What the RPC checks:**
- ✅ Day-off via `schedule_overrides.is_day_off`
- ✅ Custom working hours via overrides
- ✅ Recurring schedule via `staff_schedules`
- ✅ Booking conflicts
- ✅ Manual blocks (`blocked_times`)

**What the RPC does NOT check:**
- ❌ Shift type (no column exists)
- ❌ Whether staff has checked in
- ❌ Whether staff is on break (only static `blocked_times` — no live state)
- ❌ Whether staff is currently busy with another service (only via booking conflict)

---

## Existing Availability Foundation

### How "available for booking" is currently computed

**File:** `src/lib/engine/availability.ts`

Current chain:

```
get_available_slots RPC (schedule + overrides + blocked_times + bookings)
  → filterSlotsToWorkingWindows (working hours gate)
  → filterSlotsForQualifiedProviders (staff_type + staff_services capability)
  → filterPastSlotsForDate (no past slots)
```

Inputs used:
- ✅ `staff_schedules` (day-of-week recurring)
- ✅ `schedule_overrides` (date-specific override + day-off)
- ✅ `blocked_times` (manual blocks)
- ✅ `bookings` (existing booking conflicts)
- ✅ `staff_services` (service capability mapping)
- ✅ `staff.staff_type` (role-to-service filter)

Inputs NOT used:
- ❌ Staff check-in status (does not exist as a table)
- ❌ Live "on break" state (only static blocks)
- ❌ Shift type (opening vs closing)
- ❌ Branch support / borrowed staff

### `getStaffWithAvailability` — Schedule setup data loader

**File:** `src/lib/queries/staff.ts:371`

Fetches for each staff member:
- Their `staff_schedules` (all days)
- Their `schedule_overrides` (next 90 days)
- Their `blocked_times` (next 90 days)

This powers the schedule setup editor, not live availability. The function name is misleading.

---

## Existing CRM Availability Page

### Route: `/crm/staff-availability`
**File:** `src/app/(dashboard)/crm/staff-availability/page.tsx`

**What it actually is:** A schedule setup editor. It renders `StaffSchedulePageClient` fed by `getStaffWithAvailability()`, which shows each staff member's weekly schedule, upcoming overrides, and blocked times.

**What it says it is:** The page header reads "Staff Availability" with description: *"Set weekly working hours, day overrides, and blocked time for each staff member. These settings control when staff appear as bookable."*

**What CRM expects from an "Availability" page:**
- Who is scheduled today
- Who has checked in
- Who is busy right now  
- Who can be assigned a new booking
- Who is on break
- Who is on opening shift vs closing shift

**Verdict:** This page is a **Schedule Setup** page, mislabeled as "Availability." It should be renamed and a separate Live Availability page should be created.

---

## Existing CRM Schedule Page

### Route: `/crm/schedule`
**File:** `src/app/(dashboard)/crm/schedule/page.tsx`

Renders `ScheduleWorkspace` with `workspaceContext="crm"` and `viewerRole="crm"`. Fetches `getDailySchedule()` which calls the `get_daily_schedule` RPC to produce a per-staff day view with bookings and blocks.

**What this page actually shows:** A daily operational booking board — who's working today, their bookings, their start/end times, their blocks.

**What it should show:** The daily booking calendar and shift setup is appropriate here. This page is correctly named.

---

## Existing Dispatch Foundation

### `getAvailableBranchDrivers(branchId)`

**File:** `src/lib/actions/driver-actions.ts:188`

Current query:
```ts
.from("staff")
.eq("branch_id", branchId)
.eq("is_active", true)
.or("system_role.eq.driver,staff_type.eq.driver")
```

**What it checks:** Active driver staff at branch.
**What it does NOT check:**
- ❌ Whether the driver is scheduled today
- ❌ Whether the driver has a day-off override
- ❌ Whether the driver has checked in
- ❌ Whether the driver already has an active trip
- ❌ Driver capacity (concurrent trips)

The `dispatch-conflict` module (`src/lib/bookings/dispatch-conflict.ts`) checks driver capacity (concurrent home-service trips via `home_service_driver_capacity`), but `getAvailableBranchDrivers` is a simple active-staff filter with no schedule awareness.

**Impact:** CRM can assign a driver who is on day-off, has not checked in, or is already on a trip in progress. The system has no way to surface "Driver ready" vs "Driver unavailable today."

---

## Existing Staff Capability Mapping

### `staff_services` table

Junction table: `(staff_id, service_id)`. Queried by `filterSlotsForQualifiedProviders` in the availability engine.

**What it supports:**
- ✅ Explicit per-staff service assignments
- ✅ Fallback to keyword-based `staffTypeCanPerformService()` when no rows exist
- ✅ Driver / utility / CSR hard-excluded from booking as service providers (`HARD_EXCLUDED_SYSTEM_ROLES`)

**What it does NOT support:**
- ❌ Per-service availability time windows (a nail tech might only do nails in the afternoon)
- ❌ Cross-training tracking (a therapist who can also do nails)

The booking wizard filters by service capability via `getAvailableSlots`. This is consistent with the admin booking flow. No duplication was found.

---

## Current Gaps

### Gap 1 — No opening/closing shift type (HIGH RISK)

The `staff_schedules` table has a UNIQUE constraint on `(staff_id, day_of_week)`. This makes it impossible to assign a staff member to both an opening and closing shift on the same day of week without schema changes.

**Risk:** Any Phase 2 UI that lets managers assign staff to shift types will silently overwrite the existing row or throw a unique-constraint error at the DB level.

### Gap 2 — No multiple shifts per day support

Even if shift_type is added, the UNIQUE constraint must be changed from `(staff_id, day_of_week)` to `(staff_id, day_of_week, shift_type)` to allow two rows per staff per day.

The availability RPC's `working_hours` CTE would also need updating: currently it takes the first (or only) matching row per staff. With two rows (opening + closing), it would need to union both windows.

### Gap 3 — No staff check-in/check-out system

There is no `staff_attendance` or `staff_checkins` table. The system has no concept of a staff member clocking in for their shift. `schedule_health_checks.checked_in_staff_count` is nullable and currently unpopulated.

**Note:** `bookings.booking_progress_status = 'checked_in'` exists, but this is customer check-in for a booking — not staff reporting for their shift.

### Gap 4 — No live availability snapshot query

There is no function that takes `(branch_id, timestamp)` and returns:
```
{ staff_id, is_scheduled_today, is_checked_in, is_busy, is_on_break, shift_type, next_available_at }
```

The `/crm/staff-availability` page (mislabeled) cannot produce this without a new query.

### Gap 5 — Driver readiness not schedule-aware

`getAvailableBranchDrivers()` returns all active drivers regardless of their schedule, day-off status, or whether they already have an active trip. CRM cannot tell if a driver is ready vs unavailable.

### Gap 6 — Page naming collision

| Route | Nav Label | Actual Content | Correct Label |
|---|---|---|---|
| `/crm/staff-availability` | Availability | Schedule setup editor | Schedule Setup |
| `/crm/schedule` | Schedule | Daily booking board | Schedule (OK) |

The "Availability" nav item points to a schedule setup editor. CRM staff clicking "Availability" will see a schedule management table, not real-time assignability.

---

## Risk Areas

1. **Schema change for shift type** — Adding `shift_type` to `staff_schedules` requires dropping and recreating the UNIQUE constraint. This is safe on a migration but will need the existing `get_available_slots` RPC to be updated to union opening + closing windows correctly. If the RPC is updated incorrectly, public booking availability breaks.

2. **Availability engine impact** — Any change to how `get_available_slots` reads `working_hours` could break the public booking wizard. Changes must be backward-compatible (when no shift_type exists or is `single`, behavior must be identical to today).

3. **"Availability" page rename** — Renaming the existing page and updating the nav label is low-risk but must be done carefully to not break any existing links or bookmarks staff use.

---

## Recommended Phase 2B Implementation Plan

### Step 1 — Rename "Availability" nav item to "Schedule Setup" (immediate, safe)

Update `nav-config.ts`: change the label for `/crm/staff-availability` from "Availability" to "Schedule Setup" in all CRM role groups. No page changes needed.

This immediately corrects the label mismatch and sets correct expectations.

### Step 2 — Create a real `/crm/availability` route (new page)

Create `src/app/(dashboard)/crm/availability/page.tsx`.

Initial version uses existing data (no new tables required):

**Summary cards (derive from `getDailySchedule` + `getStaffByBranch`):**
- Scheduled Today — count of staff with working hours on today's date
- Off Today — count with `is_day_off = true` override
- In Progress — count with at least one `in_progress` booking today
- Available Now — count with no active booking at current time
- Drivers Ready — count of driver-type staff scheduled today

**Tabs:**
- **Live Board** — staff grid showing: name, shift window, current booking (if any), "available" badge
- **Staff List** — full list with schedule/override status
- **Schedule Issues** — staff with no schedule today (neither in `staff_schedules` nor override), likely data gaps
- **Driver Readiness** — drivers only, with trip count

All data derived from existing tables. No fake data. No new schema.

### Step 3 — Add `shift_type` to `staff_schedules` (schema change, Phase 2C)

Add migration:
```sql
ALTER TABLE staff_schedules
  ADD COLUMN IF NOT EXISTS shift_type TEXT
    NOT NULL DEFAULT 'single'
    CHECK (shift_type IN ('single', 'opening', 'closing'));

-- Drop old unique, add new unique that allows opening + closing per day
ALTER TABLE staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_day_of_week_key;

ALTER TABLE staff_schedules
  ADD CONSTRAINT staff_schedules_staff_id_day_shift_key
    UNIQUE (staff_id, day_of_week, shift_type);
```

Update `get_available_slots` RPC's `working_hours` CTE to `UNION ALL` both opening and closing windows for a given staff + date.

Update `filterSlotsToWorkingWindows` in `src/lib/engine/availability.ts` to handle multiple schedule rows per staff.

**Do this in Phase 2C — not Phase 2B.** The risk surface is the booking engine.

### Step 4 — Add staff check-in system (Phase 2D, new table required)

New table `staff_shift_checkins`:
```sql
CREATE TABLE staff_shift_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES staff(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  shift_date    DATE NOT NULL,
  shift_type    TEXT DEFAULT 'single',
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  recorded_by   UUID REFERENCES staff(id),
  notes         TEXT,
  UNIQUE (staff_id, shift_date, shift_type)
);
```

This enables "who is here right now" independent of booking activity. Required for accurate live availability.

---

## Files Inspected

| File | Purpose |
|---|---|
| `supabase/migrations/20260429000001_core_tables.sql` | Core schema: staff_schedules, schedule_overrides, blocked_times |
| `supabase/migrations/20260429000006_availability_rpc.sql` | get_available_slots RPC algorithm |
| `supabase/migrations/20260501000004_unified_booking_progress.sql` | booking_progress_status, checked_in_at (booking-level) |
| `supabase/migrations/20260520000001_scheduling_rules_foundation.sql` | scheduling_rules, schedule_suggestions, schedule_health_checks |
| `supabase/migrations/20260429000009_staff_expansion.sql` | system_role expansion, is_cross_branch |
| `supabase/migrations/20260508000001_service_eligibility.sql` | branch_services eligibility flags |
| `supabase/migrations/20260507000002_home_service_dispatch.sql` | home_service_driver_capacity |
| `src/lib/engine/availability.ts` | getAvailableSlots, assignTherapistBySeniority |
| `src/lib/queries/schedule.ts` | getDailySchedule, DailyScheduleStaffRow |
| `src/lib/queries/staff.ts` | getStaffWithAvailability, getStaffByBranch |
| `src/lib/queries/dispatch-queries.ts` | getDispatchData, computeDispatchStatus |
| `src/lib/actions/driver-actions.ts` | getAvailableBranchDrivers |
| `src/lib/staff/service-providers.ts` | canActAsBookingServiceProvider, staffTypeCanPerformService |
| `src/lib/scheduling/types.ts` | SchedulingRules, DailyCoverageSnapshot |
| `src/lib/scheduling/rules/evaluate-schedule-health.ts` | evaluateScheduleHealth |
| `src/app/(dashboard)/crm/staff-availability/page.tsx` | CRM "Availability" page (actually Schedule Setup) |
| `src/app/(dashboard)/crm/schedule/page.tsx` | CRM Schedule page (daily booking board) |

---

## Do Not Touch Yet

- `get_available_slots` RPC — any change risks breaking the public booking wizard
- `getAvailableSlots()` in `src/lib/engine/availability.ts` — same risk
- `staff_schedules` UNIQUE constraint — schema change, needs migration + RPC update together
- `schedule_overrides` UNIQUE constraint — same
- Public booking wizard (`src/components/public/booking-wizard.tsx`)
- Any dispatch business logic in `src/lib/bookings/dispatch-conflict.ts`
- Payroll or reporting flows

---

## Phase 2B Next Step

**Immediate (Phase 2B, safe, no schema changes):**

1. Rename "Availability" nav label in `nav-config.ts` → "Schedule Setup" for all CRM roles
2. Create `/crm/availability` page with live operational view using existing data:
   - Summary cards: Scheduled Today, Off Today, Busy Now, Available Now, Drivers Ready
   - Live Board tab: staff grid with shift window + current booking status
   - Schedule Issues tab: staff with no schedule data today
   - Driver Readiness tab: drivers only

**Phase 2C (schema + engine, higher risk, separate prompt):**

3. Add `shift_type` to `staff_schedules` + update UNIQUE constraint
4. Update `get_available_slots` RPC to union opening + closing windows
5. Update TypeScript engine to handle multi-row schedule per staff

**Phase 2D (new table, requires separate migration review):**

6. Add `staff_shift_checkins` table
7. Wire CRM staff check-in/check-out action
8. Update live availability query to use check-in state
