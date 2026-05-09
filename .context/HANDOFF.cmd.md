# HANDOFF — STAFF-UI-001 Staff Management Workspace Layout Redesign

## Date
2026-05-09

## Agent
Codex

## Summary
Rebuilt `/owner/staff` into a premium, branch-grouped Staff Management dashboard without changing auth, RBAC, booking logic, database schema, staff CRUD actions, invite flows, or manager schedule management.

## Files Changed
- `src/app/(dashboard)/owner/staff/page.tsx` — server page now fetches existing staff datasets and renders the new workspace component.
- `src/components/features/staff/staff-management-workspace.tsx` — main client orchestration for filters, tabs, selected staff, and layout.
- `src/components/features/staff/staff-management-utils.ts` — staff display labels, branch grouping, filtering, status, date, and initials helpers.
- `src/components/features/staff/staff-stats-cards.tsx` — KPI row.
- `src/components/features/staff/staff-filter-bar.tsx` — search and branch/role/status filters.
- `src/components/features/staff/staff-tabs.tsx` — Active Staff and Pending segmented tabs.
- `src/components/features/staff/staff-branch-section.tsx` — branch section shell with branch count and table container.
- `src/components/features/staff/staff-table-row.tsx` — dense staff table rows with avatar/initials, selected checkbox, badges, and row menu.
- `src/components/features/staff/staff-preview-panel.tsx` — selected staff profile and quick actions rail.
- `src/components/features/staff/staff-badges.tsx` — staff status and role badges.
- `src/components/features/staff/staff-empty-list.tsx` — filtered/empty state.

## Behavior Notes
- Active and pending datasets remain separate. Pending is still driven by existing inactive staff records from `getPendingStaff()`.
- Branch grouping happens after client-side search/filtering.
- Staff with missing branch data are grouped under `Unassigned Branch`.
- Role/title display uses `job_title` when present, falls back through system role labels for admin/non-service roles, and only appends tier for therapist rows.
- Invite Link, Direct Invite, row edit/review, Approve Staff, Assign Branch, Change Role, and Deactivate Staff quick actions all route into existing owner staff pages/actions.

## Verification
- `pnpm type-check`: passing.
- `pnpm lint`: passing.
- `pnpm build`: passing, 68 app routes.

## Remaining Notes
- No browser screenshot verification was run in this pass; verification was via TypeScript, lint, and production build.
- Existing unrelated working tree changes were left untouched.
