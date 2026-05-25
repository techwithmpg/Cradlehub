# HANDOFF — CradleHub

> Last updated: 2026-05-25

## Current Phase
CRM-TODAY-PHASE2-001 complete — Daily Operations Center UI

## What Just Happened
Phase 2 of CRM improvement — /crm/today reorganised into a clear Daily Operations Center:

1. **Title** changed to "Daily Operations Center"
2. **TodayWorkflowStrip** — calm visual guide: Start Day → Serve Customers → Confirm Bookings → Monitor Operations → Emergency Actions
3. **"Serve Customers" section** wraps quick actions with label + description
4. **"Today's Operational Snapshot" section** wraps KPI cards with label + description
5. **Booking queue empty state** now says: "No active bookings right now. Use New Walk-in, New Home Service, or Online Requests to begin today's front-desk flow."
6. **TodaySystemMatchStatus** card below queue — 6 links to existing operational tools (no new queries)
7. **TodayEmergencyActions** card below System Match Status — 6 mid-shift action links
8. **Staff Readiness card** now opens with "Start Day" label + "Check who is present, missing, and ready before accepting walk-ins."
9. Day Progress and Payment Summary remain untouched in right rail.

## Key Files Added
- `src/components/features/crm/today/today-workflow-strip.tsx`
- `src/components/features/crm/today/today-system-match-status.tsx`
- `src/components/features/crm/today/today-emergency-actions.tsx`

## Key Files Modified
- `src/app/(dashboard)/crm/today/page.tsx`
- `src/components/features/crm/today/crm-booking-queue-panel.tsx`
- `src/components/features/crm/today/today-staff-readiness.tsx`
- `src/components/features/crm/today/today-quick-actions.tsx`
- `src/components/features/crm/today/today-priority-strip.tsx`

## Architecture Rule (carry forward)
Online booking remains strictly schedule-based.
CRM/in-house booking can use daily staff check-in and live resource readiness.
Home-service booking keeps its dispatch/location workflow.
All three flows share the scheduling/availability engine but apply it differently based on booking context.

## Known Limitations (carried forward)
1. **Group schedule shift_type in Live Availability:** `getCrmAvailabilitySnapshot` populates `shifts[]` only from `staff_schedules` (individual). Staff with group rules but no individual schedule get `shift_type: "single"` for check-in.
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
- CRM Today (Phase 2): ✅ Ready

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 85 app routes

## Recommended Next Step
Phase 3 — Turn /crm/setup into a proper Rules & Setup Center:
- Current active rules summary
- Services & therapist assignments
- Schedule setup overview
- Spaces/resources & booking rules
- Staff-service assignments
- Setup health checks & issues list
