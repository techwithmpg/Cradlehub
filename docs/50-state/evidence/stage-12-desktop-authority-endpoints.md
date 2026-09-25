# Stage 12 Evidence: Hosted Desktop Authority & Security Completion

## 1. Revision & Verification Metadata

- **Stage**: 12A — Hosted Authority & Security Completion
- **Branch**: `stage/12-desktop-authority-endpoints`
- **Repository**: `https://github.com/techwithmpg/Cradlehub`
- **BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **IMPLEMENTATION_HEAD_SHA**: `0a8d0654b4f610c14bda284535f941da2430cc71`
- **PRE_EVIDENCE_REVIEW_HEAD**: `98697b165853b649132a2dc25c0b5256b00689ce`
- **Metadata Note**: `PRE_EVIDENCE_REVIEW_HEAD` represents the complete Stage 12A implementation and test suite state immediately prior to this evidence-only reconciliation. The final remote commit SHA for this evidence update is documented externally in the agent completion report.
- **Verification Environment**: Windows execution environment, Node.js v20+, Turbopack, Vitest.

---

## 2. CI, Status Contexts & Build Disclosures

- **GitHub Actions Workflows**: **NONE**
  - Query (`gh run list --commit 98697b165853b649132a2dc25c0b5256b00689ce`) confirmed 0 workflow runs configured or triggered.
- **External Vercel Preview Status**:
  - Current Remote Head (`98697b165853b649132a2dc25c0b5256b00689ce`): **SUCCESS** (Vercel deployment completed successfully).
  - Historical Implementation Head Note (`0a8d0654...`): Deployment `dpl_B5bsjnS8nu3UvWDbv9bP58MKsjGP` failed transiently on shared Google font loading for Cormorant Garamond in `src/app/layout.tsx`. Stage 12 diff verified not touching layout, font configs, or build configurations (`git diff ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99 --name-only`).
  - Runtime Caveat: External Vercel status is recorded for tracking and is not substituted for owner runtime validation.
- **Local Production Build**: **PASSED**
  - `npm run build` (`next build` with Turbopack) completed successfully with exit code 0, generating all 128 dynamic and static routes.

---

## 3. Quality Gate Results

### Repository Format Gate

- **Command**: `node scripts/check-format.mjs --check`
- **Result**: **FAILED / exit code 1**
- **Repository-Wide Debt**: 169 warning files reported across legacy and unrelated directories outside Stage 12 scope (e.g. `src/app/(public)/*`, marketing studio panels, attendance components, customer engines, etc.).
- **Stage 12A Changed Files Intersecting Warnings**: **0 files** (`A ∩ B = 0`).
  - Stage 12A files changed against `BASE_SHA`: 19 files.
  - Intersection with format warnings: 0 files.
  - Therefore Stage 12A introduces no formatting failures.
- **Policy Compliance**: Format script was not modified or weakened.

### Static Analysis & Type Checking

- **Lint Gate (`npm run lint`)**: **PASSED (exit code 0)**
  - 0 errors. 9 pre-existing warnings in unrelated marketing studio components (`src/components/features/marketing/*`).
  - 0 lint errors or warnings in Stage 12 files.
- **Type Check Gate (`npm run type-check`)**: **PASSED (exit code 0)**
  - Clean TypeScript compilation (`tsc --noEmit`).
- **Diff Whitespace Check (`git diff --check`)**: **PASSED (exit code 0)**
  - 0 whitespace errors or conflict markers.

### Focused Test Execution Gate

- **Execution Command**:
  ```bash
  npx vitest run tests/lib/staff/staff-onboarding-service.test.ts tests/lib/staff/staff-mutation-service.test.ts src/app/api/desktop/v1/staff/onboarding/route.test.ts src/app/api/desktop/v1/staff/staff-routes.test.ts tests/lib/bookings/reschedule-booking-service.test.ts src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts
  ```
