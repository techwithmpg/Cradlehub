# REPOSITORY-RECORDED PRODUCTION EVIDENCE

## Hosted Stage 12 Phase A — Desktop Authority & Security Completion

### Metadata

- **TARGET REPOSITORY**: `https://github.com/techwithmpg/Cradlehub.git`
- **STAGE**: 12A — Hosted Authority & Security Completion
- **BRANCH**: `stage/12-desktop-authority-endpoints`
- **BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **PREVIOUS_REMOTE_HEAD**: `a0198dbd711bb1eb4624a40fa7ef419703a28db6`
- **DESKTOP_REFERENCE_SHA**: `683b5c11651c972e6290b6796d01b3b449c105a4`
- **STATUS**: CORRECTIONS APPLIED — READY FOR INDEPENDENT GITHUB REVIEW

---

### Exact Changed Files (19 Files from Base `ed8ae75d`)

1. `docs/50-state/evidence/stage-12-desktop-authority-endpoints.md` — Canonical Stage 12A evidence record.
2. `src/app/(dashboard)/crm/bookings/actions.ts` — Shared CRM action updated to leverage unified reschedule operations.
3. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts` — Route tests for booking reschedule authority and error contracts.
4. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.ts` — Authoritative Desktop booking reschedule endpoint (`POST`).
5. `src/app/api/desktop/v1/staff/[staffId]/deactivate/route.ts` — Authoritative Desktop staff deactivation endpoint (`POST`).
6. `src/app/api/desktop/v1/staff/[staffId]/role/route.ts` — Authoritative Desktop staff role mutation endpoint (`PATCH`).
7. `src/app/api/desktop/v1/staff/[staffId]/route.ts` — Authoritative Desktop staff profile mutation endpoint (`PATCH`).
8. `src/app/api/desktop/v1/staff/onboarding/[requestId]/approve/route.ts` — Authoritative Desktop onboarding approval endpoint (`POST`).
9. `src/app/api/desktop/v1/staff/onboarding/[requestId]/reject/route.ts` — Authoritative Desktop onboarding rejection endpoint (`POST`).
10. `src/app/api/desktop/v1/staff/onboarding/route.test.ts` — Route tests for onboarding approval and rejection.
11. `src/app/api/desktop/v1/staff/staff-routes.test.ts` — Route tests for profile update, role mutation, and deactivation.
12. `src/app/staff-onboarding/actions.ts` — Shared onboarding server action updated to call onboarding service.
13. `src/lib/bookings/crm-booking-operations.ts` — Server-side combined reschedule and reassignment service with audit and notification resolution.
14. `src/lib/staff/desktop-staff-contract.ts` — Shared desktop contract, server bearer auth verification, fail-closed role validation.
15. `src/lib/staff/staff-mutation-service.ts` — Server-only profile, role, and deactivation mutation service with server authority.
16. `src/lib/staff/staff-onboarding-service.ts` — Server-only onboarding service with race-safe conditional claim and non-overwriting compensation.
17. `tests/lib/bookings/reschedule-booking-service.test.ts` — Service tests for reschedule, reassignment, and schedule exceptions.
18. `tests/lib/staff/staff-mutation-service.test.ts` — Service tests for profile, role, and deactivation authorization rules.
19. `tests/lib/staff/staff-onboarding-service.test.ts` — Service tests for onboarding approval concurrency, zero-mutation loser guard, and compensation safety.

*Note on `scripts/check-format.mjs`*: Fully restored to accepted repository baseline (`b4192d811e95a4fef73624548df634aebfd77a3f`). It has zero diff against base `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99` and is not in the net diff.

---

### The Six Workflow Authority Contracts

#### 1. Staff Onboarding Approval
- **Exact Route**: `/api/desktop/v1/staff/onboarding/[requestId]/approve`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `branchId` (UUID string, required): Target branch for staff member.
  - `systemRole` (string, required): Assignable system role.
  - `tier` (string, optional): Staff tier (`junior`, `senior`, etc.).
  - `serviceIds` (string array, optional): Specific service capabilities to assign.
- **Rejected / Unknown Field Behavior**: Validated via Zod `DesktopStaffApprovalSchema`. Unknown fields are stripped/ignored by schema, but invalid types or missing required fields return 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side via Supabase auth (`verifyDesktopBearerAuth`).
- **Authorization**: Actor staff ID, system role, and home branch resolved server-side from `staff` table.
- **Branch Restrictions**:
  - Owner: May approve applicant into any active branch.
  - Manager / Assistant Manager / Store Manager: Final approved branch MUST equal actor's home branch (`actor.branchId`). Cross-branch approval returns 403 `BRANCH_MISMATCH`.
- **Underlying Tables / RPCs**:
  - `staff_onboarding_requests`: Conditional claim and metadata update.
  - `staff`: Profile update (`is_active = true`, `branch_id`, `system_role`, `staff_type`, `tier`, `nickname`).
  - `staff_services`: Mutated via RPC `replace_staff_service_capabilities(p_target_staff_id, p_service_ids)`.
- **Concurrency Order & Protections**:
  1. Authenticate server-side and resolve actor identity, role, and branch.
  2. Read and validate onboarding request; verify `status = 'submitted'`.
  3. Validate branch access, role assignability, and service eligibility.
  4. Capture prior staff record and prior capabilities for safe conditional compensation.
  5. **CONDITIONALLY CLAIM** request: executes `.update({ status: 'approved', reviewed_by_staff_id, reviewed_at, ... }).eq('id', requestId).eq('status', 'submitted').select('id').maybeSingle()`.
  6. If claim returns 0 rows: returns 409 `INVALID_STATE` (`{ ok: false, code: 'INVALID_STATE', message: 'This onboarding request has already been reviewed by another user.' }`). **Losing reviewer makes ZERO mutations to staff and ZERO mutations to capabilities.**
  7. Only winning reviewer mutates `staff` record and calls `replace_staff_service_capabilities`.
- **Compensation Behavior**:
  - If staff mutation fails: conditionally compensates onboarding request back to `submitted` (`revertRequest: true`).
  - If capability RPC fails: conditionally compensates staff record to prior state AND onboarding request to `submitted`.
  - **Non-Overwrite Safety**: Every compensation step checks that the database row still matches the applied state before reverting. If a newer legitimate change occurred in the interim, rollback is skipped to prevent overwriting newer valid data.
- **Meaningful Side Effects**: Staff account activated; service capabilities assigned; onboarding request marked approved with audit metadata.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.
- **Limitations**: No distributed ACID transaction across REST/RPC calls. Application-level conditional compensation is used to recover from partial failures.

#### 2. Staff Onboarding Rejection
- **Exact Route**: `/api/desktop/v1/staff/onboarding/[requestId]/reject`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `rejectionReason` (string, required, min 1 char): Justification for rejection.
- **Rejected / Unknown Field Behavior**: Validated via Zod `DesktopStaffRejectionSchema`. Invalid types or missing fields return 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**: Scoped to request's requested branch for non-owners.
- **Concurrency**: Conditional on `id = requestId AND status = 'submitted'`. If 0 rows updated, returns 409 `INVALID_STATE`.
- **Underlying Table**: `staff_onboarding_requests` (`status = 'rejected'`, `reviewed_by_staff_id`, `reviewed_at`, `rejection_reason`).
- **Meaningful Side Effects**: Request marked rejected; associated staff row remains inactive.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.
- **Limitations**: Single table write; no compensation needed.

#### 3. Staff Profile Mutation
- **Exact Route**: `/api/desktop/v1/staff/[staffId]`
- **HTTP Method**: `PATCH`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `fullName` (string, optional)
  - `phone` (string, optional)
  - `email` (string, optional)
  - `branchId` (string, optional, UUID)
- **Rejected / Unknown Field Behavior**: Validated via Zod `DesktopStaffProfileUpdateSchema`. Invalid types return 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**:
  - Owner: May update staff in any branch and can reassign branch.
  - Manager / Assistant Manager / Store Manager: May only update staff in their own branch. Branch reassignment by non-owner is forbidden (returns 403 `FORBIDDEN`).
- **Underlying Table**: `staff` table update.
- **Meaningful Side Effects**: Updates staff personal details or branch assignment.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.
- **Limitations**: Single table update.

#### 4. Staff Role Mutation
- **Exact Route**: `/api/desktop/v1/staff/[staffId]/role`
- **HTTP Method**: `PATCH`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `role` (string, required): New system role.
- **Rejected / Unknown Field Behavior**: Validated via Zod `DesktopStaffRoleUpdateSchema`. Invalid role returns 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**:
  - Owner: Can assign any system role (including owner).
  - Manager: Can only assign operational roles within their branch. Cannot assign `owner`, cannot mutate other managers or owners. Self-role change forbidden.
- **Underlying Table**: `staff` (`system_role`, `staff_type`).
- **Meaningful Side Effects**: Changes staff system access and privileges.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.
- **Limitations**: Single table update.

#### 5. Staff Deactivation
- **Exact Route**: `/api/desktop/v1/staff/[staffId]/deactivate`
- **HTTP Method**: `POST`
- **Request Body Required**: No (Empty body or `{}` accepted)
- **Accepted Body Fields**: Exactly `{}` or empty body.
- **Rejected / Unknown Field Behavior**: **Strict schema validation (`z.object({}).strict()`).** Any unknown fields (such as `{ "reason": "test" }`, `{ "staffId": "..." }`, `{ "foo": "bar" }`) are strictly rejected with 400 `INVALID_INPUT`. Malformed JSON returns 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**:
  - Owner or Manager (same branch).
  - Cannot deactivate own account (returns 403 `FORBIDDEN`).
  - Cannot deactivate an owner account (returns 403 `FORBIDDEN`).
- **Underlying Table**: `staff` (`is_active = false`).
- **Meaningful Side Effects**: Deactivates staff member, preventing further scheduling and login.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.
- **Limitations**: Single table update.

#### 6. Booking Combined Reschedule
- **Exact Route**: `/api/desktop/v1/bookings/[bookingId]/reschedule`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `bookingDate` (string, required, YYYY-MM-DD)
  - `startTime` (string, required, HH:mm:ss or HH:mm)
  - `endTime` (string, required, HH:mm:ss or HH:mm)
  - `therapistId` (string, optional, UUID): New assigned therapist.
  - `rescheduleReason` (string, optional): Reason for audit trail.
- **Rejected / Unknown Field Behavior**: Validated via Zod `DesktopBookingRescheduleSchema`. Invalid time/date or extra fields return 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**:
  - Owner: Any branch.
  - Manager / Assistant Manager / Store Manager / CRM: Strictly booking's home branch (`booking.branch_id === actor.branchId`).
- **Validation**:
  - Validates booking status allows rescheduling (fails closed on completed/cancelled).
  - If `therapistId` omitted: validates existing therapist availability against proposed schedule.
  - If `therapistId` supplied: validates proposed therapist availability against proposed schedule. Prior therapist unavailability does not block reassignment to available therapist.
- **Underlying Tables / Actions**:
  - `bookings`: ONE authoritative update targeting `booking_date`, `start_time`, `end_time`, `staff_id` (if changed), and `metadata`.
  - `booking_events`: Emits audit event (`rescheduled` or `staff_reassigned`).
  - `notifications`: Cleans up stale assignment notifications; inserts new assignment/reassignment notification.
  - `schedule_exceptions`: Resolves schedule exceptions via `resolveStaffScheduleExceptionSignals`.
- **Meaningful Side Effects**: Updates schedule and therapist; resolves stale alerts; emits audit events; revalidates operational cache tags.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.
- **Limitations**: Application-level orchestration across booking, audit events, and notifications.

---

### Verification & Quality Gate Results (Final HEAD)

- **TypeScript**: `npm run type-check` (`tsc --noEmit`) -> **PASSED (0 errors)**.
- **ESLint**: `npm run lint` (`eslint`) -> **PASSED (0 errors, 9 pre-existing studio warnings)**.
- **Vitest Stage 12 Test Suites**: 6 test files, 61 tests -> **PASSED (61/61 passed, 100%)**:
  - `tests/lib/staff/staff-mutation-service.test.ts` (11/11 passed)
  - `tests/lib/staff/staff-onboarding-service.test.ts` (15/15 passed)
  - `src/app/api/desktop/v1/staff/onboarding/route.test.ts` (7/7 passed)
  - `src/app/api/desktop/v1/staff/staff-routes.test.ts` (15/15 passed)
  - `tests/lib/bookings/reschedule-booking-service.test.ts` (8/8 passed)
  - `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts` (5/5 passed)
- **Prettier Format Check**: All 18 Stage 12 code files verified with `npx prettier --check` -> **PASSED (All matched files use Prettier code style)**.
- **Build**: `npm run build` (`next build`, Turbopack) -> **PASSED (Compiled successfully in 42s, 128/128 pages optimized)**.
- **Format Tooling Integrity**: `scripts/check-format.mjs` restored to baseline commit `b4192d811e95a4fef73624548df634aebfd77a3f`. Quality gates not weakened.

---

### Security & Production Safety Check

- **NO SERVICE-ROLE IN CLIENT**: Verified. Privileged services include `import 'server-only';`. No service role credentials in client bundle.
- **NO CREDENTIAL LEAKS**: Zero database passwords, signing secrets, or private keys exposed in source or commits.
- **ZERO CLIENT TRUST**: All roles, actor IDs, and branch authorities are resolved from the database via server-side session authentication. Client-supplied role/branch headers or payload fields are ignored for authorization.
- **FAIL-CLOSED ACCESS**: Role canonicalization strictly validates against canonical `SystemRole` enum. Unrecognized roles fail closed with 403 `FORBIDDEN`.
- **NO RLS BYPASS / HIDDEN SCHEMA CHANGES**: Zero database migrations added. Existing database tables and RPCs are reused as-is.
- **DORMANT MODULE PROTECTION**: Completely untouched. Zero files modified in Owner, Payments, Finance, Reports, Reconciliation, Payroll, or Marketing.

---

### Deployment & Runtime Truth Statement

- **REPOSITORY-ONLY EVIDENCE**: The evidence recorded in this document is derived strictly from repository source inspection, static type checking, linting, unit/integration test execution, and production build compilation within the repository worktree.
- **UNMERGED**: The `stage/12-desktop-authority-endpoints` branch has not been merged into `main`.
- **UNDEPLOYED**: This branch has not been deployed to staging or production environments.
- **DATABASE MIGRATION**: No migrations were executed or required.
- **STAGE 12B / 13**: Stage 12B and Stage 13 have NOT been started.
