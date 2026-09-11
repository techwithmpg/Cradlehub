# STAGE 09A — HOSTED TODAY DESKTOP CONTRACT EVIDENCE (CORRECTED)

## Target

Hosted Today Desktop Contract

## Stage

09A (Correction Pass)

## Branch

`stage/09a-hosted-today-contract`

## Base SHA

`045e9193ae9cac427c13ddf97b053dee34f6ea62`

## Original Implementation Commit

`992dba0bee88f102c4ceebe25e0b9a75dbf31579`

## Previous Remote HEAD

`5d3ec123cc3547eff592fadf90c89fc318d947f6`

## Corrected Tested Implementation HEAD

`2036da9aa3dfbc21729a6f9efcdc5d9b91055cde`

## Final Remote HEAD

_(Assigned upon documentation commit and push)_

### HEAD Convention Explanation

`2036da9aa3dfbc21729a6f9efcdc5d9b91055cde` is the functional implementation commit verified by all test suites, TypeScript typecheck, ESLint, Prettier, and Next.js production build. The subsequent commit updates this delivery documentation in `docs/30-delivery/STAGE_09A_EVIDENCE.md`.

---

## Exact Changed Files

### Core Endpoints & Types

- `src/app/api/desktop/v1/today/route.ts` — GET handler for Today workspace snapshot.
- `src/app/api/desktop/v1/today/mutations/route.ts` — POST handler for Today operational mutations.
- `src/lib/today/desktop-today-contract.ts` — Authoritative Desktop Today data loader, contract types, client-aware readiness projection, Home Service dispatch mapping, and payment scope guards.

### Shared Operations & Queries

- `src/lib/bookings/crm-booking-operations.ts` — Shared operations: `confirmCrmBooking`, `markCrmBookingArrived`, `startCrmBookingService`, `completeCrmBookingService`, `CONFIRMABLE_STATUSES`, `markBookingConfirmedSchema`, `revalidateServiceSurfaces`.
- `src/app/(dashboard)/crm/bookings/actions.ts` — Web actions refactored to delegate directly to shared operations.
- `src/lib/queries/bookings.ts` — `getTodaysSchedule` and `getCrmPendingBookingQueue` accept optional `client` parameter.
- `src/lib/actions/driver-actions.ts` — `getDriverNamesByIds` and `getBranchBookingDriverIds` accept optional `client` parameter.

### Focused Tests

- `src/app/api/desktop/v1/today/route.test.ts` — 23 tests verifying bearer auth, server-resolved branch, server-resolved business date, queue sorting, readiness projection without cookie auth, payment scope exclusion, notification scoping, critical vs optional failure semantics, authoritative Home Service context, and Cache-Control.
- `src/app/api/desktop/v1/today/mutations/route.test.ts` — 14 tests verifying bearer auth, branch boundary, mutation actions, Home Service exclusions, idempotency, and payment mutation rejection.

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

## Authoritative Business Logic & Semantics

### Business-Date Authority

Today business date is server-resolved through `getBranchBusinessDate()`, using the canonical `BRANCH_TIMEZONE` currently set to `Asia/Manila`.

- The renderer's Windows clock is NOT used.
- No client-supplied date query parameter is accepted.
- No arbitrary date parameter is supported.

### Auth Model & Branch Authority

- Authenticated via `verifyDesktopBearerAuth(request)`.
- The authenticated operator's `branch_id` is extracted server-side from active staff credentials.
- The renderer cannot supply, override, or spoof `branchId` or `branch_id`.
- Branch existence is verified against the database.

### Role Permissions

Authoritative check: `canAccessCrmWorkspace(role)`.
The canonical CRM roles supported by source (`CRM_WORKSPACE_ROLES` in `src/lib/auth/crm-permissions.ts`) are:

- `owner`
- `manager`
- `assistant_manager`
- `store_manager`
- Front-desk aliases canonicalized to `crm`: `crm`, `csr`, `csr_head`, `csr_staff`

