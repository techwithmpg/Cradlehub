# Stage 08A Evidence — Home Service Desktop Contract

## Target

Hosted canonical CradleHub repository

`https://github.com/techwithmpg/Cradlehub`

## Stage

Stage 08A — Home Service Desktop Contract

Includes the minimum general Desktop Bookings dependencies required by Home Service:

- booking detail
- booking reschedule
- booking cancellation

These remain Bookings-domain contracts and are not duplicated under Home Service.

## Branch

`stage/08a-desktop-home-service-contract`

## BASE_SHA

`dd2b2e087cbecb0c641a14c8f263d204493b64d7`

At implementation completion, local HEAD and fetched `origin/main` both matched this SHA before Stage 08A was committed.

## IMPLEMENTATION_HEAD_SHA

`f502ef9648e19f1a97bf88337d12b7b40d3474a1`

This is the Stage 08A implementation commit that was pushed and independently reviewed before this evidence-only correction.

The evidence-correction commit SHA is recorded in the final stage handoff after this document correction is committed.

## Changed files

### Modified

- `src/app/(dashboard)/crm/bookings/actions.ts`
- `src/lib/actions/driver-actions.ts`
- `src/lib/engine/booking-time.ts`
- `src/lib/engine/resource-availability.ts`
- `src/lib/home-service/distance-service.ts`
- `src/lib/queries/assignment-recommendations.ts`
- `src/lib/queries/bookings.ts`
- `src/lib/queries/dispatch-queries.ts`

### Added

- `src/app/api/desktop/v1/bookings/[bookingId]/cancel/route.ts`
- `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.ts`
- `src/app/api/desktop/v1/bookings/[bookingId]/route.ts`
- `src/app/api/desktop/v1/home-service/drivers/route.ts`
- `src/app/api/desktop/v1/home-service/mutations/route.test.ts`
- `src/app/api/desktop/v1/home-service/mutations/route.ts`
- `src/app/api/desktop/v1/home-service/recommendations/route.ts`
- `src/app/api/desktop/v1/home-service/route.test.ts`
- `src/app/api/desktop/v1/home-service/route.ts`
- `src/lib/bookings/crm-booking-operations.ts`
- `src/lib/bookings/desktop-booking-contract.ts`
- `src/lib/home-service/dispatch-operations.ts`
- `tests/api/desktop-v1-home-service-operations.test.ts`
- `tests/api/desktop-v1-home-service-reads.test.ts`
- `tests/helpers/stage08a-db.ts`
- `tests/lib/engine/resource-availability-strict.test.ts`
- `STAGE_08A_EVIDENCE.md`

## Contract surface

### Home Service

Repository implementation adds Desktop v1 contract surfaces for:

- Home Service workspace/read model
- Home Service driver/read model
- Home Service recommendation/read model
- Home Service authoritative mutations

Exact method/path behavior remains subject to independent GitHub review of the pushed branch.

Expected route locations:

- `/api/desktop/v1/home-service`
- `/api/desktop/v1/home-service/drivers`
- `/api/desktop/v1/home-service/recommendations`
- `/api/desktop/v1/home-service/mutations`

### Required Bookings dependencies

General Bookings contracts added for Home Service reuse:

- `/api/desktop/v1/bookings/[bookingId]`
- `/api/desktop/v1/bookings/[bookingId]/reschedule`
- `/api/desktop/v1/bookings/[bookingId]/cancel`

These operations remain owned by the Bookings domain.

Existing Desktop booking creation remains the creation authority. Stage 08A does not introduce a second Home Service booking creator.

## Authority mapping

### Authentication

Desktop routes are intended to use the existing Desktop bearer authentication boundary.

Authenticated user/staff context is server-resolved.

### Branch authority

Branch authority is intended to come from the authenticated active staff context.

Renderer-supplied branch identity is not an authorization source.

### Home Service read authority

The existing hosted dispatch/query domain remains the authoritative read source.

Stage 08A adds strict Desktop failure behavior so backend/query failure is not silently represented as a valid empty queue.

### Driver assignment authority

Existing hosted driver-assignment rules remain authoritative.

Shared server-only operations are used so Desktop API routes do not recreate privileged renderer-side mutation logic.

### Therapist assignment authority

Existing hosted therapist assignment and recommendation rules remain authoritative.

### Dispatch authority

Existing Home Service prepare/schedule/release behavior remains authoritative.

Desktop mutations are intended to delegate to shared server-side domain operations.

### Recommendation authority

The existing therapist and driver recommendation/scoring system remains authoritative.

Stage 08A does not introduce a parallel scoring engine.

### Booking detail authority

The Bookings domain remains authoritative for booking details used by the future Home Service inspector.

### Reschedule authority

Existing hosted Bookings reschedule rules remain authoritative and are exposed through the general Desktop Bookings domain.

### Cancellation authority

Existing hosted Bookings cancellation rules remain authoritative and are exposed through the general Desktop Bookings domain.

### Location authority

Existing staff/Home Service location sources remain authoritative.

Location provenance/timestamps are exposed so the future Desktop UI can distinguish current, stale, and unavailable information truthfully.

## Side effects

The implementation was designed to preserve existing server-side business effects rather than reproduce them inside Desktop routes, including where applicable:

