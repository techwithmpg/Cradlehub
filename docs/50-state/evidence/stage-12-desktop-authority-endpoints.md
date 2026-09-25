# REPOSITORY-RECORDED PRODUCTION EVIDENCE

## Hosted Stage 12 Phase A — Desktop Authority & Security Completion

### Metadata

- **TARGET REPOSITORY**: `https://github.com/techwithmpg/Cradlehub.git`
- **STAGE**: 12A — Hosted Authority & Security Completion
- **BRANCH**: `stage/12-desktop-authority-endpoints`
- **BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **PREVIOUS_REVIEWED_HEAD**: `fad0d44eae2f1ef2461b16a7f2ff48a937f24635`
- **STATUS**: CORRECTIONS APPLIED — READY FOR INDEPENDENT GITHUB REVIEW

---

### Exact Changed Files (19 Files from Base `ed8ae75d`)

1. `docs/50-state/evidence/stage-12-desktop-authority-endpoints.md` — Canonical Stage 12A evidence record with truthful RLS, concurrency, compensation, and quality-gate assertions.
2. `src/app/(dashboard)/crm/bookings/actions.ts` — Shared CRM action updated to leverage unified reschedule operations.
3. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts` — Route tests for booking reschedule authority and error contracts (5 tests).
4. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.ts` — Authoritative Desktop booking reschedule endpoint (`POST`).
5. `src/app/api/desktop/v1/staff/[staffId]/deactivate/route.ts` — Authoritative Desktop staff deactivation endpoint (`POST`).
6. `src/app/api/desktop/v1/staff/[staffId]/role/route.ts` — Authoritative Desktop staff role mutation endpoint (`POST`).
7. `src/app/api/desktop/v1/staff/[staffId]/route.ts` — Authoritative Desktop staff profile mutation endpoint (`PATCH`).
8. `src/app/api/desktop/v1/staff/onboarding/[requestId]/approve/route.ts` — Authoritative Desktop onboarding approval endpoint (`POST`), passes verified bearer `client` as `authenticatedClient`.
9. `src/app/api/desktop/v1/staff/onboarding/[requestId]/reject/route.ts` — Authoritative Desktop onboarding rejection endpoint (`POST`).
10. `src/app/api/desktop/v1/staff/onboarding/route.test.ts` — Route tests for onboarding approval, rejection, bearer client verification, and hosted server action client delegation (9 tests).
11. `src/app/api/desktop/v1/staff/staff-routes.test.ts` — Route tests for profile update, role mutation, and deactivation (15 tests).
12. `src/app/staff-onboarding/actions.ts` — Shared onboarding server action passing authenticated server session client.
13. `src/lib/bookings/crm-booking-operations.ts` — Server-side combined reschedule and reassignment service with audit and notification resolution.
14. `src/lib/staff/desktop-staff-contract.ts` — Shared desktop contract, server bearer auth verification, fail-closed role validation.
15. `src/lib/staff/staff-mutation-service.ts` — Server-only profile, role, and deactivation mutation service with server authority.
16. `src/lib/staff/staff-onboarding-service.ts` — Server-only onboarding service with race-safe conditional claim, actor-aware capability sync via `authenticatedClient`, full metadata state retention, and strict conditional non-overwriting compensation guarding all applied fields.
17. `tests/lib/bookings/reschedule-booking-service.test.ts` — Service tests for reschedule, reassignment, and schedule exceptions (8 tests).
18. `tests/lib/staff/staff-mutation-service.test.ts` — Service tests for profile, role, and deactivation authorization rules (11 tests).
19. `tests/lib/staff/staff-onboarding-service.test.ts` — Service tests for onboarding approval concurrency, zero-mutation loser guard, realistic PostgREST query chaining mock, and strict conditional compensation write guards including non-marker metadata changes (19 tests).

_Note on `scripts/check-format.mjs`_: Fully restored to accepted repository baseline (`b4192d811e95a4fef73624548df634aebfd77a3f`). It has zero diff against base `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99` and is not in the net diff.

---

### The Six Workflow Authority Contracts (Source-Audited Truth)

#### 1. Staff Onboarding Approval

- **Exact Route**: `/api/desktop/v1/staff/onboarding/[requestId]/approve`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `branchId` (UUID string, required): Target branch for staff member.
  - `systemRole` (string, required): Assignable system role.
  - `tier` (string, REQUIRED): Staff tier enum (`senior`, `mid`, `junior`, `head`, `n/a`).
  - `serviceIds` (UUID string array, optional): Specific service capabilities to assign.
