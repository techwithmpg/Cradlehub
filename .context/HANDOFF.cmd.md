# HANDOFF — CRM-OPS-002A

## Date
2026-05-21

## What Changed

### Audit Document
**File:** `docs/phase-2-shift-aware-availability-audit.md`

Full technical audit covering:
- Schedule foundation (`staff_schedules`, `schedule_overrides`, `blocked_times`)
- Availability engine (`get_available_slots` RPC, `getAvailableSlots()` TypeScript chain)
- CRM availability and schedule pages (what they actually show vs what CRM expects)
- Dispatch readiness (`getAvailableBranchDrivers` and its gaps)
- Staff capability mapping (`staff_services`, `staffTypeCanPerformService`)
- Missing tables and schema constraints
- Phase 2B–2D implementation plan

---

## Critical Findings

### 1 — `staff_schedules` cannot support opening + closing shifts
UNIQUE constraint `(staff_id, day_of_week)` allows only **one row per staff per weekday**.  
Adding `shift_type` and changing the constraint to `(staff_id, day_of_week, shift_type)` is required.  
⚠️ This also requires updating the `get_available_slots` RPC — risk to public booking engine.

### 2 — "Availability" nav item is mislabeled
`/crm/staff-availability` renders `StaffSchedulePageClient` — a schedule setup editor.  
The nav label should be "Schedule Setup", not "Availability".  
A real live availability page at `/crm/availability` must be created.

### 3 — No staff check-in system
There is no `staff_attendance` or `staff_checkins` table.  
`bookings.checked_in_at` exists but records **customer** check-in for a booking, not staff reporting for shift.  
`schedule_health_checks.checked_in_staff_count` column exists but is always NULL (nothing populates it yet).

### 4 — Driver readiness not schedule-aware
`getAvailableBranchDrivers()` returns all active drivers regardless of schedule, day-off, or active trips.  
CRM cannot surface "Driver ready vs unavailable today" without fixing this.

---

## Phase 2B Plan (Next Step)

**Safe — no schema changes, no engine changes:**

1. Rename "Availability" nav label → "Schedule Setup" in `nav-config.ts` for all CRM roles
2. Create new `/crm/availability` page using existing data:
   - Summary cards: Scheduled Today, Off Today, Busy Now, Available Now, Drivers Ready
   - Live Board: staff grid with shift window + current booking status
   - Schedule Issues: staff with no schedule set for today
   - Driver Readiness: driver-type staff only

Data sources (all existing):
- `getDailySchedule()` → who's working, their bookings, their blocks
- `getStaffByBranch()` → full staff list for the branch
- `bookings` with `status IN ('in_progress', 'confirmed')` → who is busy right now

**Phase 2C — schema change (separate prompt, higher risk):**
- Add `shift_type` to `staff_schedules` + update UNIQUE constraint
- Update `get_available_slots` RPC to handle multiple schedule rows per staff

**Phase 2D — new table (separate migration review):**
- `staff_shift_checkins` table
- Staff check-in/check-out server action
- Wire check-in state into live availability query

---

## Do Not Touch
- `get_available_slots` RPC
- `getAvailableSlots()` in `src/lib/engine/availability.ts`
- `staff_schedules` UNIQUE constraint (until Phase 2C prompt)
- Public booking wizard

---

## Build / Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 83 app routes

## Git
- Branch: `main` — no branch or worktree created
- Audit only — no code, schema, or RLS changes