- booking audit/events
- driver notifications
- therapist/assignment effects
- dispatch notifications
- cache invalidation
- route/page revalidation
- resource availability behavior
- booking metadata behavior

Exact preservation is subject to independent source-diff review after push.

## Capability classification against approved Home Service reference

### AUTHORITATIVE NOW / CONTRACTED

- Dispatch Queue
- booking/dispatch statuses
- booking details
- driver assignment
- therapist assignment
- assignment recommendations
- prepare dispatch
- schedule/release dispatch
- travel lifecycle timestamps
- latest authoritative driver-location provenance
- booking reschedule
- booking cancellation

### REUSED EXISTING CONTRACT

- New Home Service booking creation through Desktop Bookings
- general booking ownership and validation
- general booking reschedule
- general booking cancellation

### DERIVED SAFELY

- operational counts derived from authoritative Home Service booking/dispatch data
- location freshness presentation based on authoritative timestamps
- readiness state derived from authoritative assignment/GPS state where already supported

### DEFERRED / NOT CURRENTLY SUPPORTED AS BACKEND TRUTH

- route optimization unless a real optimizer exists
- fabricated driver ratings
- fabricated driver vehicle data
- fabricated revenue analytics
- finance/reconciliation reporting
- fake online/live state
- speculative Home Service settings
- new coverage-area schema
- new Home Service pricing architecture
- new Home Service notification-settings architecture

## Live-map semantics

The future Desktop UI must not call a stale location snapshot “Live” merely because a map is displayed.

Repository location timestamps/provenance should be used to communicate freshness truthfully.

No speculative polling, SQLite cache, or background sync was authorized in Stage 08A.

## ETA authority

A UI fallback/default estimate must not be represented as authoritative live ETA.

Only stored/authoritative ETA data may be presented as authoritative.

## Route optimization

The approved UI reference contains a Route Optimization concept.

Stage 08A does not treat a normal directions/route preview as a route optimizer.

If no optimization engine exists in the canonical hosted implementation, this capability remains deferred.

## Settings

Home Service settings architecture was not authorized for Stage 08A.

No new settings schema or migration is authorized.

Desktop Settings is also currently deferred by owner direction; configuration can continue through the hosted web application.

## Checks / results

Agent-reported implementation verification before repository-write limits interrupted final handoff:

- Test suite: **229 test files passed**
- Tests: **1,829 tests passed**
- TypeScript: **passed**
- Lint: **passed with 0 errors**
- Production build: **passed**
- `git diff --check`: **passed**

A later owner-run local read-only audit independently observed:

- branch: `stage/08a-desktop-home-service-contract`
- local HEAD before commit: `dd2b2e087cbecb0c641a14c8f263d204493b64d7`
- `origin/main`: `dd2b2e087cbecb0c641a14c8f263d204493b64d7`
- `git diff --check` exit code: `0`
- Stage 08A working tree remained intact

The full test/build results above are repository-work-session evidence and must not be represented as deployed-production verification.

## REPOSITORY-RECORDED PRODUCTION EVIDENCE

Repository source and test results establish implementation behavior in the repository only.

They do not establish deployed production behavior.

## OWNER-PROVIDED MANUAL RUNTIME EVIDENCE

None recorded for Stage 08A.

Stage 08A is a backend/API contract stage and has not received owner Desktop runtime visual confirmation.

## Security / data impact

Stage 08A is intended to preserve these boundaries:

- privileged mutations remain server-side
- Desktop uses bearer authentication
- active staff context is resolved server-side
- branch authority is resolved server-side
- renderer branch/role values are not trusted as authorization
- service-role keys and privileged credentials are not exposed to renderer
- database failures are not returned as fake empty Home Service state
- safe API errors are used
- Desktop contract responses use no-store semantics

Independent GitHub review is required before stage acceptance.

## Limitations

- No Desktop Home Service UI is implemented in Stage 08A.
- No route-optimization engine was authorized.
- No fabricated rating system was authorized.
- No fabricated vehicle data was authorized.
- No new revenue/Finance reporting was authorized.
- No new Home Service Settings architecture was authorized.
- No database schema or migration changes were authorized.
- No SQLite/local cache/background sync architecture was authorized.
- No Desktop cross-branch selector was introduced.
- Location freshness remains dependent on authoritative recorded timestamps and current hosted location producers.
- Repository implementation does not prove deployed production behavior.

## Rollback

Before merge, rollback is simply abandoning/deleting the unmerged Stage 08A branch.

After an explicitly authorized merge, rollback should revert the Stage 08A merge/commits through normal Git history rather than deleting uncertain source, migrations, or infrastructure manually.

## Stage gate

Stage 08A is not accepted merely because implementation and tests pass.

Current stage state:

1. Stage 08A implementation commit `f502ef9648e19f1a97bf88337d12b7b40d3474a1` has already been pushed on the authorized branch.
2. Independent GitHub review found this evidence-document correction was required.
3. This correction is evidence-only and does not modify Stage 08A implementation behavior.
4. After this correction is committed and pushed, ChatGPT must independently re-review the GitHub branch.
5. The review result must be either:
   - `CHANGES REQUIRED`
   - `ACCEPTABLE FOR OWNER CONFIRMATION`
6. Owner confirmation is still required before merge.
7. Merge only with explicit authorization.
8. STOP before Stage 08B unless separately authorized.