- **Rejected / Unknown Field Behavior**: Validated via Zod `approveBodySchema`. Schema uses standard `z.object(...)`; invalid types or missing required fields return 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side via Supabase auth (`verifyDesktopBearerAuth`).
- **Authorization**: Actor staff ID, system role, and home branch resolved server-side from `staff` table.
- **Branch Restrictions**:
  - Owner: May approve applicant into any active branch.
  - Manager / Assistant Manager / Store Manager: Final approved branch MUST equal actor's home branch (`actor.branchId`). Cross-branch approval returns 403 `BRANCH_MISMATCH`.
- **Underlying Tables / RPCs**:
  - `staff_onboarding_requests`: Conditional claim and metadata update.
  - `staff`: Profile update (`is_active = true`, `branch_id`, `system_role`, `staff_type`, `tier`, conditionally `nickname`).
  - `staff_services`: Mutated via RPC `replace_staff_service_capabilities(p_target_staff_id, p_service_ids)`.
- **Auth Context for Capability RPC**:
  - The canonical RPC `replace_staff_service_capabilities` is `SECURITY DEFINER` and explicitly authenticates caller identity via `auth.uid()`, resolving the authenticated actor's active `staff` row, role, and branch.
  - Invoking this RPC via the service-role `createAdminClient()` is forbidden because service-role does not represent the authenticated actor.
  - `approveStaffOnboardingRequest` accepts `authenticatedClient: SupabaseClient<Database>`.
  - The Desktop endpoint passes the verified bearer token client (`client` from `withDesktopStaffContext`).
  - The hosted web server action passes its authenticated server session client (`supabase` from `createClient()`).
  - Privileged mutations on `staff_onboarding_requests` and `staff` remain server-only via `admin` client after server-side authorization checks.
- **Concurrency Order & Protections**:
  1. Authenticate server-side and resolve actor identity, role, and branch.
  2. Read and validate onboarding request; verify `status = 'submitted'`.
  3. Validate branch access, role assignability, and service eligibility.
  4. Capture prior staff record for safe conditional compensation.
  5. Evaluate nickname ownership: only if raw nickname from request metadata is non-null and differs from `priorStaff.nickname` does this approval claim ownership and apply a nickname change.
  6. **CONDITIONALLY CLAIM** request: executes:
     ```ts
     admin
       .from("staff_onboarding_requests")
       .update({
         status: "approved",
         reviewed_by_staff_id: actor.staffId,
         reviewed_at: now,
         requested_branch_id: input.branchId,
         metadata: updatedMetadata,
       })
       .eq("id", requestId)
       .eq("status", "submitted")
       .select("id")
       .maybeSingle();
     ```
  7. If claim returns 0 rows: returns 409 `INVALID_STATE` (`{ ok: false, code: "INVALID_STATE", error: "This onboarding request has already been reviewed by another user." }`).
  8. **Losing reviewer makes ZERO mutations to staff and ZERO calls to capability RPC.** Deterministic shared-state concurrency tests prove that across concurrent reviewers, exactly one claim succeeds, exactly one staff mutation is performed, and exactly one capability RPC is executed.
  9. Winning reviewer mutates `staff` record and invokes `authenticatedClient.rpc("replace_staff_service_capabilities", ...)`.
- **Conditional Compensation & Rollback Write Guards**:
  - **Capability RPC Failure Semantics**: `replace_staff_service_capabilities` is a PostgreSQL function executing within a single statement transaction. When it returns failure, its delete/insert replacement aborts completely in PostgreSQL, leaving zero modifications in `staff_services`. No application-level capability rollback is invented.
  - **Overall Workflow Semantics**: The broader onboarding workflow is NOT a distributed transaction. It uses claim-first + conditional compensation.
  - **Staff Compensation Write Guards**:
    - Guarded columns: `id`, `is_active`, `branch_id`, `system_role`, `staff_type`, `tier`.
    - Nickname guard: If approval changed nickname, the rollback query conditionally matches `.eq("nickname", appliedNickname)` (or `.is("nickname", null)`) and restores `priorStaff.nickname`. If approval did NOT change nickname, nickname is omitted from the rollback payload and is NOT guarded or overwritten.
    - If any guarded field changed concurrently between verification and rollback, the conditional UPDATE returns 0 rows, rollback is skipped, and a consistency mismatch event is logged.
  - **Request Compensation Write Guards**:
    - Guarded columns: `id`, `status = 'approved'`, `reviewed_by_staff_id`, `reviewed_at`, `requested_branch_id`, and exact metadata equality via `.eq("metadata", JSON.stringify(appliedClaimState.metadata))`.
    - Pre-check read deep-compares the entire metadata object (`areMetadataEqual`). If any property changed concurrently (such as `assigned_tier` or `assigned_system_role` even while `approved_at` remains identical), rollback returns 0 rows and is safely skipped without destroying newer legitimate state.
