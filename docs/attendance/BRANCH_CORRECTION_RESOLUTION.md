# Attendance Branch Correction Resolution

Last updated: 2026-07-15
Tasks: `ATTENDANCE-BRANCH-CORRECTION-RESOLUTION-001`,
`ATTENDANCE-BRANCH-RESOLUTION-TRANSACTION-FIX-003`

## Purpose

A valid Attendance QR scanned at the wrong branch is captured first and placed
in Branch Corrections. CRM, manager, or owner staff must then make one explicit
decision:

- `Temporary access · this shift`
- `Temporary access · this business day`
- `Permanent branch transfer`
- `Reject scan`

There is no generic Approve operation. A successful resolution continues the
already-captured scan through the same Attendance intent and commit engine used
by an ordinary QR scan. The staff member does not scan again.

Arbitrary multi-day date ranges are intentionally deferred. The current model
stores `valid_from` and `valid_until` so a later range feature can be additive,
but this release exposes only shift and branch-local business-day scopes.

## Data contract

Migration `20260715113000_attendance_branch_correction_resolution.sql` extends
the existing request, assignment, and Attendance tables rather than adding a
parallel correction system.

Migration `20260715113001_attendance_branch_resolution_transaction_fix.sql`
patches the existing resolver in place. It qualifies the two
`attendance_exceptions` updates that produced SQLSTATE `42702`; it does not
change tables, arguments, return columns, security mode, locks, or behavior.

`staff_branch_change_requests` stores the selected decision, resolution state,
authorizer, effective/validity timestamps, previous and new branches, source and
continuation scans, resulting Attendance row/result, impact summary, Test Mode,
and the existing review note/timestamps.

`staff_attendance_branch_assignments` is the bounded authorization ledger. A row
is branch-specific, linked to the correction and source scan, and has one of two
scopes:

- `shift`: usable only for the original business date or linked open Attendance
  row and automatically revoked when that row closes.
- `business_day`: expires at the next Attendance boundary in the target branch
  timezone and does not authorize another business date.

`staff_shift_checkins` snapshots the home branch, actual Attendance branch,
authorization, correction, decision, and authorizer. A later staff-profile
transfer does not rewrite those historical facts.

## Transaction and continuation

`resolve_staff_branch_correction_transaction(...)` is the only resolution
write path. It is callable only by the service role; the server action derives
the tenant, actor, and selected workspace branch from the authenticated session.
The function:

1. takes per-request and per-staff locks;
2. validates active tenant membership, role, branch scope, request ownership,
   source QR/device/event, target branch, and Test Mode;
3. rejects self-approval and conflicting second decisions;
4. writes the temporary authorization or current-profile transfer and audit;
5. calls the existing authoritative Attendance commit or provisional-clock-out
   transaction in the same database statement;
6. links the original event, deterministic continuation event, request,
   authorization, and resulting Attendance row;
7. resolves the wrong-branch exception and finalizes the request; and
8. returns the prior committed result for a replay of the same decision.

Any continuation failure raises an error, so the request, authorization,
profile, audit, scan, and Attendance changes roll back together. The original
QR event remains operational evidence. Its staff-safe result is updated and
linked to the continuation; raw source QR/device/request metadata is retained.

The deterministic continuation request ID and database uniqueness constraints
ensure repeated clicks or concurrent managers cannot create a second decision,
authorization, scan continuation, or Attendance row.

## Resolution behavior

### Temporary access

The staff member's home branch is unchanged. The authorization is limited to
the requested target branch and selected shift/day window. The resumed scan may
clock in or clock out because intent is recalculated from current Attendance and
schedule state by `scan-engine.ts`; the resolution UI does not guess the action.

### Permanent transfer

The current `staff.branch_id` changes, and `staff_branch_audit_logs` records the
old branch, new branch, actor, time, reason, and source correction. Existing
bookings, schedules, services, payroll, historical Attendance, and device rows
are not rewritten. The dialog shows a compact impact summary and creates
idempotent follow-up notifications/tasks where an operator must review future
bookings, schedules, availability, service coverage, or duty/resources.

Permanent transfer is disabled in Test Mode and requires a reason.

### Reject scan

The request and original scan receive an explicit rejected result and reviewer
reason. No authorization, profile change, continuation Attendance, or payroll
time is created. A rejected request cannot later be approved.

