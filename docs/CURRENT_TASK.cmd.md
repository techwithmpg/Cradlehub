# 🎯 CURRENT TASK — What Is Being Worked On RIGHT NOW

> **Rule: Before starting work, write your task here.**
> **Rule: When done, clear the "Active Task" and move details to CHANGELOG.**
> **Rule: Only ONE active task at a time. Finish or document why you stopped.**

---

## Active Task

| Field            | Value                                            |
|------------------|--------------------------------------------------|
| **Task ID**      | `CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30` |
| **Description**  | Update the CRM sidebar to Work Queue, Bookings, Schedule, Customers, Home Service, with collapsed System Management |
| **Agent**        | Codex                                           |
| **Started**      | 2026-06-30                                      |
| **Status**       | `REVIEW / CHECKPOINT_1_COMPLETE`                |
| **Branch**       | `main`                                          |
| **Blocked By**   | Manual authenticated workflow QA is still needed for protected CRM flows |

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

Latest attached direction supersedes the older visible naming in parts of the existing handoff. Checkpoint 1 status:

- Target daily CRM nav: `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`.
- Target secondary area: collapsed `System Management`.
- Implemented in `src/components/features/dashboard/nav-config.ts`, `src/components/features/dashboard/sidebar.tsx`, and `src/components/features/workspace/workspace-prefetch-config.ts`.
- Preserve old routes and redirects; this checkpoint is a shell/navigation update, not a broad page rebuild.
- Validation passed: `npm run type-check`, `npm run lint`, `npm run build`, `git diff --check`.
- Next checkpoint should simplify Work Queue / Today / Control Center. Header work and broader system-tool permission review remain pending.
- Do not start broad redesign work before tracing existing CRM actions, permissions, RLS, validation, and refresh behavior.
- Canonical live handoff for this refactor is `docs/FRONT_DESK_REFACTOR_PROGRESS.md`; `.context/CURRENT_TASK.cmd.md` and `.context/HANDOFF.cmd.md` also contain the latest pickup notes.

---

## Previously Active (Quick Reference)

| Task ID | Description | Outcome | Date |
|---------|-------------|---------|------|
| `PHASE-4` | Offline resilience (useNetworkStatus, OfflineBanner, action guards) | ✅ Done | 2026-05-15 |
| `PHASE-5` | Production observability (structured logger, business events, console cleanup) | ✅ Done | 2026-05-15 |
