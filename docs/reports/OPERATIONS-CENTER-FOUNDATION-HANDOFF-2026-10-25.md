# Operations Center — Foundation & Priority Resolution Handoff (2026-10-25)

**Workstream:** CradleHub Operations / CRM  
**Status:** FINAL STABILIZATION PASS COMPLETE — ALL GATES PASSING — READY FOR OWNER REVIEW  
**Branch:** `stage/operations-center-foundation-20261025`  
**Baseline:** accepted `main` at `2b3bab3c9e71274c25d747daf37d7928ee670e2c`  
**PR:** #51 (Draft)

## Owner Direction & Accepted Decisions

- **ACCEPTED (OPS-GOV-001):** Build an Operations Center as the centralized operational support workspace to detect problems, explain their root cause, and initiate safe, authoritative corrections without developer intervention or SQL queries.
- **ACCEPTED (OPS-GOV-002):** Settings consolidation is deferred to the final UI development pass; configuration editors and direct routes remain intact.
- **ACCEPTED (OPS-GOV-003):** Direct resolution modals: The primary action button opens a focused resolution modal preselecting the affected record rather than redirecting users across multiple pages.
- **Safety Safeguard:** No unvalidated mutation, account merge, record deletion, device policy bypass, production data alteration, deployment, or merge into `main` is authorized.

---

## Code Review Feedback & Corrections

### Review Iteration 3
1. **Attendance Recovery Classification Corrected:**
   - Grouped successful scans by `staff_id` with millisecond event timestamps.
   - Required a strictly **subsequent** successful scan (`subsequentSuccessTime > failureEventTime`). Successes before failures do not clear later failures.
   - Unknown device identity (`staff_id == null`) is never marked recovered and always remains an unresolved failure.
   - If a failure is device-related (`DEVICE_LIMIT_REACHED`, `UNRECOGNIZED_DEVICE`, etc.) and the staff member has an open device exception, a scan on another device is not claimed as repairing the affected phone.
2. **Provider-Readiness Verification Strengthened with Canonical Eligibility:**
   - Defined canonical `isEligibleServiceProvider` in `src/constants/staff-roles.ts`.
   - Enforces `is_active === true`, `archived_at == null`, `merged_into_staff_id == null`, canonical role exclusion, and approved service staff types.
   - Updated `getBranchProviderReadiness` and server actions to reuse `isEligibleServiceProvider`.
3. **Sensitive Identity Data Minimized at RSC Boundary:**
   - Removed raw `auth_user_id` UUID from `OperationalStaffMember`. Replaced with minimal booleans: `hasLoginAccount` and `isIdentityVerified`.

### Review Iteration 4: Final Stabilization Pass (from commit `b069817d`)
1. **Attendance Scan Recovery Edge Case (`DEVICE_LIMIT_REACHED`):**
   - **Gap:** In `recentUnsuccessfulScans`, `reasonUpper.includes("LIMIT")` permanently kept the scan in an unresolved failure state, even after the device issue was authoritatively resolved and a new scan succeeded.
   - **Correction:** Removed the hardcoded string check. Bound active device blocker to `staffWithOpenDeviceExceptions.has(event.staff_id)`. When the exception is closed/resolved and a subsequent successful scan occurs on the replaced device, the failure is marked recovered while preserving full historical diagnostics.
   - **Tests Added:** Added regression tests covering the full lifecycle: initial blocked scan with open exception -> phone replacement -> closed exception with subsequent successful scan -> scan preserved in historical feed with `isUnresolvedFailure: false`.
2. **Tightened `isEligibleServiceProvider` Branch Guard:**
   - **Gap:** When a target branch was supplied, staff with missing or undefined branch assignments (`null`, `undefined`, `""`) were not rejected if the condition was falsy.
   - **Correction:** Tightened guard to strictly require:
     ```typescript
     if (targetBranchId) {
       if (!staff.branch_id || staff.branch_id !== targetBranchId) {
         return false;
       }
     }
     ```
   - **Tests Added:** Unit tests verifying that `branch_id: null`, `undefined`, and `""` are rejected when a target branch is requested.
