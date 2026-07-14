# Attendance Phase 0 Baseline and Architecture Map

Task: `ATTENDANCE-COMPLETE-SYSTEM-001`  
Date: 2026-07-14  
Status: `LIVE CONTRACTS VERIFIED — MIGRATION HISTORY RECONCILIATION REMAINS`

## Scope and evidence

This document records the repository state before the complete Attendance
program changes application or database behavior. It is based on focused source
searches, the current migration files, existing Attendance documentation, the
generated database types, and baseline commands. Generated types and migrations
are not treated as proof of deployed schema.

Requested preflight files `PROJECT_CONTEXT.md`, `AGENT_RULES.md`, and
`ROADMAP.md` are absent from the repository. `CLAUDE.md` only delegates to
`AGENTS.md`. The available `.context` files, `docs/ARCHITECTURE.md`, Attendance
documentation, migrations, and tests were inspected.

## Current architecture

### Routes and workspace entry points

- Public Attendance QR: `/scan/[publicCode]`, with continuation activation at
  `/scan/activate/[token]`.
- Public scan server boundaries:
  `src/app/scan/actions.ts` and
  `src/app/api/attendance/public-scan/route.ts`.
- CRM Attendance: `/crm/attendance`, backed by
  `src/app/(dashboard)/crm/attendance/page.tsx` and `actions.ts`.
- Owner Attendance: `/owner/attendance`, using the shared Attendance workspace.
- Staff self view: `/staff-portal/attendance`.
- Shared CRM/Owner tabs: Overview, Records, Sessions, QR Codes, Devices,
  Recovery, and Reports.

### Scan engine and schedule interpretation

- The only scan orchestrator is `src/lib/attendance/scan-engine.ts`.
- Scan intent is isolated in
  `src/lib/attendance/attendance-intent-engine.ts`.
- Shift identity/business-date handling is in
  `src/lib/attendance/shift-instance.ts` and `time.ts`.
- The scan engine calls the existing canonical schedule query
  `getResolvedStaffSchedulesForDate` from
  `src/lib/queries/resolved-staff-schedules.ts`.
- The underlying schedule resolver is
  `src/lib/schedule/resolve-staff-schedule.ts`. The repository architecture
  states that current runtime scheduling is individual-first; historical group
  schedule tables are dormant and must not be reintroduced as runtime sources.
- Normal interpreted mutations use
  `public.commit_attendance_scan_transaction(...)`. Raw scan events remain the
  audit source.

### Device registration and recovery

- Existing device registry: `staff_devices`, with server logic in
  `device-registry.ts`, `device-policy.ts`, and `device-recovery.ts`.
- Autonomous first-scan registration continues through the signed scan
  continuation in `scan-continuation.ts`.
- CRM-reviewed Staff Portal requests use
  `staff_device_registration_requests` and `device-registration.ts`.
- Recovery consumption uses
  `public.consume_attendance_device_recovery(...)`.
- The pending local self-service migration is
  `20260714050554_attendance_staff_self_service.sql`; it is not certified as
  deployed.

### CRM and Staff Portal data sources

- CRM/Owner workspace loading is centralized in
  `src/lib/attendance/queries.ts`, then passed to the shared client workspace.
- CRM Overview currently derives staff state in
  `overview/live-staff-table.tsx`. It does not call the schedule resolver:
  missing records become `not_arrived`, missing shift labels become
  `Scheduled today`, availability means only checked in without active service,
  and the roster is truncated with `slice(0, 36)`.
- Staff Portal loads its own check-in rows in
  `src/lib/staff-portal/attendance.ts`. It shows stored schedule/check-in fields
  but does not consume a shared authoritative daily Attendance model.
- Consequently the scan engine, Overview, and Staff Portal do not currently
  share one complete schedule-and-attendance interpretation.

### Recovery and correction paths

- Recovery storage is `attendance_exceptions`; correction audit is
  `attendance_corrections`; raw evidence is `qr_scan_events`.
- `reset_attendance_state_transaction(...)` provides transactional selected-row
  reset and audit.
- `attendance-correction-service.ts` declares reclassification, manual in/out,
  rebuild, reset, review, and revert action types. Manual clock-out, reset, and
  mark-reviewed paths exist; other declared actions reach the explicit
  `This correction action is not available yet` guard.
- Existing documentation identifies remaining non-transactional correction
  workflows as a production blocker.

### Realtime and timers

- The shared Attendance workspace owns one branch-filtered channel for
  check-ins, raw scans, exceptions, corrections, devices, and bookings, with a
  500 ms refresh debounce and cleanup.
- It also owns a 30-second display clock interval and cleans it up on unmount.
- The staff Attendance realtime component filters check-in updates to the
  signed-in staff id.
- `qr_scan_events` was added to the Realtime publication by migration
  `20260713120237_attendance_recovery_rpc_and_scan_realtime_repair.sql`.
