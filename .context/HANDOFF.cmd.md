# HANDOFF — CradleHub

> Last updated: 2026-05-25

## Current Phase
CRM-SCHEDULE-PHASE5-001 complete — Schedule Setup Center

## What Just Happened (Phase 5 — Schedule Setup Center)
Phase 5 — /crm/staff-availability upgraded into "Schedule Setup Center":

1. **ScheduleSetupExplainer** (`schedule-setup-explainer.tsx`): 3-card explanation of each schedule layer (Weekly Schedule → affects online booking, Overrides/Blocked Time → blocks specific slots, Live Check-In → in-house only). Architecture note banner: "Online booking follows saved schedules and blocked time — not daily staff check-in."
2. **ScheduleSetupHealthSummary** (`schedule-setup-health-summary.tsx`): 6 stat cards (Active Staff, With Schedule, Missing Schedule, Schedule Groups, Overrides This Week, Blocked Time This Week) computed from already-fetched `StaffScheduleItem[]` — no new query. Warning banner when any staff have no individual schedule, pointing to Coverage Issues tab.
3. **ScheduleRelatedTools** (`schedule-related-tools.tsx`): Footer link cards to Live Availability, Daily Operations Center, and Services & Therapist Setup.
4. **Page title**: "Schedule Setup" → "Schedule Setup Center", description updated to mention online booking + in-house + home-service.
5. **ScheduleSetupWorkspace** (4-tab editor) preserved exactly as-is.

## What Just Happened (Phase 4B — CRM Provider Assignment Management)
Phase 4B — CRM can now assign/remove service providers from /crm/services:

1. **Server actions** (`src/app/(dashboard)/crm/services/actions.ts`):
   - `assignProviderToServiceAction`: validates role → branch → service-active → staff-eligible → no-duplicate → inserts staff_services
   - `removeProviderFromServiceAction`: same guards + **last-provider protection** (blocks removal if it would leave a public active service with 0 valid providers)
2. **ProviderAssignmentCard** (client): per-service interactive row — assign dropdown (pre-filtered to valid/unassigned providers only), provider chips with ✕ remove buttons, inline status feedback
3. **ServiceRow shared type** in `types.ts` — used by both server panel and client card
4. **Panel refactored** from client to server/client split — server computes `ServiceRow[]` including `assignableProviders`, delegates interactivity to client cards
5. **MVP access notice** added to panel — explains temporary CRM permission and what types are excluded

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
4. **CRM provider assignment is MVP-broad:** CRM setup roles can manage assignments for immediate operational use. Tighten to manager/owner-only once stable (HANDOFF note, not a bug).
5. **staff_services has no branch_id column:** Assignments are global to the staff/service relationship, not branch-scoped. This matches the existing system design — staff_type and branch_id on the staff table provide indirect branch scoping.

## Production Readiness
- Public booking: ✅ Ready
- CRM schedule setup: ✅ Ready
- Live availability: ⚠️ Mostly ready (group shift_type gap is minor)
- CRM bookings: ✅ Ready
- Dispatch: ✅ Ready
- Staff portal: ✅ Ready
- CRM Setup Center (Rules & Setup): ✅ Ready
- CRM Today (Daily Operations Center): ✅ Ready
- CRM Services & Therapist Setup: ✅ Ready (editable provider assignments with guardrails)
- CRM Schedule Setup Center: ✅ Ready (explainer cards + health summary + workspace + related tools)

## Build Status
- `npx tsc --noEmit`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing (85/85 routes)

## Recommended Next Step
Consider Phase 6 options:
- /crm/spaces-rules improvements (currently minimal)
- Mobile responsiveness audit across all new CRM pages (Phases 1–5 touched 9+ pages)
- CRM notifications and urgent action handling
- Tighten provider assignment permissions from CRM to manager/owner once system is stable (already documented as MVP-broad)
