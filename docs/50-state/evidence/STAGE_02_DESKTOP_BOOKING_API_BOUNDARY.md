# Hosted Stage 02 Desktop Booking API Boundary Evidence

## Target

Hosted Stage 02 Desktop booking API boundary

## Branch

`stage/02-desktop-booking-api`

## Current Stage HEAD

`5061e35c30222aebc311b4ee3e9b5e260712c252`

## Previous Reviewed HEAD

`f37f84feeb5a33d132c500a3369beab5904c695a`

## Merge Base Before Reconciliation

`feda4600f37e93084fdb672bd0c2612e9872bb43`

## Current Main Reconciled

`cddd96e63ac37a1a720ccb94f037f4820833f150`

## Reconciled Main Commits Incorporated

1. `c38b573a2be99ed9102d2f1c9bd342acaff7b9a1`
   `fix(marketing): resolve Sharp Linux runtime packaging and decouple read query boundary`
2. `4c207fa17a23fb8da36cf7ec55b94ddccebfe51d`
   `fix(marketing): add outputFileTracingIncludes for sharp libvips and strengthen import-guard regression test`
3. `624b4d3ca3dc0831e905447bcc1360de26afc032`
   `test(marketing): enforce Sharp import boundary`
4. `cddd96e63ac37a1a720ccb94f037f4820833f150`
   `docs(marketing): record P0 Sharp recovery evidence`

## Desktop Dependency

`stage/02-bookings` @ `9268a95d1ada8b2d963cceb56f0b0b5a1d69e83f`

This is the current reviewed Desktop Stage 02 head that targets this hosted booking boundary.

## Changed Files vs Current Main

- `src/lib/bookings/inhouse-booking-engine.ts` [NEW] - Authoritative server-only domain engine with explicit `isDevBypass: boolean` operator context
- `src/lib/auth/desktop-bearer-auth.ts` [NEW] - Server-side Bearer token verification & active staff resolution helper (strictly fail-closed: `isDevBypass: false`; no dev-bypass lookups; no super-admin override)
- `src/app/api/desktop/v1/bookings/route.ts` [NEW] - Dedicated authenticated API route for Desktop booking creation with domain-grounded HTTP status mapping
- `src/lib/actions/inhouse-booking.ts` [MODIFIED] - Thin server action wrapper preserving existing cookie-session CRM UI behavior with explicit `isDevAuthBypassEnabled()` delegation
- `tests/lib/auth/desktop-bearer-auth.test.ts` [NEW] - Direct unit test suite verifying `verifyDesktopBearerAuth` helper authentication, schema enforcement, active staff query, role normalization, error handling, super-admin override rejection, and `isDevBypass: false` isolation under active dev bypass flags
- `tests/lib/bookings/inhouse-booking-engine-auth.test.ts` [NEW] - Direct unit test suite verifying `executeInhouseBookingCreation` branch guard, cross-branch rejection before database mutations, owner branch flexibility, missing branch handling, and cross-branch rejection under active `DEV_AUTH_BYPASS=true`
- `tests/api/desktop-v1-bookings.test.ts` [NEW] - Route-level HTTP and domain code mapping tests
- `docs/50-state/evidence/STAGE_02_DESKTOP_BOOKING_API_BOUNDARY.md` [MODIFIED] - This evidence record

## Desktop Dev-Bypass Isolation

1. **Shared Engine Dev-Bypass Fallback Removed**: `executeInhouseBookingCreation` in `src/lib/bookings/inhouse-booking-engine.ts` does not import `isDevAuthBypassEnabled` or default `isDevBypass` from the environment.
2. **Explicit Required Operator Property**: `isDevBypass: boolean` is a mandatory property on `InhouseBookingOperator`.
3. **Hosted CRM Server Action Preserved**: `createInhouseBookingMultiAction` in `src/lib/actions/inhouse-booking.ts` explicitly evaluates `isDevAuthBypassEnabled()` and supplies `isDevBypass` to the engine, preserving local web development workflows while keeping production fail-closed.
4. **Desktop Bearer Helper Explicit Fail-Closed**: `verifyDesktopBearerAuth` in `src/lib/auth/desktop-bearer-auth.ts` explicitly sets `isDevBypass: false` on the operator context. It does not inspect `DEV_AUTH_BYPASS` or `DEV_ALLOW_ALL_MODULES`.
5. **Cross-Branch Protection Under Active Bypass Flags**: Regression tests prove that non-owner cross-branch booking attempts via Desktop are rejected with `CRM_BRANCH_FORBIDDEN` (HTTP 403) and execute zero downstream database writes even when `DEV_AUTH_BYPASS=true`.

