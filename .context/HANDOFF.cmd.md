# HANDOFF — CradleHub

> Last updated: 2026-05-25

## Current Phase
CRM-SETUP-PHASE3-001 complete — Rules & Setup Center

## What Just Happened
Phase 3 of CRM improvement — /crm/setup converted into a clear Rules & Setup Center:

1. **Title** changed to "Rules & Setup Center"
2. **Section 1 — Booking Flow Rules**: 3 cards (Online Booking / In-House Walk-In / Home Service) each with badge (Schedule-based / Live operations / Dispatch workflow), description, and 3 quick links
3. **Section 2 — Setup Health**: existing CrmSetupHealthCards, unchanged
4. **Section 3 — Setup Issues**: existing CrmSetupIssuesList, unchanged
5. **Section 4 — Setup Workspaces**: updated tiles now link to Services & Therapists, Schedule Setup, Spaces & Rules, Live Availability, Dispatch, Daily Operations Center
6. **Section 5 — What affects each booking type?**: booking impact matrix — 10 data-factor rows × 3 booking type columns; scrollable on mobile

## Key Files Added
- `src/components/features/crm/setup/crm-booking-flow-rules.tsx`
- `src/components/features/crm/setup/crm-booking-impact-matrix.tsx`

## Key Files Modified
- `src/app/(dashboard)/crm/setup/page.tsx`
- `src/components/features/crm/setup/crm-setup-workspace-tiles.tsx`

## Key Files Untouched (reused as-is)
- `src/components/features/crm/setup/crm-setup-health-cards.tsx`
- `src/components/features/crm/setup/crm-setup-issues-list.tsx`
- `src/lib/queries/crm-setup.ts`

## Architecture Rule (carry forward)
Online booking remains strictly schedule-based.
CRM/in-house booking can use daily staff check-in and live resource readiness.
Home-service booking keeps its dispatch/location workflow.
All three flows share the scheduling/availability engine but apply it differently based on booking context.

## Known Limitations (carried forward)
1. **Group schedule shift_type in Live Availability:** getCrmAvailabilitySnapshot populates shifts[] only from individual staff_schedules. Staff with group rules but no individual row get shift_type "single" for check-in.
2. **Recommendation engine workload caps:** max_services_per_day / max_trips_per_day fetched but not used in scoring.
3. **Driver ETA scoring:** Geographic proximity / travel time not factored into driver recommendations.
4. **Workspace tiles "Services & Therapists":** Note in tile description says "review or manage where available" — full therapist-service assignment editing is Phase 4 scope.

## Production Readiness
- Public booking: ✅ Ready
- CRM schedule setup: ✅ Ready
- Live availability: ⚠️ Mostly ready (group shift_type gap is minor)
- CRM bookings: ✅ Ready
- Dispatch: ✅ Ready
- Staff portal: ✅ Ready
- CRM Setup Center (Rules & Setup): ✅ Ready
- CRM Today (Daily Operations Center): ✅ Ready

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 85 app routes

## Recommended Next Step
Phase 4 — Improve service and therapist setup inside /crm/services:
- Service visibility management (in-spa / home-service eligibility flags)
- Therapist-service assignment (clear assignment UI, warnings for unassigned services)
- Service readiness warnings (service with no qualified therapist = blocked bookings)
- Preventing drivers/utility staff from appearing as service providers
- Clearer mobile UI for service setup
