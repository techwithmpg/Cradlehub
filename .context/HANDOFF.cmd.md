# HANDOFF — RBAC-001 Align Cradle Staff Roles with Workspace Access

## Date
2026-05-13

## Agent
Codex

## Summary
Forward-fix RBAC implementation. Added 6 new system_role values to the DB constraint, updated all routing and permission helpers, seeded Anna Liza F. Lacson as owner, corrected all existing staff role assignments, and extended 8 action files to cover manager variants.

## Changes Applied

### Migrations (new — do not edit)
- `supabase/migrations/20260513000001_rbac_role_constraint_fix.sql` — re-creates system_role CHECK with full 13-role set; resolves the migration conflict between 20260429000009 and 20260501000002.
- `supabase/migrations/20260513000002_real_staff_rbac_seed.sql` — seeds Anna Liza F. Lacson (owner); updates all staff records from migration 010 to precise roles and staff_type values.

### TypeScript
- `src/lib/permissions.ts` — SYSTEM_ROLES, MANAGERS, ROLE_LABELS, getDefaultDashboardPath updated for all new roles.
- `src/proxy.ts` — resolveWorkspace covers all 13 roles.
- `src/app/(dashboard)/owner/staff/actions.ts` — 3 checks extended to manager variants.
- `src/app/(dashboard)/owner/branches/actions.ts` — branch manager check extended.
- `src/app/(dashboard)/owner/branches/resources-actions.ts` — branch manager check extended.
- `src/app/(dashboard)/manager/bookings/actions.ts` — allowedRoles extended.
- `src/lib/actions/inhouse-booking.ts` — bookingRoles extended.
- `src/lib/queries/branch-booking-rules.ts` — manager check extended.
- `src/app/(dashboard)/driver/page.tsx` — requireDriverAccess now allows driver role.
- `src/app/(dashboard)/utility/page.tsx` — requireUtilityAccess now allows utility role.

## Role Routing
- owner → /owner
- manager / assistant_manager / store_manager → /manager
- crm / csr / csr_head / csr_staff → /crm
- staff / service_head / service_staff → /staff-portal
- driver → /driver
- utility → /utility

## Verification Status
- `pnpm lint`: passing.
- `pnpm type-check`: passing.
- `pnpm build`: passing, 68 app routes.

## Known Remaining Issue
On a fresh db reset, migration 20260501000002 fails row validation if migration 010 has already inserted assistant_manager/store_manager rows. The forward-fix migration (20260513000001) cannot run before 20260501000002 fails. Running instances are unaffected. Fresh-reset workaround: apply migrations 20260429000001 through 20260429000009, skip 010 temporarily, apply through 20260501000002, then apply 010 and 20260513000001.

## Remaining Gaps (out of scope for this pass)
- Onboarding approval role allowlist (staff-onboarding/actions.ts) not updated — only owner can approve new staff, so the allowed-roles-for-assignment array there controls what roles can be handed out during approval, not who can approve. Low risk.
- crm/actions.ts allowedRoles stays as-is — CRM workspace is not a manager workspace.
- No RLS changes made.
- No new UI built for driver/utility workspaces — both remain "Coming Soon" placeholders.
