# Stage 02 Hosted Booking Write Boundary Evidence

## Target

Hosted CradleHub server boundary for Desktop Stage 02

## Hosted Branch

`stage/02-desktop-booking-api`

## HOSTED_BASE_SHA

`feda4600f37e93084fdb672bd0c2612e9872bb43`

## Previously Reviewed Hosted HEAD

`b077720584f0d55919e50e6a757cff9c4085be23`

## Desktop Dependency

`stage/02-bookings` @ `7afb30ccb0996915544dae4c41c9e653bc9f310e`

## Changed Files in Boundary

- `src/lib/bookings/inhouse-booking-engine.ts` [NEW] - Authoritative server-only domain engine with explicit `isDevBypass: boolean` operator context
- `src/lib/auth/desktop-bearer-auth.ts` [NEW] - Server-side Bearer token verification & active staff resolution helper (strictly fail-closed: `isDevBypass: false`; no dev-bypass lookups; no super-admin override)
- `src/app/api/desktop/v1/bookings/route.ts` [NEW] - Dedicated authenticated API route for Desktop booking creation with domain-grounded HTTP status mapping
- `src/lib/actions/inhouse-booking.ts` [MODIFIED] - Thin server action wrapper preserving existing cookie-session CRM UI behavior with explicit `isDevAuthBypassEnabled()` delegation
- `tests/lib/auth/desktop-bearer-auth.test.ts` [NEW] - Direct unit test suite verifying `verifyDesktopBearerAuth` helper authentication, schema enforcement, active staff query, role normalization, error handling, super-admin override rejection, and `isDevBypass: false` isolation under active dev bypass flags
- `tests/lib/bookings/inhouse-booking-engine-auth.test.ts` [NEW] - Direct unit test suite verifying `executeInhouseBookingCreation` branch guard, cross-branch rejection before database mutations, owner branch flexibility, missing branch handling, and cross-branch rejection under active `DEV_AUTH_BYPASS=true`
- `tests/api/desktop-v1-bookings.test.ts` [NEW] - Route-level HTTP and domain code mapping tests
- `docs/50-state/evidence/STAGE_02_DESKTOP_BOOKING_API_BOUNDARY.md` [MODIFIED] - This evidence record

## Desktop Dev-Bypass Isolation Correction

Following independent review of HEAD `b077720584f0d55919e50e6a757cff9c4085be23`:

1. **Shared Engine Dev-Bypass Fallback Removed**: `executeInhouseBookingCreation` in `src/lib/bookings/inhouse-booking-engine.ts` no longer imports `isDevAuthBypassEnabled` or defaults `isDevBypass` from the environment.
2. **Explicit Required Operator Property**: `isDevBypass: boolean` is a mandatory property on `InhouseBookingOperator`.
3. **Hosted CRM Server Action Preserved**: `createInhouseBookingMultiAction` in `src/lib/actions/inhouse-booking.ts` explicitly evaluates `isDevAuthBypassEnabled()` and supplies `isDevBypass` to the engine, preserving local web development workflows while keeping production fail-closed.
4. **Desktop Bearer Helper Explicit Fail-Closed**: `verifyDesktopBearerAuth` in `src/lib/auth/desktop-bearer-auth.ts` explicitly sets `isDevBypass: false` on the operator context. It does not inspect `DEV_AUTH_BYPASS` or `DEV_ALLOW_ALL_MODULES`.
5. **Cross-Branch Protection Under Active Bypass Flags**: Regression tests prove that non-owner cross-branch booking attempts via Desktop are rejected with `CRM_BRANCH_FORBIDDEN` (HTTP 403) and execute zero downstream database writes even when `DEV_AUTH_BYPASS=true`.

## Domain Error-Mapping Correction Summary

The HTTP status code mapping in `src/app/api/desktop/v1/bookings/route.ts` remains reconciled with actual reachable codes from `executeInhouseBookingCreation`:

1. **`BOOKING_RULES_ERROR`**: Retained at HTTP 400. Client-correctable constraint failure.
2. **`SERVICE_TIMING_ERROR`**: Falls to HTTP 500 default. Internal database/calculation failure.
3. **Unsupported Distance Codes Removed**: `DISTANCE_FAILED` and `MAX_DISTANCE_EXCEEDED` removed.
4. **Actual Home-Service Error Handling**:
   - `BRANCH_NOT_FOUND` maps to HTTP 400 (invalid branch reference provided).
   - `BRANCH_LOCATION_MISSING` falls to HTTP 500 (server branch coordinate configuration missing in database).
