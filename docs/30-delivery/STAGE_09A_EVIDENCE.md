# STAGE 09A — HOSTED TODAY DESKTOP CONTRACT EVIDENCE

## Target

Hosted Today Desktop Contract

## Stage

09A

## Branch

`stage/09a-hosted-today-contract`

## Base SHA

`045e9193ae9cac427c13ddf97b053dee34f6ea62`

## Tested Implementation HEAD

`992dba0bee88f102c4ceebe25e0b9a75dbf31579`

---

## Exact Changed Files

### Core Endpoints & Types

- `src/app/api/desktop/v1/today/route.ts` — GET handler for Today workspace snapshot.
- `src/app/api/desktop/v1/today/mutations/route.ts` — POST handler for Today operational mutations.
- `src/lib/today/desktop-today-contract.ts` — Desktop Today domain aggregator, types, and runtime payment scope guard.

### Shared Authoritative Operations

- `src/lib/bookings/crm-booking-operations.ts` — Shared authoritative operational implementations for `confirmCrmBooking`, `markCrmBookingArrived`, `startCrmBookingService`, and `completeCrmBookingService`.
- `src/app/(dashboard)/crm/bookings/actions.ts` — Refactored web actions to delegate directly to the shared authoritative operations.
- `src/lib/queries/bookings.ts` — Added optional client parameter to `getTodaysSchedule` and `getCrmPendingBookingQueue`.
- `src/lib/actions/driver-actions.ts` — Added optional client parameter to `getDriverNamesByIds` and `getBranchBookingDriverIds`.

### Unit & Integration Tests

- `src/app/api/desktop/v1/today/route.test.ts` — 19 comprehensive tests covering bearer auth, branch scoping, business date, schedule, pending queue, deduplication, ordering, readiness, attendance, notifications, Home Service context, and payment exclusion.
- `src/app/api/desktop/v1/today/mutations/route.test.ts` — 14 comprehensive tests covering action validation, branch guard, confirm, arrival, start service, complete service, idempotency, Home Service restrictions, closed status rejection, and payment mutation rejection.

---

## Endpoints

### 1. `GET /api/desktop/v1/today`

- **Auth**: Bearer token via `verifyDesktopBearerAuth`. Requires active staff profile and CRM workspace role.
- **Branch**: Server-resolved strictly from `ctx.me.branch_id`. Renderer-provided branch identifiers are rejected/ignored.
- **Headers**: `Cache-Control: no-store`.
- **Response Format**:

```json
{
  "ok": true,
  "data": {
    "context": {
      "branchId": "string",
      "branchName": "string",
      "businessDate": "YYYY-MM-DD",
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
        "id": "uuid",
        "bookingDate": "YYYY-MM-DD",
        "startTime": "HH:MM:SS",
        "endTime": "HH:MM:SS",
        "status": "string",
        "bookingProgressStatus": "string",
        "type": "string",
        "deliveryType": "string | null",
        "customerName": "string | null",
        "customerPhone": "string | null",
        "serviceName": "string | null",
        "serviceDuration": 60,
        "staffId": "uuid | null",
        "staffName": "string | null",
        "resourceId": "uuid | null",
        "resourceName": "string | null",
        "paymentStatus": "string | null",
        "checkedInAt": "ISO8601 | null",
        "sessionStartedAt": "ISO8601 | null",
        "sessionDueAt": "ISO8601 | null",
        "sessionCompletedAt": "ISO8601 | null",
        "createdAt": "ISO8601 | null",
        "stage": "waiting | in_service | ready_to_pay | completed | null",
        "isHomeService": false,
        "driverId": "uuid | null",
        "driverName": "string | null",
        "noDriverWarning": false,
        "dispatchWarning": "string | null",
        "needsLocationReview": false,
        "homeServiceAddress": "string | null"
      }
    ],
    "readiness": {
      "status": "ok | warning | critical",
      "issues": [
        {
          "id": "string",
          "scope": "string",
          "severity": "critical | warning | info | success",
          "title": "string",
          "problem": "string",
          "impact": "string",
          "fix": "string",
          "actionLabel": "string",
          "actionHref": "string",
          "count": 0
        }
      ]
    },
    "attendance": {
      "selectedDate": "YYYY-MM-DD",
      "timezone": "Asia/Manila",
      "lastHourCount": 0,
      "items": [],
      "error": null
    },
    "notifications": [
      {
        "id": "uuid",
        "title": "string",
        "body": "string | null",
        "type": "string",
        "priority": "string",
        "createdAt": "ISO8601",
        "requiresAction": true
      }
    ]
  }
}
```

