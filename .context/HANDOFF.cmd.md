# HANDOFF — CRM-OPS-002B

## Date
2026-05-21

## What Changed

### Nav Restructure
**File:** `src/components/features/dashboard/nav-config.ts`

- CRM / CSR-Head Main Operations: "Availability" now points to `/crm/availability` (live view)
- CRM / CSR-Head Staff & Internal Work: added "Schedule Setup" → `/crm/staff-availability`
- CSR-Staff has no Availability or Schedule Setup items (unchanged)

### Schedule Setup Page Rename
**File:** `src/app/(dashboard)/crm/staff-availability/page.tsx`
- Page title changed from "Staff Availability" to "Schedule Setup"
- Route unchanged (`/crm/staff-availability`)

### Live Availability Query
**File:** `src/lib/queries/crm-availability.ts`

New function `getCrmAvailabilitySnapshot({ branchId, date, now? })`:
- Calls `getDailySchedule()` + `getStaffByBranch()` in parallel
- Builds `scheduleStatus` (`scheduled | off_today | no_schedule`) from override + schedule data
- Builds `liveStatus` (`available_now | busy_now | off_today | no_schedule`) from active bookings
- Derives `is_driver` and `is_service_provider` per staff
- Returns typed `CrmAvailabilitySnapshot` with `staff[]` + `summary` counts
- No schema changes, no RPC changes — safe Phase 2B only

### Live Availability Page
**File:** `src/app/(dashboard)/crm/availability/page.tsx`
- Server component at `/crm/availability`
- Uses `getManagerBranchId()` for branch resolution
- Renders `CrmAvailabilitySummary` (6 stat cards) + `CrmAvailabilityClient` (tabbed board)

### Availability Components
**Directory:** `src/components/features/crm/availability/`
- `crm-availability-summary.tsx` — 6 StatCards: Scheduled, Available, Busy, Off, No Schedule, Drivers Ready
- `crm-availability-board.tsx` — grid rows: staff name/type | status dot | shift window | active booking
- `crm-availability-client.tsx` — client tab bar: All Staff / Service Providers / Drivers / Schedule Issues

---

## Build / Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 84 app routes (was 83)

## Git
- Commit: `6efd4fc` on `main`
- Files changed: 7 (5 created, 2 modified)

---

## Do Not Touch
- `get_available_slots` RPC
- `getAvailableSlots()` in `src/lib/engine/availability.ts`
- `staff_schedules` UNIQUE constraint

---

## Phase 2C Plan (Next — separate prompt, higher risk)
- Add `shift_type` column to `staff_schedules`
- Change UNIQUE constraint from `(staff_id, day_of_week)` to `(staff_id, day_of_week, shift_type)`
- Update `get_available_slots` RPC to handle multiple schedule rows per staff per day
- Risk: touches core booking engine — needs migration review

## Phase 2D Plan (separate migration)
- Add `staff_shift_checkins` table
- Staff check-in/check-out server action
- Wire check-in state into `getCrmAvailabilitySnapshot()` to surface physical presence