5. **`REFERENCE_ERROR`**: Falls to HTTP 500 default (internal foreign-key constraint violation).
6. **Route Test Grounding**: Every retained or mapped status code is covered by focused tests.

## Server Action

`createInhouseBookingMultiAction` in `src/lib/actions/inhouse-booking.ts` remains the Server Action boundary for the hosted web UI. It obtains the cookie-authenticated user, resolves the active staff profile, evaluates local dev bypass, and delegates domain execution directly to `executeInhouseBookingCreation(rawInput, operator)`.

## Shared Domain Extraction

`executeInhouseBookingCreation(rawInput, operator)` in `src/lib/bookings/inhouse-booking-engine.ts`.
Authoritative booking creation workflow: schema validation, branch rule enforcement, service eligibility, consultation checks, exact-time provider scheduling, room auto-assignment, customer upsert, sequential multi-service booking rows, payment logging, notifications, audit logging, and cache revalidation.

## API Endpoint

`POST /api/desktop/v1/bookings`

## Authentication

Requires `Authorization: Bearer <Supabase user access token>`. Verifies user identity server-side via Supabase `auth.getUser(token)`. Rejects missing, malformed, or invalid tokens with HTTP 401.

## Authorization

Resolves active staff row via verified `user.id`. Canonicalizes `system_role` and verifies CRM workspace access via `canAccessCrmWorkspace(role)`. Enforces branch scoping server-side: non-owners can only create bookings for their assigned branch (`CRM_BRANCH_FORBIDDEN`, HTTP 403); owners may target any active branch.

## Request Schema

`createInhouseBookingMultiSchema` from `src/lib/validations/booking.ts` is the single source of truth. Authorization context (`isDevBypass`, `staffRole`, `authUserId`) is never accepted from request input.

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

- `pnpm prettier --check src/lib/bookings/inhouse-booking-engine.ts src/lib/actions/inhouse-booking.ts src/lib/auth/desktop-bearer-auth.ts src/app/api/desktop/v1/bookings/route.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/lib/bookings/inhouse-booking-engine-auth.test.ts tests/api/desktop-v1-bookings.test.ts docs/50-state/evidence/STAGE_02_DESKTOP_BOOKING_API_BOUNDARY.md` - PASSED
- `pnpm type-check` - PASSED (tsc --noEmit with 0 errors)
- `pnpm lint` - PASSED (eslint with 0 errors)
- `pnpm vitest run tests/lib/auth/desktop-bearer-auth.test.ts` - PASSED (14/14 tests pass)
- `pnpm vitest run tests/lib/bookings/inhouse-booking-engine-auth.test.ts` - PASSED (6/6 tests pass)
- `pnpm vitest run tests/api/desktop-v1-bookings.test.ts` - PASSED (19/19 tests pass)
- `pnpm vitest run tests/lib/auth/desktop-bearer-auth.test.ts tests/lib/bookings/inhouse-booking-engine-auth.test.ts tests/api/desktop-v1-bookings.test.ts` - PASSED (39/39 tests pass)
- `pnpm vitest run tests/lib/bookings/` - PASSED (223/223 tests pass)
- `pnpm build` - PASSED (Next.js production build succeeded)
- `git diff --check` - PASSED (clean diff, no whitespace errors)

## Security & Data Impact

- Zero database migrations, schema mutations, or RLS changes
- Service-role key remains strictly server-only (`import "server-only";`)
- No renderer/client secrets or credentials exposed
- No bearer token logging or credential leakage in responses
- No super-admin production booking expansion
- No dev-bypass inheritance on desktop API boundary
- No wildcard CORS
- No production database writes during tests (all tests execute against isolated mocks and local fixtures)

## Limitations

- Endpoint is implemented on the hosted server boundary and verified with unit/integration tests and production build; it is not yet connected to the Desktop client codebase in this pass.
- Desktop integration will occur only after independent review of this hosted server boundary.
