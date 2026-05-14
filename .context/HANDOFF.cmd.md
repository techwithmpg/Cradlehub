# HANDOFF — SCHED-RULES-001 Rule-Based Scheduling Engine

## Date
2026-05-14

## What Changed

### Database (migration pending apply)
- New migration: `supabase/migrations/20260520000001_scheduling_rules_foundation.sql`
- `scheduling_rules` — one row per branch, branch-level scheduling configuration (min coverage, day-off limits, break rules, auto-blocking flags, approval flow toggle).
- `staff_scheduling_preferences` — per-staff soft constraints (preferred days off, capability flags, work limits).
- `schedule_suggestions` — system-generated schedule change suggestions with status workflow: pending → approved → applied (or rejected/expired/cancelled).
- `schedule_health_checks` — daily coverage snapshot with issues/recommendations JSON, UNIQUE on (branch_id, check_date).

### Types
- `src/types/supabase.ts` — Row/Insert/Update types for all 4 tables added in alphabetical order.
- `src/lib/scheduling/types.ts` — domain types (SchedulingRules, ScheduleSuggestion, ScheduleHealthCheck, DailyCoverageSnapshot, etc.)
- `src/lib/scheduling/schemas.ts` — Zod schemas for all server action inputs.
- `src/lib/notifications/types.ts` — added schedule_suggestion_approved, schedule_suggestion_rejected, schedule_block_applied.

### Rules Engine (`src/lib/scheduling/rules/`)
- `get-scheduling-rules.ts` — fetches branch rules or returns defaults.
- `evaluate-schedule-health.ts` — pure function, returns status/issues/recommendations/counts.
- `generate-routine-blocks.ts` — pure helpers: suggestBreakBlock, suggestTravelBuffer, suggestRoomResetBuffer.
- `generate-schedule-suggestions.ts` — queries DB, builds snapshot, evaluates health, generates + deduplicates + persists suggestions.
- `apply-approved-suggestion.ts` — creates schedule_overrides or blocked_times rows for each suggestion type.
- `notify-affected-staff.ts` — fires workspace_notifications after approve/reject/apply.
- `explain-suggestion.ts` — returns headline + detail string for any suggestion type.

### Server Actions (`src/app/(dashboard)/manager/scheduling/actions.ts`)
- `upsertSchedulingRulesAction` — upserts scheduling_rules for the branch.
- `getSchedulingRulesAction` — reads current branch rules.
- `generateSuggestionsAction` — triggers the suggestion engine for a given date.
- `evaluateScheduleHealthAction` — reads stored health check for a date.
- `listPendingSuggestionsAction` — lists pending suggestions.
- `approveSuggestionAction` — marks approved, auto-applies, notifies staff.
- `rejectSuggestionAction` — marks rejected, notifies staff.

### UI Components (`src/components/features/scheduling/`)
- `scheduling-rules-form.tsx` — client form, sections: min coverage / day-off limits / break & hours / auto-blocking / approval flow.
- `schedule-health-panel.tsx` — shows daily status badge, count grid, issues, recommendations, Generate button.
- `suggestions-review-panel.tsx` — pending suggestion cards with Approve & Apply / Reject buttons.

### Page Changes
- `/manager` — health panel + suggestions review panel below ManagerTodayWorkspace on desktop.
- `/manager/settings` — SchedulingRulesForm added below existing booking rules.
- `/manager/operations` — Schedule Automation promoted from Coming Soon to Available.

## Preserved
- Existing availability engine (`get_available_slots` RPC) untouched.
- `branch_booking_rules` table untouched.
- All existing blocked_times and schedule_overrides patterns preserved.
- Public booking, payment, auth, middleware unchanged.

## Verification
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing (0 errors, 2 pre-existing warnings in staff-onboarding/onboarding-form.tsx).
- `pnpm build`: Passing.

## Notes
- Migration has not been applied to remote Supabase yet (same DNS/binary constraint as earlier migrations). Apply via `supabase migration apply` from a network-enabled environment.
- The `schedule_health_checks` table is populated by `generateSuggestionsAction` only. A future background job could run it nightly. For now managers trigger it manually from the health panel.
- `staff_scheduling_preferences` write UI (so staff can set their own preferred day off) is not yet implemented — the data model is ready.
