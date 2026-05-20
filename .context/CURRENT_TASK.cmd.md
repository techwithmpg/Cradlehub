# CURRENT TASK: MANAGER-STAFF-AVAILABILITY-001

## Status
Completed on 2026-05-20.

## Description
Created a production-ready manager page at `/manager/staff-availability` for setting weekly working hours, day overrides, day off, and blocked time per staff member. The booking engine already respects the underlying tables — this page gives the manager full visibility and control.

## Files Created
- `src/app/(dashboard)/manager/staff-availability/page.tsx`

## Files Modified
- `src/lib/queries/staff.ts` — added `StaffAvailabilityItem` type and `getStaffWithAvailability(branchId)` (parallel fetch with 90-day window, schema fallback)
- `src/components/features/staff-schedule/staff-weekly-hours-editor.tsx` — added `onSave?` prop
- `src/components/features/staff-schedule/staff-day-overrides-editor.tsx` — added `onSave?` prop
- `src/components/features/staff-schedule/staff-block-time-editor.tsx` — added `onSave?` prop
- `src/components/features/staff-schedule/staff-schedule-detail-panel.tsx` — added `onSave?` and threaded down
- `src/components/features/staff-schedule/staff-schedule-page-client.tsx` — wired PremiumSuccessToast
- `src/components/features/dashboard/nav-config.ts` — added "Availability" to manager nav
- `src/app/(dashboard)/manager/staff/actions.ts` — revalidatePath for new route in all 4 actions

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 82 app routes

## Notes
- Route at `/manager/staff-availability` avoids conflict with `/manager/staff/[staffId]` dynamic segment.
- All staff visible (active + inactive) for full availability setup before go-live.
- Booking engine untouched — engine already reads `staff_schedules`, `schedule_overrides`, `blocked_times`.
- No new npm packages. No DB changes.