## Domain Error-Mapping Summary

The HTTP status code mapping in `src/app/api/desktop/v1/bookings/route.ts` is grounded in reachable codes from `executeInhouseBookingCreation`:

1. **`BOOKING_RULES_ERROR`**: HTTP 400. Client-correctable constraint failure.
2. **`SERVICE_TIMING_ERROR`**: Falls to HTTP 500 default. Internal database/calculation failure.
3. **`BRANCH_NOT_FOUND`**: Maps to HTTP 400 (invalid branch reference provided).
4. **`BRANCH_LOCATION_MISSING`**: Falls to HTTP 500 (server branch coordinate configuration missing in database).
5. **`REFERENCE_ERROR`**: Falls to HTTP 500 default (internal foreign-key constraint violation).
6. **Route Test Grounding**: Every mapped status code is covered by focused tests.

## Endpoint & Contract

- Endpoint: `POST /api/desktop/v1/bookings`
- Authentication: `Authorization: Bearer <Supabase user access token>`
- Role & Permission: Verified staff with CRM workspace access (`owner`, `crm`, `manager`)
- Scoping: Non-owners strictly restricted to assigned branch; owners may select explicit active branch
- Success Response: HTTP 200 `{ ok: true, bookingId: string, warning?: string }`
- Error Response: HTTP mapped status `{ ok: false, code: string, message: string }`

## Checks & Verification Results

- `pnpm prettier --check src/lib/bookings/inhouse-booking-engine.ts src/lib/actions/inhouse-booking.ts src/lib/auth/desktop-bearer-auth.ts src/app/api/desktop/v1/bookings/route.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/lib/bookings/inhouse-booking-engine-auth.test.ts tests/api/desktop-v1-bookings.test.ts docs/50-state/evidence/STAGE_02_DESKTOP_BOOKING_API_BOUNDARY.md` — PASSED
- `pnpm type-check` — PASSED (0 errors)
- `pnpm lint` — PASSED (0 errors, 9 baseline warnings)
- `pnpm vitest run tests/lib/auth/desktop-bearer-auth.test.ts` — PASSED (14/14 tests pass)
- `pnpm vitest run tests/lib/bookings/inhouse-booking-engine-auth.test.ts` — PASSED (6/6 tests pass)
- `pnpm vitest run tests/api/desktop-v1-bookings.test.ts` — PASSED (19/19 tests pass)
- Combined focused tests — PASSED (39/39 tests pass)
- Full booking test suite `tests/lib/bookings/` — PASSED (19 files, 223/223 tests pass)
- Full repository test suite `pnpm test -- --run` — PASSED (215 files, 1557/1557 tests pass)
- `pnpm build` — PASSED (Next.js 16.2.4 Turbopack production build succeeded)
- `git diff --check origin/main...HEAD` — PASSED (clean, 0 whitespace errors)

## Security & Data Impact

- Zero database migrations, schema mutations, or RLS changes
- Service-role key remains strictly server-only (`import "server-only";`)
- No renderer/client secrets or credentials exposed to Desktop
- No bearer token logging or credential leakage in responses
- No super-admin production booking expansion
- No dev-bypass inheritance on desktop API boundary
- No wildcard CORS
- No production database writes during tests (all tests execute against isolated mocks and local fixtures)
- Runtime evidence: none unless actually observed
- Production mutation: none

## Limitations

- Final merge to main still awaits independent post-reconciliation review.
- Main is not merged by this step.
- Desktop repository is not merged by this step.
- Stage 03 is not started.
