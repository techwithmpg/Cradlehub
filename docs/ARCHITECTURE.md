# CradleHub Architecture

> See CLAUDE.md in the project root for the full architecture overview.
> This file will be expanded as the system is built.

## Layers
1. **Public layer** — `/book`, `/services`, `/branches`, `/about`, `/contact`
2. **Scheduling engine** — `get_available_slots` Supabase RPC
3. **Admin workspaces** — `/owner`, `/manager`, `/crm`, `/staff-portal`

## Key Files
- `src/lib/supabase/client.ts` — browser Supabase client
- `src/lib/supabase/server.ts` — server Supabase client
- `src/lib/supabase/admin.ts` — service-role client (RLS bypass, server only)
- `src/proxy.ts` — auth guard + role-based workspace routing (Next.js 16 Proxy)
- `supabase/migrations/` — database schema history

## Scheduling Architecture

- Runtime scheduling is individual-first. The canonical runtime sources are
  `staff_schedules`, `schedule_overrides`, `blocked_times`,
  `staff_shift_checkins`, `bookings`, and `branch_resources`, starting from the
  operational branch staff roster.
- `staff_schedule_groups` and `staff_group_schedule_rules` remain schema/data only as dormant historical template tables. They are not runtime availability sources and no Schedule UI, resolver, realtime subscription, booking, attendance, dispatch, or readiness path should read them as effective schedules.
- Effective staff schedule resolution lives in `src/lib/schedule/resolve-staff-schedule.ts`. Missing schedules return `NO_SCHEDULE_CONFIGURED`, configured inactive day markers return `CONFIGURED_DAY_OFF`, valid split/overnight windows keep exact ordered windows, and conflict states retain exact conflicting windows while exposing no operational availability.
- UI shift language is centralized in `src/lib/schedule/schedule-domain.ts` as
  `regular | opening | closing`; DB persistence uses
  `single | opening | closing`. Operators should never see `single`.
- Individual weekly schedule writes use `public.replace_staff_weekly_schedule(...)` through the CRM/manager save actions and verify returned rows against `staff_id, day_of_week, window_order`.
- Schedule Setup and Adjust Schedule share the ordered-window draft/editor/save
  path. Multiple active daily windows require explicit Split Shift intent and
  must not overlap.
- Daily Timeline preserves its operations-board UI but now derives rows from
  the operational roster, then overlays resolved schedule windows, bookings,
  blocks, date overrides, resource names, and live attendance presence.
  Not Configured, Day Off, and Needs Review are separate display states.
- Realtime invalidation listens to `staff`, `staff_schedules`,
  `schedule_overrides`, `blocked_times`, `staff_shift_checkins`, `bookings`, and
  `branch_resources`. Migration
  `supabase/migrations/20260713064332_schedule_realtime_publication.sql` repairs
  the live `supabase_realtime` publication for those tables.
- Live schedule warnings are contract-backed. Schedule data conflicts must
  expose exact issue types/codes, source ids, and stable fingerprints. Missing
  room/resource warnings require explicit service metadata such as
  `requires_room` or `required_resource_type`; missing `resource_id` alone is
  not a warning. Coverage-gap warnings require an explicit coverage requirement
  with category/time/minimum and must not be inferred from broad roster totals.
- `supabase/migrations/20260713035024_schedule_update_integration_repair.sql` is the applied corrective schedule-update contract for stale inactive placeholder cleanup, `staff_schedules` ordered-window constraints, validation triggers, operational staff helpers, and the transactional staff weekly replacement RPC.
- `supabase/migrations/20260713090000_schedule_leftover_cleanup.sql` is the
  applied live-data cleanup for corrupted Main Spa coverage minima and
  deterministic stale active `single` schedule rows. Original affected rows are
  backed up in `schedule_repair_backups`; ambiguous active overlaps remain for
  CRM review.
- `supabase/migrations/20260712165012_backend_stabilization_schedule_repair.sql` remains a broader pending/local repair contract for additional schedule backups, booking-rule fee column backfill, group-rule repair, and related stabilization work.
- `supabase/migrations/20260712190359_individual_schedule_runtime_only.sql` removes group-rule joins from the runtime `get_available_slots` and `get_daily_schedule` RPCs.
- Operational provider selection should exclude inactive, archived, merged, test, and explicitly non-schedulable staff. App-side fallback logic lives in `src/lib/staff/operational-staff.ts`; the migration also defines an `operational_staff` view for database-side consumers.
- The live schedule-update schema repair and realtime publication repair were
  applied through the Supabase Management API query path because the direct
  Postgres pooler migration-history path still times out. Do not blind push
  migrations until `pnpm db:status` can read linked migration history cleanly.

