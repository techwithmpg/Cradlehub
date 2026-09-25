# Stage 12 Evidence: Hosted Desktop Authority & Security Completion

## 1. Revision & Verification Metadata

- **Stage**: 12A — Hosted Authority & Security Completion
- **Branch**: `stage/12-desktop-authority-endpoints`
- **Repository**: `https://github.com/techwithmpg/Cradlehub`
- **BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **HEAD_SHA**: `0a8d0654b4f610c14bda284535f941da2430cc71`
- **HEAD_SHA Meaning**: Stage 12A implementation/test head reviewed by this evidence-only correction.
- **Verification Environment**: Windows local execution environment, Node.js v20.x, Turbopack, Vitest.

---

## 2. CI, Status Contexts & Build Disclosures

- **GitHub Actions Workflows**: **NONE**
  - Query (`gh run list --commit 0a8d0654b4f610c14bda284535f941da2430cc71`) returned 0 workflow runs.
- **External Vercel Preview Status**: **FAILURE**
  - Deployment ID: `dpl_B5bsjnS8nu3UvWDbv9bP58MKsjGP`
  - State: `ERROR`
  - Failure Location: Pre-existing / shared `next/font` Google font build path in `src/app/layout.tsx`.
  - Font: `Cormorant Garamond`
  - Representative Error: `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`.
  - Stage 12A Relation: No Stage 12 diff touches layout, font configuration, `package.json`, lockfile, or Next.js configuration (proven by `git diff ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99 --name-only`).
  - Status Assessment: Recorded as an external/unrelated preview-build limitation; not treated as Stage 12A runtime verification.
- **Local Production Build**: **PASSED**
  - `npm run build` (`next build` with Turbopack) completed successfully with exit code 0, compiling all routes and generating 128 static and dynamic routes.

---

## 3. Quality Gate Results

### Repository Format Gate

- **Command**: `node scripts/check-format.mjs --check`
- **Result**: **FAILED / exit code 1**
- **Stage 12 Modified Files**: **PASS** (0 warnings in `src/lib/staff/staff-onboarding-service.ts`, `tests/lib/staff/staff-onboarding-service.test.ts`, and `docs/50-state/evidence/stage-12-desktop-authority-endpoints.md`).
- **Remaining Failures**: 157 pre-existing / unrelated files outside Stage 12 scope fail formatting across older directories (e.g. `package.json`, `pnpm-workspace.yaml`, `scripts/check-format.mjs`, marketing studio panels, attendance components, customer engines, etc.).
- **Policy Compliance**: Per governance rules, format tooling script was not weakened and unrelated repository files were not reformatted.

### Static Analysis & Type Checking

- **Lint Gate (`npm run lint`)**: **PASSED**
  - 0 errors. 9 pre-existing warnings in unrelated marketing studio views (`src/components/features/marketing/*`).
  - 0 lint errors or warnings in Stage 12 files.
- **Type Check Gate (`npm run type-check`)**: **PASSED**
  - `tsc --noEmit` passed with 0 errors.
- **Diff Check Gate (`git diff --check`)**: **PASSED**
  - 0 whitespace errors, conflict markers, or carriage-return issues.

### Test Execution Gate

