# Scheduling Backbone Audit

Task ID: `SCHEDULING-BACKBONE-AUDIT-001`
Status: `REPAIRED_LOCALLY`
Started: 2026-07-03
Last updated: 2026-07-03

## Purpose

Audit and repair schedule-dependent operational flows before daily-use simulations. This pass focused on confirmed high-risk mismatches that affected schedule truth, branch-local dates, SQL/RPC parity, and group-rule application safety.

## Guardrails

- Do not create a second scheduling engine.
- Do not reset production data.
- Do not regenerate QR codes.
- Do not begin full day-in-the-life simulations until scheduling invariants pass.
- Document every confirmed mismatch before or alongside repair.

## Source Of Scheduling Truth

| Layer | Tables / Files / SQL | Findings |
| --- | --- | --- |
| Weekly individual schedules | `staff_schedules`, `src/lib/schedule/resolve-staff-schedule.ts`, `src/lib/queries/resolved-staff-schedules.ts` | Canonical TypeScript resolver supports overrides, inactive rows as individual day-off, multiple windows, and overnight windows. Day-of-week conversion now uses `YYYY-MM-DD` UTC-safe helpers. |
| Group schedule rules | `staff_schedule_groups`, `staff_group_schedule_rules` | There is no separate membership table. Operational group fallback is staff-type based through `getScheduleGroupKeyForStaffType`. SQL was behind this mapping and is repaired in the new migration. |
| Explicit group memberships | `staff_schedule_group_members` | No table or references exist in this checkout. The prior "apply group schedule" action treated missing staff IDs as all branch staff, which was unsafe; it now requires explicit targets. |
| Date overrides | `schedule_overrides` | Override day-off and timed override remain highest priority. Existing DB constraint still does not allow overnight override times; this was not changed in this pass. |
| Day-off overrides | `schedule_overrides.is_day_off` | Correctly handled in TypeScript and repaired in SQL precedence comments/body. |
| Blocked times | `blocked_times` | App-side status/summary calculations now use overnight-safe duration math where touched. SQL slot conflicts normalize block ranges against overnight working windows. |
| Service duration/buffers | `services`, `branch_services`, `src/lib/engine/availability.ts`, SQL RPCs | TypeScript availability uses `branch_services.custom_duration_minutes` when available. Migration history in this checkout does not define that column, so SQL RPC duration parity remains documented as residual schema drift instead of being changed blindly. |
| Staff service capability | `staff_services`, `src/lib/engine/availability.ts`, assignment recommendations | Availability and assignment paths continue filtering by provider capability. Assignment group fallback now uses mapped plus raw group keys. |
| Booking holds/statuses | `bookings`, `src/lib/bookings/hold-status.ts`, SQL RPCs | TypeScript blocks only active holds and active booking statuses. New SQL migration restores this parity in `get_available_slots` and `get_daily_schedule`. |
| Public booking availability | `public.get_available_slots`, `src/lib/engine/availability.ts` | SQL now supports mapped group keys and overnight schedule windows. App still post-filters working windows and provider capability. |
| Daily schedule board | `public.get_daily_schedule`, `src/lib/queries/schedule.ts` | SQL now maps group keys and aggregates overnight work spans by absolute end minutes instead of plain `MAX(time)`. |
| Branch business date | `src/lib/engine/slot-time.ts` | Added shared branch-local date, clock, day, add-days, week-start, and format helpers. Schedule UIs now use these instead of machine/UTC defaults. |

## Consumer Map

| Consumer | File or SQL Function | Result |
| --- | --- | --- |
| Manager Schedule | `src/app/(dashboard)/manager/schedule/page.tsx` | Default selected date now uses branch business date. |
| Owner Schedule | `src/app/(dashboard)/owner/schedule/page.tsx` | Default selected date now uses branch business date. |
| CRM Schedule Daily Timeline | `src/components/features/schedule/tabs/daily-timeline-operations.ts` | Live status now uses branch-local date/minutes and overnight windows. |
| CRM Schedule Staff Mode | `src/components/features/schedule/schedule-staff-mode.tsx` | Upcoming-booking filter uses branch-local now; schedule/break/block summaries support overnight ranges. |
| CRM Schedule Full Schedule | `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx` | Week/date ranges and labels no longer round-trip through local `Date`/`toISOString`. |
| Staff Full Schedule Modal | `src/components/features/staff-schedule/staff-schedule-calendar-modal.tsx` | Day/week/month navigation, labels, month grids, and Today action use branch-safe `YYYY-MM-DD` helpers. |
| Week utilities / toolbar / header | `schedule-week-utils.ts`, `schedule-toolbar.tsx`, `schedule-workspace-header.tsx` | Date shifting, Today checks, and labels use branch helpers. |
| Coverage cards | `coverage-issues-tab.tsx`, `schedule-coverage-issues.tsx`, `schedule-setup-right-rail.tsx`, `schedule-setup-health-summary.tsx`, `individual-schedule-editor.tsx` | Today, weekday, and week-range calculations use branch business date. |
| CRM Availability | `src/lib/queries/crm-availability.ts` | Current clock comparisons use branch-local time. |
| Public Availability | `src/lib/engine/availability.ts` | Past-date filtering and schedule weekday lookup use branch-local helpers and UTC-safe `YYYY-MM-DD` parsing. |
| Assignment Recommendations | `src/lib/queries/assignment-recommendations.ts` | Group fallback now looks up mapped and raw group keys. |
| CRM Staff Full Schedule Action | `src/app/(dashboard)/crm/schedule/actions.ts` | Group rules now load by mapped plus raw group keys. |
| Group Apply Action | `src/lib/actions/staff-schedule-groups.ts` | Empty staff target list now fails closed instead of applying to all active branch staff. |

## Canonical Precedence

1. Date override marked day off.
2. Date override with explicit working times.
3. Individual weekly schedule rows.
4. Staff-type schedule group fallback, because no explicit membership table exists.
5. No resolved schedule.

## Confirmed Defects And Repairs

| Defect | Repair |
| --- | --- |
| Manager/Owner schedule defaulted through UTC `toISOString()` and could select the wrong business date. | Replaced with `getBranchBusinessDate()`. |
| Week/full-schedule views serialized dates through local `Date` and `toISOString()`. | Added `addDaysToYmd`, `getMondayOfWeekYmd`, `getDayOfWeekFromYmd`, and `formatBranchYmd`; rewired touched week/full-schedule views. |
| Coverage/current-status cards used machine date and weekday. | Rewired to branch business date and UTC-safe weekday conversion. |
| CRM availability current-time checks used server-local clock. | Rewired to `getBranchClockTime()` for `Asia/Manila`. |
| Daily timeline live state used UTC date string and did not treat after-midnight overnight windows as in-shift. | Rewired to branch-local date/minutes and normalized overnight windows. |
| Group apply with no `staffIds` targeted all active branch staff. | Empty target lists now return a validation error before auth/admin client use. |
| Group fallback mapping differed across SQL and TypeScript. | Added SQL helper `public.schedule_group_key_for_staff_type(text)` and updated RPC joins; TypeScript consumers now share `getScheduleGroupKeyForStaffType`. |
| SQL `get_available_slots` dropped overnight schedules with `work_end > work_start`. | New migration normalizes work windows to absolute minutes and wraps slot display time only at output. |
| SQL conflict checks compared raw `TIME` values and had stale booking-hold semantics. | New migration normalizes booking/block ranges for overnight windows and restores active-hold status filtering. |
| SQL `get_daily_schedule` used raw group keys and plain `MAX(end_time)`. | New migration maps group keys and chooses max absolute end minutes for overnight spans. |

## SQL / RPC Parity

| Function | Migration / Definition | Compared Against | Findings |
| --- | --- | --- | --- |
| `get_daily_schedule` | `supabase/migrations/20260703130922_scheduling_rpc_group_overnight_parity.sql` | `resolve-staff-schedule.ts`, `resolved-staff-schedules.ts` | Repaired group key mapping, group fallback precedence, active hold statuses for daily bookings, and overnight span aggregation. |
| `get_available_slots` | `supabase/migrations/20260703130922_scheduling_rpc_group_overnight_parity.sql` | `src/lib/engine/availability.ts`, `hold-status.ts`, `resolve-staff-schedule.ts` | Repaired mapped/raw group joins, active hold status filtering, and overnight window/slot conflict math. |
| `compute_booking_end_time` | Existing `20260429000003_helper_functions.sql` | TypeScript branch duration lookup | Still uses global `services.duration_minutes`. App types and TypeScript know about `branch_services.custom_duration_minutes`, but local migrations do not define it; this requires a separate schema/API decision. |

## Database Audit Notes

- `staff_schedule_group_members` is absent from the codebase and migrations.
- `staff_schedules` overnight support exists via `20260603000002_allow_overnight_staff_schedules.sql`.
- `schedule_overrides`, `bookings`, and `blocked_times` still have earlier same-day time-range constraints unless later live schema differs.
- The new migration has not been applied to a database in this pass. It was locally authored and type-level app verification passed.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run src/lib/engine/availability.test.ts tests/lib/schedule/resolve-staff-schedule.test.ts tests/lib/schedule/schedule-timeline.test.ts tests/lib/schedule/daily-timeline-operations.test.ts tests/lib/schedule/daily-schedule-query.test.ts tests/lib/actions/staff-schedule-groups.test.ts`: PASS, 11 files / 79 tests
- `git diff --check`: PASS, line-ending notices only

## Remaining Follow-Up

- Apply and verify `supabase/migrations/20260703130922_scheduling_rpc_group_overnight_parity.sql` against the linked database before production use.
- Decide whether `branch_services.custom_duration_minutes` should be formalized in migrations and SQL RPC duration logic.
- Decide whether overnight date-specific overrides, bookings, and blocks should be supported at the schema level, not just schedule windows.
- Run authenticated CRM/Manager/Owner schedule browser QA once a valid session is available.
