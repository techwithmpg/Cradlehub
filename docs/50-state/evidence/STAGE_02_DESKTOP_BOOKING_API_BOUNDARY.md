# Stage 02 Hosted Booking Write Boundary Evidence

## Target
Hosted CradleHub server boundary for Desktop Stage 02

## Hosted Branch
`stage/02-desktop-booking-api`

## HOSTED_BASE_SHA
`feda4600f37e93084fdb672bd0c2612e9872bb43`

## Desktop Dependency
`stage/02-bookings` @ `7afb30ccb0996915544dae4c41c9e653bc9f310e`

## Changed Files
- `src/lib/bookings/inhouse-booking-engine.ts` [NEW] — Authoritative server-only domain engine
- `src/lib/auth/desktop-bearer-auth.ts` [NEW] — Server-side Bearer token verification & staff resolution helper
- `src/app/api/desktop/v1/bookings/route.ts` [NEW] — Dedicated authenticated API route for Desktop booking creation
- `src/lib/actions/inhouse-booking.ts` [MODIFIED] — Thin server action wrapper preserving existing cookie-session CRM UI behavior
- `tests/api/desktop-v1-bookings.test.ts` [NEW] — Focused unit/integration test suite verifying auth rejection, branch enforcement, domain execution, and response shape
- `docs/50-state/evidence/STAGE_02_DESKTOP_BOOKING_API_BOUNDARY.md` [NEW] — This evidence record

## Canonical Source Inspected
- `src/app/(dashboard)/crm/bookings/new/page.tsx`
- `src/components/features/bookings/quick-booking-form.tsx`
- `src/lib/actions/inhouse-booking.ts`
- `src/lib/validations/booking.ts`
- `src/lib/queries/quick-booking-options.ts`
- `src/lib/services/service-catalog.ts`
- `src/lib/services/service-eligibility.ts`
- `src/lib/queries/branch-booking-rules.ts`
- `src/lib/engine/exact-crm-booking-time.ts`
- `src/lib/engine/resource-availability.ts`
- `src/lib/bookings/dispatch-conflict.ts`
- `src/lib/home-service/distance-service.ts`
- `src/lib/auth/crm-permissions.ts`
- `src/lib/auth/get-user-workspace-access.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/app/api/crm/bookings/route.ts`

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
- `pnpm format:check` — PASSED (all files formatted with Prettier)
- `pnpm type-check` — PASSED (tsc --noEmit with 0 errors)
- `pnpm lint` — PASSED (eslint with 0 errors)
- `pnpm vitest run tests/api/desktop-v1-bookings.test.ts` — PASSED (10/10 tests pass)
- `pnpm vitest run tests/lib/bookings/` — PASSED (13/13 test files pass, 77/77 tests)
- `pnpm build` — PASSED (Next.js 16 production build succeeded, generating static/dynamic routes including `/api/desktop/v1/bookings`)
- `git diff --check` — PASSED (clean diff, no whitespace errors)

## Security & Data Impact
- Zero database migrations, schema mutations, or RLS changes
- Service-role key remains strictly server-only (`import "server-only";`)
- No renderer/client secrets or credentials exposed
- No bearer token logging or credential leakage in responses
- No wildcard CORS
- No production database writes during tests (all tests execute against isolated mocks and local fixtures)

## Limitations
- Endpoint is implemented on the hosted server boundary and verified with unit/integration tests and production build; it is not yet connected to the Desktop client codebase in this pass.
- Desktop integration will occur only after independent review of this hosted server boundary.
