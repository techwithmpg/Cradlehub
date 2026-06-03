# HANDOFF - Multi-workspace switching: COMPLETE

## Status

Build verified. CradleHub now has a shared workspace-access resolver, `/select-workspace`, an account setup fallback, and a premium setup-center-style switching overlay.

## What changed

### Workspace access model

Added `src/lib/auth/workspace-access.ts`.

- Defines `WorkspaceKey`, `WorkspaceAccess`, and typed profile input.
- Builds workspace access from the active staff profile without creating duplicate accounts or separate logins.
- Returns CRM for operational/admin roles, Owner for owners, Manager for manager roles, Staff Portal for active non-driver/non-utility staff, Driver Portal for `system_role` or `staff_type` driver, and Utility Portal to preserve the existing utility workspace.
- Provides `getWorkspaceSwitchDestination()` for login/proxy redirects.

Added `src/lib/auth/get-user-workspace-access.ts`.

- Loads current user workspace access from Supabase.
- Preserves super-admin and local dev-bypass behavior.

### Login and route guard

Changed `src/app/(auth)/login/actions.ts`.

- After successful login, calls `getUserWorkspaceAccess(user.id)`.
- Redirects zero-workspace users to `/account/setup`.
- Redirects single-workspace users directly to that workspace.
- Redirects multi-workspace users to `/select-workspace`.

Changed `src/proxy.ts`.

- Replaced single-role workspace redirects with workspace-access checks.
- Allows multi-access users into every entitled workspace.
- Blocks unauthorized manual visits server-side and redirects to `/select-workspace` when multiple authorized options exist.
- Removes the old owner/manager forced-to-CRM behavior.

### Selector and setup fallback

Added `src/app/(dashboard)/select-workspace/page.tsx`.

- Premium centered workspace selector.
- Shows only authorized workspace cards with icon, label, description, branch chip, and Open Workspace action.
- Single-workspace users are redirected out of the selector.

Added `src/app/account/setup/page.tsx`.

- Authenticated fallback for users with login access but no usable workspace.
- Shows pending/rejected/no-profile messaging from onboarding status where available.

### Switching transition

Added `src/components/shared/workspace-switching-loader.tsx`.

- Uses the existing setup-center `CrmPremiumLoader`.
- Renders centered blurred/dimmed overlay with CradleHub mark and warm card styling.

Added `src/components/shared/workspace-switch-link.tsx`.

- Client wrapper for workspace navigation.
- Prevents repeated clicks, shows loader immediately, uses `router.push()`, has a fail-safe timeout, and shows a Sonner error if push throws.

### Header and driver compatibility

Changed `src/components/features/dashboard/header.tsx`.

- Adds a profile dropdown with My Profile, Switch Workspace, Settings, Help & Support, and Logout.
- Shows Switch Workspace only when the user has more than one workspace.

Changed `src/app/(dashboard)/layout.tsx`.

- Fetches workspace access and passes it into the header.

Changed `src/app/(dashboard)/driver/page.tsx` and `src/app/(dashboard)/driver/dispatch/page.tsx`.

- Driver portal now allows staff with `staff_type = driver`, not only `system_role = driver`.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 91 routes
- Focused scan for `any`, `@ts-ignore`, and direct `console.` in touched files: PASS
- In-app browser reached `http://localhost:3000/select-workspace` and correctly redirected unauthenticated traffic to `/login`.

## Browser note

Authenticated click-through still needs local test sessions for CRM-only, Staff-only, CRM+Staff, Driver, Owner/Admin, and no-workspace users. Code-level checks and unauthenticated proxy behavior are verified.

## Follow-up fix: Staff Portal shell nav

After user screenshot review, fixed `src/components/features/dashboard/sidebar.tsx` so path-derived workspace identity wins over role-derived CRM/CSR identity. Multi-access users visiting `/staff-portal/*` now get `NAV_CONFIG.staff` and Staff Portal sidebar metadata instead of CSR/CRM navigation. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; in-app browser reached `/staff-portal/profile` but redirected unauthenticated traffic to `/login`.

## Follow-up fix: Staff Portal self-edit profile

Added `src/components/features/staff-portal/staff-profile-details-form.tsx` and `updateMyProfileDetailsAction` in `src/app/(dashboard)/staff-portal/actions.ts`. Staff users can edit only `full_name` and `nickname` on their own staff row. `system_role`, `staff_type`, and `tier` are displayed as locked read-only fields and remain controlled by owner/manager/CRM staff management flows. The server action validates the authenticated user, updates only the linked staff row via the server admin client, and hard-codes the allowed update payload. Also fixed the staff portal profile lookup to load real `staff_type`, `avatar_url`, and `avatar_path` fields instead of forcing them to null. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; authenticated save click-through still needs a local staff session.

## Follow-up fix: Staff Portal role dropdowns

Per latest user request, updated the Staff Portal profile form so `system_role` and `staff_type` are editable dropdowns sourced from `SYSTEM_ROLE_OPTIONS` and `STAFF_TYPE_OPTIONS`. `updateMyProfileDetailsAction` now validates those values against `SYSTEM_ROLES` and `STAFF_TYPES`, then updates `full_name`, `nickname`, `system_role`, and `staff_type` on the authenticated user's own staff row. Tier remains read-only. Save button keeps the `Loader2` in-button spinner while pending. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; browser route check redirected unauthenticated traffic to `/login`.

## Follow-up fix: Staff Portal visible save button

Moved the Staff Portal profile `Save Changes` button into the `Account Details` card header so staff can see it immediately. The button now uses a dedicated submit component with React DOM `useFormStatus()` so the inline `Loader2` spinner and `Saving` label reflect the active form submission. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; local route reachability still redirects unauthenticated traffic to `/login`, so final visual save confirmation needs a logged-in staff session.
