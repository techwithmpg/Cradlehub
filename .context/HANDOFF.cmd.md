# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2X-H complete — End-to-End Operations Smoke Test

## What Just Happened
- Full operational workflow verified: public booking → CRM schedule setup → live availability → CRM bookings → dispatch → staff portal.
- Critical bug fixed: online booking notification failure no longer falsely reports booking failure.
- Medium bugs fixed: driver assignment UI now refreshes correctly in both bookings panel and dispatch workspace.
- Minor fix: removed unused `rawBlocks` prop from staff schedule page.
- Smoke test report created at `docs/phase-2x-h-end-to-end-smoke-test.md`.

## Known Limitations
1. **Group schedule shift_type in Live Availability:** `getCrmAvailabilitySnapshot` populates `shifts[]` only from `staff_schedules` (individual). Staff with group rules but no individual schedule get `shift_type: "single"` for check-in, which may not match their group rule's `shift_type`.
2. **Recommendation engine workload caps:** `max_services_per_day` / `max_trips_per_day` from `staff_scheduling_preferences` are fetched but not used in scoring.
3. **Driver ETA scoring:** Geographic proximity / travel time is not factored into driver recommendations.

## Production Readiness
- Public booking: ✅ Ready
- CRM schedule setup: ✅ Ready
- Live availability: ⚠️ Mostly ready (group shift_type gap is minor)
- CRM bookings: ✅ Ready
- Dispatch: ✅ Ready
- Staff portal: ✅ Ready

## Files to Know
- `docs/phase-2x-h-end-to-end-smoke-test.md` — Smoke test report
- `src/lib/actions/online-booking.ts` — Fixed notification best-effort pattern
- `src/components/features/bookings/bookings-table.tsx` — Fixed driver assign refresh
- `src/components/features/dispatch/dispatch-workspace.tsx` — Fixed driver assign refresh

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes

## Recommended Next Step
Phase 2J — Staff Shift Requests
