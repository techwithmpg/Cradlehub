# 🎯 CURRENT TASK — What Is Being Worked On RIGHT NOW

> **Rule: Before starting work, write your task here.**
> **Rule: When done, clear the "Active Task" and move details to CHANGELOG.**
> **Rule: Only ONE active task at a time. Finish or document why you stopped.**

---

## Active Task

| Field            | Value                                            |
|------------------|--------------------------------------------------|
| **Task ID**      | `ATTENDANCE-RECOVERY-RULES-001` |
| **Description**  | Upgrade Attendance with schedule-aware recovery, rules, audit, and closing-scan intent handling |
| **Agent**        | Codex |
| **Started**      | 2026-07-10 |
| **Status**       | `DONE` |
| **Branch**       | `main` |
| **Blocked By**   | None |

---

## Task Status Values

| Status        | Meaning                                                |
|---------------|--------------------------------------------------------|
| `IDLE`        | No work in progress                                    |
| `IN_PROGRESS` | Agent is actively working                              |
| `BLOCKED`     | Cannot proceed — reason documented in "Blocked By"     |
| `REVIEW`      | Work done, needs verification (`pnpm build && lint`)   |
| `DONE`        | Verified complete — ready to move to CHANGELOG         |
| `ABANDONED`   | Stopped mid-task — reason in notes, picked up later    |

---

## Notes

ATTENDANCE-RECOVERY-RULES-001 status:

- Added a pure Smart Attendance Intent Engine and focused tests for normal clock-in/out, duplicate, missing schedule, day-off, first closing scan, launch recovery, ambiguous, and overnight clock-out cases.
- Updated QR Attendance so first scans in clock-out/closing windows with no active check-in are recorded as raw scan events plus Recovery exceptions instead of being inserted as normal clock-ins.
- Refurbished the visible Attendance `exceptions` tab into Recovery with internal views for Today Recovery, Staff Records, Rules, and Audit Log while preserving the existing tab key/URL behavior.
- Added schedule-aware attendance rule fields and correction audit fields in `supabase/migrations/20260710040835_attendance_recovery_rules.sql`.
- Added server-side correction/rules services and actions for launch recovery, manual clock-out, staff-day reset, reviewed scans, and rule updates.
- Verification passed: focused attendance tests, `npx tsc --noEmit`, targeted lint, `pnpm build`, and `git diff --check`.
- Still required: apply/push the new Supabase migration and run authenticated CRM browser QA for Recovery actions against live branch data.

---

SCHEDULE-CONFLICT-RESOLUTION-CENTER-001 status:

- Required Next.js local docs and React best-practice guidance were read before source edits.
- Removed stale Schedule Conflict Center compile blockers from the impact model, summary-list helper, dialog wiring, and resolution panel typing.
- Refreshed the dialog test around approval-level accept exceptions: reason entry, scope selection, accepted-tab transition, and no action-route delegation.
- Verification passed: `pnpm type-check`, `pnpm lint`, focused schedule tests, booking/availability safety tests, and `pnpm build`.
- Remaining recommendation: authenticated CRM browser QA against live branch data.

---

DATABASE-CONNECTION-STABILIZATION-001 status:

- Added `scripts/database/` wrappers for doctor, status, verify, link, push, type generation, and migration creation.
- Updated package database scripts to use these wrappers instead of stale hardcoded Supabase CLI flags.
- Updated `.env.example` with placeholders only and unignored it in `.gitignore`; real local secrets remain ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Direct project-local Supabase CLI shim works at `2.95.6`; `pnpm exec supabase` is unreliable in this managed shell.
- Verification passed for wrapper syntax, type-check, lint, full tests, build, diff whitespace, and secret scans.
- `pnpm db:doctor`, `db:status`, `db:verify`, and dry-run `db:push` now run with masked errors, but remote migration connectivity still times out and pooler env is missing.
- Still required: rotate the exposed database password, update local/deployment secrets, rerun DB workflow checks, run `db:types`, and reconcile migration history before applying pending migrations.

ATTENDANCE-DEVICE-REGISTRY-005 status:

- Completed and live DB verified on 2026-07-03.
- Applied `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql`.
- Live SQL probe verified the migration-history row, new device/token columns, `public.consume_attendance_device_recovery`, and `service_role` execute grant.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI.
- Added recovery link generation, rename, revoke, pending-link revocation, staff confirmation screen, new path-wide attendance-device cookie, and focused tests.
- Verification passed: `pnpm db:types`, `pnpm type-check`, `pnpm lint`, focused recovery Vitest, full `pnpm test`, `pnpm build`, and `git diff --check`.
- Still required: authenticated browser QA and real staff phone recovery scan QA.

---

## Previously Active (Quick Reference)

| Task ID | Description | Outcome | Date |
|---------|-------------|---------|------|
| `PHASE-4` | Offline resilience (useNetworkStatus, OfflineBanner, action guards) | ✅ Done | 2026-05-15 |
| `PHASE-5` | Production observability (structured logger, business events, console cleanup) | ✅ Done | 2026-05-15 |
