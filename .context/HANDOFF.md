## What Is Next — CRM Stabilization / Simplification

Current active work is tracked in:

1. `.context/CURRENT_TASK.cmd.md`
2. `.context/HANDOFF.cmd.md`
3. `docs/FRONT_DESK_REFACTOR_PROGRESS.md`

Latest CRM direction:

1. Daily primary CRM nav should move toward `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
2. System tools should move into a quieter collapsed `System Management` area.
3. Existing routes and internal identifiers can remain during stabilization; do not do a broad rename.
4. Production action reliability is the priority: trace each CRM action through UI, server action/API, auth/role checks, Supabase/RLS, database constraints, invalidation/refresh, and feedback before claiming it works.

Latest completed checkpoint:

- `CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30`
- Sidebar primary CRM nav now uses `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Management-authorized CRM users now have a collapsed bottom `SYSTEM / System Management` section for existing setup/staff/schedule/reconciliation tools.
- CRM automatic prefetching now targets primary daily routes only.
- Validation passed: `npm run type-check`, `npm run lint`, `npm run build`, and `git diff --check`.

Before editing, run:

```bash
git status --short --branch
```

There are uncommitted CRM/refactor and handoff changes in the worktree. Do not revert them unless the user explicitly asks.

Next recommended checkpoint:

1. Simplify Work Queue / Today / Control Center without deleting old routes.
2. Keep `/crm/control` alive as compatibility until its useful actions are safely folded into Work Queue.
3. Review CRM header requirements separately and avoid adding duplicate New Booking buttons.
4. Review system-tool access before exposing System Management to ordinary CRM/CSR roles; current page gates remain management-authorized.
