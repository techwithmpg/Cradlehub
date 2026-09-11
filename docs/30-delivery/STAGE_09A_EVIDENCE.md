# STAGE 09A — HOSTED TODAY DESKTOP CONTRACT EVIDENCE (EVIDENCE CORRECTION)

## Evidence Status

**REPOSITORY-RECORDED PRODUCTION EVIDENCE**

This document proves repository implementation, authoritative contract structures, and recorded verification checks on branch `stage/09a-hosted-today-contract`. It reflects the verified code in the repository and does not claim deployed production runtime behavior. The repository implementation applies the described invariants.

## Target

Hosted Today Desktop Contract

## Stage

09A (Evidence-Only Correction Pass)

## Branch

`stage/09a-hosted-today-contract`

## Base SHA

`045e9193ae9cac427c13ddf97b053dee34f6ea62`

## Tested Implementation HEAD

`53e6b4d732cdb07c6caf3a1d1ba3d685395015ae`

## Commit History

- **Original Implementation**: `992dba0bee88f102c4ceebe25e0b9a75dbf31579`
- **First Correction**: `2036da9aa3dfbc21729a6f9efcdc5d9b91055cde`
- **Second Correction**: `b07252c0228bb0ec730f944087d1eee1fad5aef8`
- **Final Tested Implementation / Test HEAD**: `53e6b4d732cdb07c6caf3a1d1ba3d685395015ae`

_(Following documentation-only commits do not alter tested implementation. Final remote HEAD is recorded in the delivery handoff)._

---

## Exact Changed Files

### Core Endpoints & Contract Types

- `src/app/api/desktop/v1/today/route.ts` — GET handler for Today workspace snapshot.
- `src/app/api/desktop/v1/today/mutations/route.ts` — POST handler for Today operational mutations.
- `src/lib/today/desktop-today-contract.ts` — Authoritative Desktop Today data loader, contract types (including `dispatchContextAvailable`), client-aware readiness projection, Home Service dispatch mapping, database-level dormant notification filtering before LIMIT, and payment scope guards.

### Shared Operations & Queries

- `src/lib/bookings/crm-booking-operations.ts` — Shared operations: `confirmCrmBooking`, `markCrmBookingArrived`, `startCrmBookingService`, `completeCrmBookingService`, `CONFIRMABLE_STATUSES`, `markBookingConfirmedSchema`, `revalidateServiceSurfaces`.
- `src/app/(dashboard)/crm/bookings/actions.ts` — Web actions refactored to delegate directly to shared operations.
- `src/lib/queries/bookings.ts` — `getTodaysSchedule` and `getCrmPendingBookingQueue` accept optional `client` parameter.
- `src/lib/actions/driver-actions.ts` — `getDriverNamesByIds` and `getBranchBookingDriverIds` accept optional `client` parameter.

### Focused Tests

- `src/app/api/desktop/v1/today/route.test.ts` — 28 unit tests verifying bearer auth, server-resolved branch, server-resolved business date, queue sorting, resource query error handling, readiness projection without cookie auth, dispatch failure degraded readiness, payment readiness exclusion, future Home Service missing dispatch item semantics, today Home Service missing dispatch item semantics, authoritative null driver semantics, notification database query predicates (branch, workspace, requires_action, unread/read, dormant type exclusion before limit), notification response isolation from mixed datasets, critical unassigned count failure semantics, today stage-count boundary semantics, closed booking semantics, and Cache-Control.
- `src/app/api/desktop/v1/today/mutations/route.test.ts` — 14 unit tests verifying bearer auth, branch boundary, mutation actions, Home Service exclusions, idempotency, and payment mutation rejection.

---

## Exact GET Response Schema

`GET /api/desktop/v1/today` returns the exact TypeScript contract below:

