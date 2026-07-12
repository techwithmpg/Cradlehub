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

## Attendance Architecture

- Public scans enter the existing QR scan engine in `src/lib/attendance/scan-engine.ts`; there is no parallel attendance engine.
- Attendance scans resolve QR/device/staff context, branch authorization, branch-local business time, schedule intent, stable shift instance, current session state, and duplicate/idempotency context before writing interpreted Attendance records.
- Branch-local shift identity is centralized in `src/lib/attendance/shift-instance.ts`. New clock-ins capture `shift_instance_key`, `schedule_source`, `schedule_source_id`, `branch_timezone`, `attendance_business_date`, `scheduled_start_at`, and `scheduled_end_at` so later schedule edits do not orphan legitimate open sessions.
- Schedule-aware intent remains in `src/lib/attendance/attendance-intent-engine.ts`. Only an open row matching the resolved current shift can be used for clock-out. Stale prior-day rows and same-day conflicting rows are isolated into Recovery and the current scan continues through schedule-aware intent.
- Current state and next expected scan action are centralized in `src/lib/attendance/attendance-state-machine.ts`, including off-day/no-current-shift/recovery/clock-in/clock-out/completed outcomes.
- Device Registry is staff-first: load staff assigned to the selected branch, then load devices by `staff_id`. Stale `staff_devices.branch_id` metadata must not make an existing phone appear missing.
- Raw `qr_scan_events` remain immutable audit evidence. Normal interpreted clock-in, clock-out, active-service-blocked, and Recovery-intent Attendance commits now use `public.commit_attendance_scan_transaction(...)`, which writes the interpreted record, scan event, Recovery issue, device seen timestamp, and idempotent public result inside one PostgreSQL transaction. Some event-only/noop paths still use the existing scan-event writer and should stay under QA before production closeout.
- Recovery cases dedupe active issues with occurrence counters, first/last seen timestamps, latest scan linkage, related check-ins, recommended action, and priority.
- Corrections update interpreted attendance records and write `attendance_corrections` history. Selected-record Attendance State Reset now uses `public.reset_attendance_state_transaction(...)` to void only the chosen interpreted row, resolve linked open Recovery cases, and write the correction audit in one transaction. Manual clock-out, launch recovery, ignore-scan, rule updates, archive-test-data, and any future rebuild/manual-attendance actions still need transactional RPC coverage for final closeout.
- Production requires `ATTENDANCE_DEVICE_SECRET`; local development is the only allowed fallback. Secret rotation invalidates existing device cookies.

### Attendance Production Closeout Blockers

- Reconcile Supabase migration history from a working migration-history connection. The linked schema has the recent Attendance columns/functions, but `supabase_migrations.schema_migrations` does not record the recent Attendance migration versions.
- Expand transactional coverage to the remaining correction workflows and QA event-only/noop scan paths.
- Complete account claim, login rate limits, canonical scan host redirect, rotating branch challenge, scheduled reconciliation, full diagnostic modal, authenticated CRM/Owner QA, and real-phone/device-cookie QA.