Non-CRM roles (`staff`, `driver`, `utility`, `service_head`, `service_staff`, `digital_marketer`) are rejected with 403 Forbidden.

### Readiness Auth Correction & Payment Exclusion

1. **No Cookie-Session Auth**: Desktop Today readiness projection does not import or invoke `getCrmReadinessCached()` or any function depending on `createClient()` from `src/lib/supabase/server.ts`. It operates purely within the bearer-authenticated `ctx.supabase` context.
2. **Strict Payment Scope Exclusion**:
   - Filtered via `filterDesktopReadinessIssues`: rejects any issue where `issue.scope === "payment"`, `issue.id.startsWith("payment:")`, or `actionHref` points to payment/reconciliation URLs.
   - Specifically guarantees that `payment:unpaid-bookings` and payment-review warnings never reach Desktop Today.
3. **Operational Issues Projected**:
   - `daily:unassigned-bookings`: Emitted when confirmed bookings today have no assigned staff.
   - `dispatch:awaiting-driver`: Emitted when active home-service bookings have no assigned driver.
   - `dispatch:needs-location-review`: Emitted when home-service bookings require address or location coordinate verification.

### Notification Scoping & Authority

The database query itself enforces scoping BEFORE ordering and limit:

- `.eq("branch_id", branchId)`
- `.eq("target_workspace", "crm")`
- `.eq("requires_action", true)`
- `.in("status", ["unread", "read"])`
- `.order("created_at", { ascending: false })`
- `.limit(20)`

Non-CRM workspaces (`driver`, `staff`, `owner`, `utility`) and other branches are excluded in the database query. Query errors degrade truthfully to `{ available: false, items: [], error: "Notifications could not be refreshed." }` rather than falsely masquerading as "zero notifications".

### Critical vs. Optional Dependency Failure Semantics

- **Critical Dependencies**:
  - `getTodaysSchedule`, `getCrmPendingBookingQueue`, `getManagerDashboardStats`, and the `unassigned` count query are critical to operational truth.
  - If any of these queries fail (including `unassignedRes.error`), `GET /api/desktop/v1/today` throws and fails truthfully with 500 SERVER_ERROR.
  - It does NOT convert database errors into fake zeros (`unassigned = 0`) or empty queue (`queue: []`).
- **Optional / Degradable Sections**:
  - `readiness`: if computation fails, returns `available: false`, `status: "warning"`, and a fallback error issue.
  - `attendance`: if feed query fails, returns `available: false` and preserves the error message.
  - `notifications`: if query fails, returns `available: false` and `items: []`.
  - Home Service auxiliary dispatch: if `getDispatchData` fails, home-service queue items retain `isHomeService: true`, set `noDriverWarning: false` (does NOT fabricate false "no driver" alerts), and report `dispatchWarning: "Dispatch context unavailable"`.

### Home Service Integration

- Authoritative Home Service context is sourced from `getDispatchData({ branchId, date, supabase: ctx.supabase, throwOnError: true })`.
- Exposes: `isHomeService`, `driverId`, `driverName`, `noDriverWarning`, `dispatchWarning`, `needsLocationReview`, `homeServiceAddress`.
- Excludes: Continuous live GPS tracking, route coordinates, fake ETA, and raw metadata blobs.

### Queue Membership Rule

- Combines `getTodaysSchedule(branchId, businessDate)` and `getCrmPendingBookingQueue(branchId, businessDate)`.
- Excludes cancelled bookings (`status = 'cancelled'`).
- Deduplicates by `bookingId` (today's schedule takes precedence).
- Sorted by `bookingDate ASC, startTime ASC`.

---

## Operational Mutations

- **Endpoint**: `POST /api/desktop/v1/today/mutations`
- **Authorized Actions**:
  1. `confirm_booking` — Validates confirmable status, transitions to `confirmed`, creates audit log.
  2. `mark_arrived` — Validates `type !== 'home_service'`, sets arrival timestamp, creates check-in notification.
  3. `start_service` — Validates `type !== 'home_service'`, sets `session_started_at` idempotently, transitions `pending` -> `confirmed`.
  4. `complete_service` — Sets `session_completed_at`, updates status to `completed` (if not already paid/completed), calls `update_branch_daily_summary` RPC, records audit log.
- **Shared Implementation**: Reuses extracted server operations from `src/lib/bookings/crm-booking-operations.ts` with zero duplicate business logic.
- **Excluded Mutations**: Payment collection/updating/confirmation, rescheduling, cancellation, therapist assignment, and dispatch mutations.

---

## Payment Scope Guard Verification

- **Excluded Fields**: `total_collected`, `total_expected`, `total_unpaid`, `by_method`, `amount_paid`, `price_paid`, `payment_reference`.
- **Excluded Actions**: `collect_payment`, `confirm_payment`, `update_payment`.
- **Runtime Guard**: `assertNoPaymentScopeLeak` recursively scans outgoing response JSON.
- **Readiness Filter**: `filterDesktopReadinessIssues` strips all payment-scoped issues.

---

## Verification & Checks Results

1. **Vitest Unit Tests**:
   - Command: `pnpm test run src/app/api/desktop/v1/today`
   - Result: **37 passed** (23 in `route.test.ts`, 14 in `mutations/route.test.ts`).
2. **Full Desktop & Auth Regression Test Suite**:
   - Command: `pnpm test run src/app/api/desktop tests/api/desktop-v1-home-service-operations.test.ts tests/api/desktop-v1-home-service-reads.test.ts tests/api/desktop-v1-bookings.test.ts tests/api/desktop-v1-customers.test.ts tests/api/desktop-v1-schedule.test.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/lib/bookings/inhouse-booking-engine-auth.test.ts`
   - Result: **295 passed across 14 test files** (0 failures).
3. **TypeScript Compilation**:
   - Command: `pnpm run type-check` (`tsc --noEmit`)
   - Result: **0 errors**.
4. **ESLint**:
   - Command: `pnpm run lint "src/lib/today/desktop-today-contract.ts" "src/app/api/desktop/v1/today/route.test.ts"`
   - Result: **0 errors, 0 warnings**.
5. **Prettier Formatting**:
   - Command: `pnpm exec prettier --check "src/lib/today/desktop-today-contract.ts" "src/app/api/desktop/v1/today/route.test.ts"`
   - Result: **All matched files use Prettier code style**.
6. **Next.js Production Build**:
   - Command: `pnpm run build` (`next build`)
   - Result: **Compiled successfully in 44s**, static generation completed (128/128), routes `/api/desktop/v1/today` and `/api/desktop/v1/today/mutations` compiled dynamically with exit code 0.
7. **Git Diff Check**:
   - Command: `git diff --check`
   - Result: **0 errors**.

---

## Security & Data Impact

- **Bearer Authentication**: Required on all Today Desktop endpoints; no browser cookie reliance.
- **Branch Isolation**: Always server-resolved; renderer query parameters ignored.
- **RLS & Database Schema**: Zero database migrations, zero schema alterations, zero RLS policies disabled.
- **Secrets Protection**: No service role key or internal credentials exposed to the renderer.
- **Payment Boundary**: Strict exclusion of dormant finance and payment capabilities.

---

## Limitations & Rollback

- **Limitations**:
  - Realtime subscriptions remain on hosted web; Desktop Today contract provides snapshot queries with explicit refresh.
  - Payment settlement must be managed via the hosted web interface.
  - Home Service dispatch planning and driver assignment remain in the dedicated Home Service module.
- **Rollback**:
  - Reset branch to accepted base SHA `045e9193ae9cac427c13ddf97b053dee34f6ea62`.
