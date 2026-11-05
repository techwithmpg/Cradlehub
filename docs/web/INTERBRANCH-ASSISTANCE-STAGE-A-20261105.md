# Inter-Branch Staff Assistance — Stage A / current-system contract

**Target:** CradleHub WEB, CONTROLLED STABILIZATION
**Owner authorization:** 2026-11-05: build inter-branch assistance; no further CSR interviews required.
**Branch:** `stage/interbranch-assistance-foundation-20261105`
**Base:** `6a381313c3afd31ea936e52850212e3b428154a5` (`main` at branch creation)
**Status:** STAGE A WORKING EVIDENCE. **NOT SHIPPABLE**, no migration or production change.

## 1. Confirmed operational decisions
1. Both Main Spa and SM may *request* eligible service staff from the other branch when short-handed. Staff categories: therapist, nail technician, aesthetician/facialist; preserve existing staff qualification rules.
2. CSR identifies shortage and submits a request. **Lending branch manager** selects and authorizes which staff can be spared. Owner may authorize across branches; ordinary CSR must never approve staff release.
3. Staff temporarily work at the receiving branch through the end of their approved duty. Their permanent `staff.branch_id` does NOT change.
4. Staff can arrive from their home branch and finish/clock out at the receiving branch. Attendance should remain **one continuous shift**, with a distinct transfer/arrival event; no duplicate check-in or fictitious payroll time.
5. **SM offers no Home Service.** Main can perform its own Home Service with qualified visiting staff if all driver, travel, service and branch rules pass.
6. No automatic transfer or silent staff reassignment. Smart shortage hints come only after measured demand/capacity evidence; CSR initiates and manager decides.
7. Request approval is NOT sufficient for booking eligibility until integrated, arrived/activation logic, authoritative overlap checks and all booking writer paths are independently validated.

## 2. REPOSITORY-RECORDED PRODUCTION EVIDENCE, not verified runtime
- `src/lib/engine/availability.ts`: candidate roster filters `staff.branch_id = requested branch`; availability RPC plus qualified provider filter and booking holds.
- `src/lib/queries/schedule.ts`: loads staff by `staff.branch_id` and builds branch-scoped schedule and bookings.
- `src/lib/queries/crm-availability.ts`: staff by permanent branch, schedule, shift check-ins, pending bookings and availability; when attendance enforcement is paused scheduled staff can appear present. **Do not use this UI-only status as transfer authorization**.
- `src/lib/queries/assignment-recommendations.ts`: candidate staff, service skills, schedules, time blocks, attendance, and conflict bookings are branch-scoped. Need cross-branch conflict aggregation.
- `src/lib/actions/staff-schedule-adjustments.ts`: explicitly requires staff's permanent branch to equal selected branch; do not use it to fake transfers.
- `src/lib/home-service/dispatch-operations.ts`: branch authorization and same-branch driver enforcement; preserve.
- `src/lib/attendance/scan-engine.ts` and `src/lib/staff/branch-assignment-resolver.ts`: attendance branch QR and temporary access supported for branch correction cases; **not an assistance request/dispatch workflow**.
- `src/lib/attendance/dynamic-clock-out.ts`: existing RPC-backed clock-out policy incl. home service; integrate only after mapping all consumers and preserving audit trails.
- `src/lib/auth/crm-permissions.ts`: CRM access is broad; assistance approval MUST use a new manager-only server-side policy, not a general CRM role.
- `src/components/features/dashboard/nav-config.ts`: managers currently use the CRM workspace, so design one shared operational surface, not a new disconnected manager app.
- `src/lib/bookings/hold-status.ts`, `src/lib/engine/staff-assignment.ts`, and `src/lib/bookings/bkg3-atomic-contract.ts`: booking holds and assignment safety must be preserved in every write path.

## 3. Read-only database schema observed, 2026-11-05
- `staff_attendance_branch_assignments` has `staff_id`, `home_branch_id`, `branch_id`, `valid_from`, `valid_until`, `status`, `scope`, `approved_at`, `consumed_checkin_id`.
- `staff_shift_checkins` has `home_branch_id`, `branch_id`, check-in/out, `branch_authorization_id`, attendance policy fields and payroll minutes. Its current semantics must be reconciled, not bypassed.
- `bookings` has branch/staff/time/visit type and `staff_schedules` has staff/time/shift windows.
- Two branches exist: Main Spa and SM; SM does not offer Home Service by owner decision.
- Staff types include `therapist`, `nail_tech`, `aesthetician`; preserve actual skills and valid work roles rather than assuming any service staff can perform any procedure.
- Database queries were **SELECT-only**. We did not validate live booking, attendance transfer, or payroll end-to-end behavior.