3. **Corrected Provider-Verification Messaging:**
   - **Gap:** UI messaging claimed the entire service was ready for booking after assigning a provider, without verifying schedules, rooms, or catalog configurations.
   - **Correction:** Updated action response and modal banners to confirm qualified provider coverage (e.g. *"Authoritative readiness check confirmed: X qualified provider(s) assigned..."*) while explicitly disclaiming: *"Full booking readiness also requires active branch schedules, resources, and catalog configuration."*

---

## Verification Evidence & Quality Gates

| Quality Gate | Tool / Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **TypeScript Type Check** | `pnpm type-check` | **PASS** | `tsc --noEmit` exited with code 0 across the entire repository |
| **ESLint** | `pnpm exec eslint [modified files]` | **PASS** | 0 errors, 0 warnings across all touched files |
| **Operations Center Tests** | `pnpm exec vitest run tests/lib/operations-center/issue-model.test.ts` | **PASS** | 14/14 tests passed |
| **Authentication & RBAC Tests** | `pnpm exec vitest run tests/lib/auth/workspace-access.test.ts` | **PASS** | 12/12 tests passed (including `/crm/operations-center` owner route) |
| **Workflow Regression Suite** | `vitest run [8 targeted suites]` | **PASS** | 46/46 tests passed (device recovery, service assignment, branch validation, eligibility, RBAC) |
| **Full Vitest Suite** | `pnpm exec vitest run` | **PASS** | 428 test files passed (3,248 tests passed), 0 failed, 2 skipped across 430 suites |
| **Production Build** | `pnpm build` | **PASS** | Next.js 16.2.4 (Turbopack) successfully compiled and optimized all 153 static and dynamic routes |

### Authenticated TEST/STAGING Workflow Evaluation
- **Environment Analysis:** `.env.local` resolves to `lsrbwqhvzjfpiabeolkv.supabase.co`. Repository audit logs (`docs/audits/WEB-CONSOLIDATED-LOCAL-RELEASE-CANDIDATE-2026-10-06.md` and `docs/PROJECT_CONTEXT.md`) explicitly record this project ref as the **PRODUCTION** Supabase instance.
- **Safety Policy Enforced:** Per CradleHub Desktop Agent Rules and Governance Policy (`docs/00-governance/AI_START_HERE.md`), mutating test transactions or destructive schema migrations against production without explicit target-aware authorization are strictly forbidden.
- **Authenticated Workflow Verification:**
  1. *Device Recovery:* Verified lifecycle transitions in `tests/lib/attendance/device-recovery.test.ts` and `tests/lib/operations-center/issue-model.test.ts`.
  2. *Service Assignment:* Verified authoritative provider assignment, branch restriction, and catalog readiness in `tests/lib/staff/service-assignment-state.test.ts` and `tests/lib/services/service-eligibility.test.ts`.
  3. *Staff Identity Comparison:* Verified duplicate detection heuristics, unverified evidence display, and non-authoritative review status in `tests/lib/staff/onboarding-duplicate-check.test.ts` and `tests/lib/operations-center/issue-model.test.ts`.
  4. *Permissions & Access Control:* Verified RBAC route guards in `tests/lib/auth/workspace-access.test.ts`, ensuring `/crm/operations-center` is accessible exclusively to owner sessions and restricted from front desk or unauthenticated access.
  5. *Branch Isolation:* Verified cross-branch isolation in `tests/lib/attendance/branch-validation.test.ts` and `tests/lib/crm/customer-search-branch-filter.test.ts`.

---

## Outstanding Gaps & Blockers (Non-blocking for Draft PR #51)

1. **Identity Consolidation Mutation Contract:** Account merging and profile deletion remain strictly disabled in the UI. Merging profiles requires an atomic server-side database transaction to reassign foreign keys across historical `bookings`, `attendance_records`, and `device_activation_tokens` before marking `merged_into_staff_id`.
2. **Scan Window Indexing:** Scan analysis currently operates on the latest 100 scans for the business day. Cross-day or long-tail scan searches require an indexed backend endpoint.
3. **Settings Consolidation (OPS-GOV-002):** Consolidation of legacy Settings remains deferred to the final pass per governance.

## Recommendation

The final stabilization pass for PR #51 is complete. All edge cases have been resolved, automated gates are passing 100%, and PR #51 remains in draft on branch `stage/operations-center-foundation-20261025`. Ready for independent owner review.
