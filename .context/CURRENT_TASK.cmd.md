Task ID: PUBLIC-MOBILE-LOADING-TRANSITIONS-001
Description: Add the final public mobile homepage intro and simple public route-loading line
Agent: Codex
Status: COMPLETE

Scope:
- Show the custom Cradle website intro only on first homepage (`/`) entry per browser session.
- Add one simple thin warm-gold top route-loading line for public navigation among `/`, `/services`, `/book`, `/branches`, `/about`, and `/contact`.
- Keep the public intro and route line from stacking or replaying unnecessarily.
- Preserve all booking wizard logic, booking data, APIs, Supabase/database logic, server actions, auth/RBAC, middleware, protected workspaces, CRM/admin/staff/driver portals, and non-public loading patterns.

Required verification:
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`

Notes:
- Required protocol files and local Next.js App Router docs were read before code edits.
- Worktree already contains uncommitted public homepage and booking reskin changes from recent public tasks; this task must build on them without reverting unrelated edits.
- Completed with `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and local public route smoke checks passing.