- **Results**: **6 test files passed, 68 tests passed, 0 failed (68/68 PASSED)**:
  1. `tests/lib/staff/staff-onboarding-service.test.ts`: 20 passed (includes concurrency claim-first locking, caller-authenticated client for capability RPC, conditional rollback guards, read-time metadata race 11b, and write-time TOCTOU race 11c).
  2. `tests/lib/staff/staff-mutation-service.test.ts`: 11 passed (operational role permissions, branch mismatch gating, sensitive role protection, profile updates, role assignment hierarchy, self-escalation protection, digital_marketer managerial adaptation, self-deactivation protection, subordinate soft-deactivation).
  3. `src/app/api/desktop/v1/staff/onboarding/route.test.ts`: 9 passed (desktop onboarding approve and reject route endpoints).
  4. `src/app/api/desktop/v1/staff/staff-routes.test.ts`: 15 passed (desktop staff profile PATCH, role POST, and deactivation POST route endpoints).
  5. `tests/lib/bookings/reschedule-booking-service.test.ts`: 8 passed (CRM reschedule domain engine, timing validation, conflict resolution, exception handling).
  6. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts`: 5 passed (desktop booking reschedule route endpoint, validation handling, branch boundary enforcement, execution).

---

## 4. Workflows & Endpoints Source Truth Audit

### Workflow 1: Onboarding Approval

- **Route Path**: `/api/desktop/v1/staff/onboarding/[requestId]/approve`
- **HTTP Method**: `POST`
- **Authentication & Context**:
  - Managed by `withDesktopStaffContext`, which validates bearer authentication via `verifyDesktopBearerAuth`.
  - Caller role is canonicalized server-side via `canonicalizeSystemRole`.
- **Request Body Required**: Yes
- **Schema & Exact Fields**:
  - `branchId`: required UUID (`z.guid("Invalid branch ID")`)
  - `systemRole`: required string validated against `SYSTEM_ROLES` and canonicalized
    - Real `SYSTEM_ROLES`: `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`, `csr`, `csr_head`, `csr_staff`, `staff`, `service_head`, `service_staff`, `digital_marketer`, `driver`, `utility`.
    - Legacy CSR aliases canonicalize to `crm`.
  - `tier`: **required** enum: `senior | mid | junior | head | n/a` (`z.enum(["senior", "mid", "junior", "head", "n/a"])`)
  - `serviceIds`: optional UUID[] (`z.array(z.guid("Invalid service ID")).optional()`)
  - Defined with standard `z.object({...})` without `.strict()`.
- **Approval Authorization**:
  - Enforced by `canApproveStaffOnboarding`:
    - **Owner**: Full authority to assign any active system role (`OWNER_ASSIGNABLE_SYSTEM_ROLES`).
    - **Manager-Class Roles** (`manager`, `assistant_manager`, `store_manager`): Branch-scoped (target request must match approver's branch); cannot assign sensitive/management roles; restricted to `MANAGER_ASSIGNABLE_SYSTEM_ROLES` (`crm`, `digital_marketer`, `staff`, `service_head`, `service_staff`, `driver`, `utility`).
    - **CRM / Front-Desk Roles** (`crm` and aliases): Branch-scoped (target request must match approver's branch); cannot assign sensitive/management roles; restricted to `CRM_ASSIGNABLE_SYSTEM_ROLES` (`crm`, `staff`, `service_head`, `service_staff`, `driver`, `utility`).
    - **Other Roles**: Forbidden.
- **Execution Order & Operations**:
  1. Authenticates caller; establishes actor context (`withDesktopStaffContext`).
  2. Resolves target request from `staff_onboarding_requests` to verify status is `submitted`.
  3. **Claim First**: Atomically transitions request to `status = 'approved'`, sets `reviewed_by_staff_id`, `reviewed_at`, `requested_branch_id`, and appends `approved_at` into `metadata`. Guarded by conditional `.eq("status", "submitted")`.
  4. Updates `staff` table row with assigned `system_role`, `branch_id`, `tier`, and `is_active = true`.
  5. Invokes `replace_staff_service_capabilities` using the **caller-authenticated Supabase client** (`authenticatedClient`), ensuring PostgreSQL RLS evaluates the caller session.
  6. **Conditional Compensation on Failure**: If staff update or capability RPC fails, `compensateApprovalMutation` restores state only if concurrent writers have not modified the records.
- **HTTP Failure Response Shape**: Produced by `desktopStaffFailure`:
  ```json
  {
    "ok": false,
    "code": "...",
    "message": "..."
  }
  ```

### Workflow 2: Onboarding Rejection

- **Route Path**: `/api/desktop/v1/staff/onboarding/[requestId]/reject`
- **HTTP Method**: `POST`
- **Request Body Required**: **No** (`request.json().catch(() => ({}))` accepts empty body or `{}`).
- **Schema & Exact Fields**:
  - `rejectionReason`: `z.string().max(500, "Rejection reason must be 500 characters or fewer").optional()`
- **Authorization**:
  - Governed by `canReviewStaffOnboarding(actorRole)`:
    - Allows `owner`, `manager`, `assistant_manager`, `store_manager`, and `crm` (including front-desk aliases).
    - Non-owner reviewers are branch-scoped (`request.requested_branch_id === actor.branchId`).
- **Data Writes & Operations**:
  - Writes to `staff_onboarding_requests`:
    - `status = "rejected"`
    - `reviewed_by_staff_id = actor.staffId`
    - `reviewed_at = now`
    - `rejection_reason = input.rejectionReason ?? null` (database column)
    - `metadata` updated with audit timestamps (`rejected_at`, `rejected_by_staff_id`)
  - Guarded by conditional `.eq("status", "submitted")`.
- **HTTP Failure Response Shape**: Produced by `desktopStaffFailure`:
  ```json
  {
    "ok": false,
    "code": "...",
    "message": "..."
  }
  ```

### Workflow 3: Staff Profile Update

- **Route Path**: `/api/desktop/v1/staff/[staffId]`
- **HTTP Method**: `PATCH`
- **Request Body Required**: Yes
- **Schema & Exact Fields**:
  - `fullName`: `z.string().min(2, "Name required").max(100).optional()`
  - `nickname`: optional trimmed string, empty converted to null, nullable, max 80 characters
  - `phone`: `z.string().min(7, "Phone too short").max(20, "Phone too long").optional()`
  - `tier`: `z.enum(["senior", "mid", "junior", "head", "n/a"]).optional()`
  - `staffType`: `z.enum(STAFF_TYPES).optional()`
    - Valid `STAFF_TYPES`: `therapist`, `nail_tech`, `aesthetician`, `csr`, `driver`, `utility`, `salon_head`, `managerial`.
  - `isHead`: `z.boolean().optional()`
  - Explicit Non-Capabilities: Does **not** accept `email` or `branchId`. Does **not** reassign branches.
- **Authorization**:
  - Operational actors allowed in `updateStaffProfileService`: `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`.
  - Non-owner actors:
    - Must belong to the same branch as target staff (`target.branch_id === actor.branchId`).
    - Cannot modify staff with sensitive/management roles (`SENSITIVE_SYSTEM_ROLES` require owner approval).
- **HTTP Failure Response Shape**: Produced by `desktopStaffFailure`:
  ```json
  {
    "ok": false,
    "code": "...",
    "message": "..."
  }
  ```

### Workflow 4: Staff Role Mutation

- **Route Path**: `/api/desktop/v1/staff/[staffId]/role`
- **HTTP Method**: **`POST`** (not `PATCH`)
- **Request Body Required**: Yes
- **Schema & Exact Fields**:
  - `systemRole`: required string validated against `SYSTEM_ROLES` and canonicalized.
- **Authorization & Hierarchy**:
  - Handled by `assignStaffRoleService`.
  - Accepted operational actors: `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`.
  - Hierarchy enforced by `getAssignableSystemRoles(actorRole)`:
    - `owner` -> `OWNER_ASSIGNABLE_SYSTEM_ROLES`
    - Manager-class roles (`manager`, `assistant_manager`, `store_manager`) -> `MANAGER_ASSIGNABLE_SYSTEM_ROLES`
    - `crm` -> `CRM_ASSIGNABLE_SYSTEM_ROLES`
  - Restrictions:
    - Self-escalation / self-role change forbidden if changing own role (`target.id === actor.staffId && nextSystemRole !== canonicalizeSystemRole(actor.systemRole)`).
    - Non-owner actors are branch-scoped (`target.branch_id === actor.branchId`).
    - Non-owner actors cannot modify staff holding sensitive roles (`SENSITIVE_SYSTEM_ROLES`).
- **Side Effects**:
  - Updates `system_role` in `staff` table.
  - If `systemRole === "digital_marketer"`, automatically updates `staff_type = "managerial"`.
- **HTTP Failure Response Shape**: Produced by `desktopStaffFailure`:
  ```json
  {
    "ok": false,
    "code": "...",
    "message": "..."
  }
  ```

### Workflow 5: Staff Deactivation

- **Route Path**: `/api/desktop/v1/staff/[staffId]/deactivate`
- **HTTP Method**: `POST`
- **Request Body Required**: **No** (accepts empty body or `{}`; validated with `z.object({}).strict()`; unknown fields or malformed JSON return 400).
- **Authorization**:
  - Operational actors allowed in `deactivateStaffService`: `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`.
  - Self-deactivation forbidden for all actors (`target.id === actor.staffId`).
  - Non-owner actors: Same branch only (`target.branch_id === actor.branchId`); cannot deactivate staff with sensitive roles.
- **Side Effects**:
  - Sets `is_active = false` in `staff` table without deleting the row.
  - Revalidates paths and invalidates workspace cache tags.
- **HTTP Failure Response Shape**: Produced by `desktopStaffFailure`:
  ```json
  {
    "ok": false,
    "code": "...",
    "message": "..."
  }
  ```

### Workflow 6: Booking Reschedule

- **Route Path**: `/api/desktop/v1/bookings/[bookingId]/reschedule`
- **HTTP Method**: `POST`
- **Authentication & Context**:
  - Managed by `withDesktopBookingContext`, verifying bearer auth via `verifyDesktopBearerAuth`.
  - Requires active staff profile with a branch assignment.
  - Enforces `allowOwnerCrossBranch: false` (no unrestricted cross-branch authority in Desktop client context).
- **Request Body Required**: Yes
- **Schema & Exact Fields** (`rescheduleBookingSchema.omit({ bookingId: true })`):
  - `date`: required calendar date string (`YYYY-MM-DD`, validated via `isValidCalendarDate`)
  - `startTime`: required time string (`HH:mm` or `HH:mm:ss`, validated via regex `/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/`)
  - `note`: optional string, maximum 500 characters
  - `homeServiceAddress`: optional string, maximum 1000 characters
  - `homeServiceAccessNote`: optional string, maximum 500 characters
  - `therapistId`: optional UUID (`z.guid("Invalid therapist ID").optional()`)
  - `overrideReason`: optional enum with exact values:
    - `customer_requested`
    - `therapist_on_break`
    - `manager_decision`
    - `skill_or_service_mismatch`
    - `workload_balance`
    - `other`
- **Validation Failure Code**: Route returns flat code **`VALIDATION_ERROR`** with HTTP status 400 and message `"A valid booking, date and time are required."` if route parameters or body fail schema validation.
- **Authorization**:
  - Enforced by `canAccessCrmWorkspace(ctx.me.system_role)` (`owner`, `manager`, `assistant_manager`, `store_manager`, `crm`, and front-desk aliases).
  - Target booking branch must match caller branch (`checkDesktopBooking` / `loadCrmBookingForAction`).
  - Therapist reassignment requires `canReassignBooking(ctx.me.system_role)`.
- **Underlying Service Function**:
  - `rescheduleBooking(ctx, { ...body.data, bookingId })` in `src/lib/bookings/crm-booking-operations.ts`.
- **Side Effects**:
  - Rejects rescheduling for closed (`completed`, `cancelled`, `no_show`) or in-progress bookings.
  - Calculates new `end_time` server-side via `computeEndTime`.
  - Verifies candidate therapist qualifications and availability.
  - Verifies room/resource availability for in-branch bookings.
  - Updates `booking_date`, `start_time`, `end_time`, and optional `staff_id` in `bookings` table.
  - Updates `metadata` with reschedule history (`withRescheduleMetadata`), assignment audit if therapist changed, and resolves open schedule exceptions (`resolveStaffScheduleExceptionMetadata`).
- **HTTP Failure Response Shape**: Produced by `desktopFailure` via `bookingOperationResponse`:
  ```json
  {
    "ok": false,
    "code": "...",
    "message": "..."
  }
  ```

---

## 5. Compensation & Rollback Concurrency Protection

### Deep JSONB Metadata Protection

When compensating an onboarding approval failure:

1. **Pre-check**: Compares current database metadata against `appliedClaimState.metadata` using deep recursive equality (`areMetadataEqual`).
2. **Conditional UPDATE**: Rollback update query enforces exact JSONB equality:
   ```ts
   .eq("id", requestId)
   .eq("status", "approved")
   .eq("reviewed_by_staff_id", appliedClaimState.reviewed_by_staff_id)
   .eq("reviewed_at", appliedClaimState.reviewed_at)
   .eq("requested_branch_id", appliedClaimState.requested_branch_id)
   .eq("metadata", JSON.stringify(appliedClaimState.metadata))
   ```
   If ANY property in metadata was changed post-claim (e.g. `assigned_tier`, `assigned_system_role`), the rollback update matches zero rows.

### Concurrency & Race Tests

- **Read-Time Race (Test 11b)**:
  - Scenario: `reviewed_at`, `requested_branch_id`, and `approved_at` remain identical, but another writer modified `assigned_tier` before pre-check.
  - Outcome: Pre-check detects mismatch; rollback update is skipped; newer metadata survives; mismatch logged.
- **Write-Time TOCTOU Race (Test 11c)**:
  - Scenario: Pre-check reads metadata matching applied claim state. Another writer modifies metadata before rollback UPDATE executes.
  - Outcome: Conditional UPDATE executes with `.eq("metadata", ...)` and matches 0 rows (`revertedReq === null`).
  - Request is **not** considered restored; compensation fails safely; `staff.onboarding.compensation_request_concurrent_conflict` is logged; newer concurrent metadata is not overwritten.
