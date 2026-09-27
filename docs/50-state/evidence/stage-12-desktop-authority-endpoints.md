# Stage 12 Evidence: Hosted Desktop Authority & Security Completion

## 1. Revision & Verification Metadata

- **Stage**: 12A — Hosted Authority & Security Completion
- **Branch**: `stage/12-desktop-authority-endpoints`
- **Repository**: `https://github.com/techwithmpg/Cradlehub`
- **BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **IMPLEMENTATION_HEAD_SHA**: `0a8d0654b4f610c14bda284535f941da2430cc71`
- **PRE_EVIDENCE_REVIEW_HEAD**: `98697b165853b649132a2dc25c0b5256b00689ce`
- **Metadata Note**: `BASE_SHA`, `IMPLEMENTATION_HEAD_SHA`, and `PRE_EVIDENCE_REVIEW_HEAD` are stable revision anchors. `PRE_EVIDENCE_REVIEW_HEAD` identifies the implementation and test suite state reviewed before evidence corrections. The final evidence-only commit SHA and its external GitHub Actions/Vercel statuses are queried and reported in the completion report after push; they are not self-encoded as a current revision or status in this canonical evidence file.
- **Verification Environment**: Windows execution environment, Node.js v20+, Turbopack, Vitest.

---

## 2. CI, Status Contexts & Build Disclosures

- **GitHub Actions at PRE_EVIDENCE_REVIEW_HEAD**: **NO WORKFLOW RUNS OBSERVED**
  - Query (`gh run list --commit 98697b165853b649132a2dc25c0b5256b00689ce`) returned 0 workflow runs for that revision.
- **Historical External Vercel Preview Observations**:
  - `PRE_EVIDENCE_REVIEW_HEAD` (`98697b165853b649132a2dc25c0b5256b00689ce`): **SUCCESS** was recorded for that revision (Vercel deployment completed successfully).
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
  6. `src/app/api/desktop/v1/bookings/[bookingId]/reschedule/route.test.ts`: 5 passed (unauthenticated request -> 401; invalid booking UUID -> 400; missing date/startTime -> 400; successful delegation including optional therapist reassignment; conflict mapping -> 409).

- **Booking Route Test Coverage Limit**: This specific route test file mocks `rescheduleBooking` and does not explicitly test branch authority. Branch restrictions described in Workflow 6 are production source behavior, not coverage proved by these five route tests. The results above are previously recorded Stage 12A results; implementation/tests were not rerun for this evidence-only correction.

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
  5. Invokes `replace_staff_service_capabilities` using the **caller-authenticated Supabase client** (`authenticatedClient`) so `auth.uid()` represents the real authenticated reviewer. This `SECURITY DEFINER` RPC performs its own internal authorization using `auth.uid()` and server-resolved actor, role, branch, target staff, target role, target active state, and requested services. This is internal RPC authorization rather than ordinary table RLS evaluation of the replacement operation. Service-role remains server-only and is not used for this actor-aware approval capability call. Source: `src/lib/staff/staff-onboarding-service.ts` and `supabase/migrations/20260806132402_service_catalog_unification_repair.sql`.
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

---

## 6. Current-Main Reconciliation

- **ORIGINAL_STAGE12_BASE_SHA**: `ed8ae75d2d6fc9f3b8144dcabbe014f676e83a99`
- **ACCEPTED_PRE_RECONCILIATION_HEAD**: `7a34a35f3da2819bd8db77766dc312007383d21a`
- **CURRENT_MAIN_RECONCILIATION_SHA**: `f8977cce5c1286402eed2e6805ba0428c38dc660`
- **LOCAL_MERGE_HEAD_BEFORE_SEMANTIC_CORRECTION**: `2409a22ae0cb9a8e09f8e34e371975413115b314`
- **Status**: Current-main reconciliation and the auth-first semantic correction are prepared for independent review. Stage 12A-scoped code/test/type/lint/format/whitespace gates pass. The owner explicitly accepted the local production build as ENVIRONMENT BLOCKED — NOT A STAGE 12A IMPLEMENTATION FAILURE for finalizing this reconciliation branch only; this is not a release-certification waiver or a build PASS.
- **Merge Inspection**: A normal merge of `origin/main` into the same Stage 12A branch produced no textual conflicts. The sole overlapping file was `src/lib/bookings/crm-booking-operations.ts`. Main's service-start resource argument and utility-turnover completion/repair behavior were preserved alongside Stage 12A's reschedule/reassignment behavior. Main's authentication/workspace/proxy boundaries, booking time normalization, notification routing, staff operational roles, and public onboarding route changes were inspected; the final worktree comparison to main contains only the Stage 12A scope and evidence.
- **Semantic Conflict and Explicit Resolution**: Current hosted main intentionally authenticates protected CRM booking Server Actions before operation-specific input validation. Stage 12A's additional pre-auth booking-ID validation in `markBookingConfirmedAction` was unnecessary for the Desktop endpoint work and failed the preserved current-main regression. The owner explicitly authorized preserving current-main authentication-first ordering. The redundant early validation was removed without adding a replacement Server Action validation layer. `getCrmActionsContext()` resolves the authorized actor first; `confirmCrmBooking` continues to own authoritative booking input validation. The action now matches current main exactly, and `tests/app/crm/booking-actions.test.ts` remains unchanged.
- **Security Impact**: Authentication/authorization remains fail-closed; booking existence, branch, or validation details are not substitutes for authenticating the caller. This is semantic reconciliation, not a product feature. Accepted Desktop endpoints, optional therapist reassignment, branch restrictions, server-computed end time, qualification/availability/resource checks, audit/metadata/notifications, and flat Desktop failures remain intact. Staff services and endpoints retain claim-first approval, conditional compensation including exact metadata write-race guards, role hierarchy, sensitive-role/self-change protections, branch scoping, rejection authority, and soft deactivation. Capability replacement still uses the caller-authenticated client so `auth.uid()` represents the reviewer; the `SECURITY DEFINER` RPC performs internal authorization. Service-role remains server-only and is not substituted for this actor-aware call.

