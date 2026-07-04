# 🎯 CURRENT TASK — What Is Being Worked On RIGHT NOW

> **Rule: Before starting work, write your task here.**
> **Rule: When done, clear the "Active Task" and move details to CHANGELOG.**
> **Rule: Only ONE active task at a time. Finish or document why you stopped.**

---

## Active Task

| Field            | Value                                            |
|------------------|--------------------------------------------------|
| **Task ID**      | `DATABASE-CONNECTION-STABILIZATION-001` |
| **Description**  | Reset and establish a secure reusable Supabase migration, SQL, and type-generation workflow |
| **Agent**        | Codex                                           |
| **Started**      | 2026-07-03                                      |
| **Status**       | `IDLE`                                      |
| **Branch**       | `main`                                          |
| **Blocked By**   | No active task; latest Attendance device registry work is complete, but DB password rotation and migration-history connectivity remain external follow-ups |

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
