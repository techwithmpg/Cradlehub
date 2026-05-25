# HANDOFF — CradleHub

> Last updated: 2026-05-25

## Current Phase
CRM-SERVICES-PHASE4-001 complete — Services & Therapist Setup

## What Just Happened (Phase 4 — Services & Therapist Setup)
Phase 4 of CRM improvement — /crm/services upgraded into "Services & Therapist Setup":

1. **Title** changed to "Services & Therapist Setup" (icon: ✨)
2. **Section 1 — Active Services**: existing `ServicesOfferedTab` retained unchanged — manages active/in-spa/home-service flags, price overrides, visibility, adding/removing services
3. **Section 2 — Provider Assignments** (new): `CrmServiceTherapistPanel` shows per-service:
   - In-spa / Home / Visibility eligibility pills
   - Assigned provider chips (staff name + staff_type badge)
   - ⛔ critical banner for **public services with 0 valid providers** (online booking fails to show therapists)
   - ⚠️ warning for non-public services with 0 providers
   - "How provider matching works" footnote — explains `SERVICE_STAFF_TYPES` rule and hard-excluded roles
4. **New query**: `getBranchStaffAndServiceAssignments(branchId, serviceIds)` — parallel fetch of active branch staff + staff_services rows
5. **Architecture rule enforced** (display only): only `SERVICE_STAFF_TYPES` (therapist, nail_tech, aesthetician, salon_head) count as valid providers; driver and utility are hard-excluded regardless of staff_services entries

## Key Files Added (Phase 4)
- `src/lib/queries/crm-services.ts`
- `src/components/features/crm/services/crm-service-therapist-panel.tsx`

## Key Files Modified (Phase 4)
- `src/app/(dashboard)/crm/services/page.tsx`

## Phase 3 Summary (retained for context)
Phase 3 — /crm/setup into Rules & Setup Center (commit c9c3fe0):
- `src/components/features/crm/setup/crm-booking-flow-rules.tsx` (new)
- `src/components/features/crm/setup/crm-booking-impact-matrix.tsx` (new)
- `src/app/(dashboard)/crm/setup/page.tsx` (title + sections)
- `src/components/features/crm/setup/crm-setup-workspace-tiles.tsx` (updated tiles)

## Architecture Rule (carry forward)
Online booking remains strictly schedule-based.
CRM/in-house booking can use daily staff check-in and live resource readiness.
Home-service booking keeps its dispatch/location workflow.
All three flows share the scheduling/availability engine but apply it differently based on booking context.

## Known Limitations (carried forward)
1. **Group schedule shift_type in Live Availability:** getCrmAvailabilitySnapshot populates shifts[] only from individual staff_schedules. Staff with group rules but no individual row get shift_type "single" for check-in.
2. **Recommendation engine workload caps:** max_services_per_day / max_trips_per_day fetched but not used in scoring.
3. **Driver ETA scoring:** Geographic proximity / travel time not factored into driver recommendations.
4. **Provider assignment editing from CRM:** The Phase 4 panel is read-only. To assign a staff member to a service, use the owner workspace (owner → Staff → [staff member] → Services tab). A future CRM phase could add inline assignment editing directly in the services page.

## Production Readiness
- Public booking: ✅ Ready
- CRM schedule setup: ✅ Ready
- Live availability: ⚠️ Mostly ready (group shift_type gap is minor)
- CRM bookings: ✅ Ready
- Dispatch: ✅ Ready
- Staff portal: ✅ Ready
- CRM Setup Center (Rules & Setup): ✅ Ready
- CRM Today (Daily Operations Center): ✅ Ready
- CRM Services & Therapist Setup: ✅ Ready (read-only provider panel)

## Build Status
- `npx tsc --noEmit`: ✅ Passing (0 errors)

## Recommended Next Step
Consider Phase 5 options:
- Inline staff-service assignment editing within /crm/services (currently read-only, requires owner workspace)
- /crm/spaces-rules improvements (currently minimal)
- Mobile responsiveness audit across all new CRM pages
- CRM notifications and urgent action handling