```ts
export type DesktopTodayContext = {
  branchId: string;
  branchName: string;
  businessDate: string;
  role: string;
};

export type DesktopTodaySummary = {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
  unassigned: number;
  waiting: number;
  inService: number;
  readyToPay: number;
  completedService: number;
  homeService: number;
};

export type DesktopTodayQueueItem = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingProgressStatus: string;
  type: string;
  deliveryType: string | null;
  customerName: string | null;
  customerPhone: string | null;
  serviceName: string | null;
  serviceDuration: number | null;
  staffId: string | null;
  staffName: string | null;
  resourceId: string | null;
  resourceName: string | null;
  paymentStatus: string | null;
  checkedInAt: string | null;
  sessionStartedAt: string | null;
  sessionDueAt: string | null;
  sessionCompletedAt: string | null;
  createdAt: string | null;
  stage: "waiting" | "in_service" | "ready_to_pay" | "completed" | null;
  isHomeService: boolean;
  dispatchContextAvailable: boolean | null;
  driverId: string | null;
  driverName: string | null;
  noDriverWarning: boolean;
  dispatchWarning: string | null;
  needsLocationReview: boolean;
  homeServiceAddress: string | null;
};

export type DesktopTodayReadinessIssue = {
  id: string;
  scope: string;
  severity: string;
  title: string;
  problem: string;
  impact: string;
  fix: string;
  actionLabel: string;
  actionHref: string;
  count?: number;
};

export type DesktopTodayReadiness = {
  available: boolean;
  status: "ok" | "warning" | "critical";
  issues: DesktopTodayReadinessIssue[];
  error: string | null;
};

export type DesktopTodayAttendanceItem = {
  eventId: string;
  staffId: string | null;
  staffName: string;
  staffNickname: string | null;
  eventType: string;
  outcome: string;
  reasonCode: string | null;
  message: string | null;
  occurredAt: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  sourceLabel: string | null;
};

export type DesktopTodayAttendance = {
  available: boolean;
  selectedDate: string;
  timezone: string;
  lastHourCount: number;
  items: DesktopTodayAttendanceItem[];
  error: string | null;
};

export type DesktopTodayNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  priority: string;
  createdAt: string;
  requiresAction: boolean;
};

export type DesktopTodayNotifications = {
  available: boolean;
  items: DesktopTodayNotification[];
  error: string | null;
};

export type DesktopTodayData = {
  context: DesktopTodayContext;
  summary: DesktopTodaySummary;
  queue: DesktopTodayQueueItem[];
  readiness: DesktopTodayReadiness;
  attendance: DesktopTodayAttendance;
  notifications: DesktopTodayNotifications;
};
```

### Successful HTTP Envelope

The GET route returns the source data through:

```ts
desktopJson({
  ok: true,
  data,
});
```

producing the standard success wire response:

```json
{
  "ok": true,
  "data": { ...DesktopTodayData }
}
```

---

## Authoritative Business Logic & Contract Truth Semantics

### 1. Resource Lookup Error Handling

The `branch_resources` query now inspects `resourceError`. If an error occurs, it is thrown, causing `GET /today` to fail truthfully with a 500 error instead of silently returning fake `resourceName: null`.

### 2. Truthful Readiness Partial Failure

- When `getDispatchData` succeeds, `readiness.available = true`.
- When `getDispatchData` fails, `readiness.available = false` is strictly enforced, an explicit `system:dispatch-readiness-unavailable` issue is added, and `readiness.error` reports that dispatch readiness could not be refreshed.
- Readiness operates purely using the bearer client context and authoritative data sources without cookie-session dependencies.
- Strict payment readiness exclusion: `filterDesktopReadinessIssues` strips any issue with `scope === "payment"`, ID prefix `payment:`, or payment/reconciliation URLs (including `payment:unpaid-bookings`).

### 3. Home Service Dispatch Context Availability & Semantics

The `dispatchContextAvailable` field in `DesktopTodayQueueItem` has the following authoritative semantics:

- `null`: The booking is not a Home Service booking (`isHomeService === false`).
- `true`: The booking is a Home Service booking and an authoritative matching dispatch item was loaded for this booking.
- `false`: The booking is a Home Service booking, but authoritative dispatch context was not available for that booking (e.g. future pending booking for tomorrow, booking unindexed for the date, or dispatch query failed).

