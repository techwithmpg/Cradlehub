# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2X-D complete — Public Booking Group Schedule Integration Review (audit/design only)

## What Just Happened (2X-D)
Full audit of `get_available_slots` and related systems. Design document produced. No code modified.

**Key findings:**
- The gap is in the `working_hours` CTE of `get_available_slots` — the `ELSE NULL` branch that fires when a staff member has no `staff_schedules` row. Group rules are never consulted.
- There are **two** places to fix (they must ship together): the SQL RPC and the TypeScript `filterSlotsToWorkingWindows` post-filter in `availability.ts`. If only the RPC is updated, the TypeScript filter will drop all group-rule generated slots.
- `get_daily_schedule` has the same gap and must also be updated for CRM board consistency.
- The link between staff and their group is via `staff.staff_type = staff_schedule_groups.group_key`. There is no `group_id` FK on `staff`. The `staff_pool` CTE in the RPC needs `staff_type` added.
- `get_available_slots` is SECURITY DEFINER — bypasses RLS correctly, new JOINs will work.
- `applyGroupScheduleToStaffAction` (copies group rules to individual schedules) remains valid but is no longer the primary mechanism after 2X-E.

**Design document created:**
- `docs/phase-2x-d-group-schedule-integration-design.md`

## Approved Priority Rule
```
1. schedule_overrides.is_day_off = TRUE   → staff is off (no slots)
2. schedule_overrides with explicit times → use override window
3. staff_schedules row(s) for that day    → use individual schedule
4. staff_group_schedule_rules for that day → use group default (CURRENTLY MISSING)
5. No rule at all                         → no slots
6. blocked_times apply on top
7. Booking conflicts apply on top
```

## Recommended Next Step
Phase 2X-E — Wire Group Rules into Operational Systems:

1. **Migration** `supabase/migrations/20260524000002_wire_group_rules_into_availability.sql`:
   - Add `staff_type` to `staff_pool` CTE in `get_available_slots`
   - Add LEFT JOINs to `staff_schedule_groups` + `staff_group_schedule_rules` in `working_hours` CTE
   - Add group fallback CASE tier (see design doc §5.1)
   - Same update to `get_daily_schedule` (see design doc §5.2)
2. **`src/lib/engine/availability.ts`** — Update `filterSlotsToWorkingWindows`:
   - Add `branchId` parameter
   - Add group rule fallback for staff with no individual schedule (see design doc §5.3)
3. **`src/lib/queries/assignment-recommendations.ts`** — Update schedule fetching to also consult group rules for staff without individual schedules (or add `getGroupSchedulesForScoring` helper)
4. Run type-check, lint, build, manual smoke test
5. Commit: `feat(availability): wire group schedule rules into booking engine`

## Files to Know
- `docs/phase-2x-d-group-schedule-integration-design.md` — Full audit + design (READ BEFORE 2X-E)
- `supabase/migrations/20260522000004_add_shift_type_to_staff_schedules.sql` — Current (latest) `get_available_slots` implementation
- `supabase/migrations/20260524000001_staff_group_schedule_rules.sql` — Group tables + RLS
- `src/lib/engine/availability.ts` — TypeScript availability engine (filterSlotsToWorkingWindows needs group fallback)
- `src/lib/queries/assignment-recommendations.ts` — Recommendation scoring (also needs group fallback)
- `src/lib/actions/staff-schedule-groups.ts` — `applyGroupScheduleToStaffAction` (remains valid, no changes)

## Known Limitations (carried forward)
1. **CRITICAL:** Group schedule fallback not yet wired — fix is 2X-E
2. **HIGH:** `manager/staff-availability` still shows legacy individual-only editor — fix is 2X-F
3. **Therapist assignment is recommendation-only** — no assign action exists
4. **No workload caps enforced** — `max_services_per_day` fetched but not scored
5. **Recommendation engine also ignores group schedules** — separate sub-task within 2X-E

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes
