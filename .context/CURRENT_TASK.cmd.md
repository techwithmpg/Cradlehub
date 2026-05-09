# CURRENT TASK: STAFF-UI-002 — Staff Management Display Normalization and Compact Profile (Complete)

## Overview
Refined the existing owner Staff Management workspace UI/data display layer so staff table rows, role badges, and the selected profile panel use one shared display helper. No auth, RBAC, booking logic, database schema, staff CRUD, public pages, or route structure were changed.

## Exact Files Identified Before Editing
- Staff Management route: `src/app/(dashboard)/owner/staff/page.tsx`
- Workspace component: `src/components/features/staff/staff-management-workspace.tsx`
- Branch/table component: `src/components/features/staff/staff-branch-section.tsx`
- Staff row component: `src/components/features/staff/staff-table-row.tsx`
- Right profile panel: `src/components/features/staff/staff-preview-panel.tsx`
- Role/status badge component: `src/components/features/staff/staff-badges.tsx`
- Display/group/filter helper: `src/components/features/staff/staff-management-utils.ts`
- Label sources inspected: `src/lib/permissions.ts`, `src/constants/staff.ts`

## Completed
- Added shared `getStaffDisplayMeta(staff)` for Staff Management role labels, staff type labels, access role badge labels, tier eligibility, and subtitles.
- Profile panel and table rows now use the same helper, removing the old mismatch where the table could show managerial identity while the right panel showed therapist data.
- Protected manager/admin/front-desk/support roles suppress legacy default `tier = junior` even when raw seed data has `staff_type = therapist`.
- Service staff roles can still display Junior/Mid/Senior tiers when staff type is service-eligible.
- Removed the repeated Branch column from branch-grouped staff tables; branch remains in headers, filters, and profile details.
- Made the right profile panel content-height with self-start alignment instead of stretching down the page.
- Preserved existing links/actions for invite, review/edit profile, assign branch, change role, deactivate, and pending approval review.

## Verification
- `pnpm type-check`: passing
- `pnpm lint`: passing
- `pnpm build`: passing, 68 app routes

## Status
Complete. Ready to commit as `fix(staff): normalize staff display and compact profile panel`.
