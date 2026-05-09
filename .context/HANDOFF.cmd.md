# HANDOFF — STAFF-UI-002 Staff Management Display Normalization

## Date
2026-05-09

## Agent
Codex

## Summary
Normalized Staff Management display metadata through a single typed helper and tightened the branch-grouped table/profile layout. The work is limited to the owner Staff Management workspace UI layer and does not change auth, RBAC, booking, schema, staff CRUD, public pages, or workspace routes.

## Files Changed
- `src/components/features/staff/staff-management-utils.ts`
  - Added `StaffDisplayMeta` and `getStaffDisplayMeta(staff)`.
  - Uses `job_title` first for position identity.
  - Derives display Staff Type from `system_role` for protected roles:
    owner/admin → Administration, manager variants → Managerial, CRM/CSR → Front Desk labels, driver/utility → support labels.
  - Allows tier only for service access roles (`staff`, `service_staff`) with service-eligible staff types (`therapist`, `nail_tech`, `aesthetician`).
  - Keeps legacy helper exports as wrappers around the shared helper for compatibility.
- `src/components/features/staff/staff-badges.tsx`
  - Role badge can use the shared staff display metadata when a staff object is provided.
- `src/components/features/staff/staff-table-row.tsx`
  - Uses shared metadata for row subtitle, position/role, and access role badge.
  - Removed branch cell from rows inside branch sections.
- `src/components/features/staff/staff-branch-section.tsx`
  - Removed Branch table column and kept table columns as Select, Staff, Position / Role, Phone, Status, Access Role, Actions.
  - Kept existing compact per-branch show more/show less behavior.
- `src/components/features/staff/staff-preview-panel.tsx`
  - Uses shared metadata for subtitle, System Role, Staff Type, and badge display.
  - Right panel now uses self-start/content-height layout.
  - Pending staff still get the existing prominent Approve Staff link to the staff detail/review page; no new reject/decline backend action was introduced.
- `src/components/features/staff/staff-management-workspace.tsx`
  - Aligns the staff list/profile grid to the top to avoid stretching the profile rail.

## Behavior Notes
- Charilyn Abellar and other manager/admin/support rows no longer show `Therapist` or `Junior` from stale raw seed defaults.
- Manager Staff Type resolves to `Managerial`; profile subtitle resolves to `Managerial · phone`.
- CSR/CRM/front-desk, driver, utility, owner, and manager variants never show Junior/Mid/Senior tier labels.
- Service staff can still show Junior/Mid/Senior when the role and staff type are eligible.
- Branch grouping still runs after search/filtering and empty branch groups are not rendered.
- Existing Active/Pending tabs, branch filters, row selection, invite/review/edit links, and action menus remain in place.

## Verification
- `pnpm type-check`: passing.
- `pnpm lint`: passing.
- `pnpm build`: passing, 68 app routes.

## Remaining Notes
- Existing unrelated working tree changes were left untouched:
  `.claude/settings.json`, `supabase/migrations/20260513000002_real_staff_rbac_seed.sql`, `docs/design-references/`, `next-smoke.err.log`, `next-smoke.log`.