## 4. Proposed workflow/state machine

`requested -> approved_pending_arrival -> travelling -> active -> completed`
`requested -> declined`
`requested/approved_pending_arrival/travelling -> cancelled`

- A request includes receiving/lending branch, service staff type, quantity, time window, service requirements, optional Main Home Service usage, initiating CSR, and reason.
- Lending manager approves **named** eligible staff in the same branch and within their scheduled shifts; reject if existing appointments (including holds, other branches, home service travel and assistance windows) conflict, or if home branch loses essential coverage.
- At approval reserve only a transfer window; do not expose staff as `available_now` until their actual arrival and attendance state are verified.
- At arrival confirm receiving branch and transition; staff becomes eligible only once the *shared server-side* booking validator and cross-branch reservation checks are integrated.
- After completion expire temporary branch booking eligibility, close/adjust work segment, preserve actual attendance and commission allocation.

### Critical boundary
No production component should call `isAssistanceEffectiveForBooking` until its `serverValidated` parameter is backed by authoritative, transaction-safe database checks. The pure utility is **preparatory only** and deliberately fail-closed by default.

## 5. Required before implementation Stage B/C

**Inspection and decisions to freeze before any SQL write / API / UI publication:**
1. Consumers and writers: all public/CRM/owner booking save paths, holds, staff assignment, booking edits, transfer cancellation, dispatch and payroll queries. Verify atomic cross-branch conflicts at the database level.
2. Relationship design: separate `staff_assistance_requests`, per-staff approved assignments and auditable transitions. Do NOT repurpose `staff_attendance_branch_assignments` or change permanent staff branch to represent borrowing.
3. Permission: CSR only on their requesting branch; manager only on lending branch; owner cross-branch; staff only their own assignment; deny data from unrelated branches.
4. Attendance: existing QR must accept valid receiving branch without generating a second shift; authoritative source of worked minutes and clock-out policy must remain unchanged and auditable.
5. Arrival/traffic: confirm transfer buffer, travel to Main/home customer, timeout, return/early cancellation, and who may correct a missing arrival event.
6. Home Service: Main only; transportation/driver/distance/late booking windows and staff travel buffers checked, with no SM home-service activation.
7. Notification: existing in-app + push targets and dedupe, actionable CSR/manager signals; avoid alert spam and notification/approval races.
8. No fake coverage: scheduled+clocked-in+service-qualified+no booking/travel/hold conflict; do not rely on an unverified front-end `available_now` indicator.
9. Before/after diagnostic evidence of booking availability and attendance; independent review and owner approval before merging each stage.

## 6. Minimal safety acceptance tests (stage A)
- CSR cannot approve; non-lending branch manager cannot approve; lending manager and owner can review.
- Requests have valid offset-aware time windows, distinct branch IDs, and bounded quantity.
- Candidate blocked by scheduled window, unqualified service, inactive status, already-booked work, other assistance, or insufficient sending-branch coverage.
- Approved without arrival is **not** active availability.
- No booking before arrival, after end, or in the wrong branch.
- SM Home Service never activated.
- Completed/cancelled/declined requests cannot be revived.
- Later integration tests: actual multi-branch concurrent booking/hold, attendance same-shift clock-out from receiving QR, payroll not duplicated, dispatch and Home Service Main only, rollback and restart.

## 7. Safe rollout / rollback
- Stage A pure code + tests + evidence only: **no migration, no nav, no active behavior, no production writes**.
- Stage B request/approval records and UI only behind a default-OFF server flag, separate migration reviewed against live schema. No booking or attendance changes yet.
- Stage C shared booking eligibility and transactional no-double-book guard, attendance transfer/clock-out, payroll and dispatch checks. Pilot in controlled environment, deploy only with owner approval.
- Stage D contextual low-coverage hints after measuring baseline with real data.
- On any stage's failure, disable its server flag/revert scoped code; never replay historical migrations to clean local history; preserve historical attendance and payments.

## 8. Evidence / limitations
- Target: Web only. Desktop is **not** authorized by this scope.
- Repo base: `6a381313c3afd31ea936e52850212e3b428154a5`; head SHA to be captured in PR.
- Changed files: this document, pure contract, targeted tests.
- Checks: targeted Vitest, type-check and lint to be run on a real checkout; remote GH editing alone does not execute these.
- Browser/native/database integration/production functional verification: **NOT PERFORMED**.
- Rollback: revert Stage A branch if rejected; no SQL rollback required because database is unchanged.
