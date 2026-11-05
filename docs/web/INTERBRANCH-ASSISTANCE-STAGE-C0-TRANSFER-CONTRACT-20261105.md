# WEB Stage C0 — Inter-Branch Staff Duty / Attendance Contract (proposal)

Status: **DESIGN / BASELINE RECONCILIATION REQUIRED — NOT IMPLEMENTATION OR PRODUCTION APPROVAL**
Date: 2026-11-05
Target: CradleHub **WEB** only. Desktop is a separate track.

## Owner's requested behavior (2026-11-05)
After a CSR at the lending branch approves named personnel for an assistance window:
1. Notify each selected staff member on their phone and in Staff Portal; reuse the existing workspace notification, subscription, push and service-worker infrastructure.
2. Staff member clocks out at their **home** branch before leaving.
3. At the **receiving** branch, the same registered phone scans the receiving branch's existing attendance QR; the server checks the approved assignment and exact branch/window before clock-in.
4. **Active-duty worked time** pauses after home clock-out, resumes at receiving clock-in, stops again on receiving clock-out. The approved assignment's wall-clock end time never pauses or extends automatically.
5. Record a full audit trail, preserve historical home branch attendance and payroll evidence. Permanent `staff.branch_id` stays unchanged.
6. Staff becomes bookable at receiving branch **only** after all independent attendance, schedule, qualification, booking-conflict, assignment and capacity checks succeed. The system must never treat approval alone as bookability.
7. Both Main and SM may lend and receive staff; **SM has no Home Service**.

## Accepted baseline discrepancy — STOP before implementation
`docs/web/INTERBRANCH-ASSISTANCE-STAGE-A-20261105.md` describes **one continuous attendance shift**, including travel to receiving branch, while the latest owner request explicitly requires a **clock-out pause and a receiving-branch clock-in resume**. Reconcile this accepted contract with attendance/payroll ownership and record a reviewed owner decision *before writing attendance mutations*. Do not silently replace the Stage A assumption.

## Repository inspection (REPOSITORY-RECORDED PRODUCTION EVIDENCE where applicable, not live verification)
- Request/approval: `src/app/(dashboard)/crm/schedule/assistance-actions.ts` creates provisional `approved_pending_arrival` records in `staff_assistance_requests` and branch-scoped CRM notification signals. No per-staff push, arrival, active or completion transition exists in these actions.
- Current Stage B schema: `supabase/migrations/20261105153000_interbranch_assistance_requests.sql` only allows `requested`, `approved_pending_arrival`, `declined`, `cancelled`; its trigger forbids post-approval state changes. A **new, separately reviewed forward migration** is required for per-staff lifecycle records; do not mutate applied migration history or drop audit rows.
- Source of attendance write intent: `src/lib/attendance/scan-engine.ts`, `src/lib/attendance/attendance-intent-engine.ts`, `src/app/api/attendance/public-scan/route.ts`, and canonical `commit_attendance_scan_transaction` RPC. Preserve device registration, QR authorization, duplication/recovery, shift windows, and audits.
- Attendance correction facility `staff_attendance_branch_assignments` described in `docs/web/INTERBRANCH-ASSISTANCE-STAGE-A-20261105.md` is **not** an operational assistance transfer writer and must not be reused without formal contract review.
- Availability `src/lib/engine/availability.ts`, `src/lib/queries/schedule.ts`, `src/lib/queries/crm-availability.ts` filter by permanent branch; do not patch only a frontend roster to make borrowed personnel bookable.
- Push `docs/operations/BROWSER_PUSH_NOTIFICATIONS.md` describes existing `workspace_notifications`, subscription validation, web-push dispatcher and service worker. Selected staff must receive exact-recipient, deduplicated delivery, never a branch-wide personal assignment.
- Staff self-service attendance: `src/lib/staff-portal/attendance.ts` reads sessions and reports current state; payroll and attendance totals may rely on `staff_shift_checkins.worked_minutes`. Validate all downstream consumers before changing session semantics.
- Existing provisional approval validates known booking conflicts, not sufficient home-branch coverage or a complete schedule+skills gate. Stage C cannot assume approved means safe to transfer.

