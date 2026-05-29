# HANDOFF — CradleHub

> Last updated: 2026-05-29

## Current Phase
CRM-OPS-STAFF-SVC-001 complete — CRM is now fully operational for staff/service management

## What Just Happened (CRM-OPS-STAFF-SVC-001 — CRM Operational Staff/Service Management)

CRM workspace can now manage staff profiles, activate/deactivate staff, assign service capabilities, and control service visibility — all without leaving the CRM workspace or relying on Manager pages.

**Key changes:**

- `src/lib/actions/crm-staff-services.ts` (NEW) — `updateStaffServicesFromCrmAction`: replaces all service capability assignments for a staff member, branch-scoped, all CRM roles allowed.

- `src/app/(dashboard)/owner/staff/actions.ts` — `requireOwnerOrManager()` now includes CRM/CSR operational roles. All non-owner roles are branch-scoped. New `toggleStaffActiveAction` (CRM-accessible).

- `src/app/(dashboard)/owner/branches/actions.ts` — `updateBranchServiceVisibilityAction` now uses `requireOwnerOrBranchManager()` — CRM/CSR roles can toggle public/csr_only for their branch.

- `src/lib/auth/crm-permissions.ts` — Added `canManageOperationalStaff`, `canManageStaffServices`, `canUpdateServiceVisibility`; updated `canManageStaffAssignments` to include crm+csr_head.

- `src/components/features/staff/staff-edit-form.tsx` — Added "crm" context (behaves like manager). Branch type simplified to `BranchLite`.

- `src/components/features/staff/staff-service-editor-sheet.tsx` — Added `onSave?(ids)` and `saving` props. Done button now triggers save when wired.

- `src/components/features/staff/staff-preview-panel.tsx` + `staff-management-workspace.tsx` — CRM callback props `onEditStaff`, `onManageServices`, `onToggleActive` threaded through.

- `src/components/features/crm/staff/crm-staff-management-tab.tsx` — Full rewrite: orchestrates StaffEditForm Sheet, StaffServiceEditorSheet, and toggle-active.

- `src/components/features/crm/staff/crm-staff-assignments-tab.tsx` — Full rewrite: Manage button per row, StaffServiceEditorSheet with CRM save.

- `src/components/features/crm/services/service-assignment-table-row.tsx` — Visibility toggle button in status cell: 🌐 Public ↔ 🔒 CSR Only.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (90/90 routes)

## Recommended Next Steps
1. **Browser verification** — open `/crm/staff?tab=management`, edit a staff member, assign services, toggle active/inactive from the preview panel. Open `/crm/services`, toggle a service between Public and CSR Only.
2. **RLS audit** — Run `pnpm db:types` if schema has changed since last run. Verify CRM role can write to `staff_services` via normal Supabase RLS (no service-role bypass used).
3. **Unused components cleanup** — `crm-setup-health-cards.tsx`, `crm-setup-issues-list.tsx`, `crm-setup-workspace-tiles.tsx`, `spaces-rules-health-summary.tsx`, `spaces-rules-access-notice.tsx`, `crm-readiness-badge.tsx`, `crm-readiness-badge-wrapper.tsx` are no longer imported by active pages. Safe to remove when confirmed.
4. **Owner/Manager workspace reactivation** — when ready, revert `owner/layout.tsx` and `manager/layout.tsx` from `redirect("/crm")` back to full layouts.

## Previous Phase
SETUP-CENTER-UI-002 complete — Setup Center redesigned with premium mockup-quality UI
(See previous HANDOFF content below)

---

## Previous Phase
SETUP-CENTER-UI-002 complete — Setup Center redesigned with premium mockup-quality UI

The CRM Setup Center (`/crm/setup`, `/crm/services`, `/crm/spaces-rules`) has been redesigned with a premium, action-driven UI.

**Build Status:** pnpm type-check ✅ · pnpm lint ✅ · pnpm build ✅ (89/89 routes)
