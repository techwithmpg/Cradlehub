# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2X-F complete — Manager Schedule Setup Parity

## What Just Happened
- `/manager/staff-availability` now uses the same full `ScheduleSetupWorkspace` as `/crm/staff-availability`.
- Manager sees General Rules, Individual Adjustments, Overrides, and Coverage Issues tabs.
- Manager can view and edit group schedule rules and individual schedules.
- No new components created — pure page-level alignment.

## Known Limitations
1. **Group schedules not wired into availability RPC:** `get_available_slots` still reads individual `staff_schedules` only.
2. **Group schedules used in recommendation engine:** Phase 2X-E wired group rules into recommendation context.
3. **Manager and CRM share identical workspace:** No role-specific differences in the UI yet.

## Files to Know
- `src/app/(dashboard)/manager/staff-availability/page.tsx` — Manager schedule setup
- `src/app/(dashboard)/crm/staff-availability/page.tsx` — CRM schedule setup (identical pattern)
- `src/components/features/staff-schedule/schedule-setup-workspace.tsx` — Shared workspace

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes

## Recommended Next Step
Phase 2X-G — Dead Code / Legacy Cleanup (remove old duplicate schedule components now that both pages use the shared workspace).