## Proposed state and ownership
**Request**: `requested -> approved_pending_arrival | declined | cancelled` remains Stage B until reviewed change.
**Per-staff duty** (new records): `approved -> notified -> home_clocked_out -> travelling -> arrived_clocked_in -> completed`; separate explicit paths for `cancelled`, `expired`, `failed_arrival`, `exception` with actor, timestamps and reasons. Lifecycle transitions must be atomic, idempotent, monotonic, server-authorized, and stored in append-only evidence.
**Assignment window**: fixed `[start_at,end_at)` in a single timezone-aware instant. Clock-in cannot create eligibility outside this window. A last service running into end time requires CSR resolution, not silent assignment extension.
**Attendance**: preserve original home clock-in/out and receiving branch clock-in/out as separate actual duty segments linked to a single approved assistance assignment. Never backdate fictitious travel duty, overwrite historical scans, or record two simultaneous open sessions.
**Accounting**: calculate active-duty time from the union of server-validated, non-overlapping sessions. Travel is excluded from *active-duty* time by default; whether travel is separately paid is an **OPEN BUSINESS/PAYROLL DECISION**, not a deduction to impose automatically. Avoid double counting minutes and commissions.
**Booking**: server source-of-truth must validate the per-staff active receiving-branch duty plus qualifications, room/service/home-service policies, holds, travel and cross-branch conflicts transactionally.

## Gate sequence (one approved stage at a time)
C0. Baseline reconciliation: confirm meaning of pause/resume vs one continuous shift, paid travel, uncompleted service at duty end, extension/cancellation and late arrival; inventory all writers/readers and payroll consumers. This document **does not certify** the answers.
C1. Notifications only: exact staff recipient and branch CSR action notifications, durable in-app fallback, dedupe, safe deep-link and tests across logged-out/expired subscription/2 tabs.
C2. Forward-only per-staff assignment schema & atomic transition API: independently reviewed migration, RLS/grants/actor and audit tests on disposable DB. Do not touch existing attendance tables yet.
C3. QR integration: modify canonical scan path only after tests for ordinary scans, device registration, time windows, duplicate scans, missed clock-out, branch restrictions, overnight shifts and reversal/recovery. No GPS requirement reintroduction.
C4. Booking eligibility: inspect all public/CRM booking save and availability paths, atomic capacity/hold integration, cross-branch double-book protection; activate behind independent feature flag.
C5. Payroll/reconciliation & operational QA: no double-counted work, home branch ownership, signed-out sessions, staff push, CSR actions and real browser/phone/device tests; measured performance before optimization.

## Minimum test cases
- Main lends to SM, SM lends to Main, SM cannot request Home Service.
- Selected staff receives exactly one personal notification; unselected staff receives none; failed push still leaves durable in-app notice.
- Home-branch open session cannot coexist with receiving-branch open session. Wrong QR, early arrival, after-end arrival, expired assignment, same-device replay or non-assigned staff fail closed.
- Wrong branch / non-CSR approval denied. Staff cannot self-extend transfer.
- Original site and destination booking conflicts, held services, scheduled breaks, shift bounds and lending-branch coverage fail closed.
- Two concurrent bookings cannot both reserve the same transferred staff member.
- Duty end while service is in progress creates CSR issue without truncating the service or falsely extending eligibility.
- Travel interval not in active-duty worked minutes; approved payable travel, if adopted, appears separately and only once.
- Recovery/clock-out repair preserves scans, timestamps, payroll evidence and assignment audit.

## Evidence status
GitHub source inspection performed; no new production schema, attendance, booking, payroll or notification mutation; no local pnpm, native device, browser or concurrency integration tests run for this proposal. Owner approval and independent review are required before implementation or merge.
