# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2I complete — Driver/Therapist Assignment Recommendation Engine

## What Just Happened
- Built pure scoring engine (`src/lib/assignments/recommendation-engine.ts`) for therapist and driver candidates.
- Built query layer (`src/lib/queries/assignment-recommendations.ts`) that fetches all context in parallel.
- Built server actions (`src/lib/actions/assignment-recommendations.ts`) with branch scope and role guards.
- Built UI components (`assignment-recommendation-card.tsx`, `assignment-recommendation-panel.tsx`).
- Integrated into CRM bookings detail panel (therapist + driver recommendations).
- Integrated into CRM dispatch workspace (driver recommendations for awaiting-driver items).

## Known Limitations
1. **Group schedules not wired into recommendations:** The engine reads `staff_schedules` directly. Phase 2H created `staff_group_schedule_rules` but they are not yet used by the recommendation engine (same limitation as `get_available_slots`).
2. **Therapist assignment is recommendation-only in booking panel:** No existing "assign therapist to existing booking" UI action exists. Assignment happens during booking creation or via edit booking flow.
3. **Driver assignment is wired:** Uses existing `assignBookingDriverAction`.
4. **No workload caps enforced:** `staff_scheduling_preferences.max_services_per_day` and `max_trips_per_day` are fetched but not yet used in scoring.
5. **No ETA/travel time in driver scoring:** Geographic proximity is not factored into driver recommendations yet.

## Recommended Next Step
Phase 2X — Operations Unification Pass (consolidate recommendations, assignments, and dispatch readiness into a single operational view).

## Files to Know
- `src/lib/assignments/recommendation-engine.ts` — Scoring logic
- `src/lib/queries/assignment-recommendations.ts` — Data fetching
- `src/lib/actions/assignment-recommendations.ts` — Server actions
- `src/components/features/assignments/` — UI components
- `src/components/features/bookings/bookings-table.tsx` — Booking detail panel integration
- `src/components/features/dispatch/dispatch-workspace.tsx` — Dispatch integration

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes
