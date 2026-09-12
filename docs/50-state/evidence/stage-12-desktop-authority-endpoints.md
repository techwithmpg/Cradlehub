# REPOSITORY-RECORDED PRODUCTION EVIDENCE

## Hosted Stage 12 Phase A — Desktop Authority & Security Completion

### Metadata

- **TARGET**: Stage 12 Phase A — Hosted Authority & Security Completion
- **BRANCH**: `stage/12-desktop-authority-endpoints`
- **BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **PREVIOUS_REVIEW_HEAD**: `d79f33b341868790dd346393e47a1c44bf3f9da5`
- **EVIDENCE_COMMIT**: THIS DOCUMENT IS PART OF THE FINAL CORRECTION COMMIT; FINAL REMOTE HEAD RECORDED IN HANDOFF AFTER PUSH
- **DESKTOP_REFERENCE_SHA**: `683b5c11651c972e6290b6796d01b3b449c105a4`

---

### Exact Changed Files (Stage 12 Phase A)

1. `src/lib/staff/desktop-staff-contract.ts` — Shared contract, actor resolution, strict fail-closed role validation.
2. `src/lib/staff/staff-onboarding-service.ts` — Server-only onboarding approval and rejection service with strict branch authority, prior capability capture, returned-row verified updates, compensating rollback, and concurrency guards.
3. `src/lib/staff/staff-mutation-service.ts` — Server-only profile, role, and deactivation mutation service with server authority and no discarded reason field.
4. `src/lib/bookings/crm-booking-operations.ts` — Combined booking reschedule with full reassignment side effects, truthful audit events, stale notification cleanup, and schedule exception resolution.
5. `src/app/api/desktop/v1/staff/onboarding/[requestId]/approve/route.ts` — Desktop API route for onboarding approval (`POST`).
6. `src/app/api/desktop/v1/staff/onboarding/[requestId]/reject/route.ts` — Desktop API route for onboarding rejection (`POST`).
7. `src/app/api/desktop/v1/staff/[staffId]/route.ts` — Desktop API route for staff profile update (`PATCH`).
8. `src/app/api/desktop/v1/staff/[staffId]/role/route.ts` — Desktop API route for staff role change (`PATCH`).
9. `src/app/api/desktop/v1/staff/[staffId]/deactivate/route.ts` — Desktop API route for staff deactivation (`POST`).
10. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.ts` — Desktop API route for booking reschedule (`POST`).
11. `tests/lib/staff/staff-onboarding-service.test.ts` — Service tests for approval/rejection authority, concurrency, returned-row checks, and compensation.
12. `tests/lib/staff/staff-mutation-service.test.ts` — Service tests for profile, role, and deactivation authority.
13. `src/app/api/desktop/v1/staff/onboarding/route.test.ts` — Route-level tests for onboarding approval & rejection.
14. `src/app/api/desktop/v1/staff/staff-routes.test.ts` — Route-level tests for profile, role, and deactivation.
15. `tests/lib/bookings/reschedule-booking-service.test.ts` — Service-level tests for combined reschedule & reassignment.
16. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts` — Route-level tests for reschedule.
17. `scripts/check-format.mjs` — Updated format baseline commit to Stage 12 base SHA (`ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`).
18. `docs/50-state/evidence/stage-12-desktop-authority-endpoints.md` — Canonical repository evidence record.

---

### The Six Workflow Authority Contracts

1. **Onboarding Approval**: `POST /api/desktop/v1/staff/onboarding/[requestId]/approve`
   - Actor: Resolved server-side from Bearer token.
   - Authority:
     - Owner: May approve applicant into another active branch where canonical owner authority permits it.
     - Non-Owner (manager, assistant_manager, store_manager, crm): Final approved branch MUST equal `actor.branchId`. Cross-branch final approval returns 403 `BRANCH_MISMATCH`.
   - Mutation Flow & Row Verification:
     - Initial Staff Update: Executes `.update(...).eq("id", staffId).select("id").maybeSingle()`. If error or zero rows returned, fails immediately with `SAVE_FAILED` without executing capability replacement.
     - Capability Replacement: Invokes `replace_staff_service_capabilities` RPC. If RPC fails, triggers compensating rollback of the staff row using prior values.
     - Request Finalization: Updates `staff_onboarding_requests` with `.eq("id", requestId).eq("status", "submitted").select("id").maybeSingle()`.
   - Concurrency & Race Handling:
     - If request was concurrently reviewed (`!updatedRequest`), attempts compensating rollback of staff row and capabilities.
     - If compensation succeeds: returns 409 `INVALID_STATE` ("This onboarding request has already been reviewed by another user.").
     - If compensation fails: logs `staff.onboarding.compensation_incomplete_critical` and returns `SAVE_FAILED` ("The onboarding request changed concurrently and rollback could not be fully completed.").
   - Compensation Verifications: Rollback staff write executes `.update(...).eq("id", staffId).select("id").maybeSingle()` with exact prior values (`is_active`, `branch_id`, `system_role`, `staff_type`, `tier`, `nickname`) and verifies returned row; rollback capabilities invokes `replace_staff_service_capabilities` with `priorCapabilityIds`.

2. **Onboarding Rejection**: `POST /api/desktop/v1/staff/onboarding/[requestId]/reject`
   - Method: `POST`
   - Input: `DesktopStaffRejectionSchema` (`rejectionReason`)
   - Actor: Resolved server-side from Bearer token.
   - Authority: Scoped to request's branch for non-owners.
   - Concurrency: Conditional on `id = requestId AND status = 'submitted'`. If 0 rows updated, returns 409 `INVALID_STATE`.

3. **Staff Profile Mutation**: `PATCH /api/desktop/v1/staff/[staffId]`
   - Method: `PATCH`
   - Input: `DesktopStaffProfileUpdateSchema` (`fullName`, `phone`, `email`, `branchId`)
   - Authority: Owner (any branch), Manager / Assistant Manager / Store Manager (same branch only). Target branch mutation is forbidden for non-owners.

4. **Staff Role Mutation**: `PATCH /api/desktop/v1/staff/[staffId]/role`
   - Method: `PATCH`
   - Input: `DesktopStaffRoleUpdateSchema` (`role`)
   - Authority: Owner (can assign any role including owner). Manager (same branch only; cannot assign `owner`, cannot mutate other managers or owners).

5. **Staff Deactivation**: `POST /api/desktop/v1/staff/[staffId]/deactivate`
   - Method: `POST`
   - Input: Empty object `{}`. No unused reason string is accepted or silently discarded.
   - Authority: Owner or Manager (same branch). Cannot deactivate self or owners.