**Driver Warning Rule**:

- `noDriverWarning` is set to `true` **ONLY** when `dispatchContextAvailable === true` AND authoritative `dItem.driverId === null`.
- When `dispatchContextAvailable === false`, `noDriverWarning = false`, `driverId = null`, `driverName = null`, `needsLocationReview = false`, and `dispatchWarning` reports a truthful unavailable message (e.g. `"Dispatch context not loaded for booking date"` or `"Dispatch context unavailable"`).
- The repository implementation never fabricates a "No Driver Assigned" warning for unindexed or future bookings.

### 4. Database-Level Dormant Notification Filtering & Response Isolation

The notification query in `src/lib/today/desktop-today-contract.ts` applies strict database predicates **before** ordering and limiting:

- `.eq("branch_id", branchId)`
- `.eq("target_workspace", "crm")`
- `.eq("requires_action", true)`
- `.in("status", ["unread", "read"])`
- `.not("type", "in", "(payment_pending,payment_overdue,reconciliation_submitted,marketing_content_updated)")`
- `.order("created_at", { ascending: false })`
- `.limit(20)`

**Response Isolation Proof**:
Vitest test suite proves both query construction (recording builder calls) and data isolation from mixed datasets. When tested against a mixed dataset containing other branches, non-CRM workspaces (`driver`, `staff`, `owner`), and dormant types (`payment_pending`, `payment_overdue`, `reconciliation_submitted`, `marketing_content_updated`), only valid operational CRM notifications for the authenticated branch reach `body.data.notifications.items`.

### 5. Today Operational Stage Count Semantics

Summary stage counts (`waiting`, `inService`, `readyToPay`, `completedService`, `homeService`) are calculated **strictly for today's operations** (`item.bookingDate === businessDate`). Future pending bookings remain present in the `queue` for operator situational awareness, but do not inflate Today's operational stage metrics.

### 6. Closed Booking Semantics

Today's schedule includes closed bookings (such as `status = 'cancelled'` or `status = 'no_show'`). In accordance with `getCradleFlowStage(b)`, closed bookings map to `stage: null`. They are preserved in the queue with their true status and `stage: null`.

### 7. Attendance Auth Boundary

- The Desktop Today endpoint is authenticated via Desktop bearer token (`verifyDesktopBearerAuth`).
- The branch ID is extracted from authenticated Desktop staff credentials and passed to the server-side attendance helper (`getRecentAttendanceScanFeed`).
- Privileged server-side credentials remain internal to the server; no privileged secrets or service-role keys are exposed to the client or renderer.
- Bookings, readiness, dispatch, resource, and notification reads operate through the authorized Desktop client context.

### 8. Authoritative Mutation Operations & Source-Audited Side Effects

Mutations in `src/app/api/desktop/v1/today/mutations/route.ts` strictly delegate to verified shared business operations in `src/lib/bookings/crm-booking-operations.ts`. The repository implementation establishes the following distinction between directly implemented logic and delegated RPC behavior:

| Action             | Directly Implemented in TypeScript                                                                                                                                                                                                                                                                                                                                                                                                                                                      | RPC Called                         | Side Effects Proven by Current Repository                                                                                                                                                                                                                                                                                                                    | Retracted / Unsupported Claims                                                           |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `confirm_booking`  | Validates schema; checks CRM role & branch; loads booking; validates status in `CONFIRMABLE_STATUSES`; rejects `cancelled`, `completed`, `no_show`; directly updates `bookings` (`status = 'confirmed'`, `booking_progress_status = 'not_started'` if not started, updates `metadata` with note/actor); calls `annotateLatestBookingEvent` for a real status transition (the helper does nothing when the booking was already confirmed); calls `revalidateOperationalBookingSurfaces`. | None                               | Direct `bookings` update and event annotation in database.                                                                                                                                                                                                                                                                                                   | None.                                                                                    |
| `mark_arrived`     | Validates schema; checks CRM role & branch; loads booking; rejects `CLOSED_BOOKING_STATUSES`; excludes Home Service (`isHomeServiceBooking(booking)`); checks idempotency (`checked_in` returns success); verifies progress is `not_started`; directly updates `bookings` (`booking_progress_status = 'checked_in'`, `checked_in_at = now`); calls `revalidateOperationalBookingSurfaces`.                                                                                              | None                               | Direct `bookings` update with `checked_in_at` and progress status.                                                                                                                                                                                                                                                                                           | Does NOT dispatch notification or write audit logs directly from this function.          |
| `start_service`    | Validates schema; checks CRM role & branch; loads booking; rejects closed bookings; excludes Home Service; checks idempotency (returns success if already started with timestamp); delegates to RPC; calls `revalidateServiceSurfaces`.                                                                                                                                                                                                                                                 | `start_booking_service_session`    | Stored procedure (`20260724133000_repair_exact_service_session_lifecycle.sql`) acquires `FOR UPDATE` lock, checks permissions and closed state, updates `bookings` (`status = 'in_progress'`, `booking_progress_status = 'session_started'`, `session_started_at`, `session_due_at`, `session_start_source`, `session_started_by`).                          | Does NOT alter payment or attendance directly.                                           |
| `complete_service` | Validates schema; checks CRM role & branch; loads booking; checks idempotency (returns success if already `completed`); rejects `cancelled`, `no_show`; delegates to RPC; calls `revalidateServiceSurfaces`.                                                                                                                                                                                                                                                                            | `complete_booking_service_session` | Stored procedure (`20260724133000_repair_exact_service_session_lifecycle.sql`) acquires `FOR UPDATE` lock, checks permissions and closed state, verifies session started, updates `bookings` (`status = 'completed'`, `booking_progress_status = 'completed'`, `session_completed_at`, `completed_at`, `session_completion_source`, `session_completed_by`). | Retracted: Does NOT call `update_branch_daily_summary` and does NOT record an audit log. |

---

## Verification & Checks Results

1. **Vitest Unit Tests** (recorded for tested HEAD `53e6b4d732cdb07c6caf3a1d1ba3d685395015ae`):
   - Command: `pnpm test run src/app/api/desktop/v1/today`
   - Result: **42 passed** (28 in `route.test.ts`, 14 in `mutations/route.test.ts`).
2. **Full Desktop & Auth Regression Test Suite** (recorded for tested HEAD `53e6b4d732cdb07c6caf3a1d1ba3d685395015ae`):
   - Command: `pnpm test run src/app/api/desktop tests/api/desktop-v1-home-service-operations.test.ts tests/api/desktop-v1-home-service-reads.test.ts tests/api/desktop-v1-bookings.test.ts tests/api/desktop-v1-customers.test.ts tests/api/desktop-v1-schedule.test.ts tests/lib/auth/desktop-bearer-auth.test.ts tests/lib/bookings/inhouse-booking-engine-auth.test.ts`
   - Result: **300 passed across 14 test files** (0 failures).
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
   - Result: **Compiled successfully in 38s**, TypeScript passed in 46s, static generation completed (128/128), dynamic routes `/api/desktop/v1/today` and `/api/desktop/v1/today/mutations` compiled dynamically with exit code 0.
7. **Git Diff Check**:
   - Command: `git diff --check`
   - Result: **0 errors**.
8. **Remote Vercel Status** (commit `f6c358890a6a9c88ae8c781de7865c036938f119`):
   - Result: **VERCEL STATUS: success** (`Deployment has completed`, target: `https://vercel.com/techwithmpg-6128s-projects/cradlehub/pggUPHyZ5z8SdFdTbpBuQ7JgHB2C`).

---

## Security & Data Impact

- **Bearer Auth Enforced**: All Desktop Today endpoints require valid Bearer token auth; zero cookie reliance.
- **Branch Boundary**: Authenticated branch is strictly resolved server-side.
- **Zero Schema Alterations**: Zero migrations, zero DDL, zero schema mutations.
- **Dormant Payment Scope**: Zero financial amounts or payment actions exposed.
