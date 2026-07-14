# Attendance Phase 1 — Authoritative Daily Model

Task: `ATTENDANCE-COMPLETE-SYSTEM-001`  
Date: 2026-07-14  
Status: `IMPLEMENTED LOCALLY — AUTHENTICATED BROWSER QA PENDING`

## Decision

`src/lib/attendance/day-model.ts` is the reusable Attendance-day composition
layer. It does not resolve schedules itself. Schedule truth remains
`getResolvedStaffSchedulesForDate(...)`, which delegates to the existing
individual-first schedule resolver. This preserves the repository's explicit
decision that historical group schedule tables are dormant data, not runtime
schedule sources.

The model combines the resolved schedule with branch timezone/business date,
Attendance settings, interpreted check-ins, active service sessions, open
exceptions, and current time. It returns typed `AttendanceDayStaffState` rows
for server consumers.

## State behavior

- Day off, not scheduled, missing schedule, and schedule conflict are distinct.
- A future shift is `scheduled_later`; the configured early-arrival window is
  `expected_soon`.
- `not_arrived` exists only while a real shift is expected.
- `late_not_arrived` begins only after the configured late grace period.
- A valid open check-in without service or exception is `available`.
- Active service takes precedence and is `in_service`.
- Open exceptions and schedule conflicts become `needs_review` unless active
  service is currently more operationally important to display.
- Completed interpreted records are `clocked_out`.
- Split and overnight windows retain exact timezone-aware instants.

`forgotten_clock_out`, `absent`, and break persistence remain typed future
states but are not fabricated in Phase 1. They require the later automation and
break-policy phases.

## Consumers

- CRM and Owner Attendance resolve the complete active branch roster
  server-side and include `dailyStaffStates` in the shared workspace payload.
- CRM Overview renders those authoritative rows. The previous local
  `record exists => scheduled/not arrived` interpretation and first-36 roster
  slice are removed.
- Staff Portal resolves the signed-in staff member with the same schedule query
  and daily model. Only the self row and self history are returned to the UI.
- Phase 1 timestamp surfaces use the resolved branch timezone where available.

## Verification coverage

Focused model tests cover ordinary, split, overnight, override, day-off,
missing, conflict, later shift, grace/late, checked-in/available, checked-out,
active service, wrong-branch evidence, timezone boundary, open exception, and
not-operational states. Existing scan-intent and Staff Portal tests run beside
the model tests to detect divergence.

Authenticated CRM/Staff Portal browser QA remains required because the current
browser session has no safe signed-in fixture. No browser certification is
claimed from static tests or production build output.

Verification completed:

- Phase-focused: 25 files / 112 tests passed.
- Full Vitest: 120 files / 835 tests passed.
- `pnpm type-check`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed on Next.js 16.2.4 with 109 routes.
- `git diff --check`: passed with line-ending warnings only.
