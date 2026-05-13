# HANDOFF — MGR-STAFF-001 Manager Staff Parity

## Date
2026-05-13

## Agent
Kimi

## Summary
Manager workspace now has staff detail/edit capabilities matching Owner, but branch-scoped and with manager-safe role restrictions. A shared `StaffEditForm` component serves both workspaces.

## Files Created
- `docs/MANAGER_STAFF_PARITY_AUDIT.md`
- `src/components/features/staff/staff-edit-form.tsx`
- `src/app/(dashboard)/manager/staff/[staffId]/page.tsx`

## Files Modified
- `src/app/(dashboard)/owner/staff/[staffId]/page.tsx` — uses shared form
- `src/app/(dashboard)/owner/staff/actions.ts` — hardened `updateStaffAction`
- `src/components/features/staff/staff-preview-panel.tsx` — manager quick actions
- `src/components/features/manager/mobile/manager-staff-screen.tsx` — clickable cards
- `src/components/features/control-console/control-console-page.tsx` — `<a>` → `<Link>`

## Behavior After Change
- `/manager/staff/[staffId]` exists and loads branch-scoped staff.
- Manager can edit: name, phone, role (safe roles only), staff type, tier, is_head, active status, service capabilities.
- Manager cannot: change branch, assign sensitive roles, or edit protected accounts.
- Owner staff management unchanged.
- Mobile staff cards link to detail pages.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 80 app routes.

## Remaining Notes / Future Improvements
- Manager direct-invite page (`/manager/staff/new`) if business wants it.
- Staff soft-delete capability does not exist for Owner or Manager.
- Role schema (`updateStaffSchema`) currently supports `manager, crm, csr, csr_head, csr_staff, staff`. If the business wants to assign `driver`, `utility`, `service_head`, or `service_staff` through the edit form, the Zod schema and form options need to be expanded (DB already supports them).