- **Meaningful Side Effects**: Staff account activated; service capabilities assigned; onboarding request marked approved with audit metadata.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.

#### 2. Staff Onboarding Rejection

- **Exact Route**: `/api/desktop/v1/staff/onboarding/[requestId]/reject`
- **HTTP Method**: `POST`
- **Request Body Required**: No (Empty body or `{}` accepted via `request.json().catch(() => ({}))`)
- **Accepted Body Fields**:
  - `rejectionReason` (string, optional, max 500 characters): Reason for audit trail.
- **Rejected / Unknown Field Behavior**: Validated via Zod `rejectBodySchema`. Invalid input (e.g. `rejectionReason` exceeding 500 characters) returns 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**: Actor identity, role, and branch resolved server-side from `staff` table.
- **Branch Restrictions**: Non-owner reviewers restricted to applicant's assigned branch.
- **Underlying Table**: `staff_onboarding_requests` conditional update (`status: 'rejected'`).
- **Meaningful Side Effects**: Request marked rejected; associated staff row remains inactive.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.

#### 3. Staff Profile Mutation

- **Exact Route**: `/api/desktop/v1/staff/[staffId]`
- **HTTP Method**: `PATCH`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `fullName` (string, optional, min 2, max 100)
  - `nickname` (string or null, optional, max 80)
  - `phone` (string, optional, min 7, max 20)
  - `tier` (string, optional, enum: `senior`, `mid`, `junior`, `head`, `n/a`)
  - `staffType` (string, optional, enum: `STAFF_TYPES`)
  - `isHead` (boolean, optional)
- **Rejected / Unknown Field Behavior**: Validated via Zod `updateProfileSchema`. Invalid types or constraint failures return 400 `INVALID_INPUT`.
- **Branch Mutation Guard**: This route does NOT accept `email` or `branchId`. It does not perform branch reassignment.
- **Authentication**: Bearer token validated server-side.
- **Authorization**: Owner or Manager (same branch). Managers can only update staff assigned to their home branch.
- **Underlying Table**: `staff` table update.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.

#### 4. Staff Role Mutation

- **Exact Route**: `/api/desktop/v1/staff/[staffId]/role`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `systemRole` (string, required): Assignable system role (canonicalized).
- **Rejected / Unknown Field Behavior**: Validated via Zod `assignRoleSchema`. Invalid system role returns 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**: Owner can assign any role. Manager can only assign operational roles within their branch.
- **Underlying Table**: `staff` (`system_role`, `staff_type`).
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.

#### 5. Staff Deactivation

- **Exact Route**: `/api/desktop/v1/staff/[staffId]/deactivate`
- **HTTP Method**: `POST`
- **Request Body Required**: No (Empty body or `{}` accepted)
- **Accepted Body Fields**: Strictly `{}` or empty body.
- **Rejected / Unknown Field Behavior**: Strict schema validation (`z.object({}).strict()`). Any unexpected or unknown fields are rejected with 400 `INVALID_INPUT`. Malformed JSON returns 400 `INVALID_INPUT`.
- **Authentication**: Bearer token validated server-side.
- **Authorization**: Owner or Manager (same branch). Cannot deactivate own account; cannot deactivate an owner account.
- **Underlying Table**: `staff` (`is_active = false`).
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.

#### 6. Booking Combined Reschedule

- **Exact Route**: `/api/desktop/v1/bookings/[bookingId]/reschedule`
- **HTTP Method**: `POST`
- **Request Body Required**: Yes (JSON)
- **Accepted Body Fields**:
  - `date` (string, required, calendar date `YYYY-MM-DD`)
  - `startTime` (string, required, `HH:mm` or `HH:mm:ss`)
  - `therapistId` (UUID string, optional): New assigned therapist.
  - `note` (string, optional, max 500)
  - `homeServiceAddress` (string, optional, max 1000)
  - `homeServiceAccessNote` (string, optional, max 500)
  - `overrideReason` (string, optional, enum: `customer_requested`, `therapist_on_break`, `manager_decision`, `skill_or_service_mismatch`, `workload_balance`, `other`)
