# CURRENT TASK: RBAC-001 — Align Cradle Staff Roles with Workspace Access (Complete)

## Overview
Implement the smallest safe forward-fix to align the real Cradle org structure with workspace routing and permission checks. No RBAC redesign, no auth rewrite, no booking logic changes.

## Phases Completed

### Phase 1 — Schema forward-fix
- `supabase/migrations/20260513000001_rbac_role_constraint_fix.sql`
  Drops and re-creates `staff_system_role_check` with 13 roles including all new ones.
  Resolves the migration conflict from 20260501000002 dropping assistant_manager/store_manager.

### Phase 2 — Permission and route helpers
- `src/lib/permissions.ts` — SYSTEM_ROLES, MANAGERS, ROLE_LABELS, getDefaultDashboardPath all updated.
- `src/proxy.ts` — resolveWorkspace handles all 13 roles.

### Phase 3 — Real staff seed migration
- `supabase/migrations/20260513000002_real_staff_rbac_seed.sql`
  Inserts Anna Liza F. Lacson (owner). Updates all existing staff records from migration 010 to use precise roles and staff_type values.

### Phase 4 — Hardcoded role audit
Updated 8 action/query files to include assistant_manager and store_manager in all manager-level checks.
Updated driver/utility page guards to allow their respective roles.

## Role Routing Summary
- owner → /owner
- manager / assistant_manager / store_manager → /manager
- crm / csr / csr_head / csr_staff → /crm
- staff / service_head / service_staff → /staff-portal
- driver → /driver
- utility → /utility

## Known Remaining Issue
On a fresh db reset, migration 20260501000002 may fail row validation because migration 010 inserts assistant_manager/store_manager rows before 20260501000002 removes those values from the constraint. The forward-fix migration resolves this on running instances. Fresh-reset recovery requires manual intervention (cannot edit old migrations).

## Verification
- `pnpm type-check`: passing
- `pnpm lint`: passing
- `pnpm build`: passing, 68 app routes

## Status
Complete. Ready to commit.
