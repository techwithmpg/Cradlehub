# Operations Center — Foundation & Priority Resolution Handoff (2026-10-25)

**Workstream:** CradleHub Operations / CRM  
**Status:** IMPLEMENTED ON REVIEW BRANCH — VALIDATED WITH AUTOMATED CHECKS — AWAITING INDEPENDENT OWNER REVIEW  
**Branch:** `stage/operations-center-foundation-20261025`  
**Baseline:** accepted `main` at `2b3bab3c9e71274c25d747daf37d7928ee670e2c`  
**PR:** #51

## Owner Direction & Accepted Decisions

- **ACCEPTED (OPS-GOV-001):** Build an Operations Center as the centralized operational support workspace to detect problems, explain their root cause, and initiate safe, authoritative corrections without developer intervention or SQL queries.
- **ACCEPTED (OPS-GOV-002):** Settings consolidation is deferred to the final UI development pass; configuration editors and direct routes remain intact.
- **ACCEPTED (OPS-GOV-003):** Direct resolution modals: The primary action button must open a focused resolution modal preselecting the affected record rather than redirecting users across multiple pages.
- **Safety Safeguard:** No unvalidated mutation, account merge, record deletion, device policy bypass, production data alteration, deployment, or merge into `main` is authorized.

---

## Implemented Architecture & Resolution Flows

### 1. Operations Center Foundation & Workspace Metrics
- **Location:** `/crm/operations-center` (server component with authoritative `getFrontDeskContext()` branch scoping).
- **6 Authoritative Summary Metrics:**
  - Branch Health: Derived from authoritative diagnostic results (`Ready` / `Attention Needed` / `Incomplete`).
  - Total Open Incidents: Live count across all loaded branch diagnostic sources.
  - Critical Problems: Issues with severity `critical` requiring immediate intervention.
  - Attendance Reviews: Authoritative count from `AttendanceWorkspaceData`.
  - Staff & Accounts: Live count from branch staff diagnostics.
  - Configuration Health: Authoritative count from `CrmSetupHealthData`.
  - **Failure Transparency:** Any failed feed is explicitly reported as `Unavailable` rather than misleading `0` counts.

### 2. Multi-Facet Issue Inbox & Search
- Multi-facet filtering by:
  - **Severity:** All, Critical, Warning, Info.
  - **Category / Area:** All, Attendance, Staff & Account, Configuration.
  - **Resolution State:** All, Detected, Under Review, Pending Action, Verified.
- Search covers: Staff name, staff ID, issue title, diagnostic error code, receipt/scan suffix (e.g., `4F0AF7D6`), service name, and service ID.

### 3. Priority Workflow 1 — Device Limit Reached (`DEVICE_LIMIT_REACHED`, Receipt `4F0AF7D6`)
- **Direct Modal:** When an incident or unsuccessful scan with code `DEVICE_LIMIT_REACHED` or `phone` resolution kind is resolved:
  - Automatically identifies the affected staff account and loads active registered devices from the device registry.
  - Renders `RecoveryLinkDialog` directly in the Operations Center.
  - Requires the user to explicitly select which previous device is being disconnected when at the `ACTIVE_ATTENDANCE_DEVICE_LIMIT` limit (preventing ineffective links).
  - Explains staff reconnection steps.
  - Clear governance feedback: Generating a recovery link is marked as a **pending external action**, not verified resolution; verified resolution requires a subsequent successful scan from the staff member.

### 4. Priority Workflow 2 — Duplicate Staff Accounts & Identity Review
- **Direct Modal:** `StaffDuplicateModal` provides side-by-side comparison for suspected duplicates (matching normalized names or matching phones) or manually selected profiles:
  - Compares: Full name, nickname, phone, system role, staff type, active/archived status, linked auth identity (`auth_user_id`), identity verification status (`identity_verified_at`), registered devices count, and scan activity.
  - Identifies which profile appears actively used (green badge with authoritative criteria explanation).
  - **Safety Safeguard:** Displays an explicit audit warning prohibiting automatic deletion or unvalidated merging.
  - **Required Backend Contract:** Explicitly specifies the required server-side atomic transaction to migrate foreign keys across `bookings`, `attendance_records`, and `device_activation_tokens` before setting `merged_into_staff_id`.
  - Provides safe non-destructive links to verified profile editing in `/crm/staff?tab=management`.

### 5. Priority Workflow 3 — Missing Service Provider Resolution
- **Record-Specific Readiness:** `getCrmSetupHealth` derives `unstaffedServices` directly from canonical `getBranchProviderReadiness` and `getBranchAssignableServices`, pinpointing exact unstaffed services.
- **Direct Modal:** `ServiceProviderModal` opens with the exact unstaffed service and branch preselected.
  - Explains the verified root cause (active service with 0 assigned therapists in `staff_services`).
  - Lists eligible active branch providers (filtered by `SERVICE_STAFF_TYPES`, excluding utility/driver/marketer).
  - Executes canonical server action `assignProviderToServiceAction({ branchId, serviceId, staffId })`.
  - On save: invalidates availability caches, triggers `router.refresh()`, verifies the service is now staffed, and confirms resolution.

### 6. Utility Staff Scanning Diagnostics & Fallback
- Scans or issues related to utility staff or QR scanning provide targeted diagnostics:
  - Camera permissions verification.
  - Branch attendance QR poster verification.
  - Account status and branch assignment check.
  - Front Desk manual check-in fallback guidance.

---

## Verification Evidence

| Check | Tool / Command | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Type Check** | `pnpm type-check` | **PASS** | `tsc --noEmit` exited with code 0 (clean) |
| **Linting** | `eslint [all modified files]` | **PASS** | 0 errors, 0 warnings |
| **Unit Tests** | `vitest run tests/lib/operations-center/issue-model.test.ts` | **PASS** | 7/7 tests passed cleanly |
| **Full Production Build** | `pnpm build` | **PASS** | Next.js 16.2.4 (Turbopack) compiled all 153 static/dynamic routes |

---

## Known Limitations & Remaining Gaps

1. **Identity Consolidation Contract:** Automatic merging or profile deletion remains disabled. A future backend transaction migration contract is required to reassign foreign keys across historical bookings, attendance sessions, and payroll before `merged_into_staff_id` can be updated safely.
2. **Scan Window:** Unsuccessful scan attempts are limited to today's latest 100 scans loaded at the business-day boundary; older historical receipts require an indexed historical scan query endpoint.
3. **Settings Consolidation:** Standalone Settings reorganization remains untouched, reserved for the final UI pass per `OPS-GOV-002`.
4. **Environment:** No unauthorized production or destructive database operations were executed.

## Recommendation

The Operations Center module foundation, priority workflows, and focused resolution modals are complete, fully typed, linted, tested, and built. The branch `stage/operations-center-foundation-20261025` is ready for owner review on draft PR #51.
