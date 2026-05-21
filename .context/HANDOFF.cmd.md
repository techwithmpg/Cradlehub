# HANDOFF — CradleHub

> Last updated: 2026-05-21

## Current Phase
Phase 2X-B complete — Shared UI Component Consolidation

## What Just Happened (2X-B)
Consolidated duplicated UI components and time-format helpers identified in the Phase 2X-A audit.

**Created:**
- `src/lib/utils/time-format.ts` — `formatTime12h(time: string | null | undefined): string`
- `src/components/shared/shift-type-badge.tsx` — `ShiftTypeBadge` (opening/closing/single)
- `src/components/shared/presence-status-badge.tsx` — `PresenceStatusBadge`
- `src/components/shared/availability-status-badge.tsx` — `AvailabilityStatusBadge` (dot + label)

**Updated (duplicates removed):**
- `crm-availability-board.tsx` — removed `SHIFT_BADGE`, `ShiftBadge`, `PresenceBadge`, `formatTime`
- `crm-availability-client.tsx` — removed `SHIFT_BADGE`, `STATUS_DOT`, `STATUS_LABEL`, `PresencePill`, `formatTime`
- `staff-schedule-row.tsx` — removed `SHIFT_BADGE_COLORS`, local `ShiftBadge`
- `group-schedule-rules-panel.tsx` — removed local `shortTime()`
- `staff-schedule-summary.ts` — removed private `shortTime()`, uses `formatTime12h`
- `dispatch-workspace.tsx` — removed local `fmt12h()`, uses `formatTime12h`
- `dispatch-queries.ts` — removed local `fmt12h()` (UI formatting helper was misplaced in a query file)

Key findings:
1. **CRITICAL:** `staff_group_schedule_rules` (Phase 2H) is ignored by ALL operational systems — booking engine, recommendation engine, daily schedule RPC, CRM availability. Group rule configuration has zero effect on bookings today.
2. **HIGH:** `manager/staff-availability` was not updated to Phase 2E workspace — still shows legacy individual-only editor while `/crm/staff-availability` has the full group rules workspace.
3. **MEDIUM:** `fmt12h()` defined in both `dispatch-workspace.tsx` and `dispatch-queries.ts` (exact duplicate). Shift badge constants duplicated across 4 files. Presence badge duplicated across 2 files.
4. **MEDIUM:** 3 schedule pages (`/crm/schedule`, `/manager/schedule`, `/owner/schedule`) duplicate identical auth context setup code.
5. **LOW:** Double booking fetch in `buildDriverRecommendationContext`. N+1 staff-ID queries in recommendation context builder.

## Recommended Next Step
Phase 2X-C — Backend Schedule/Availability Utility Consolidation:
- Extract shared `getSchedulePageContext()` helper for `/crm/schedule`, `/manager/schedule`, `/owner/schedule`
- Fix double booking fetch in `buildDriverRecommendationContext`
- Consolidate N+1 `getActiveBranchStaffIds` calls in recommendation context builder
- Then 2X-D (public booking group rules review) and 2X-E (wire group rules to operational systems)

## Files to Know
- `docs/phase-2x-operations-unification-audit.md` — Full audit findings + remediation plan
- `src/lib/assignments/recommendation-engine.ts` — Scoring logic (no group rules wired)
- `src/lib/queries/assignment-recommendations.ts` — Data fetching (double-fetch bug in driver context)
- `src/lib/queries/staff-schedule-groups.ts` — Group rules queries (only used by schedule setup UI)
- `src/lib/queries/crm-availability.ts` — CRM availability (ignores group rules)
- `src/components/features/dispatch/dispatch-workspace.tsx` — Dispatch (fmt12h duplicate here)
- `src/lib/queries/dispatch-queries.ts` — Dispatch query (fmt12h should NOT be here)

## Known Limitations (carried forward from 2I)
1. **Group schedules not wired into recommendations** — confirmed by audit; fix is 2X-E
2. **Therapist assignment is recommendation-only** — no assign action exists
3. **No workload caps enforced** — `max_services_per_day` fetched but not scored
4. **No ETA/travel time in driver scoring** — geographic proximity not factored

## Build Status
- `pnpm type-check`: ✅ Passing (no code changes in 2X-A)
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 84 app routes