### Fresh Local Verification

Environment: Windows, canonical Node.js `v24.14.0` and pnpm `10.33.2`. The official Node archive SHA256 was verified. Frozen-lockfile dependencies were retained; no package manifest, `.node-version`, lockfile, or repository formatting rules changed.

| Check                                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run tests/app/crm/booking-actions.test.ts`                                                                                     | PASS: 11/11; current-main authentication-before-validation regression remains unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pnpm exec vitest run` with the six Stage 12A focused files listed in Section 3                                                                  | PASS: 6 files, 68/68 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm type-check`                                                                                                                                | PASS, exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm lint`                                                                                                                                      | FAIL, inherited current-main baseline: exit 1, 88 errors and 26 warnings. All 12 error-bearing files are unchanged relative to `origin/main`; lint configuration and dependency files also match main. No unrelated lint cleanup was performed.                                                                                                                                                                                                                                                                           |
| Stage 12A scoped ESLint: `node node_modules/eslint/bin/eslint.js` with the safely generated Git file list                                        | PASS, exit 0: 18 lintable files, 0 errors, 0 warnings. The list is the union of `git diff origin/main...HEAD --name-only` and `git diff --name-only`, filtered to `.js`, `.jsx`, `.ts`, `.tsx`, including the pending auth-first correction.                                                                                                                                                                                                                                                                              |
| `pnpm format:check` after temporary local LF normalization                                                                                       | Repository gate FAIL, exit 1: 576 warning files remain outside Stage 12A. A = warning files; B = 17 changed code files in the resulting worktree comparison to `origin/main`; A intersect B = 0.                                                                                                                                                                                                                                                                                                                          |
| Scoped Prettier using the repository's unchanged LF rule: `node node_modules/prettier/bin/prettier.cjs --check` with the 17 Stage 12A code paths | PASS: no genuine Stage 12A formatting defect after the authorized local LF checkout correction.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Evidence Prettier check                                                                                                                          | PASS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Local production build                                                                                                                           | ENVIRONMENT BLOCKED / NOT EXECUTED TO COMPLETION. Existing server-only Supabase admin infrastructure in `src/lib/supabase/admin.ts` requires `SUPABASE_SERVICE_ROLE_KEY`, absent from the isolated local verification environment. No full build was rerun under the final authorization. The earlier attempt compiled and completed TypeScript, then failed prerendering with missing Supabase configuration. No evidence of a Stage 12A source/build defect was identified; no reconciled-branch build PASS is claimed. |
| `git diff --check`                                                                                                                               | PASS, exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

- **LF/CRLF Handling**: The owner authorized LF normalization solely for local verification. The affected unedited files retained identical Git blobs. Because Git status showed checkout-only modifications, those temporary line-ending changes were restored after format verification; only the two intentional correction files remain modified. No `.gitattributes`, `git add --renormalize`, formatter-script change, line-ending-only commit, or unrelated formatting cleanup occurred. The zero-intersection format result describes the observed temporary LF verification state, not a claim that the restored Windows checkout is permanently LF.
- **Build Environment and Credential Boundary**: Presence-only checks found the required privileged `SUPABASE_SERVICE_ROLE_KEY` absent from the isolated environment. No privileged credential was retrieved, copied, logged, committed, injected, or substituted with a public key. No application code was weakened to satisfy build configuration. A public-key-only build attempt authorized in an intermediate instruction was interrupted while awaiting hidden input, before any configuration was supplied or build started; that waiting process was canceled under the final instruction. No environment files were written, and process checks confirmed the temporary public variables remained absent.
- **Current-Main Hosted Environment Observation**: The owner supplied an independent observation that hosted main at `f8977cce5c1286402eed2e6805ba0428c38dc660` has a READY Vercel deployment. This is baseline environment evidence supplied by independent review, not an agent-observed runtime outcome and not proof that the reconciled Stage 12A branch itself built or deployed.
- **Correction Files and Final Scope**: The semantic/evidence correction is limited to `src/app/(dashboard)/crm/bookings/actions.ts` and this evidence file. The booking action matches current main exactly, so the final Stage 12A comparison to the reconciliation main contains 18 authority endpoint/service/test/evidence files. No line-ending-only changes are retained.
- **Data/Scope Impact**: No new database, schema, migration, Auth, or policy changes were authored or applied. Existing main migrations were carried through the merge without alteration or execution. No production-data access/mutation, desktop repository changes, SQLite/cache work, or unrelated cleanup occurred.
- **Limitations and Push Decision**: These are local test/source/verification observations, not production runtime evidence. No live Desktop, hosted runtime, database, or deployment verification was performed by this agent. The owner explicitly waived completion of the full local production build only for finalizing this Stage 12A reconciliation and authorized committing/pushing the same stage branch after the final scoped gates pass. The build remains ENVIRONMENT BLOCKED and is not a Stage 12A PASS. The final correction SHA and its actual GitHub/Vercel status are reported externally after push; an ignored Vercel build must not be treated as a completed deployment. No merge to main, Stage 12B, or release certification is authorized.
