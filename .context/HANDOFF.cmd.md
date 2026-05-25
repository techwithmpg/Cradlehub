# HANDOFF — CradleHub

> Last updated: 2026-05-25

## Current Phase
CRM-SPACES-PHASE6-001 complete — Spaces & Booking Rules Center

## What Just Happened (Phase 6 — Spaces & Booking Rules Center)
Phase 6 — /crm/spaces-rules upgraded into "Spaces & Booking Rules Center":

1. **Permission extension** (`resources-actions.ts`): `requireOwnerOrManager` now includes `crm` and `csr_head` with branch-scope check — consistent with `requireOwnerOrBranchManager` pattern in `branches/actions.ts`. All three resource mutations also revalidate `/crm/spaces-rules`.
2. **CRM resource management enabled**: `canManageResources={true}` — CRM can add/edit/toggle rooms and resources. Server action validates role + branch_id.
3. **Booking rules kept read-only for CRM**: `canEditRules={false}` — booking rules control online booking time windows, home-service availability, and advance-booking limits. These settings directly affect live online booking; tightening to manager/owner only is the safe choice (documented here).
4. **Booking Rules tab now visible for CRM**: Changed `canViewBookingRules` and `showActiveRulesKpi` from `workspaceContext !== "crm"` to `true` so CRM can see (but not edit) the active rules.
5. **SpacesRulesExplainer** (`spaces-rules-explainer.tsx`): 3 cards for In-Spa, In-House/Walk-In, and Home-Service — explains what each booking flow uses and how spaces/rules affect them. Architecture note banner.
6. **SpacesRulesHealthSummary** (`spaces-rules-health-summary.tsx`): 8 stat cards from already-fetched `ResourceRow[]` + `BranchBookingRules` — no extra queries.
7. **SpacesRulesAccessNotice** (`spaces-rules-access-notice.tsx`): Clear can/cannot two-column notice for CRM scope.
8. **SpacesRulesRelatedTools** (`spaces-rules-related-tools.tsx`): Footer links to Today, Live Availability, Services, Schedule Setup, Rules & Setup.
9. **Page title** → "Spaces & Booking Rules Center" with `PageHeader`, description updated.

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
- CRM Spaces & Booking Rules Center: ✅ Ready (resource editing enabled, booking rules read-only for CRM)

## Known Limitations (updated Phase 6)
6. **CRM cannot edit booking rules**: `updateBranchBookingRules` in `branch-booking-rules.ts` gates on `manager/assistant_manager/store_manager/owner`. Booking rules control online booking time windows, home-service enable/disable, and advance-booking limits — higher risk than resource toggling. Keep manager/owner-only. If operational need arises, add `crm` to `canManageBranchRules` and revalidate booking paths.

## Build Status
- `npx tsc --noEmit`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing (85/85 routes)

## Recommended Next Step
Consider Phase 7:
- /crm/availability → Live Availability & Check-In Center (CRM manage daily staff check-in, live presence, missing staff, same-day operational reality)
- Mobile responsiveness audit across all new CRM pages (Phases 1–6 touched 10+ pages)
- CRM notifications and urgent action handling
- Tighten provider assignment permissions from CRM to manager/owner once system is stable
