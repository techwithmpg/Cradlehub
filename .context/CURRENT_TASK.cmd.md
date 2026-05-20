# CURRENT TASK: SCHEDULE-ADJUSTMENT-001

## Status
Completed on 2026-05-20.

## Description
Added manual individual staff schedule adjustment control to the existing manager/CRM schedule workflow.

## Files Created
- `src/lib/actions/staff-schedule-adjustments.ts`
- `src/components/features/schedule/manual-staff-schedule-adjustment.tsx`

## Files Modified
- `src/components/features/schedule/schedule-workspace.tsx`
- `src/components/features/schedule/schedule-board-panel.tsx`
- `src/components/features/schedule/schedule-staff-mode.tsx`
- `src/lib/queries/schedule.ts`
- `src/lib/permissions.ts`
- `.context/CHANGELOG.cmd.md`
- `.context/HANDOFF.cmd.md`
- `.context/ERRORS.cmd.md`
- `docs/PROJECT_CONTEXT.md`

## Verification
- `pnpm type-check`: Passing
- `pnpm lint`: Passing
- `pnpm build`: Passing, 83 app routes

## Notes
- The control appears inside schedule staff mode rather than creating a new scheduling page.
- Shared server action enforces authenticated user, role permission, branch scope, and target staff branch membership.
- Existing availability engine already respects `schedule_overrides`, `blocked_times`, `staff_schedules`, and bookings, so no engine rewrite was needed.