- **Focused Stage 12 Vitest Suites**:
  - Command: `npx vitest run tests/lib/staff/staff-onboarding-service.test.ts tests/lib/staff/staff-mutation-service.test.ts src/app/api/desktop/v1/staff/onboarding/route.test.ts src/app/api/desktop/v1/staff/staff-routes.test.ts tests/lib/bookings/reschedule-booking-service.test.ts src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts`
  - Results: **6 test files passed, 68 tests passed, 0 failed (68/68 PASSED)**:
    1. `tests/lib/staff/staff-onboarding-service.test.ts`: 20 passed (includes concurrency winner/loser, compensation guards, read-time metadata race 11b, and write-time TOCTOU race 11c)
    2. `tests/lib/staff/staff-mutation-service.test.ts`: 11 passed (profile, role, deactivation, nickname uniqueness)
    3. `src/app/api/desktop/v1/staff/onboarding/route.test.ts`: 9 passed (desktop onboarding approve/reject routes)
    4. `src/app/api/desktop/v1/staff/staff-routes.test.ts`: 15 passed (staff profile, role, deactivation routes)
    5. `tests/lib/bookings/reschedule-booking-service.test.ts`: 8 passed (CRM reschedule domain engine)
    6. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts`: 5 passed (desktop booking reschedule route)

---

## 4. Endpoints & Workflows Source Truth Audit

### Workflow 1: Onboarding Approval

- **Route Path**: `/api/desktop/v1/staff/onboarding/[requestId]/approve`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes
- **Schema & Exact Fields**:
  - `branchId`: UUID (Required)
  - `systemRole`: `OnboardingSystemRole` (`"admin" | "manager" | "staff"`) (Required)
  - `tier`: `StaffTier` (`"junior" | "senior" | "master"`) (**Required**)
  - `serviceIds`: UUID[] (Optional)
  - Note: Uses standard `z.object({...})` without `.strict()`; unknown properties are not rejected by schema validation.
- **Authorization**:
  - Bearer token authenticated via `authenticateDesktopUser`.
  - Roles allowed: `owner` or `manager`.
  - Branch restriction: Managers must belong to the target `branchId`.
- **Underlying Operation & Execution Order**:
  1. Authenticates caller; establishes actor context (`staffId`, `systemRole`, `branchId`).
  2. Fetches target `staff_onboarding_requests` record to capture prior state and ensure status is `submitted`.
  3. **Claim Step (First Mutation)**: Atomically updates request row to `status = 'approved'`, `reviewed_by_staff_id`, `reviewed_at`, `requested_branch_id`, and writes `approved_at` timestamp into `metadata`. Guarded by conditional `.eq("status", "submitted")`.
  4. **Staff Record Mutation**: Uses admin client to update staff row (`system_role`, `branch_id`, `tier`, `is_active = true`).
  5. **Capability RPC**: Invokes database function `replace_staff_service_capabilities` using the **caller-authenticated Supabase client** (`authenticatedClient`) ensuring RLS enforcement at database level.
  6. **Compensation on Failure**: If staff mutation or capability RPC fails, `compensateApprovalMutation` is triggered.
- **Failure Shape**: `{ ok: false, error: string, code?: string }` (Status 400, 401, 403, 404, or 500).

### Workflow 2: Onboarding Rejection

- **Route Path**: `/api/desktop/v1/staff/onboarding/[requestId]/reject`
- **HTTP Method**: `POST`
- **Request Body Required**: **No** (`request.json().catch(() => ({}))` accepts empty body or `{}`).
- **Schema & Exact Fields**:
  - `rejectionReason`: `z.string().max(500).optional()`
- **Authorization**:
  - Bearer token authenticated.
  - Roles allowed: `owner` or `manager`.
  - Branch restriction: Managers may only reject requests for their branch.
- **Underlying Operation**:
  - Atomically claims and updates request row to `status = 'rejected'`, `reviewed_by_staff_id`, `reviewed_at`, and appends `rejection_reason` to metadata.
  - Guarded by conditional `.eq("status", "submitted")`.
- **Failure Shape**: `{ ok: false, error: string, code?: string }`.

### Workflow 3: Staff Profile Update

- **Route Path**: `/api/desktop/v1/staff/[staffId]`
- **HTTP Method**: `PATCH`
- **Request Body Required**: Yes
- **Schema & Exact Fields**:
  - `fullName`: `z.string().min(1).optional()`
  - `nickname`: `z.string().optional()`
  - `phone`: `z.string().optional()`
  - `tier`: `z.enum(["junior", "senior", "master"]).optional()`
  - `staffType`: `z.enum(["regular", "probationary", "contractor"]).optional()`
  - `isHead`: `z.boolean().optional()`
  - Note: Does **not** accept `email` or `branchId`. This endpoint does **not** perform branch reassignment.
- **Authorization**:
  - Bearer token authenticated.
  - Roles allowed: `owner` or `manager`.
  - Branch restriction: Managers may only update staff in their branch.
- **Underlying Operation**:
  - Validates caller permissions; verifies staff exists in branch.
  - If `nickname` is changed, checks uniqueness across active staff within the branch (excluding current staff ID).
  - Updates profile fields in `staff` table.
- **Failure Shape**: `{ ok: false, error: string, code?: string }`.

### Workflow 4: Staff Role Mutation

- **Route Path**: `/api/desktop/v1/staff/[staffId]/role`
- **HTTP Method**: **`POST`** (not `PATCH`)
- **Request Body Required**: Yes
- **Schema & Exact Fields**:
  - `systemRole`: `z.enum(["owner", "manager", "staff"])` (Field name is **`systemRole`**, not `role`).
- **Authorization**:
  - Strictly restricted to **`owner`** only.
  - Managers and staff are rejected with status 403 / `FORBIDDEN`.
- **Underlying Operation**:
  - Prevents owner self-demotion if caller is the targeted staff member.
  - Updates `system_role` in `staff` table.
- **Failure Shape**: `{ ok: false, error: string, code?: string }`.

### Workflow 5: Staff Deactivation

- **Route Path**: `/api/desktop/v1/staff/[staffId]/deactivate`
- **HTTP Method**: `POST`
- **Request Body Required**: No (accepts empty body or `{}`).
- **Authorization**:
  - Roles allowed: `owner` or `manager`.
  - Branch restriction: Managers may only deactivate staff within their assigned branch.
  - Prevents deactivating self.
- **Underlying Operation**:
  - Sets `is_active = false` in `staff` table.
- **Failure Shape**: `{ ok: false, error: string, code?: string }`.

### Workflow 6: Booking Reschedule

- **Route Path**: `/api/desktop/v1/bookings/[bookingId]/reschedule`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes
- **Schema & Exact Fields** (`rescheduleBookingSchema`):
  - `date`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (Required)
  - `startTime`: `z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)` (Required)
  - `note`: `z.string().max(1000).optional()`
  - `homeServiceAddress`: `z.string().max(500).optional()`
  - `homeServiceAccessNote`: `z.string().max(500).optional()`
  - `therapistId`: `z.string().uuid().optional()`
  - `overrideReason`: `z.enum(["customer_request", "staff_unavailable", "operational_conflict"]).optional()`
  - Note: Does **not** use `bookingDate`, `endTime`, or `rescheduleReason`.
- **Validation Failure Code**: Flat code **`VALIDATION_ERROR`** returned with HTTP status 400.
- **Authorization**:
  - Bearer token authenticated.
  - Roles allowed: `owner`, `manager`, or `staff` (front desk / therapist).
  - Branch restriction: If caller is branch-bound (manager/staff), booking's current branch and new target must match caller's branch.
- **Underlying Operation**:
  - Calls `rescheduleBookingOperation` in `src/lib/bookings/crm-booking-operations.ts`.
  - Performs slot availability verification, scheduling conflict checks, and updates booking timestamps.
- **Failure Shape**: `{ ok: false, error: string, code: string, details?: unknown }`.

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