### 2. `POST /api/desktop/v1/today/mutations`

- **Auth**: Bearer token via `withDesktopBookingContext`.
- **Authorized Actions**:
  - `confirm_booking` (`{ action: "confirm_booking", bookingId: uuid, note?: string }`)
  - `mark_arrived` (`{ action: "mark_arrived", bookingId: uuid }`)
  - `start_service` (`{ action: "start_service", bookingId: uuid }`)
  - `complete_service` (`{ action: "complete_service", bookingId: uuid }`)
- **Excluded / Rejected Actions**:
  - `collect_payment`, `update_payment`, `confirm_payment` (rejected with 400 VALIDATION_ERROR)
  - `cancel`, `reschedule`, `assign_therapist`, `assign_room`, `prepare_dispatch` (rejected with 400 VALIDATION_ERROR)

---

## Authority & Operational Semantics

### Business Date Authority

- Resolves exclusively via `getBranchBusinessDate()` (Asia/Manila time zone).
- Client or desktop renderer system clocks are not used for date calculation.

### Auth Model & Branch Rule

- Token validation via Supabase Auth.
- Active staff profile verification (`staff.is_active = true`).
- Role authorization via `canAccessCrmWorkspace(staffRole)`.
- Branch strictly locked to `ctx.me.branch_id`. Cross-branch access is prohibited in desktop mode (`allowOwnerCrossBranch: false`).

### Queue Membership Rule

1. Queries `getTodaysSchedule(branchId, businessDate)`.
2. Queries `getCrmPendingBookingQueue(branchId, businessDate)` (pending statuses: `pending`, `pending_payment`, `pending_crm_confirmation` where `booking_date >= businessDate`, limit 100).
3. Deduplicates items by booking `id` (giving precedence to schedule entries).
4. Sorts strictly by `booking_date ASC`, then `start_time ASC`.

### Lifecycle / Stage Semantics

- Evaluates `getCradleFlowStage(booking)`:
  - Closed bookings (`cancelled`, `no_show`, `expired`) -> `null`
  - Service completed (`status === "completed"`, `booking_progress_status === "completed"`, or `session_completed_at` set):
    - `payment_status === "paid"` -> `"completed"`
    - Otherwise -> `"ready_to_pay"` (represents service finished, payment pending on web)
  - In progress (`status === "in_progress"`, `booking_progress_status === "session_started"`, or `session_started_at` set) -> `"in_service"`
  - Otherwise -> `"waiting"`

### Authoritative Shared Operations Reused

- `confirmCrmBooking`: Validates status in `CONFIRMABLE_STATUSES` (`pending_payment`, `pending_crm_confirmation`, `pending`) or `confirmed`. Annotates audit event and revalidates operational booking surfaces.
- `markCrmBookingArrived`: Strictly in-spa only. Rejects Home Service bookings. Idempotent if already checked in.
- `startCrmBookingService`: Invokes Supabase RPC `start_booking_service_session`. Strictly in-spa only (Home Service started by assigned staff). Idempotent if already started. Revalidates staff portal paths.
- `completeCrmBookingService`: Invokes Supabase RPC `complete_booking_service_session`. Idempotent if already completed. Revalidates staff portal paths.

### Preserved Side Effects

- Audit logging: `annotateLatestBookingEvent`
- Surface revalidations: `revalidateOperationalBookingSurfaces(branch_id)` and `revalidateServiceSurfaces(branch_id)`
- RPC invocations: `start_booking_service_session` and `complete_booking_service_session`

