# CURRENT TASK: MGR-STAFF-001 — Manager Staff Parity

## Overview
Mirror Owner staff-management capabilities into the Manager workspace, safely branch-scoped, without redesigning the app or rewriting staff management from scratch.

## What changed
1. **Audit:** Created `docs/MANAGER_STAFF_PARITY_AUDIT.md` documenting Owner capabilities, Manager gaps, and safe parity plan.

2. **Shared edit form:**
   - Extracted `src/components/features/staff/staff-edit-form.tsx` from Owner route.
   - Accepts `workspaceContext: "owner" | "manager"`.
   - Owner: full controls, all branches, all roles.
   - Manager: branch-locked, manager-safe roles only, protected-account warning.

3. **New Manager route:**
   - Created `src/app/(dashboard)/manager/staff/[staffId]/page.tsx`.
   - Loads staff only from manager's branch; returns `notFound()` otherwise.
   - Renders shared `StaffEditForm` with `workspaceContext="manager"`.

4. **Owner route updated:**
   - `src/app/(dashboard)/owner/staff/[staffId]/page.tsx` now imports shared `StaffEditForm`.
   - Deleted old local `staff-edit-form.tsx`.

5. **Server action hardening (`updateStaffAction`):**
   - Added `SENSITIVE_SYSTEM_ROLES` and `MANAGER_SAFE_ROLES` sets.
   - Manager updates check: target staff is in manager's branch.
   - Manager updates check: target staff is NOT a protected account.
   - Manager updates check: new `systemRole` must be manager-safe.
   - Manager updates check: new `branchId` must equal manager's branch.
   - Revalidates both `/owner/staff` and `/manager/staff` (list + detail pages).

6. **Preview panel updates:**
   - `src/components/features/staff/staff-preview-panel.tsx`
   - Manager now sees "Change Role" and "Deactivate Staff" quick actions.
   - "Assign Branch" remains Owner-only.

7. **Mobile staff screen:**
   - `src/components/features/manager/mobile/manager-staff-screen.tsx`
   - Staff cards are now clickable `Link` elements to `/manager/staff/[staffId]`.

8. **Pre-existing lint fix:**
   - Fixed `<a>` → `<Link>` in `control-console-page.tsx` (was blocking lint).

## Files changed
- `docs/MANAGER_STAFF_PARITY_AUDIT.md` — CREATED
- `src/components/features/staff/staff-edit-form.tsx` — CREATED (extracted)
- `src/app/(dashboard)/manager/staff/[staffId]/page.tsx` — CREATED
- `src/app/(dashboard)/owner/staff/[staffId]/page.tsx` — updated import to shared form
- `src/app/(dashboard)/owner/staff/[staffId]/staff-edit-form.tsx` — DELETED
- `src/app/(dashboard)/owner/staff/actions.ts` — hardened `updateStaffAction`
- `src/components/features/staff/staff-preview-panel.tsx` — manager quick actions
- `src/components/features/manager/mobile/manager-staff-screen.tsx` — clickable cards
- `src/components/features/control-console/control-console-page.tsx` — `<a>` to `<Link>`

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 80 app routes (was 79).

## Next Phase
- Manager direct-invite page (`/manager/staff/new`) if business wants managers to create staff directly.
- Staff delete/soft-delete capability if business needs it (currently only deactivate).
