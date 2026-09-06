# Stage 02 Hosted Booking Write Boundary Evidence

## Target

Hosted CradleHub server boundary for Desktop Stage 02

## Hosted Branch

`stage/02-desktop-booking-api`

## HOSTED_BASE_SHA

`feda4600f37e93084fdb672bd0c2612e9872bb43`

## Previously Reviewed Hosted HEAD

`7396ac4d2c5170a4882d9e142c07e2d827465f50`

## Desktop Dependency

`stage/02-bookings` @ `7afb30ccb0996915544dae4c41c9e653bc9f310e`

## Changed Files in Boundary

- `src/lib/bookings/inhouse-booking-engine.ts` [NEW] - Authoritative server-only domain engine
- `src/lib/auth/desktop-bearer-auth.ts` [NEW] - Server-side Bearer token verification & active staff resolution helper (strictly aligned with canonical authority; no super-admin override)
- `src/app/api/desktop/v1/bookings/route.ts` [NEW] - Dedicated authenticated API route for Desktop booking creation
- `src/lib/actions/inhouse-booking.ts` [MODIFIED] - Thin server action wrapper preserving existing cookie-session CRM UI behavior
- `tests/lib/auth/desktop-bearer-auth.test.ts` [NEW] - Direct unit test suite verifying `verifyDesktopBearerAuth` helper authentication, schema enforcement, active staff query, role normalization, error handling, and super-admin override rejection
- `tests/lib/bookings/inhouse-booking-engine-auth.test.ts` [NEW] - Direct unit test suite verifying `executeInhouseBookingCreation` branch guard, cross-branch rejection before database mutations, owner branch flexibility, and missing branch handling
- `tests/api/desktop-v1-bookings.test.ts` [NEW] - Route-level HTTP and domain code mapping tests
- `docs/50-state/evidence/STAGE_02_DESKTOP_BOOKING_API_BOUNDARY.md` [MODIFIED] - This evidence record

## Security & Authorization Correction Summary

Following independent review of HEAD `7396ac4d2c5170a4882d9e142c07e2d827465f50`, the following corrections were applied:

1. **Removed Unauthorized Super-Admin Expansion**:
   - `resolveSuperAdminContext` and mock staff fallbacks were removed from `src/lib/auth/desktop-bearer-auth.ts`.
   - The Desktop booking API requires the exact same canonical active staff context as the original hosted booking action (`staff` table lookup with `auth_user_id` and `is_active: true`, canonical system role, and `canAccessCrmWorkspace(role)`).
   - A user whose ID matches super-admin configuration without an active staff record is denied access (`STAFF_NOT_FOUND`, HTTP 403).
2. **Direct Authentication Helper Testing**:
   - `verifyDesktopBearerAuth` is directly tested in `tests/lib/auth/desktop-bearer-auth.test.ts` without mocking the helper itself.
   - Verified: missing header (401), malformed scheme (401), empty bearer (401), invalid/expired token (401), missing server config (500), no active staff record (403), query failure fail-closed (403), unauthorized role (403), authorized CRM role (200), legacy alias normalization (`csr` -> `crm`), super-admin without staff rejected (403), and token leakage prevention.
3. **Direct Shared Engine Authorization & Branch Boundary Testing**:
   - `executeInhouseBookingCreation` is directly tested in `tests/lib/bookings/inhouse-booking-engine-auth.test.ts` for branch authorization.
   - Verified: non-owner operator attempting cross-branch booking is immediately rejected (`CRM_BRANCH_FORBIDDEN`) before any DB mutation or downstream rule validation occurs.
   - Verified: owner operator is permitted to create bookings across branches.
   - Verified: unassigned operator or missing branch is rejected (`BRANCH_MISSING`).
   - Verified: non-CRM operator is rejected (`UNAUTHORIZED`).

## Server Action

`createInhouseBookingMultiAction` in `src/lib/actions/inhouse-booking.ts` remains the Server Action boundary for the hosted web UI. It obtains the cookie-authenticated user, resolves the active staff profile, and delegates domain execution directly to `executeInhouseBookingCreation(rawInput, operator)`.

## Shared Domain Extraction

`executeInhouseBookingCreation(rawInput, operator)` in `src/lib/bookings/inhouse-booking-engine.ts`.
Extracts the authoritative booking creation workflow: schema validation, branch rule enforcement, service eligibility, consultation checks, exact-time provider scheduling, room auto-assignment, customer upsert, sequential multi-service booking rows, payment logging, notifications, audit logging, and cache revalidation.

## API Endpoint

`POST /api/desktop/v1/bookings`

## Authentication

Requires `Authorization: Bearer <Supabase user access token>`. Verifies user identity server-side via Supabase `auth.getUser(token)`. Rejects missing, malformed, or invalid tokens with HTTP 401.

## Authorization

Resolves active staff row via verified `user.id`. Canonicalizes `system_role` and verifies CRM workspace access via `canAccessCrmWorkspace(role)`. Enforces branch scoping server-side: non-owners can only create bookings for their assigned branch (`CRM_BRANCH_FORBIDDEN`, HTTP 403); owners may target any active branch.

## Request Schema

`createInhouseBookingMultiSchema` from `src/lib/validations/booking.ts` is the single source of truth.

## Response Contract

- Success: HTTP 200 `{ ok: true, bookingId: string, warning?: string }`
- Failure: HTTP status mapped from domain code `{ ok: false, code: string, message: string }`

## Side Effects

All canonical domain side effects are strictly preserved:

- Customer upsert / creation
- Sequential bookings creation
- Multi-service metadata and exact-time snapshots
- `booking_payment_logs` append-only audit record
- Staff assignment and home-service review notifications (`createNotification`)
- Business audit logging (`logBusinessEvent`)
- Operational surface cache revalidation (`revalidateOperationalBookingSurfaces`)

## Verification Checks

- `pnpm format:check` - PASSED (all target files formatted with Prettier)
- `pnpm type-check` - PASSED (tsc --noEmit with 0 errors)
- `pnpm lint` - PASSED (eslint with 0 errors)
- `pnpm vitest run tests/lib/auth/desktop-bearer-auth.test.ts` - PASSED (13/13 tests pass)
- `pnpm vitest run tests/lib/bookings/inhouse-booking-engine-auth.test.ts` - PASSED (5/5 tests pass)
- `pnpm vitest run tests/api/desktop-v1-bookings.test.ts` - PASSED (13/13 tests pass)
- `pnpm vitest run tests/lib/bookings/` - PASSED (all booking tests pass)
- `pnpm build` - PASSED (Next.js production build succeeded)
- `git diff --check` - PASSED (clean diff, no whitespace errors)

## Security & Data Impact

- Zero database migrations, schema mutations, or RLS changes
- Service-role key remains strictly server-only (`import "server-only";`)
- No renderer/client secrets or credentials exposed
- No bearer token logging or credential leakage in responses
- No super-admin production booking expansion
- No wildcard CORS
- No production database writes during tests (all tests execute against isolated mocks and local fixtures)

## Limitations

- Endpoint is implemented on the hosted server boundary and verified with unit/integration tests and production build; it is not yet connected to the Desktop client codebase in this pass.
- Desktop integration will occur only after independent review of this hosted server boundary.
