# Operations Center — Foundation & Priority Resolution Handoff (2026-10-25)

**Workstream:** CradleHub Operations / CRM  
**Status:** CODE REVIEW CORRECTIONS COMPLETE — AUTOMATED GATES PASSING — AWAITING INDEPENDENT CODE REVIEW  
**Branch:** `stage/operations-center-foundation-20261025`  
**Baseline:** accepted `main` at `2b3bab3c9e71274c25d747daf37d7928ee670e2c`  
**PR:** #51

## Owner Direction & Accepted Decisions

- **ACCEPTED (OPS-GOV-001):** Build an Operations Center as the centralized operational support workspace to detect problems, explain their root cause, and initiate safe, authoritative corrections without developer intervention or SQL queries.
- **ACCEPTED (OPS-GOV-002):** Settings consolidation is deferred to the final UI development pass; configuration editors and direct routes remain intact.
- **ACCEPTED (OPS-GOV-003):** Direct resolution modals: The primary action button opens a focused resolution modal preselecting the affected record rather than redirecting users across multiple pages.
- **Safety Safeguard:** No unvalidated mutation, account merge, record deletion, device policy bypass, production data alteration, deployment, or merge into `main` is authorized.

---

## Code Review Feedback & Corrections (Review Iteration 3)

### 1. Attendance Recovery Classification Corrected
- **Gap:** In `recentUnsuccessfulScans`, any same-day successful scan by the same staff was previously treated as recovery, even if the success preceded the failure. Furthermore, a successful scan from another registered device falsely marked a phone failure as repaired, and unknown devices lacked explicit non-recovery handling.
- **Correction:**
  - Grouped successful scans by `staff_id` with millisecond event timestamps.
  - Required a strictly **subsequent** successful scan (`subsequentSuccessTime > failureEventTime`). Successes before failures do not clear later failures.
  - Unknown device identity (`staff_id == null`) is never marked recovered and always remains an unresolved failure.
  - If a failure is device-related (`DEVICE_LIMIT_REACHED`, `UNRECOGNIZED_DEVICE`, etc.) and the staff member has an open device exception in `attendance.exceptions`, a subsequent scan by the staff member on another device is not claimed as repairing the affected phone.

### 2. Provider-Readiness Verification Strengthened with Canonical Eligibility
- **Gap:** The existing readiness query in `service-catalog.ts` only checked active rows without validating branch ownership, archived/merged status, or provider-role eligibility.
- **Correction:**
  - Defined and exported canonical `isEligibleServiceProvider` in `src/constants/staff-roles.ts`.
  - Enforces:
    - `is_active === true`
    - `archived_at == null`
    - `merged_into_staff_id == null`
    - `branch_id === targetBranchId`
    - `system_role` is not in `HARD_EXCLUDED_PROVIDER_SYSTEM_ROLES` (`driver`, `utility`, `digital_marketer`)
    - `staff_type` is in `SERVICE_STAFF_TYPES` (`therapist`, `nail_tech`, `aesthetician`, `salon_head`)
  - Updated `getBranchProviderReadiness` in `src/lib/services/service-catalog.ts` to query all staff eligibility fields and filter via `isEligibleServiceProvider`.
  - Updated `verifyServiceProviderReadinessAction` and `assignProviderToServiceAction` in `src/app/(dashboard)/crm/services/actions.ts` to reuse `isEligibleServiceProvider`.

### 3. Sensitive Identity Data Minimized at RSC Boundary
- **Gap:** Raw authentication identifier (`auth_user_id` Supabase UUID) was previously passed from the server component to the client component and rendered into the DOM.
- **Correction:**
  - Updated `OperationalStaffMember` in `src/lib/operations-center/issue-model.ts` to remove `auth_user_id` entirely.
  - Added minimal authorized display fields: `hasLoginAccount: boolean` and `isIdentityVerified: boolean`.
  - In `src/app/(dashboard)/crm/operations-center/page.tsx`, mapped `hasLoginAccount: Boolean(row.auth_user_id)` and `isIdentityVerified: Boolean(row.identity_verified_at)` before passing data to `OperationsCenterView`.
  - In `StaffDuplicateModal`, rendered login account presence using `profile.hasLoginAccount` without any raw auth UUID in memory or the DOM.

---

## Verification Evidence & Full Test Suite Results

| Quality Gate | Tool / Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **TypeScript Type Check** | `pnpm type-check` | **PASS** | `tsc --noEmit` exited with code 0 across the entire repository |
| **ESLint** | `pnpm exec eslint [modified files]` | **PASS** | 0 errors, 0 warnings across all touched files |
| **Focused Operations Tests** | `pnpm exec vitest run tests/lib/operations-center/issue-model.test.ts` | **PASS** | 13/13 tests passed (timestamp recovery, unknown device identity, open device blockers, canonical provider eligibility, sensitive data minimization) |
| **Navigation & Auth Tests** | `pnpm exec vitest run tests/lib/auth/workspace-access.test.ts` | **PASS** | 12/12 tests passed |
| **Service Catalog Tests** | `pnpm exec vitest run tests/lib/services/` | **PASS** | 61/61 tests passed across 5 test suites |
| **Attendance Tests** | `pnpm exec vitest run tests/lib/attendance/` | **PASS** | 416/416 tests passed across 52 test suites |
| **Component Integration Tests** | `pnpm exec vitest run tests/components/crm/quick-booking-unified-modes.test.tsx` | **PASS** | 10/10 tests passed (13.6s) |
| **Full Production Build** | `pnpm build` | **PASS** | Next.js 16.2.4 (Turbopack) successfully compiled and optimized all 153 static and dynamic routes (including `/crm/operations-center`) |

### Full Vitest Suite Run Analysis
- **Full Suite Execution:** Ran all 430 test suites (3,236 tests).
- **Passed:** 426 test files passed, 2 skipped, 2 failed on initial parallel load:
  1. `quick-booking-unified-modes.test.tsx`: Exceeded the 15s timeout under 15-worker load; passed 10/10 in 13.6s when run individually.
  2. `workspace-access.test.ts`: `OWNER_ROUTE_PREFIXES` did not include `/crm/operations-center` added in commit `e50e59fe`. Resolved by adding `/crm/operations-center` to `OWNER_ROUTE_PREFIXES`, passing 12/12.

---

## Outstanding Gaps & Blockers

1. **Identity Consolidation Mutation Contract:** Account merging and profile deletion remain strictly disabled in the UI. Merging profiles requires an atomic server-side database transaction to reassign foreign keys across historical `bookings`, `attendance_records`, and `device_activation_tokens` before marking `merged_into_staff_id`.
2. **Scan Window Indexing:** Scan analysis currently operates on the latest 100 scans for the business day. Cross-day or long-tail scan searches require an indexed backend endpoint.
3. **Settings Consolidation (OPS-GOV-002):** Consolidation of legacy Settings remains deferred to the final pass per governance.

## Recommendation

All 3 additional review issues have been corrected with canonical rules, full type safety, and zero lint warnings. Branch `stage/operations-center-foundation-20261025` on draft PR #51 is returned for independent review.