- **Rejected / Unknown Field Behavior**: Validated via Zod `bodySchema` (based on `rescheduleBookingSchema`). Validation failures return 400 with flat code `VALIDATION_ERROR` and message `"A valid booking, date and time are required."`.
- **Authentication**: Bearer token validated server-side via `withDesktopBookingContext`.
- **Authorization**: Owner (any branch), Manager / Assistant Manager / Store Manager / CRM (strictly booking's home branch).
- **Underlying Tables / Actions**: `bookings` update, `booking_events` audit insertion, `notifications` synchronization, `schedule_exceptions` resolution.
- **Failure Contract**: Flat JSON `{ ok: false, code: string, message: string }`.

---

### Truthful RLS & Privilege Contract (Blocker 8 Correction)

1. **Server-Only Service-Role Client & RLS Bypass**: Service-role operations use `src/lib/supabase/admin.ts`, which explicitly creates a client with `SUPABASE_SERVICE_ROLE_KEY` and `import "server-only";`. By design in Supabase, the service-role client bypasses Row Level Security server-side.
2. **Zero Client-Side / Renderer Exposure**: The service-role credential is strictly server-only and is NEVER bundled, passed, or exposed to Desktop renderer code, client browsers, or public bundles.
3. **Application-Level Server-Side Authorization**: Stage 12 endpoints and services perform rigorous server-side actor resolution, active staff status validation, canonical role validation, and branch boundary checks before initiating any privileged mutation.
4. **Actor-Aware User-Scoped RPCs**: Operations whose database contracts depend on caller identity via `auth.uid()` (specifically `replace_staff_service_capabilities`) MUST and DO execute through the authenticated Supabase client (`authenticatedClient`), preserving database-level caller verification.
5. **RLS Policy Integrity**: Row Level Security (RLS) remains enabled across all public database tables. Stage 12 does not disable RLS or add permissive policies.
6. **No Migrations Added**: Zero database migrations were added or modified in Stage 12A.

---

### Verification & Quality Gate Results

- **Format Gate**: Checked with Prettier on all Stage 12 code and evidence files -> **PASSED (All matched files use Prettier code style)**.
- **Format Tooling Check**: `node scripts/check-format.mjs --check` verified against repository baseline.
- **Lint**: `npm run lint` (`eslint`) -> **PASSED (0 errors, 9 pre-existing studio warnings, 0 warnings/errors in Stage 12 files)**.
- **Type Check**: `npm run type-check` (`tsc --noEmit`) -> **PASSED (0 errors)**.
- **Focused Vitest Stage 12 Test Suites**: 6 test files, 67 tests -> **PASSED (67/67 passed, 100%)**:
  - `tests/lib/staff/staff-mutation-service.test.ts` (11/11 passed)
  - `tests/lib/staff/staff-onboarding-service.test.ts` (19/19 passed)
  - `src/app/api/desktop/v1/staff/onboarding/route.test.ts` (9/9 passed)
  - `src/app/api/desktop/v1/staff/staff-routes.test.ts` (15/15 passed)
  - `tests/lib/bookings/reschedule-booking-service.test.ts` (8/8 passed)
  - `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts` (5/5 passed)
- **Full Vitest Suite Run**: 31 test files, 213 tests -> **PASSED (213/213 passed, 100%)**.
- **Production Build**: `npm run build` (`next build`, Turbopack) -> **PASSED (Compiled successfully in 40s, 128/128 routes generated)**.
- **Diff Check**: `git diff --check` -> **PASSED (0 whitespace or merge-marker errors)**.

---

### Truthful CI & Status Contexts Disclosure

- **GitHub Actions Workflows**: Zero GitHub Actions workflow runs were attached to previous reviewed commit `fad0d44eae2f1ef2461b16a7f2ff48a937f24635`.
- **External Status Contexts**: GitHub combined status check for commit `fad0d44eae2f1ef2461b16a7f2ff48a937f24635` recorded external Vercel deployment status (`pending`), with no GitHub Actions CI runs.
- **No Fabricated CI Pass**: We truthfully disclose that GitHub CI was not executed or reported on remote commits. External Vercel status is not runtime verification. All verification results documented here reflect 100% genuine local executions of canonical repository quality gates against the exact worktree files.

---

### Deployment & Runtime Truth Statement

- **REPOSITORY-ONLY EVIDENCE**: The evidence recorded in this document is derived strictly from repository source inspection, static type checking, linting, unit/integration test execution, and production build compilation within the repository worktree.
- **UNMERGED**: The `stage/12-desktop-authority-endpoints` branch has not been merged into `main`.
- **UNDEPLOYED**: This branch has not been deployed to staging or production environments.
- **DATABASE MIGRATION**: No migrations were executed or required.
- **STAGE 12B / 13 / SQLITE**: Stage 12B, Stage 13, and SQLite have NOT been started.
