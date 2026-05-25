# HANDOFF — CradleHub

> Last updated: 2026-05-25

## Current Phase
CRM-SAFE-TWEAKS-001 complete — CRM Safe Usability Tweaks (Phase 1)

## What Just Happened
Phase 1 CRM usability tweaks — small, safe, regression-resistant changes:

1. `/crm` now redirects to `/crm/today` (was `/crm/control`).
2. `/crm/availability` notice now explicitly states online booking remains schedule-based and is NOT controlled by the check-in board.
3. CRM Today quick actions replaced with 5 focused buttons: New Walk-in, New Home Service, Online Requests, Search Customer, Live Availability.
4. `/crm/bookings/new?type=walkin` opens the wizard defaulting to in-spa. `/crm/bookings/new?type=home_service` opens defaulting to home service.
5. Staff Readiness "Full View" link corrected to `/crm/availability` (was `/crm/staff-availability`).
6. CRM/CSR Head sidebar: "Ops Setup" → "Rules & Setup", "Spaces" → "Spaces & Rules". No routes removed.

## Key Files Changed
- `src/app/(dashboard)/crm/page.tsx`
- `src/app/(dashboard)/crm/availability/page.tsx`
- `src/app/(dashboard)/crm/bookings/new/page.tsx`
- `src/components/public/booking-wizard.tsx` — added optional `initialVisitType?: VisitType` prop
- `src/components/features/crm/today/today-quick-actions.tsx`
- `src/components/features/crm/today/today-staff-readiness.tsx`
- `src/components/features/dashboard/nav-config.ts`

## Architecture Rule (carry forward)
Online booking remains strictly schedule-based.
CRM/in-house booking can use daily staff check-in and live resource readiness.
Home-service booking keeps its dispatch/location workflow.
All three flows share the scheduling/availability engine but apply it differently based on booking context.

## Known Limitations (carried from CRM-OPS-003)
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
- CRM Setup Center: ✅ Ready
- CRM Today (Phase 1 tweaks): ✅ Ready

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 85 app routes

## Recommended Next Step
Phase 2 — CRM Daily Operations Center redesign:
- Make `/crm/today` the full CRM Daily Operations Center
  (Start Day, Serve Customers, System Match Status, CRM Confirms, Monitor Operations, Emergency Actions)
- Make `/crm/setup` the Rules & Setup Center
  (Current rules, Services, Schedule setup, Spaces/resources, Staff-service assignments, Setup issues)