## Attendance Architecture

- Daily operational interpretation is centralized in
  `src/lib/attendance/day-model.ts`. It composes—not replaces—the canonical
  `getResolvedStaffSchedulesForDate(...)` output with branch-local time,
  Attendance settings, check-ins, active service sessions, and exceptions.
  CRM/Owner Overview and Staff Portal consume the same typed
  `AttendanceDayStaffState`; UI components must not reimplement schedule state.
- Public scans enter the existing QR scan engine in `src/lib/attendance/scan-engine.ts`; there is no parallel attendance engine.
- Attendance scans resolve QR/device/staff context, branch authorization, branch-local business time, schedule intent, stable shift instance, current session state, and duplicate/idempotency context before writing interpreted Attendance records.
- Branch-local shift identity is centralized in `src/lib/attendance/shift-instance.ts`. New clock-ins capture `shift_instance_key`, `schedule_source`, `schedule_source_id`, `branch_timezone`, `attendance_business_date`, `scheduled_start_at`, and `scheduled_end_at` so later schedule edits do not orphan legitimate open sessions.
- Schedule-aware intent remains in `src/lib/attendance/attendance-intent-engine.ts`. Only an open row matching the resolved current shift can be used for clock-out. Stale prior-day rows and same-day conflicting rows are isolated into Recovery and the current scan continues through schedule-aware intent.
- Current state and next expected scan action are centralized in `src/lib/attendance/attendance-state-machine.ts`, including off-day/no-current-shift/recovery/clock-in/clock-out/completed outcomes.
- Device Registry is staff-first: load staff assigned to the selected branch, then load devices by `staff_id`. Stale `staff_devices.branch_id` metadata must not make an existing phone appear missing.
- Raw `qr_scan_events` remain immutable audit evidence. Normal interpreted clock-in, clock-out, active-service-blocked, and Recovery-intent Attendance commits now use `public.commit_attendance_scan_transaction(...)`, which writes the interpreted record, scan event, Recovery issue, device seen timestamp, and idempotent public result inside one PostgreSQL transaction. Some event-only/noop paths still use the existing scan-event writer and should stay under QA before production closeout.
- Public Attendance scan failures must return structured safe error codes and an
  operation ID. Route/action catch blocks must not return HTTP 200 for
  unexpected backend transaction, schema, RLS, or constraint failures, and must
  not expose raw SQL details to the phone.
- `attendance_exceptions.exception_type` stores stable database categories only.
  Internal scan reasons such as `missing_schedule`, `off_day_exception`,
  `ambiguous_scan`, `late_clock_in`, `early_clock_out`, and
  `likely_closing_scan_without_clock_in` map to stable values before
  persistence, with the original reason preserved in
  `metadata.internalExceptionType` for Recovery UI.
- Attendance check-ins store schedule source as `weekly`, `override`,
  `recovery`, or `none`. Weekly and override scans should carry the exact source
  row/window id in `schedule_source_id`; split-shift identity includes window
  order/source id so later windows are not treated as duplicates of earlier
  windows.
- Recovery cases dedupe active issues with occurrence counters, first/last seen timestamps, latest scan linkage, related check-ins, recommended action, and priority.
- Corrections update interpreted attendance records and write `attendance_corrections` history. Selected-record Attendance State Reset now uses `public.reset_attendance_state_transaction(...)` to void only the chosen interpreted row, resolve linked open Recovery cases, and write the correction audit in one transaction. Manual clock-out, launch recovery, ignore-scan, rule updates, archive-test-data, and any future rebuild/manual-attendance actions still need transactional RPC coverage for final closeout.
- Production requires `ATTENDANCE_DEVICE_SECRET`; local development is the only allowed fallback. Secret rotation invalidates existing device cookies.

### Attendance Production Closeout Blockers

- Reconcile Supabase migration history from a working migration-history connection. The linked schema has the recent Attendance columns/functions, but `supabase_migrations.schema_migrations` does not record the recent Attendance migration versions.
- Expand transactional coverage to the remaining correction workflows and QA event-only/noop scan paths.
- Complete account claim, login rate limits, canonical scan host redirect, rotating branch challenge, scheduled reconciliation, full diagnostic modal, authenticated CRM/Owner QA, and real-phone/device-cookie QA.
