# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2X-E complete — Wire Group Schedule Rules Into Operations

## What Just Happened (2X-E)
Group schedule rules (`staff_group_schedule_rules`) are now live in all three operational systems. Staff members without individual `staff_schedules` rows now use their group's default schedule as a fallback.

**Created:**
- `supabase/migrations/20260525000001_wire_group_rules_into_availability.sql`
  - Updated `get_available_slots`: added `staff_type` to `staff_pool` CTE; added LEFT JOINs to `staff_schedule_groups` + `staff_group_schedule_rules` in `working_hours` CTE; added group fallback CASE tier
  - Updated `get_daily_schedule`: added `staff_type` to `active_staff` CTE; added same JOINs in `work_hours` CTE; group fallback in MIN/MAX aggregation

**Modified:**
- `src/lib/engine/availability.ts`
  - `filterSlotsToWorkingWindows` now accepts `branchId` param
  - Switched from single-window (earliest start only) to **multi-window** approach (array of WorkingWindow per staff) — slot passes if it fits ANY one valid window
  - Adds group rule fallback for staff without individual schedule (3 extra queries when needed: `staff`, `staff_schedule_groups`, `staff_group_schedule_rules`)
  - Call sites in `getAvailableSlots` and `getAvailableSlotsMulti` updated to pass `branchId`
  - **Also fixes a pre-existing bug**: with opening+closing shifts, old code picked earliest start only — a 16:30 slot could incorrectly be dropped if it fit closing but not opening window
- `src/lib/queries/assignment-recommendations.ts`
  - Added private `getGroupSchedulesFallback()` helper
  - `buildContextFromBooking` now adds group schedule rows for staff with no individual schedule
  - Recommendation scoring now uses the same effective schedule truth as the booking engine

## Effective Priority Rule (now enforced everywhere)
```
1. schedule_overrides.is_day_off = TRUE   → staff off, no slots
2. schedule_overrides with explicit times → use override window
3. staff_schedules row for that day        → individual schedule
4. staff_group_schedule_rules for that day → group default (WIRED IN)
5. no rule at all                          → no schedule / no slots
6. blocked_times apply on top
7. booking conflicts apply on top
```

## Recommended Next Step
Phase 2X-F — Manager Schedule Setup Parity:
- `manager/staff-availability` still shows legacy individual-only `StaffSchedulePageClient`
- `/crm/staff-availability` has the full group rules `ScheduleSetupWorkspace`
- 2X-F: make `/manager/staff-availability` use the same `ScheduleSetupWorkspace` as CRM

## Known Limitations (carried forward)
1. **Therapist assignment is recommendation-only** — no assign action exists
2. **No workload caps enforced** — `max_services_per_day` fetched but not scored
3. **No ETA/travel time in driver scoring** — geographic proximity not factored
4. **Migration not applied to live DB yet** — `pnpm db:push` or Supabase dashboard apply needed

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes
