# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2X-G complete — Dead Code / Legacy Cleanup

## What Just Happened
- Deleted `src/components/features/schedule/staff-schedule-grid.tsx` (336 lines, unreferenced legacy schedule grid).
- Deleted `src/components/features/dashboard/schedule-manager.tsx` (569 lines, unreferenced legacy schedule manager).
- All other schedule components verified still in use — none deleted.

## Known Limitations
1. **Group schedules not wired into availability RPC:** `get_available_slots` still reads individual `staff_schedules` only.
2. **Recommendation engine uses `staff_schedules` directly:** Group rules exist but don't affect recommendations yet.
3. **QUICK_ACTIONS placeholder still rendered:** User-visible "Coming later" list in schedule setup right rail.

## Files to Know
- `src/components/features/staff-schedule/schedule-setup-workspace.tsx` — Shared workspace (CRM + Manager)
- `src/app/(dashboard)/crm/staff-availability/page.tsx` — CRM schedule setup
- `src/app/(dashboard)/manager/staff-availability/page.tsx` — Manager schedule setup

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes

## Recommended Next Step
Phase 2X-H — End-to-End Operations Smoke Test
