# 🎯 CURRENT TASK

| Field | Value |
|-------|-------|
| **Task ID** | `SEC-AUDIT-001` |
| **Description** | `Security and role-routing audit across auth, workspaces, API routes, actions, queries, and RLS` |
| **Agent** | `Kimi DevCoder` |
| **Status** | `IN PROGRESS` |

## Notes
- Audit who the logged-in user maps to (`auth_user_id` → `staff`), including inactive/missing staff handling.
- Verify workspace routing by `system_role` + `staff_type` (`/owner`, `/manager`, `/crm`, `/staff-portal`, `/driver`, `/utility`).
- Check branch scoping and data exposure across owner/manager/crm/staff/driver/utility surfaces.
- Review API routes and server actions for session checks, role checks, and branch enforcement.
- Review Supabase RLS policy coverage and identify broad/missing policies.
- Run verification commands: `pnpm type-check`, `pnpm build`, `pnpm lint`.
- Do not implement fixes unless a clearly safe, minimal correction is requested.