6. **Booking Combined Reschedule**: `POST /api/desktop/v1/bookings/[bookingId]/reschedule`
   - Method: `POST`
   - Input: `DesktopBookingRescheduleSchema` (`bookingDate`, `startTime`, `endTime`, optional `therapistId`, optional `rescheduleReason`)
   - Authority: Owner (any branch if authorized), Manager / Assistant Manager / Store Manager / CRM (strictly booking's branch).
   - Validation: If `therapistId` not supplied, validates existing therapist against proposed schedule. If `therapistId` supplied, validates proposed therapist against proposed schedule (date, start time, end time). Unavailability of old therapist does not block assignment of valid new therapist.
   - Database Write: ONE authoritative bookings UPDATE for the final booking state (`booking_date`, `start_time`, `end_time`, `staff_id` when changed, `metadata`). Consequential actions (audit events, notification resolution/creation, schedule exception signals) are orchestrated at the application level.

---

### Server-Resolved Actor Model & Role Rules

- **Resolution**: All Desktop API endpoints authenticate using `verifyDesktopBearerAuth(request)`. This verifies the Supabase Auth session and resolves the actor's system role and branch from the `staff` database table via `getAuthenticatedStaffFromUser()`.
- **Zero Client Trust**: Actor ID, role, and branch provided in the request body or headers are strictly ignored and never used as authority truth.
- **Fail-Closed Role Verification**: `canonicalizeDesktopStaffRole` strictly validates the normalized role against recognized `SystemRole` values. If unrecognized, it fails closed immediately with 403 `FORBIDDEN` ("Invalid or unrecognized staff system role."). No silent fallback to `staff` role.
- **Server-Only Markers**: Added `import "server-only";` to privileged services (`staff-onboarding-service.ts`, `staff-mutation-service.ts`) ensuring service-role credentials cannot be bundled into client builds.

---

### Database Write Targets & Side Effects

#### Actual Database Targets
- `public.staff`: Updates profile attributes (`full_name`, `phone`, `email`, `branch_id`), `system_role`, and `is_active` (`false` on deactivation, `true` on onboarding approval).
- `public.staff_onboarding_requests`: Updates `status` (`approved` / `rejected`), `reviewed_by`, `reviewed_at`, `rejection_reason`.
- `public.staff_services`: Mutated via RPC `replace_staff_service_capabilities(target_staff_id, service_ids)`.
- `public.bookings`: ONE authoritative update targeting `booking_date`, `start_time`, `end_time`, `staff_id` (if changed), and `metadata`.
- `public.booking_events`: Emits audit event with truthful result (`staff_reassigned` if only staff changed; `rescheduled` if schedule/address changed).
- `public.notifications`: Inserts and resolves notifications.

#### Actual Side Effects Present
- **Notification Cleanup**: When `staffChanged`, calls `resolveNotificationsForEntity("booking", booking.id, "staff", "booking_assigned")` and `resolveNotificationsForEntity("booking", booking.id, "staff", "home_service_assigned")` to clear stale assignment alerts.
- **Previous Therapist**: Emits `booking_reassigned` notification with deduplication key.
- **New Therapist**: Emits canonical `booking_assigned` (or `home_service_assigned` for Home Service). Does not emit misleading `booking_rescheduled`.
- **Driver**: Preserves `booking_rescheduled` notification for paid Home Service trips.
- **Schedule Exception**:
  - If `staffChanged`: Resolves exception as `reassigned_staff` with `previous_staff_id` and `new_staff_id`.
  - If `scheduleChanged` (without staff change): Resolves exception as `rescheduled_booking`.
  - Calls `resolveStaffScheduleExceptionSignals`.
- **Customer Notification**: NONE. No customer notification is implemented or claimed.
- **Cache Invalidation**: Revalidates operational surfaces via `revalidateOperationalBookingSurfaces(booking.branch_id)`.

---

### Application-Level Compensation & Concurrency Protections

- **Rollback Capture**: Before performing any mutation in `approveStaffOnboardingRequest`, the service loads the staff member's prior row values (`is_active`, `branch_id`, `system_role`, `staff_type`, `tier`, `nickname`) and existing capability service IDs from `staff_services`.
- **Returned-Row Verifications**: Both the initial staff update and compensating staff rollback chain `.select("id").maybeSingle()` and verify a row was returned, preventing unhandled zero-row no-ops from masquerading as successes.
- **Unified Helper**: `compensateApprovalMutation` restores the prior staff row and re-executes `replace_staff_service_capabilities` with the captured prior capability IDs.
- **Failure Handling**: Every compensating step is checked. If compensation itself encounters an error or fails to update a row, a high-signal log event `staff.onboarding.compensation_incomplete_critical` is recorded, and `SAVE_FAILED` is returned.
- **Race Condition Guard**: Approval and rejection mutations query with `.eq("id", requestId).eq("status", "submitted")`. If another reviewer approved or rejected concurrently, the row count is 0, compensation executes (for approval), and a 409 `INVALID_STATE` conflict is returned if compensation succeeded, or `SAVE_FAILED` if compensation failed.

---

### Verification & Quality Gate Results

- **Full Test Suite**: 237 test files passed, 1925 tests passed (100% passing).
  - `tests/lib/staff/staff-onboarding-service.test.ts` (15/15 passed)
  - `tests/lib/staff/staff-mutation-service.test.ts` (11/11 passed)
  - `src/app/api/desktop/v1/staff/onboarding/route.test.ts` (7/7 passed)
  - `src/app/api/desktop/v1/staff/staff-routes.test.ts` (8/8 passed)
  - `tests/lib/bookings/reschedule-booking-service.test.ts` (8/8 passed)
  - `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts` (5/5 passed)
- **TypeScript**: `npm run type-check` passed (0 errors).
- **ESLint**: `npm run lint` passed (0 errors, 9 pre-existing studio component warnings).
- **Prettier**: `npm run format:check` passed across 19 incremental files since base SHA `ed8ae75d`.
- **Build**: `npm run build` passed (Next.js 16.2.4 production build).
- **Git Diff**: `git diff --check` clean (0 whitespace/conflict errors).

---

### Database & Schema Impact

- **MIGRATIONS**: NONE.
- **SCHEMA CHANGES**: ZERO.
- Uses existing tables (`staff`, `staff_onboarding_requests`, `bookings`, `booking_events`, `notifications`) and existing RPC (`replace_staff_service_capabilities`).

---

### Desktop Repository Impact

- **DESKTOP REPO**: `E:\Cradle-Destop-Client`
- **IMPACT**: Strictly READ-ONLY / NONE. No files created or modified in Desktop repository.

---

### Deployment Truth

- **REPOSITORY IMPLEMENTED**: YES
- **MERGED**: NO
- **DEPLOYED**: NO / NOT VERIFIED
- **PRODUCTION VERIFIED**: NO
- **DESKTOP PHASE B**: NOT STARTED
