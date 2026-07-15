# Smart Dynamic Clock-Out

## Architecture decision

**Expected clock-out is schedule-backed and dynamically resolved from final work completion.**

The resolved individual schedule remains authoritative for whether a staff member
is working, their branch, shift type, scheduled window, and Attendance business
date. Dynamic policy changes only the expected clock-out and its review window.
When no qualifying assignment exists, the resolved schedule end is the expected
clock-out.

There is one resolver and one final Attendance record. The system does not create
a second portal Attendance engine:

1. `recalculate_attendance_clock_out_policy` loads only the open record's branch,
   staff, business-date schedule evidence, applicable category rule, and relevant
   assignments.
2. It stores the resulting evidence in the existing
   `attendance_policy_snapshot` and deadline columns.
3. Branch QR recalculates immediately before classifying a valid clock-out.
4. Portal clock-out invokes `commit_attendance_portal_clock_out`, which verifies
   auth identity, device, branch, open record, assignments, and eligibility under
   the same per-staff advisory lock used by QR.
5. Booking and schedule lifecycle triggers recalculate only affected open records.
6. Existing Supabase safety jobs continue reading stored CRM-closing deadlines.

## Decision tree

```text
Open Attendance record
  ├─ CRM/front desk + Closing shift
  │    ├─ final valid in-spa branch service → completion + CRM closing buffer
  │    └─ no branch service → resolved schedule end
  ├─ Driver
  │    ├─ final assigned home-service trip → completion + return buffer
  │    └─ no trip → resolved schedule end
  ├─ Service provider
  │    ├─ final assigned service → completion + category buffer
  │    │    ├─ home service → home wrap-up buffer
  │    │    └─ in-spa service → cleanup buffer
  │    └─ no service → resolved schedule end
  └─ Utility/manager/non-service staff → resolved schedule end
```

An earlier final-service result may precede schedule end only when final-client
release is enabled for the category, or when the staff member is using the
explicit therapist/CRM closing strategy. A later final service always extends the
expected time. A manager-created active date override supplies the schedule
fallback without overwriting the raw clock-in schedule snapshot.

## Staff-category matrix

| Category | Dynamic evidence | Buffer | Portal clock-out |
|---|---|---|---|
| Therapist | Own final valid service | Cleanup or home wrap-up | Final completed home dispatch, or eligible Closing shift |
| Salon / nail / aesthetician | Own final valid service | Cleanup | Branch QR |
| CRM / CSR Closing | Final valid in-spa service at assigned branch | CRM closing duty | Eligible Closing shift |
| CRM / CSR non-Closing | Schedule | None | Branch QR |
| Driver | Own final assigned home-service trip | Return/travel (zero allowed) | Final completed trip |
| Utility / managers / other non-service | Schedule | None | Branch QR unless explicit supported category evidence exists |

Opening/Closing scheduling permissions do not change: only therapists and
CRM/front-desk staff use hierarchical shift types. Salon remains
non-hierarchical.

## Completion priority and exclusions

For service work the resolver uses, in order:

1. `session_completed_at` (or the home-service `completed_at` compatibility field)
2. Extended/effective `session_due_at`
3. `session_started_at` plus the snapshotted/service duration
4. Scheduled booking end, including overnight end
5. Resolved scheduled shift end
6. An explicitly active, creator-backed schedule override as the schedule basis

Cancelled, no-show, wrong-assignee, deleted, out-of-business-day, and live/test
mismatched bookings are excluded. CRM closing ignores home-service bookings.
Driver resolution uses `driver_id`; therapist resolution uses `staff_id`.

## Dynamic window and record-first behavior

The stored window is:

```text
earliest normal = expected clock-out - category early tolerance
latest normal   = expected clock-out + category late grace
```

A branch QR clock-out always uses the newly recalculated snapshot. Early and
overtime clock-outs are committed, then flagged for review. Portal clock-out does
the same for an otherwise eligible final home service or final trip. An eligible
Closing-shift portal action remains disabled until its closing completion window.

## Portal eligibility

Branch QR is the default. The portal action is enabled only for:

- the assigned therapist after their final home-service service and dispatch are
  completed;