## Authorization and database exposure

- CRM, manager, and owner server-side roles may resolve within their derived
  tenant/branch authority; ordinary staff cannot resolve requests.
- A requester cannot approve their own correction.
- Browser roles have selected read access only on the request and authorization
  tables. Writes use the server service role and the restricted transaction.
- RLS remains enabled. Write-capable browser policies were removed, `anon` has
  no table access, and the resolver RPC has no `anon` or `authenticated`
  execute grant.
- Errors returned to the UI are safe workflow messages; server logs use stable
  operation identifiers and safe failure stages rather than QR/device secrets.

An authenticated phone completing first-scan login is registered before the
canonical scan engine evaluates wrong-branch authority. That device record does
not grant access to the scanned branch; it supplies the verified identity needed
to capture and later resume the source scan. An older source event with no device
ID cannot be repaired safely by choosing another phone and must be scanned again.

## Operator flow

1. Open CRM → Staff → Branch Corrections.
2. Select a pending item and choose **Resolve branch** or **Reject scan**.
3. For resolution, select shift, business day, or permanent transfer. Review
   validity and, for permanent transfer, the impact summary.
4. Enter the required reason for permanent transfer or rejection and confirm.
5. Confirm the final Attendance outcome shown on the request. A temporary
   authorization also shows its expiration/revocation state.

If the transaction fails, the request remains pending and is safe to retry. Ask
the staff member to scan again only when the UI explicitly reports that the
original source scan is unavailable, including older first-login events that
were captured without a device ID.

## Verification evidence

- TypeScript: `pnpm type-check`
- Lint: `pnpm lint` (one pre-existing unused-function warning only)
- Focused fix suite: 4 files / 31 tests
- Full suite: 138 files / 1,103 tests
- Production build: Next.js 16.2.4, 110 generated pages
- Live schema: migrations `20260715113000` and `20260715113001` applied and
  recorded; columns, indexes, RLS, grants, policies, function body, and ACLs
  inspected
- Synthetic database QA in rollback transactions:
  - Test Mode shift continuation, replay idempotency, and clock-out revocation
  - Test Mode business-day authorization and future-date denial
  - permanent transfer with home/actual branch snapshots and audit
  - rejection with no Attendance row and no later approval
  - forced inner Attendance failure with authorization, request, profile, audit,
    and Attendance rollback assertions
  - cleanup probes found zero synthetic staff, request, or Attendance rows

The fix-specific linked QA also verified live temporary shift, business-day,
and non-Test permanent resolution, an identical second-manager replay, a
controlled missing-device result, and forced inner-commit rollback. The patched
function remains `SECURITY INVOKER`, has `search_path=public, extensions`, and is
executable by `service_role` but not `anon` or `authenticated`.

No real staff Attendance record was created, modified, rejected, or resolved for
this QA. One existing real pending request was observed read-only and left alone.

## Release notes

The repository has broader historical local/remote migration drift. This focused
migration was applied in isolation and its exact version recorded after live
inspection. Do not use a blind full `supabase db push`; reconcile the unrelated
backlog separately.

## Troubleshooting

- **Request remains pending:** refresh once and retry. A continuation failure is
  atomic, so there should be no partial authorization or branch transfer.
- **Source scan unavailable:** do not manufacture a replacement payload. Confirm
  the request links to the original wrong-branch event, active Attendance QR
  point, and registered device. If the source device ID is missing, ask the staff
  member to scan again after the first-login repair is deployed.
- **SQLSTATE 42702:** verify migration `20260715113001` is recorded and inspect
  the live resolver for `attendance_exceptions as exception_row`. Do not recreate
  the function with `SECURITY DEFINER` or grant it directly to browser roles.
- **Already resolved:** the same decision safely replays its final result. A
  different decision needs an explicit future reopen workflow and cannot be
  forced through the resolver.
- **Requires review:** the Attendance engine committed an exception outcome.
  Resolve that item in the existing Attendance review workflow; do not create a
  second branch resolution.
- **Permanent transfer impact:** use the generated booking/schedule/service task
  instead of manually moving historical or future records without review.
- **Generated `.next/dev/types` parse errors:** remove only the corrupt generated
  dev type artifacts and rerun `pnpm type-check`; do not edit generated output.
