# Attendance Fluid Operations

## Operational contract

Attendance uses a record-first model. `qr_scan_events` is permanent scan evidence, `staff_shift_checkins` is official interpreted attendance, `attendance_exceptions` records uncertainty, and `attendance_corrections` records an actor-attributed resolution. Timing anomalies do not discard a valid scan.

The scan transaction is idempotent by request ID and commits the raw event, attendance mutation (when inferred), exception (when needed), public result, and device timestamps together. Legacy policy columns remain for compatibility but do not decide record-first behavior.

## Decision table

| State before a valid scan | Attendance action | Review action | Public result |
|---|---|---|---|
| Exactly one open row | Close that row, even when stale or outside the current schedule; preserve its original snapshot | Flag stale/outside/early/overtime anomalies | Clocked out |
| Multiple open rows | No attendance mutation | One conflicting-open issue containing all open row IDs | Scan captured |
| No open row, inside clock-in window | Create clock-in | Flag early/late timing when applicable | Clocked in |
| No open row, missing schedule/off day/outside ordinary windows | Create clock-in | Flag exact schedule/timing uncertainty | Clocked in, review required |
| No open row, first scan near expected closing | No attendance mutation | Preserve the scan for manager review | Scan captured |
| Revoked device, inactive/archived/merged staff, invalid QR/identity | No attendance mutation | Security/identity evidence | Blocked |

An active service is not allowed to override the one-open invariant: the sole open Attendance row closes on the next valid Attendance scan. Service state remains separately auditable.

## Effective branch

`resolve_effective_attendance_branch` evaluates, in order:

1. approved temporary assignment for the Attendance business date;
2. active schedule/duty assignment for that weekday;
3. approved cross-branch assignment or the staff cross-branch flag;
4. staff home branch;
5. review when none authorizes the scanned branch.

`staff_devices.branch_id` is last-used metadata, synchronized from the scanned QR point inside the scan transaction. It is not branch authority. A permanent branch correction changes future home-branch resolution and does not rewrite historical Attendance rows.

## Shared operational status

Every Attendance consumer receives one of: `not_expected`, `expected_later`, `missing`, `clocked_in`, `on_service`, `clocked_out`, `needs_review`, or `scan_captured`. The shared resolver combines the branch business date, resolved schedule, official record, active service, and open exceptions.

## Review and corrections

The Attendance Review Queue is the single operational queue. `apply_attendance_review_correction` locks the linked evidence, applies the official attendance or branch-authority mutation, resolves the linked exception, and inserts an audit row in one transaction. Supported transactional actions include accepting recorded attendance, setting manual clock-out time, voiding a duplicate/accidental interpretation, allowing a branch for today, and changing the future permanent home branch. Raw scan rows are never edited or deleted.

## Database safety

- A staff-wide advisory lock plus `staff_shift_checkins_single_open_guard` rejects creation of a second live open row, including across branches. Existing legacy conflicts remain untouched so CRM can review them.
- Request-ID locking and stored public results preserve retry idempotency.
- RLS is enabled on new operational tables; resolver and correction functions are not executable by `anon` or `authenticated`, and server-owned execution is granted to `service_role` only.
- Device registration, reconnection, revocation, security block, replacement, and last-used branch changes are recorded in `attendance_device_audit_events`.

## Reports

The Reports tab exposes exactly:

- **Daily Attendance** — business date, staff, schedule, clock-in/out, worked/late/early/overtime minutes, shared status, exception labels, correction indicator.
- **Exceptions and Corrections** — exception state, resolution, actor, correction action/reason, and audit reference.
- **Payroll Export** — worked and approved payable minutes. A row with unresolved ambiguous scan evidence has zero approved payable minutes until reviewed.

All on-screen filters apply to CSV export.

## Required scenario matrix

Each row states the expected raw scan, attendance, exception, result, retry/concurrency, and audit evidence.

| # | Scenario | Raw scan | Attendance | Exception | Final result | Idempotency / audit |
|---:|---|---|---|---|---|---|
| 1 | Normal clock-in | committed | one open row | none | clocked in | request replay returns same event/result |
| 2 | Normal clock-out | committed | sole row closed | none | clocked out | same row/event IDs replayed |
| 3 | Early clock-in | committed | open row created | early clock-in | clocked in + warning | event/exception linked |
| 4 | Late clock-in | committed | open row created | late clock-in | clocked in + warning | event/exception linked |
| 5 | Early clock-out | committed | sole row closed | early clock-out | clocked out + warning | metrics and snapshot audited |
| 6 | Overtime clock-out | committed | sole row closed | overtime clock-out | clocked out + warning | metrics and snapshot audited |
| 7 | Exactly one stale open | committed | stale sole row closed | stale open (+ timing codes) | clocked out + warning | original snapshot retained |
| 8 | No schedule | committed | open row created | missing schedule | clocked in + warning | fixed policy ignores legacy setting |
| 9 | Scheduled off day | committed | open row created | off-day | clocked in + warning | fixed policy ignores legacy setting |
| 10 | Outside both windows | committed | open row created | outside schedule window | clocked in + warning | exact reason persisted |
| 11 | First scan near closing | committed | unchanged | likely closing without clock-in | scan captured | no invented time; event replayed |
| 12 | Multiple open rows | committed | unchanged | conflicting open with all IDs | scan captured | no third row; atomic issue/event |
| 13 | Overnight shift | committed | original business-date row opened/closed | timing only when applicable | clocked in/out | overnight snapshot retained |
| 14 | Branch-local business date | committed | row uses branch business date | as applicable | deterministic | timezone/date in snapshot |
| 15 | Temporary cross-branch | committed | row at effective scanned branch | none unless timing | accepted | assignment source + QR evidence |
| 16 | Permanent wrong-branch correction | mismatch scan preserved | no historical rewrite | issue resolved atomically | future scans accepted | correction stores actor/reason/old/new |
| 17 | Duplicate request ID | one event | one mutation | no duplicate | stored result replayed | request advisory lock |
| 18 | Two simultaneous scans | both attempts evidenced | at most one new open | duplicate/conflict as resolved | deterministic | staff-wide advisory/trigger guard |
| 19 | Revoked device | committed security event | unchanged | revoked device | blocked | device lifecycle + scan evidence |
| 20 | Inactive staff | committed identity event | unchanged | inactive staff | blocked | archived/merged/inactive distinguished |
| 21 | Cleared-browser recovery | initial unknown-device event plus continuation | attendance after secure relink | device issue resolved | sign-in/recovery then scan result | device audit and continuation IDs |
| 22 | Active service at clock-out | committed | sole Attendance row closes | service state remains separate | clocked out | no legacy timing blocker |
| 23 | Manual Attendance correction | existing scan unchanged | selected row atomically changed | linked issue resolved | correction applied | actor/reason/old/new captured |
| 24 | Correction audit trail | immutable scan retained | official current truth | resolved state retained | visible in queue/report | correction ID links exception/check-in |
| 25 | Daily Attendance report | referenced, not mutated | row-level current truth | labels included | filtered rows/CSV | correction indicator included |
| 26 | Exceptions report | referenced, not mutated | linked official row | open/resolved truth | filtered rows/CSV | actor/reason/audit reference included |
| 27 | Payroll after correction | referenced, not mutated | corrected current truth | unresolved ambiguity non-payable | approved minutes exported | correction indicator included |
| 28 | Realtime refresh | no new scan write | no duplicate mutation | unchanged | same server truth rerendered | stable row/event IDs |

