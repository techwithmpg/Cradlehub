# Current Task - AUTH-STAFF-RECOVERY-001

Status: COMPLETE
Started: 2026-06-17
Completed: 2026-06-17

## Description

Add staff password recovery, accessible password visibility controls, and Owner account-access diagnostics without replacing the existing Supabase Auth or RBAC system.

## Audit Summary

- Existing login uses Supabase Auth through `signInWithPassword`, then resolves access with `getUserWorkspaceAccess` and the workspace-switching helpers.
- Protected workspace access is enforced in `src/proxy.ts`; CRM access requires a linked active `staff` row and a role/workspace combination accepted by `canAccessWorkspacePath`.
- Owner direct staff creation currently uses `inviteUserByEmail` and stores the returned Supabase Auth user id in `staff.auth_user_id`.
- The legacy `/onboard/[staffId]` password setup route still exists and can create auth users for invite rows, but it is stale relative to the current direct-invite flow and should not be expanded.
- There is no self-service forgot-password page, reset-password page, or `/auth/callback` handler for Supabase recovery links.
- Password inputs on login and legacy onboarding do not include a visibility toggle.
- Owner staff management does not show whether a staff member has a linked auth account, confirmed email, prior sign-in, active status, or CRM workspace access.
- Staff rows do not store email addresses, so diagnostics for unlinked staff cannot infer an email without a linked Supabase Auth user.

## Implementation Notes

- Preserve the existing Supabase Auth, middleware/proxy, RBAC, staff role, and workspace-switching architecture.
- Keep the service-role Supabase client server-only.
- Add generic reset responses to avoid account enumeration.
- Add owner-only diagnostics and password recovery support for linked staff accounts.
- Add append-only audit/rate-limit storage for password recovery and diagnostics events.

## Implementation Summary

- Added `/forgot-password`, `/auth/callback`, and `/reset-password` using the existing Supabase Auth clients and PKCE code exchange.
- Added generic self-service reset responses so valid/invalid email addresses are not enumerated.
- Added `PasswordInput` with accessible show/hide controls and applied it to login, reset password, staff onboarding, and legacy staff invite password fields.
- Added Owner-only staff account diagnostics in the staff preview panel, backed by server actions that check linked Supabase Auth status through the existing server-only admin client.
- Added owner-triggered password recovery emails for linked staff accounts.
- Added `staff_account_access_events` migration and typed table entry for audit/rate-limit events.
- Preserved existing login action, proxy protection, RBAC, workspace switching, and staff role model.

## Verification Results

- `pnpm type-check`: PASS
- `pnpm lint`: PASS with 4 existing warnings outside this task.
- Focused tests: PASS, 3 files / 9 tests.
- `pnpm test`: PARTIAL, 39 files passed and the 2 known unrelated failures remain in `tests/lib/bookings/progress.test.ts`.
- `pnpm build`: PASS, 100 generated app routes.
- Credential/token scan: PASS, no token/password logging matches.
- Client service-role scan: PASS, no client component imports `createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY`, or `service_role`.