- the assigned driver after their final trip is completed; or
- a therapist/CRM staff member explicitly clocked into an eligible Closing shift.

The server blocks portal completion while an active session/dispatch or a future
valid same-business-day assignment remains. Responses expose at most a safe next
assignment time, never customer identity or contact details.

The browser submits no staff ID, branch ID, Attendance ID, booking/trip ID,
completion timestamp, expected time, classification, or eligibility value.

## Security and concurrency

- The Server Action obtains the authenticated Supabase user and HttpOnly device
  credential. The raw credential never enters the database or logs.
- The database resolves the active, non-archived staff row and matches the SHA-256
  fingerprint to an active, trusted, non-revoked device at the open record's
  branch.
- The portal RPC is denied to `public`, `anon`, and `authenticated`; only the
  server-side `service_role` may execute it.
- QR, portal, booking assignment changes, and schedule mutations share the same
  branch/staff/test-mode advisory lock. Concurrent QR/portal attempts can close
  one record only.
- Request IDs are unique in `qr_scan_events`; replay returns the committed result.
- Denied authenticated attempts are audited with safe codes and no token/customer
  data.

## Snapshot fields

The existing `attendance_policy_snapshot` stores:

- raw and resolved schedule end;
- policy/category rule identifiers;
- calculation source and source booking/dispatch/trip IDs;
- source completion and scheduled-start timestamps;
- expected, earliest, latest, reminder, escalation, hard-cutoff, and provisional
  timestamps;
- applied buffer, timezone, and business date;
- active/upcoming flags and safe next assignment time;
- portal eligibility reason/method; and
- final method/classification after portal completion.

No customer name, address, phone, email, or service notes are copied into the
snapshot.

## Event triggers

Recalculation runs after relevant booking insert/update/delete, including
assignment, reassignment, date/time, status/progress, session start/due/extension,
completion, driver, delivery type, or test metadata changes. Both old and new
assignees are included. A branch-final change also updates open CRM Closing rows
for that branch.

Schedule and date-override mutations update the affected staff's open rows.
Category and branch rule-version changes update only matching open branch rows.
The resolver compares material evidence before updating; `calculatedAt` alone
does not cause a write.

## Recovery

Attendance Recovery reads the stored snapshot and displays expected time,
schedule fallback, dynamic source, compact evidence ID, applied buffer, method,
portal block reason, provisional close, and actual reconciliation. Customer data
is deliberately absent. Existing correction and provisional reconciliation paths
remain authoritative.

## Test and Training Mode

The same resolver and portal transaction are used. An open record is selected for
the branch's current Test Mode, and assignment evidence must carry matching test
metadata. Audit, exception, and Attendance rows retain `is_test`; existing payroll,
live totals, notifications, and Supabase safety queries continue excluding tests.

## Supabase and Vercel

Normal policy recalculation is event-driven in PostgreSQL. No five-minute Vercel
Attendance cron exists. CRM Closing rows retain `attendance_policy_source =
'crm_closing'`, so the existing four bounded Supabase Cron stages continue to
query stored dynamic reminder/escalation/hard-cutoff timestamps with
`FOR UPDATE SKIP LOCKED`, idempotent intervention keys, and small batches.

## Troubleshooting

- **Use branch QR:** the category/shift is intentionally not portal eligible.
- **Registered device required:** register or recover the Attendance device from
  Staff Portal Profile; do not clear unrelated repository or browser credentials.
- **Another assignment remains:** inspect the same Attendance business date for a
  confirmed/in-progress booking or trip.
- **Closing duties remain:** compare the stored expected/earliest timestamps to
  branch-local time and verify the source completion/buffer.
- **Schedule fallback:** verify assignment, booking status/progress, business date,
  delivery type, and Test Mode metadata.
- **Policy did not update:** inspect the affected-record trigger and compare the
  stored snapshot; unchanged evidence intentionally causes no write.

## Upgrade path

Apply the additive migration in isolation, regenerate types from the resulting
schema, run focused/full gates, and verify function ACLs/triggers/indexes before
deploying application code. Because this repository has known migration-history
drift, do not run a blind full `supabase db push`; apply and verify this migration
through the approved focused path, then reconcile history separately.