- Device registration requests are not part of the shared workspace channel,
  so request-state invalidation needs a focused Phase 10 audit.

### Reports, notifications, tasks, payroll, and scheduler

- `reports/attendance-reports-tab.tsx` is a presentation placeholder using the
  shared workspace payload; existing documentation explicitly says its export
  and report filters are placeholders.
- Existing CRM notifications and workflow signal stores must be reused. No
  Attendance missing-arrival or forgotten-clock-out reconciliation job was
  found.
- `staff_shift_checkins` already stores `worked_minutes`, `late_minutes`,
  `early_leave_minutes`, and `overtime_minutes`. Separate Owner payroll snapshot
  tables already exist, but no advisory Attendance-to-payroll bridge was found.
- The existing scheduler mechanisms are:
  - Vercel Cron for `/api/agent/follow-up` only.
  - A `pg_cron` attempt for `complete_due_service_sessions()` in the original
    Attendance migration, with a service-role/server-job fallback when the
    extension is unavailable.
- There is no Attendance reconciliation cron endpoint or registered schedule.

## Relevant database contracts

Primary tables:

- `staff`, `branches`, `staff_schedules`, `schedule_overrides`, `blocked_times`
- `staff_shift_checkins`, `qr_scan_events`, `attendance_exceptions`
- `attendance_corrections`, `attendance_settings`, `qr_points`
- `staff_devices`, `device_activation_tokens`
- pending `staff_device_registration_requests`
- `bookings`, `branch_resources`
- existing CRM notification and workflow-task tables
- existing payroll periods/items/adjustments and staff pay profiles

Primary Attendance RPCs found in migrations/types:

- `commit_attendance_scan_transaction`
- `reset_attendance_state_transaction`
- `consume_attendance_device_recovery`
- pending `review_staff_device_registration_request`
- pending `complete_staff_device_registration_request`
- `complete_due_service_sessions`

Attendance base tables have RLS enabled in
`20260702075213_attendance_qr_system.sql`. Owner, branch operational-role, and
self-only policies are present for the applicable resources. Privileged
Attendance mutation RPCs explicitly revoke broad execution and grant
`service_role`. The pending device-request migration adds self, Owner, and
branch-CRM SELECT policies plus explicit RPC grants. These statements describe
local SQL only until linked-schema probes succeed.

## Known limits and timezone defects

- CRM Overview silently limits the roster to 36 staff before search/filter.
- Workspace queries cap several resources at 100 and raw scan history at 200;
  these limits are not exposed as pagination/completeness contracts.
- Recovery groups render only the first eight issues per group; several
  Overview/session cards also deliberately slice summaries.
- CRM Overview computes record navigation dates with hardcoded
  `Asia/Manila`.
- Device display, QR display, and scan-feed helpers also contain Manila
  hardcoding. `shift-instance.ts` and `time.ts` use Manila as a fallback, which
  is acceptable only when branch timezone is genuinely unavailable.

## Proven baseline defects and gaps

1. No authoritative reusable daily Attendance state model exists.
2. CRM Overview falsely treats every missing record as not arrived and labels
   it scheduled today, regardless of day off, later shift, or missing schedule.
3. Staff Portal and CRM Overview do not share scan-engine schedule resolution.
4. Full CRM roster search is impossible beyond the first 36 staff.
5. Attendance reports and CSV/export behavior are placeholders.
6. Missing-arrival, missed-shift, and forgotten-clock-out automation is absent.
7. Several declared Recovery actions are intentionally unavailable.
8. Operational availability does not yet combine schedule, attendance, booking,
   service, break, and exception state.
9. Attendance hard limits can silently truncate operational/report evidence.
10. Deployed migration history, pending device-request RLS, and current live
    RPC grants cannot be verified from this environment.

## Baseline verification

- Focused Attendance suite:
  `pnpm test --run tests/lib/attendance tests/app/attendance tests/components/attendance tests/lib/staff-portal/attendance.test.ts`
  — 24 files / 96 tests passed.
- `pnpm db:doctor`:
  CLI, project reference, link identity, token, pooler configuration, and type
  generation checks passed; migration history timed out on linked Postgres
  port 5432 and the command exited 2.
- `pnpm db:status`:
  105 local migrations; remote schema comparison reported no change before the
  migration-history read timed out; command exited 1.
- `pnpm type-check`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed on Next.js 16.2.4; 109 static/dynamic routes generated,
  including all Attendance and Staff Portal Attendance routes.
- `git diff --check`: passed with line-ending warnings only.

## Phase 0 gate

The local architecture map and baseline test requirement are complete. The
previously missing Staff Portal device-request migration was subsequently
applied through the linked Management API SQL path and its table, RLS, policies,
grants, RPC restrictions, schema-cache visibility, and service-role REST access
were verified. Linked migration-history reads still time out, so version
`20260714050554` must be reconciled before a normal broad migration push.