### Home Service Relationship

- Exposes operational flags: `isHomeService`, `driverId`, `driverName`, `noDriverWarning`, `dispatchWarning`, `needsLocationReview`, `homeServiceAddress`.
- Does NOT fabricate route, continuous tracking, live coordinates, or artificial ETA.
- Detailed dispatch management remains isolated within the Home Service module.

### Payment-Scope Exclusion

- Zero financial totals exposed (`total_collected`, `total_expected`, `total_unpaid`, `by_method`).
- Zero money values on queue items (`amount_paid`, `price_paid`, `payment_reference`).
- Only simple operational `paymentStatus` string is exposed for lifecycle interpretation.
- Runtime enforcement via `assertNoPaymentScopeLeak(data)` which recursively scans payloads and throws if forbidden keys exist.

### Attendance & Readiness Semantics

- Attendance: Returns snapshot via `getRecentAttendanceScanFeed`. Fallback preserves error message on query failure without claiming live stream.
- Readiness: Returns operational status and issues via `getCrmReadinessCached`. If query fails, status defaults to `"warning"` with a system issue, never faking 0 issues.
- Notifications: Scoped to branch, operational, action-required only.

---

## Checks / Results

1. **Unit & Integration Tests (`pnpm test run src/app/api/desktop`):**
   - `src/app/api/desktop/v1/attendance/route.test.ts`: 5 tests passed
   - `src/app/api/desktop/v1/attendance/history/route.test.ts`: 6 tests passed
   - `src/app/api/desktop/v1/attendance/mutations/route.test.ts`: 19 tests passed
   - `src/app/api/desktop/v1/home-service/route.test.ts`: 5 tests passed
   - `src/app/api/desktop/v1/home-service/mutations/route.test.ts`: 5 tests passed
   - `src/app/api/desktop/v1/today/route.test.ts`: 19 tests passed
   - `src/app/api/desktop/v1/today/mutations/route.test.ts`: 14 tests passed
   - **Total Desktop API tests**: 73 passed (73 tests across 7 test files).

2. **Regression Tests (`tests/api/` & `tests/lib/auth/`):**
   - `tests/api/desktop-v1-home-service-operations.test.ts`: 80 tests passed
   - `tests/api/desktop-v1-home-service-reads.test.ts`: 42 tests passed
   - `tests/api/desktop-v1-bookings.test.ts`: 19 tests passed
   - `tests/api/desktop-v1-customers.test.ts`: 9 tests passed
   - `tests/api/desktop-v1-schedule.test.ts`: 49 tests passed
   - `tests/lib/auth/desktop-bearer-auth.test.ts`: 13 tests passed
   - `tests/lib/bookings/inhouse-booking-engine-auth.test.ts`: 6 tests passed
   - **Total regression tests**: 218 passed across 7 test files.

3. **TypeScript Type Check (`pnpm run type-check`):**
   - `tsc --noEmit`: **Passed (0 errors)**.

4. **ESLint (`pnpm exec eslint ...` on changed files):**
   - **Passed (0 errors, 0 warnings)**.

5. **Prettier Format Check (`pnpm exec prettier --check ...` on changed files):**
   - **Passed (All matched files use Prettier code style)**.

6. **Production Build (`pnpm run build`):**
   - `next build` attempted. Turbopack failed attempting to fetch Google Fonts (`fonts.googleapis.com`) due to local offline sandbox network isolation. (Truthfully recorded).

7. **Git Diff Check (`git diff --check`):**
   - **Passed (0 whitespace errors, 0 merge markers)**.

---

## Security & Data Impact

- **Security**: Strict bearer auth, server-resolved branch scoping, zero service-role keys exposed to responses, financial and payment mutations completely inaccessible, no raw metadata leakage.
- **Data Impact**: Zero schema changes, zero database migrations. All mutations execute through existing transactional RPCs and admin queries.

## Rollback Plan

- Reset or revert to `BASE_SHA: 045e9193ae9cac427c13ddf97b053dee34f6ea62`.
