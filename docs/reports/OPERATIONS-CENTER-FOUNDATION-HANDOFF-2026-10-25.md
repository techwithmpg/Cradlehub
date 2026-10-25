# Operations Center — Foundation & Priority Resolution Handoff (2026-10-25)

**Workstream:** CradleHub Operations / CRM  
**Status:** CODE REVIEW CORRECTIONS IMPLEMENTED — AUTOMATED GATES PASSING — AWAITING INDEPENDENT CODE REVIEW  
**Branch:** `stage/operations-center-foundation-20261025`  
**Baseline:** accepted `main` at `2b3bab3c9e71274c25d747daf37d7928ee670e2c`  
**PR:** #51

## Owner Direction & Accepted Decisions

- **ACCEPTED (OPS-GOV-001):** Build an Operations Center as the centralized operational support workspace to detect problems, explain their root cause, and initiate safe, authoritative corrections without developer intervention or SQL queries.
- **ACCEPTED (OPS-GOV-002):** Settings consolidation is deferred to the final UI development pass; configuration editors and direct routes remain intact.
- **ACCEPTED (OPS-GOV-003):** Direct resolution modals: The primary action button opens a focused resolution modal preselecting the affected record rather than redirecting users across multiple pages.
- **Safety Safeguard:** No unvalidated mutation, account merge, record deletion, device policy bypass, production data alteration, deployment, or merge into `main` is authorized.

---

## Code Review Feedback & Corrections (Review Iteration 2)

Following an independent code review of PR #51, 8 correctness and operational-safety gaps were identified and resolved:

### 1. Authoritative Provider Assignment Verification
- **Gap:** UI previously presented "Provider Assigned & Verified" immediately after the mutation call succeeded, without confirming readiness state.
- **Correction:** Implemented multi-step resolution in `ServiceProviderModal` (`idle` → `submitting` → `verifying` → `verified` / `unconfirmed` / `error`).
- Added canonical server action `verifyServiceProviderReadinessAction` in `src/app/(dashboard)/crm/services/actions.ts` executing authoritative `getBranchProviderReadiness(branchId, [serviceId])`.
- If the re-query confirms active providers, UI reports confirmed count; if verification fails or finds zero eligible providers, displays an explicit unconfirmed alert warning the user that service remains unstaffed.

### 2. Staff Data Failures Handled Transparently
- **Gap:** An unsuccessful staff query could previously fall back to an empty array `[]`, giving false assurance of zero staff identity issues.
- **Correction:** In `src/app/(dashboard)/crm/operations-center/page.tsx`, checks both the outer Promise result and the inner PostgREST result (`staffResult.status === "fulfilled" && !staffResult.value.error`).
- When the query fails, sets `staffRows = null` and `staffAvailable = false`. The summary card displays `Unavailable` and empty state alerts that diagnostics are incomplete.

### 3. Duplicate-Account Comparison: Removed Heuristic "Primary" Scoring
- **Gap:** Evaluated a heuristic "Primary / Active" badge which appeared authoritative without human verification.
- **Correction:** Removed `evaluatePrimary` from `StaffDuplicateModal`. Added an unmissable banner: *"Unverified Diagnostic Evidence for Manual Identity Review"*.
- Profiles display objective comparison items (verified identity status, active login, registered devices, scan history) as evidence for manual review. Merge and delete buttons remain disabled with explicit audit warnings.

### 4. Accurate Multi-Source Device Counting
- **Gap:** Counted only the first device registry entry for a staff member.
- **Correction:** Multi-source aggregator across `deviceRegistry.activeDevices`, `devices`, and `deviceRegistry.entries` using a deduplicated `Set<string>` of device IDs. Reports accurate active device counts across all registries.

