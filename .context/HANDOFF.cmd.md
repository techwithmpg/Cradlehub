# HANDOFF — CRM Edit Staff Profile Tabbed Modal

## What Was Done

Rebuilt the CRM Edit Staff Profile modal from a plain long-form editor into the approved centered tabbed modal for `/crm/staff?tab=management`.

## Files Changed

| File | What changed |
|------|-------------|
| `src/components/features/crm/staff/crm-edit-staff-profile-modal.tsx` | Rebuilt as centered `AdminDialog size="xl"` with fixed header, identity card, tabs, scrollable body, sticky footer, dirty tracking, validation, and safe save flow. |
| `src/components/features/crm/staff/crm-staff-management-tab.tsx` | Profile save now shows status + refreshes; Edit Services closes profile modal before opening dedicated service editor. |
| `src/components/features/crm/staff/edit-staff-profile-types.ts` | Shared draft/tab/service/branch types and dirty-count helper. |
| `src/components/features/crm/staff/edit-staff-profile-form-parts.tsx` | Shared section/field/input styling helpers. |
| `src/components/features/crm/staff/edit-staff-profile-identity-card.tsx` | Premium staff identity summary card. |
| `src/components/features/crm/staff/edit-staff-profile-tabs.tsx` | Four-tab modal navigation. |
| `src/components/features/crm/staff/edit-staff-profile-footer.tsx` | Sticky footer with unsaved changes + actions. |
| `src/components/features/crm/staff/staff-service-capabilities-summary.tsx` | Summary-only service capabilities card and launch button. |
| `src/components/features/crm/staff/tabs/*.tsx` | Focused Profile Info, Work Setup, Access & Status, and Service Capabilities tab content. |

## Modal Design

- Centered `AdminDialog` using the shared admin overlay system.
- Header: "Edit Staff Profile" plus operational description.
- Staff identity card: avatar, name, staff function/tier/status, branch, phone, service count.
- Tabs: Profile Info, Work Setup, Access & Status, Service Capabilities.
- Body: internal scroll via `AdminOverlayBody`.
- Footer: always visible, with unsaved change count, Cancel, and Save Changes.
- Service Capabilities tab is summary-only and opens the existing dedicated service capabilities modal.

## Permission Safety

- Existing `updateStaffAction` remains the save path.
- Protected system roles stay disabled in the modal.
- CRM/CSR role promotion remains constrained by existing role option and server action guards.
- Branch changes are only enabled for owner/manager roles and still validated server-side.
- No RBAC/auth weakening and no database schema changes.

## Verification

- `pnpm type-check`: Passing
- `pnpm lint`: Passing with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: Passing, 89 routes
- Browser click-through: blocked. In-app browser could not reach local CRM route (`ERR_CONNECTION_REFUSED` after redirect to `/login`), though PowerShell received HTTP 200 from `http://localhost:3000/crm/staff?tab=management`.

## Remaining Notes

- Authenticated browser verification still needs a reachable local browser session and a valid CRM/CSR login.
- Production CRM/CSR saves still depend on the previously created staff RLS migration being applied in Supabase.
- The broader worktree contains unrelated dirty files from earlier tasks; do not revert them casually.
