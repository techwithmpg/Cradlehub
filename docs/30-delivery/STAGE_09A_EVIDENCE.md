# STAGE 09A — HOSTED TODAY DESKTOP CONTRACT EVIDENCE (SECOND CORRECTION)

## Target

Hosted Today Desktop Contract

## Stage

09A (Second Correction Pass)

## Branch

`stage/09a-hosted-today-contract`

## Base SHA

`045e9193ae9cac427c13ddf97b053dee34f6ea62`

## HEAD_SHA

`b07252c0228bb0ec730f944087d1eee1fad5aef8`

## Commit History

- **Original Implementation**: `992dba0bee88f102c4ceebe25e0b9a75dbf31579`
- **First Correction**: `2036da9aa3dfbc21729a6f9efcdc5d9b91055cde`
- **Second Correction (Tested Implementation HEAD)**: `b07252c0228bb0ec730f944087d1eee1fad5aef8`

_(Following documentation-only commit does not alter tested implementation. Final remote HEAD is recorded in the delivery handoff)._

---

## Exact Changed Files

### Core Endpoints & Contract Types

- `src/app/api/desktop/v1/today/route.ts` — GET handler for Today workspace snapshot.
- `src/app/api/desktop/v1/today/mutations/route.ts` — POST handler for Today operational mutations.
- `src/lib/today/desktop-today-contract.ts` — Authoritative Desktop Today data loader, contract types (including `dispatchContextAvailable`), client-aware readiness projection, Home Service dispatch mapping, database-level dormant notification filtering, and payment scope guards.

### Shared Operations & Queries

- `src/lib/bookings/crm-booking-operations.ts` — Shared operations: `confirmCrmBooking`, `markCrmBookingArrived`, `startCrmBookingService`, `completeCrmBookingService`, `CONFIRMABLE_STATUSES`, `markBookingConfirmedSchema`, `revalidateServiceSurfaces`.
- `src/app/(dashboard)/crm/bookings/actions.ts` — Web actions refactored to delegate directly to shared operations.
- `src/lib/queries/bookings.ts` — `getTodaysSchedule` and `getCrmPendingBookingQueue` accept optional `client` parameter.
- `src/lib/actions/driver-actions.ts` — `getDriverNamesByIds` and `getBranchBookingDriverIds` accept optional `client` parameter.

### Focused Tests

- `src/app/api/desktop/v1/today/route.test.ts` — 27 unit tests verifying bearer auth, server-resolved branch, server-resolved business date, queue sorting, resource query error handling, readiness projection without cookie auth, dispatch failure degraded readiness, payment readiness exclusion, future Home Service missing dispatch item semantics, today Home Service missing dispatch item semantics, authoritative null driver semantics, notification database predicates (branch, workspace, requires_action, unread/read, dormant exclusion), critical unassigned count failure semantics, today stage-count boundary semantics, closed booking semantics, and Cache-Control.
- `src/app/api/desktop/v1/today/mutations/route.test.ts` — 14 unit tests verifying bearer auth, branch boundary, mutation actions, Home Service exclusions, idempotency, and payment mutation rejection.

---

## Exact GET Response Schema

`GET /api/desktop/v1/today` returns:

```json
{
  "ok": true,
  "data": {
    "context": {
      "branchId": "string (UUID)",
      "branchName": "string",
      "businessDate": "string (YYYY-MM-DD)",
      "role": "string"
    },
    "summary": {
      "total": 0,
      "pending": 0,
      "confirmed": 0,
      "inProgress": 0,
      "completed": 0,
      "cancelled": 0,
      "noShow": 0,
      "unassigned": 0,
      "waiting": 0,
      "inService": 0,
      "readyToPay": 0,
      "completedService": 0,
      "homeService": 0
    },
    "queue": [
      {
        "id": "string (UUID)",
        "bookingDate": "string (YYYY-MM-DD)",
        "startTime": "string (HH:MM:SS)",
        "endTime": "string (HH:MM:SS)",
        "status": "string",
        "bookingProgressStatus": "string",
        "type": "string",
        "deliveryType": "string | null",
        "customerName": "string | null",
        "customerPhone": "string | null",
        "serviceName": "string | null",
        "serviceDuration": "number | null",
        "staffId": "string | null",
        "staffName": "string | null",
        "resourceId": "string | null",
        "resourceName": "string | null",
        "paymentStatus": "string | null",
        "checkedInAt": "string (ISO) | null",
        "sessionStartedAt": "string (ISO) | null",
        "sessionDueAt": "string (ISO) | null",
        "sessionCompletedAt": "string (ISO) | null",
        "createdAt": "string (ISO) | null",
        "stage": "waiting | in_service | ready_to_pay | completed | null",
        "isHomeService": true,
        "dispatchContextAvailable": "boolean | null",
        "driverId": "string | null",
        "driverName": "string | null",
        "noDriverWarning": false,
        "dispatchWarning": "string | null",
        "needsLocationReview": false,
        "homeServiceAddress": "string | null"
      }
    ],
    "readiness": {
      "available": true,
      "status": "ok | warning | critical",
      "issues": [
        {
          "id": "string",
          "scope": "daily | dispatch | system",
          "severity": "warning | critical",
          "title": "string",
          "problem": "string",
          "impact": "string",
          "fix": "string",
          "actionLabel": "string",
          "actionHref": "string",
          "count": 0
        }
      ],
      "error": "string | null"
    },
    "attendance": {
      "available": true,
      "selectedDate": "string (YYYY-MM-DD)",
      "timezone": "string",
      "lastHourCount": 0,
      "items": [
        {
          "eventId": "string",
          "staffId": "string | null",
          "staffName": "string",
          "staffNickname": "string | null",
          "eventType": "string",
          "outcome": "string",
          "reasonCode": "string | null",
          "message": "string | null",
          "occurredAt": "string (ISO)",
          "clockInAt": "string (ISO) | null",
          "clockOutAt": "string (ISO) | null",
          "sourceLabel": "string | null"
        }
      ],
      "error": "string | null"
    },
    "notifications": {
      "available": true,
      "items": [
        {
          "id": "string",
          "title": "string",
          "body": "string | null",
          "type": "string",
          "priority": "string",
          "createdAt": "string (ISO)",
          "requiresAction": true
        }
      ],
      "error": "string | null"
    }
  }
}
```

---

## Authoritative Business Logic & Second-Correction Truth Semantics

### 1. Resource Lookup Error Handling

The `branch_resources` query now inspects `resourceError`. If an error occurs, it is thrown, causing `GET /today` to fail truthfully with a 500 error instead of silently returning fake `resourceName: null`.

### 2. Truthful Readiness Partial Failure

- When `getDispatchData` succeeds, `readiness.available = true`.
- When `getDispatchData` fails, `readiness.available = false` is strictly enforced, an explicit `system:dispatch-readiness-unavailable` issue is added, and `readiness.error` reports that dispatch readiness could not be refreshed.
- Readiness does not depend on cookie-session authentication. It operates purely using the bearer client context and authoritative data sources.
- Strict payment readiness exclusion: `filterDesktopReadinessIssues` strips any issue with `scope === "payment"`, ID prefix `payment:`, or payment/reconciliation URLs (including `payment:unpaid-bookings`).

### 3. Home Service Dispatch Context Availability & Semantics

The new `dispatchContextAvailable` field in `DesktopTodayQueueItem` has the following authoritative semantics:

- `null`: The booking is not a Home Service booking (`isHomeService === false`).
- `true`: The booking is a Home Service booking and an authoritative matching dispatch item was loaded for this booking.
- `false`: The booking is a Home Service booking, but authoritative dispatch context was not available for that booking (e.g. future pending booking for tomorrow, booking unindexed for the date, or dispatch query failed).

**Driver Warning Rule**:

- `noDriverWarning` is set to `true` **ONLY** when `dispatchContextAvailable === true` AND authoritative `dItem.driverId === null`.
- When `dispatchContextAvailable === false`, `noDriverWarning = false`, `driverId = null`, `driverName = null`, `needsLocationReview = false`, and `dispatchWarning` reports a truthful unavailable message (e.g. `"Dispatch context not loaded for future date"` or `"Dispatch context unavailable"`).
- It NEVER fabricates a "No Driver Assigned" warning for unindexed or future bookings.

### 4. Database-Level Dormant Notification Filtering

The notification query in `src/lib/today/desktop-today-contract.ts` applies strict dormant-scope exclusion in the database query **before** ordering and limiting:

- `.eq("branch_id", branchId)`
- `.eq("target_workspace", "crm")`
- `.eq("requires_action", true)`
- `.in("status", ["unread", "read"])`
- `.not("type", "in", "(payment_pending,payment_overdue,reconciliation_submitted,marketing_content_updated)")`
- `.order("created_at", { ascending: false })`
- `.limit(20)`

This guarantees that dormant payment, reconciliation, and marketing notifications never consume the result limit.

### 5. Today Operational Stage Count Semantics

Summary stage counts (`waiting`, `inService`, `readyToPay`, `completedService`, `homeService`) are calculated **strictly for today's operations** (`item.bookingDate === businessDate`). Future pending bookings remain present in the `queue` for operator situational awareness, but do not inflate Today's operational stage metrics.

### 6. Closed Booking Semantics

Today's schedule includes closed bookings (such as `status = 'cancelled'` or `status = 'no_show'`). In accordance with `getCradleFlowStage(b)`, closed bookings map to `stage: null`. They are preserved in the queue with their true status and `stage: null`.

### 7. Attendance Auth Boundary

- The Desktop Today endpoint is authenticated via Desktop bearer token (`verifyDesktopBearerAuth`).
- The branch ID is extracted from authenticated Desktop staff credentials and passed to the server-side attendance helper (`getRecentAttendanceScanFeed`).
- Privileged server-side credentials remain internal to the server; no privileged secrets or service-role keys are exposed to the client or renderer.

### 8. Authoritative Mutations & RPCs

Mutations in `src/app/api/desktop/v1/today/mutations/route.ts` strictly delegate to verified shared business operations:

- `confirm_booking`: Validates status in `CONFIRMABLE_STATUSES`, sets `status = 'confirmed'`, records audit log.
- `mark_arrived`: Validates `type !== 'home_service'`, rejects closed bookings, sets `checked_in_at`, creates notification.
- `start_service`: Validates `type !== 'home_service'`, calls stored procedure `start_booking_service_session` RPC.
- `complete_service`: Sets `session_completed_at`, marks status as completed if appropriate, calls `update_branch_daily_summary` RPC, records audit log.

---

## Verification & Checks Results

1. **Vitest Unit Tests**:
   - Command: `pnpm test run src/app/api/desktop/v1/today`
   - Result: **41 passed** (27 in `route.test.ts`, 14 in `mutations/route.test.ts`).
2. **Full Desktop & Auth Regression Test Suite**:
   - Command: `pnpm test run src/app/api/desktop tests/api/desktop-v1-home-service-operations.test.ts tests/api/desktop-v1-home-service-reads.test.ts tests/api/desktop-v1-bookings.test.ts tests/api/desktop-v1-customers.test.ts tests/api/desktop-v1-schedule.test.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/lib/bookings/inhouse-booking-engine-auth.test.ts`
   - Result: **299 passed across 14 test files** (0 failures).
3. **TypeScript Compilation**:
   - Command: `pnpm run type-check` (`tsc --noEmit`)
   - Result: **0 errors**.
4. **ESLint**:
   - Command: `pnpm run lint "src/lib/today/desktop-today-contract.ts" "src/app/api/desktop/v1/today/route.test.ts"`
   - Result: **0 errors, 0 warnings**.
5. **Prettier Formatting**:
   - Command: `pnpm exec prettier --check "src/lib/today/desktop-today-contract.ts" "src/app/api/desktop/v1/today/route.test.ts" "docs/30-delivery/STAGE_09A_EVIDENCE.md"`
   - Result: **All matched files use Prettier code style**.
6. **Next.js Production Build**:
   - Command: `pnpm run build` (`next build`)
   - Result: **Compiled successfully in 34s**, static generation completed (128/128), dynamic routes `/api/desktop/v1/today` and `/api/desktop/v1/today/mutations` compiled dynamically with exit code 0.
7. **Git Diff Check**:
   - Command: `git diff --check`
   - Result: **0 errors**.

---

## Security & Data Impact

- **Bearer Auth Enforced**: All Desktop Today endpoints require valid Bearer token auth; zero cookie reliance.
- **Branch Boundary**: Authenticated branch is strictly resolved server-side.
- **Zero Schema Alterations**: Zero migrations, zero DDL, zero schema mutations.
- **Dormant Payment Scope**: Zero financial amounts or payment actions exposed.