### 5. Operational Health: Scan Failures vs Incidents vs Harmless Attempts
- **Gap:** Labeled branch fully operational based solely on zero open exceptions, ignoring active scan lockouts and equating harmless duplicates to blockers.
- **Correction:** Modeled `isUnresolvedFailure` in `OperationsScan`.
- If a staff member logged a blocked scan but subsequently clocked in successfully today, the attempt is classified as *"Harmless / Succeeded Later"*.
- If a blocked scan has no subsequent successful scan, it is badged as *"Unresolved Scan Failure"*.
- Branch Health card distinguishes states:
  - `Diagnostics Incomplete` if any diagnostic query failed.
  - `{n} Critical Problem(s)` if critical severity issues exist.
  - `{n} Open Incident(s)` if non-critical issues exist.
  - `{n} Blocked Scan(s)` if unresolved scan failures exist with zero open exceptions.
  - `Current Checks Clear` with subtitle *"Zero open exceptions or blocked scans in current branch snapshot"* only when all checks and scans are clean.

### 6. Resolution Status Aligned with Persisted Reality
- **Gap:** Displayed a "Verified" filter and state without an authoritative read contract for historical resolved records.
- **Correction:** Aligned `OperationsResolutionState` strictly to persisted states: `"detected" | "under_review" | "pending_action"`. Removed the misleading `verified` filter option from the issue inbox filter bar.

### 7. Setup-Health Reliability & Silence-Free Audits
- **Gap:** Configuration query errors in `resourcesResult`, `driversResult`, and `unassignedResult` fell back silently to `0`.
- **Correction:** Updated `getCrmSetupHealth` in `src/lib/queries/crm-setup.ts` to explicitly check for PostgREST errors on each query and throw. When an error occurs, the configuration feed is accurately marked `Unavailable` rather than displaying deceptive zero counts.

### 8. Provider Eligibility & Privacy Protection
- **Gap:** UI previously claimed providers were verified without checking `identity_verified_at`, and exposed sensitive raw UUIDs.
- **Correction:** Provider selection in `ServiceProviderModal` only badges a provider as *"ID Verified"* if `identity_verified_at` is non-null. Masked all account and device identifiers in `StaffDuplicateModal` (e.g. `ID: ...c4b8` and `Device ...d7f6`), eliminating raw `auth_user_id` UUID strings from the DOM.

---

## Verification Evidence

| Quality Gate | Tool / Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **TypeScript Type Check** | `pnpm type-check` | **PASS** | `tsc --noEmit` exited with code 0 across the entire repository |
| **ESLint** | `pnpm exec eslint [modified files]` | **PASS** | 0 errors, 0 warnings across all 8 touched files |
| **Focused Unit Tests** | `pnpm exec vitest run tests/lib/operations-center/issue-model.test.ts` | **PASS** | 9/9 tests passed (including scan failure distinction and aligned resolution states) |
| **Regression Tests** | `pnpm exec vitest run tests/lib/auth/workspace-access.test.ts` | **PASS** | 12/12 tests passed |
| **Integration Component Tests** | `pnpm exec vitest run tests/components/crm/quick-booking-unified-modes.test.tsx` | **PASS** | 10/10 tests passed |
| **Full Production Build** | `pnpm build` | **PASS** | Next.js 16.2.4 (Turbopack) successfully compiled and optimized all 153 static and dynamic routes (including `/crm/operations-center`) |

---

## Outstanding Gaps & Blockers

1. **Identity Consolidation Mutation Contract:** Account merging and profile deletion remain strictly disabled in the UI. Merging profiles requires an atomic server-side database transaction to reassign foreign keys across historical `bookings`, `attendance_records`, and `device_activation_tokens` before marking `merged_into_staff_id`.
2. **Scan Window Indexing:** Scan analysis currently operates on the latest 100 scans for the business day. Cross-day or long-tail scan searches require an indexed backend endpoint.
3. **Settings Consolidation (OPS-GOV-002):** Consolidation of legacy Settings remains deferred to the final pass per governance.

## Recommendation

All 8 code review gaps have been corrected, verified, and audited with zero regressions. The branch `stage/operations-center-foundation-20261025` on draft PR #51 is ready for independent review.
