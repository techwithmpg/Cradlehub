# PR #58 ATTENDANCE QR FLOW & APPLICATION INTEGRATION AUDIT REPORT

**Document ID:** `PR58-APPLICATION-INTEGRATION-AUDIT-REPORT-2026-11-02`  
**Target:** CradleHub Web / Staff Attendance PWA  
**Branch:** `fix/attendance-qr-flow-20261101`  
**Repository:** `techwithmpg/Cradlehub`  
**Report Date:** 2026-11-02  
**Audit Scope:** Controlled Stabilization Review across Attendance Web/PWA, QR Scanning, Geofencing, Device Registration, Server Authorization, Advisory Locking, Idempotency, and Exception Governance.

---

## 1. Executive Summary & Audit Verdict

**Audit Verdict: PASS**

An end-to-end audit and scoped safety correction of the CradleHub Web and Staff Attendance PWA application codebase on branch `fix/attendance-qr-flow-20261101` was conducted against the local PostgreSQL 17 test baseline and accepted `origin/main` commit `18bfb406bdfbd94c0a56581446bce9b74e131162`.

The investigation systematically verified:
1. **Branch & Baseline Divergence:** The branch cleanly diverges from `origin/main` at common merge-base `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`. `origin/main` contains CRM booking failure diagnostics fixes (PR #60 and #61), while `fix/attendance-qr-flow-20261101` contains attendance/scanner fixes, geofence safety enforcement, and isolated test slices. Zero conflicting business logic exists between the two branches.
2. **Evidence Integrity:** Committed artifacts and their SHA-256 hashes reconcile with 100% cryptographic precision. The 1-byte difference in the earlier QR contract report draft is proven to be a single trailing newline (`0x0A`), not CRLF conversion.
3. **Integration Boundaries:** Strict boundary isolation is enforced between camera viewfinder navigation grants (`staff_scan_grants` table + single-use atomic claims with 120s TTL) and untrusted printed link visits (requiring explicit CSR/staff "Record attendance" confirmation).
4. **Geofence Overrides & Limits:** Branch Main Spa ($100\text{m}$) and SM Branch ($150\text{m}$) limits are protected by authoritative server enforcement in `src/lib/attendance/geofence-server.ts`. Any environment variable attempting to expand beyond these approved boundaries fails closed with `"geofence_configuration"`.
5. **Fail-Safe Behavior:** All seven critical failure paths (direct QR links, expired grants, replayed requests, duplicated scans, inactive staff, wrong-branch attempts, and missing locations) fail closed safely without unauthorized state mutation.
6. **Home-Service Protection:** Remote clock-out requires seven strict server-side predicates (verified completion, zero active/upcoming assignments, therapist category, home-service source). It applies strictly to clock-out and cannot become a general geofence bypass or permit remote clock-in.
7. **Automated Verification:** 221 targeted integration tests passed (14 test files) and 599 full attendance tests passed across 82 test files with zero failures. TypeScript type-check passed cleanly with zero errors. The complete 4-layer local PostgreSQL 17 test database suite passed with zero errors.
8. **Runtime Scope Control:** Confirmed only the authorized geofence radius safety check in `src/lib/attendance/geofence-server.ts` was modified in runtime application code.

---

## 2. Repository, Branch, & Baseline Traceability

| Property | Value |
| :--- | :--- |
| **Repository** | `techwithmpg/Cradlehub` |
| **Active Worktree** | `E:\cradlehub\.tmp\attendance-qr-flow-20261101` |
| **Working Branch** | `fix/attendance-qr-flow-20261101` |
| **Current Commit HEAD** | `12d712916b9c637ed89b02d2f317a9ad40216d42` |
| **Preceding Commit** | `69266ba47ceeb51e89f81ef690ec997a06f3938b` |
| **Accepted `origin/main` Baseline** | `18bfb406bdfbd94c0a56581446bce9b74e131162` |
| **Common Merge-Base** | `f3291826a1fb1a61107e5ce87591cd9e0b7524ef` |
| **Working Tree Status** | Clean (Zero uncommitted functional or schema changes) |

### Branch Divergence Explanation (Without Rebase or Merge)
- `origin/main` advanced from `f3291826` through commits `e3b26119`, `5896930a`, `07943a78`, `46f0d3c5` (PR #60 merge), `b46ea031`, and `18bfb406` (PR #61 merge). These commits exclusively touched the CRM Quick Booking failure diagnostics subsystem (`src/components/features/bookings/quick-booking-form.tsx`, `src/types/errors.ts`, `src/types/crm-api.ts`).
- `fix/attendance-qr-flow-20261101` contains the authorized attendance QR fixes, geofencing safeguards, scanner grants, duty assignments, and dependency slices.
- The two branches modify completely disjoint functional domains with zero conflicting business code. Per stabilization discipline, no rebase or merge was executed.

---

## 3. Reconciliation of Committed Evidence & SHA-256 Checksums

The committed dependency slices and evidence reports in HEAD (`12d712916b9c637ed89b02d2f317a9ad40216d42`) and preceding commit `69266ba47ceeb51e89f81ef690ec997a06f3938b` were reconciled against disk and git tree blobs:

| File Path | SHA-256 Hash | Git Blob ID | Commit | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| `tests/database/pr58-qr-geofence-local-slice.sql` | `2D1D90F379699CF33DF287BED43A46D6702B2EB35746CCC61C23AE41D135CAD5` | `3a710821` | `12d71291` | **PASS (Exact Match)** |
| `tests/database/pr58-qr-geofence-local-test.sql` | `77396782B46F47315BF01648D946D07B41BFF0F3BB298D2C5EF835AAE87BD6AA` | `36bf2c82` | `12d71291` | **PASS (Exact Match)** |
| `docs/reports/PR58-QR-GEOFENCE-CONTRACT-REPORT-2026-11-02.md` | `FB1067F0DB514669E8F60B6E62C6009EE16CDAE3E33B94B728991F8327E35167` | `5875f2cd` | `12d71291` | **PASS (Exact Match)** |
| `tests/database/pr58-branch-schedule-device-local-slice.sql` | `36748D9AFA19A4523D0305AB4DF4D44E7409CF709D891567B706F2AE97A2E0D9` | `cf61ba16` | `69266ba4` | **PASS (Exact Match)** |
| `tests/database/pr58-branch-schedule-device-local-test.sql` | `957B9C2955C5A8279C7FF3D84973F8C326A4532F3996DC8C5B5237BF9BE138D9` | `2cbfa866` | `69266ba4` | **PASS (Exact Match)** |
| `docs/reports/PR58-BRANCH-SCHEDULE-DEVICE-CONTRACT-REPORT-2026-11-02.md` | `C23CEAF74D856BE0F616117DE6B9A7D5B4C7A7FB8EC8EAD1330FB16E40D6A415` | `e99da568` | `69266ba4` | **PASS (Exact Match)** |

### Cryptographic Dissection of QR Contract Report Checksum
- **Initial Draft Hash:** `14624477095E865F757157CAFDA8C1C973B76D92700606B848B558069F1F2DD0` (15,427 bytes, Unix LF line endings).
- **Final Committed Blob Hash:** `FB1067F0DB514669E8F60B6E62C6009EE16CDAE3E33B94B728991F8327E35167` (15,428 bytes, Unix LF line endings).
- **Line Ending Verification:** Both versions utilize identical Unix LF (`\n`, `0x0A`) line terminators throughout. The difference is **NOT** explained by CRLF-to-LF conversion.
- **Root Cause of Difference:** The exact delta is a single trailing newline (`0x0A`, `\n`) appended at the end of the document prior to `git add` in commit `12d71291`. Every single character in positions 0 through 15,426 is 100% byte-for-byte identical. Evidence integrity is preserved.

---

## 4. Review of Integration Boundaries

```
[Staff PWA Camera Viewfinder]
        │ (Decoded QR Payload)
        ▼
[resolveStaffScanTargetAction] ──(Checks Auth)──► Inserts [staff_scan_grants] (120s TTL)
        │                                         Sets STAFF_SCAN_GRANT_COOKIE (120s maxAge)
        ▼
[PublicScanProcessor] ────────(Claims Grant)───► Invokes claim_staff_scan_grant() RPC (8s timeout)
        │
        ├──► If Grant Claimed: Auto-Confirms -> Proceeds directly to GPS fix
        └──► If Printed Link (No Grant) / Timeout: Stops at "QR Recognized" -> Requires explicit tap
        │
        ▼
[browser-location.ts] ────────► navigator.geolocation.getCurrentPosition()
        │                       (enableHighAccuracy: true, maxAge: 0, 15s timeout)
        ▼
[POST /api/attendance/public-scan]
        │
        ├──► 1. verifyAttendanceGeofence() [Runs BEFORE replay cache check!]
        │       - Rejects accuracy > 75m
        │       - Rejects age < -5s or > 20s
        │       - Calculates Haversine distance to branch coordinates
        │       - Enforces approved branch limits (Main 100m, SM 150m)
        │       - Outside radius -> Blocks with location_outside
        │
        ├──► 2. Idempotent Replay Check (loadCommittedScanResult)
        │
        ├──► 3. resolveAttendanceScanIdentity()
        │       - Validates isOperationalStaff (blocks inactive/archived/merged)
        │       - Checks raw credential cookie vs staff_devices.device_fingerprint_hash
        │       - Enforces active device limit (max 2 devices per staff)
        │
        ├──► 4. resolveEffectiveAttendanceBranch() RPC
        │       - Checks home branch, assignments, transfers, cross-branch privilege
        │
        └──► 5. commit_attendance_scan_transaction() RPC
                - Advisory Lock: attendance_scan_request (by operation UUID)
                - Advisory Lock: attendance_scan_staff (by staff + branch + test)
                - Row Lock FOR UPDATE on staff and staff_shift_checkins
                - Writes qr_scan_events, staff_shift_checkins, attendance_exceptions
```

### 4.1 Scanner Grant Lifetimes: Distinct Roles & Contract Verification
The attendance scanner architecture implements two distinct, complementary duration limits:
1. **120-Second Signed Scanner Token & Database Ledger TTL (`STAFF_SCAN_GRANT_TTL_SECONDS = 120`):**
   - **Location:** Defined in `src/lib/scanner/staff-scan-grant.ts` and enforced on `public.staff_scan_grants` (`expires_at = now() + 120s`).
   - **Purpose:** Governs the cryptographic validity and single-use redemption lifetime of the camera scan intent. In mobile PWA environments (iOS WebKit and Android Chrome), users encounter full page navigation, browser permissions dialogs ("Allow location access?"), and GPS satellite acquisition. 120 seconds provides sufficient operational headroom for devices to complete location acquisition without prematurely aborting the session.
   - **Security Properties:** Cryptographically signed with HMAC SHA-256 (`timingSafeEqual`), bound to the specific user and public QR code, stored in an HTTP-only path-scoped cookie (`/staff/scan/process`), and consumed atomically by `claim_staff_scan_grant` RPC (`UPDATE ... SET claimed_at = clock_timestamp() ... RETURNING operation_id`).
2. **8-Second Client Handshake Timeout (`SCANNER_GRANT_CLAIM_TIMEOUT_MS = 8_000`):**
   - **Location:** Defined in `src/components/features/attendance/public-scan-processor.tsx`.
   - **Purpose:** Governs client-side UI responsiveness. When the processor page mounts, it invokes `claimStaffScanGrantAction`. The client waits up to 8 seconds for this server handshake:
     - If the grant is claimed within 8 seconds: The UI auto-confirms and seamlessly transitions to location acquisition.
     - If the grant is absent (printed static QR link) or the network stalls beyond 8 seconds: The client times out gracefully and renders the deliberate `"qr_recognized"` confirmation card with a "Record attendance" button. Staff are never frozen indefinitely on a loading state.
3. **Test Coverage Confirmation:**
   - Single-use consumption and expiration are fully verified in `src/lib/scanner/__tests__/staff-scan-grant.test.ts`, `src/lib/scanner/__tests__/staff-scan-boundary.test.ts`, `tests/components/attendance/public-scan-processor.test.tsx`, and `tests/database/staff-scan-grants-integration.sql`. Zero defects identified; grant durations are sound and preserved.

---

## 5. Geofence Overrides & Branch Limits Assessment

1. **Owner-Approved Perimeter Limits:**
   - Main Spa (`c1000000-0000-0000-0000-000000000001`): **Maximum $100\text{ meters}$**.
   - SM Branch (`c1000000-0000-0000-0000-000000000002`): **Maximum $150\text{ meters}$**.
   - Maximum Location Accuracy: **$\le 75\text{ meters}$** (`MAX_ATTENDANCE_LOCATION_ACCURACY_METERS`).
   - Location Freshness: **$-5\text{s} \le \text{age} \le 20\text{s}$** (`MAX_ATTENDANCE_LOCATION_AGE_MS`).
2. **Behavior of `ATTENDANCE_GEOFENCE_MODE`:**
   - Evaluated by `attendanceGeofenceMode()`:
     - If empty/unset or set to `"disabled"`: Returns `"disabled"`.
     - If set to `"enabled"`: Returns `"enabled"`.
     - Any other value (e.g. `"true"`, `"1"`, `"enable"`): Returns `"invalid"`.
   - **Can it disable mandatory location verification?**
     **YES.** When `ATTENDANCE_GEOFENCE_MODE` is `"disabled"` or unset:
     - `verifyAttendanceGeofence()` immediately returns `null` (lines 25-26), accepting any scan with or without location.
     - `attendanceGeofenceRequired()` returns `false`, causing the Staff PWA scanner (`locationRequired={attendanceGeofenceRequired()}`) to skip GPS acquisition entirely.
     - When set to an invalid value (e.g. `"invalid"`), `verifyAttendanceGeofence()` returns `"geofence_configuration"`, failing closed.
     - Location verification is **mandatory only when `ATTENDANCE_GEOFENCE_MODE="enabled"`**.
3. **Current Environment Override Gap:**
   - In `src/lib/attendance/geofence-server.ts` (lines 35-42), radius overrides are permitted up to a hard application ceiling of $1,000\text{ meters}$.
   - While this prevents infinite or unbounded radii, an operator could configure `ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS=500`, expanding Main Spa from $100\text{m}$ to $500\text{m}$, which violates the approved policy ceiling.
4. **Implemented Runtime Safety Correction (`src/lib/attendance/geofence-server.ts`):**
   - The server geofence verification binds override validation directly to the approved branch policy limit:
     ```ts
     const branchPolicy =
       ATTENDANCE_GEOFENCE_BRANCHES[input.branchId as keyof typeof ATTENDANCE_GEOFENCE_BRANCHES];
     if (!branchPolicy) return "geofence_configuration";

     const radiusVariable =
       input.branchId === "c1000000-0000-0000-0000-000000000001"
         ? process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS
         : input.branchId === "c1000000-0000-0000-0000-000000000002"
           ? process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS
           : undefined;
     const configuredRadius = radiusVariable === undefined ? undefined : Number(radiusVariable);
     if (
       radiusVariable !== undefined &&
       (!/^\d+(?:\.\d+)?$/.test(radiusVariable) ||
         !Number.isFinite(configuredRadius) ||
         !configuredRadius ||
         configuredRadius > branchPolicy.radiusMeters)
     )
       return "geofence_configuration";
     ```
   - **Enforced Safety Behaviors:**
     - Overrides attempting to expand beyond approved limits ($> 100\text{m}$ for Main Spa, $> 150\text{m}$ for SM Branch) **fail closed** with `"geofence_configuration"`.
     - Valid tighter overrides (e.g., $50\text{m}$ for Main Spa, $100\text{m}$ for SM Branch) remain supported.
     - Non-numeric strings, negative numbers, zero, NaN, or non-finite values **fail closed** with `"geofence_configuration"`.
     - Unconfigured, missing, or unknown branch IDs **fail closed** with `"geofence_configuration"`.
5. **Explicit Disabled-Mode Security Limitation:**
   - When `ATTENDANCE_GEOFENCE_MODE` is unset or explicitly set to `"disabled"`:
     - `attendanceGeofenceMode()` returns `"disabled"`.
     - `verifyAttendanceGeofence()` returns `null` immediately, accepting attendance scans regardless of whether location coordinates are present, inaccurate, stale, or off-site.
     - `attendanceGeofenceRequired()` returns `false`, causing the Staff PWA scanner to skip requesting device geolocation entirely.
   - **Production Requirement:** In production, physical geofence boundaries are **enforced only if `ATTENDANCE_GEOFENCE_MODE=enabled` is explicitly configured** in the hosting environment variables.
6. **Executed Targeted Regression-Test Matrix (`tests/lib/attendance/geofence-server.test.ts`):**
   | Test Case ID | `ATTENDANCE_GEOFENCE_MODE` | Branch | Radius Env Var | Expected Result | Actual Result | Verification Description |
   | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
   | `GEO-01` | (unset / missing) | Main | (unset) | `null` (Bypassed) | `null` | Default unconfigured mode disables geofence |
   | `GEO-02` | `"disabled"` | Main | (unset) | `null` (Bypassed) | `null` | Explicit disabled mode bypasses geofence |
   | `GEO-03` | `"enabledd"` (invalid) | Main | (unset) | `"geofence_configuration"` | `"geofence_configuration"` | Invalid mode string fails closed |
   | `GEO-04` | `"enabled"` | Main | (unset) | Pass (100m) | Pass (`null`) | Standard Main Spa baseline (89m passes, 111m fails) |
   | `GEO-05` | `"enabled"` | SM | (unset) | Pass (150m) | Pass (`null`) | Standard SM Branch baseline (133m passes, 167m fails) |
   | `GEO-06` | `"enabled"` | Main | `"50"` | Pass (50m) | Pass (`null`) | Valid tightening (44.5m passes, 89m fails outside) |
   | `GEO-07` | `"enabled"` | Main | `"100"` | Pass (100m) | Pass (`null`) | Boundary value equal to approved limit |
   | `GEO-08` | `"enabled"` | Main | `"101"` | `"geofence_configuration"` | `"geofence_configuration"` | Fails closed on widening Main Spa past 100m |
   | `GEO-09` | `"enabled"` | Main | `"500"` | `"geofence_configuration"` | `"geofence_configuration"` | Fails closed on significant widening |
   | `GEO-10` | `"enabled"` | SM | `"150"` | Pass (150m) | Pass (`null`) | Boundary value equal to approved limit |
   | `GEO-11` | `"enabled"` | SM | `"151"` | `"geofence_configuration"` | `"geofence_configuration"` | Fails closed on widening SM past 150m |
   | `GEO-12` | `"enabled"` | Main | `"0"` / `"-10"` | `"geofence_configuration"` | `"geofence_configuration"` | Zero or negative radius fails closed |
   | `GEO-13` | `"enabled"` | Main | `"100m"` / `"NaN"` | `"geofence_configuration"` | `"geofence_configuration"` | Non-numeric override fails closed |
   | `GEO-14` | `"enabled"` | Unknown Branch | (unset) | `"geofence_configuration"` | `"geofence_configuration"` | Unknown branch ID fails closed |
   | `GEO-15` | `"enabled"` | Main | (unset), acc: `76m` | `"location_inaccurate"` | `"location_inaccurate"` | Accuracy > 75m fails closed (75m passes) |
   | `GEO-16` | `"enabled"` | Main | (unset), age: `21s` | `"location_stale"` | `"location_stale"` | Age > 20s or future > 5s fails closed |

---

## 6. Fail-Safe Verification of Critical Failure Paths

All seven required failure scenarios were reviewed in application and database logic:

1. **Direct Printed QR Links:**
   - Visiting `/scan/[publicCode]` directly provides no grant cookie.
   - `claimStaffScanGrantAction` returns null.
   - `confirmed` state remains `false`.
   - UI renders "QR code recognized" card with an explicit "Record attendance" button. Staff must deliberately tap the button before any location reading or scan execution occurs.
2. **Expired Grants:**
   - Grants older than 120 seconds fail the SQL predicate: `claimed_at IS NULL AND expires_at > clock_timestamp()`.
   - RPC updates 0 rows and returns null.
   - Client claim handshakes taking longer than 8 seconds time out gracefully to manual confirmation (`confirmed = false`), requiring explicit user interaction.
3. **Replayed Requests:**
   - `verifyAttendanceGeofence` executes *before* `loadCommittedScanResult`. Replaying an old operation ID from off-site or with stale GPS data is rejected with `location_outside` or `location_stale`.
   - When on-site, `loadCommittedScanResult` verifies that `qr_point_id` matches the stored event. A mismatched point returns `reasonCode: "scan_request_mismatch"` (`ok: false, outcome: "blocked"`).
4. **Duplicated Scans:**
   - `findRecentDuplicate` checks `qr_scan_events` for a scan with the same point and device within `duplicate_scan_window_seconds`.
   - Returns `ok: true, outcome: "noop", reasonCode: "duplicate_scan"` without creating a duplicate shift or altering attendance state.
5. **Inactive Staff:**
   - `isOperationalStaff` checks `is_active === true`, `archived_at IS NULL`, and `merged_into_staff_id IS NULL`.
   - Inactive, archived, or merged staff members are rejected with `account_not_eligible` or `staff_inactive` (`outcome: "blocked", severity: "critical"`).
6. **Wrong-Branch Attempts:**
   - `resolve_effective_attendance_branch` evaluates branch assignments and cross-branch permissions.
   - If unauthorized, returns `reasonCode: "wrong_branch"` and opens a `staff_branch_assignment_issues` review ticket without writing any attendance check-in.
7. **Missing Location:**
   - If `location` is null or undefined when geofencing is enabled, `validateAttendanceLocation` returns `"location_required"`.
   - Scan fails closed with `ok: false, outcome: "blocked", severity: "warning"`, stating *"Location access is required for attendance"*.

---

## 7. Home-Service Remote Clock-Out Protection

Home-service remote clock-out was analyzed in migration `20260715021703_attendance_smart_dynamic_clock_out.sql` (lines 560-567):

```sql
elsif v_category = 'therapists'
   and v_source = 'home_service'
   and v_source_status = 'completed'
   and v_source_progress = 'completed'
   and v_source_completion is not null then
  v_portal_eligible := true;
  v_portal_reason := 'final_home_service_complete';
  v_portal_method := 'staff_portal_home_service';
```

### Invariants Preventing Geofence Bypass:
1. **Clock-Out Only:** This mechanism applies exclusively to clock-out of an existing, already checked-in shift. It NEVER permits remote clock-in.
2. **Strict Prerequisite State:**
   - `v_has_active` must be false (no ongoing active assignment).
   - `v_has_upcoming` must be false (no pending upcoming assignment).
   - Staff member category must be `therapists`.
   - Check-in dynamic policy source must be explicitly `home_service`.
   - Associated booking status must be `completed`.
   - Associated booking progress status must be `completed`.
   - Associated completion timestamp must be verified non-null.
3. **Fail-Closed Fallback:** If any of the above seven conditions are not satisfied, `v_portal_eligible` remains `false` and `v_portal_reason` defaults to `'use_branch_qr'`, `'has_active_assignment'`, or `'upcoming_assignment'`. The staff member is required to scan the branch physical QR code.

---

## 8. Automated Test Execution Evidence

### 8.1 Targeted Vitest Integration Suites
**Command:**
```powershell
npm test tests/lib/attendance/geofence.test.ts tests/lib/attendance/geofence-server.test.ts tests/lib/attendance/geofence-boundary.test.ts tests/lib/attendance/smart-dynamic-clock-out.test.ts src/lib/scanner/__tests__/ tests/app/attendance/public-scan-route.test.ts tests/components/attendance/public-scan-processor.test.tsx
```
**Outcome:**
```text
✓ tests/lib/attendance/geofence-boundary.test.ts (3 tests)
✓ tests/lib/attendance/geofence-server.test.ts (13 tests)
✓ tests/lib/attendance/smart-dynamic-clock-out.test.ts (60 tests)
✓ tests/lib/attendance/geofence.test.ts (13 tests)
✓ src/lib/scanner/__tests__/classify-public-qr.test.ts (9 tests)
✓ src/lib/scanner/__tests__/staff-scan-grant.test.ts (2 tests)
✓ src/lib/scanner/__tests__/resolve-scan-target.test.ts (24 tests)
✓ src/lib/scanner/__tests__/staff-camera-policy.test.ts (18 tests)
✓ src/lib/scanner/__tests__/staff-scan-boundary.test.ts (19 tests)
✓ tests/app/attendance/public-scan-route.test.ts (11 tests)
✓ src/lib/scanner/__tests__/use-staff-scanner.test.ts (11 tests)
✓ src/lib/scanner/__tests__/staff-scan-retry.test.tsx (2 tests)
✓ src/lib/scanner/__tests__/staff-qr-scanner.test.tsx (9 tests)
✓ tests/components/attendance/public-scan-processor.test.tsx (27 tests)

Test Files: 14 passed (14)
Tests:      221 passed (221)
Duration:   7.37s
```

### 8.2 Broader Attendance Regression Suites & Static Checks
- **TypeScript Static Verification:** `tsc --noEmit` passed with 0 errors (Exit code 0).
- **Unit Suites:** 39 tests passed across 7 test files (`diagnostic-catalog`, `overview-summary`, `stale-recovery`, `review-resolution`, `device-recovery-operation`, `staff-self-service`, `time`).
- **Component & Route Suites:** 96 tests passed across 17 test files (`public-scan-route`, `public-scan-processor`, `staff-attendance-clock-out`, `attendance-today`, etc.).
- **Lib & PWA Shell Suites:** 464 tests passed across 58 test files (`crm-closing-policy`, `hybrid-closing`, `branch-authority`, `pure-attendance-reader`, `geofence-server`, `staff-scanner-shell`, etc.).
- **Total Automated Vitest Tests Passing:** **599 tests passed across 82 test files (0 failures)**.

### 8.3 PostgreSQL 17 Local Database Suite Execution
**Command:**
```powershell
& "E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\dropdb.exe" -h 127.0.0.1 -p 55444 -U postgres --if-exists pr58_qr_geofence_stage_20261102
& "E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\createdb.exe" -h 127.0.0.1 -p 55444 -U postgres pr58_qr_geofence_stage_20261102
& "E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe" -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55444 -U postgres -d pr58_qr_geofence_stage_20261102 `
  -f "tests/database/pr58-staff-current-contract-local-prereqs.sql" `
  -f "tests/database/pr58-staff-current-contract-local.sql" `
  -f "tests/database/pr58-staff-current-contract-local-dependencies.sql" `
  -f "tests/database/pr58-staff-duty-assignments-baseline.sql" `
  -f "tests/database/pr58-schedule-local-correction.sql" `
  -f "tests/database/pr58-staff-current-contract-local-test.sql" `
  -f "tests/database/pr58-staff-test-privileges-overlay.sql" `
  -f "tests/database/pr58-staff-test-privileges-local-test.sql" `
  -f "tests/database/pr58-branch-schedule-device-local-slice.sql" `
  -f "tests/database/pr58-branch-schedule-device-local-test.sql" `
  -f "tests/database/pr58-qr-geofence-local-slice.sql" `
  -f "tests/database/pr58-qr-geofence-local-test.sql"
```
**Outcome:**
```text
PR58 current staff contract LOCAL checks passed
PR58 TEST privilege overlay LOCAL checks passed
PR58 branch authority, schedules, and device dependency slice LOCAL checks passed
PR58 QR points, scan events, and geofence dependency slice LOCAL checks passed
```
All four test layers passed with zero errors.

---

## 9. Verification Separation Boundary

| Verification Domain | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Automated Unit & Integration Tests** | **PASS** | 599 Vitest automated tests passing across 82 test files; 0 regressions. |
| **TypeScript Static Check** | **PASS** | `tsc --noEmit` clean with 0 errors. |
| **Local Database Execution** | **PASS** | PostgreSQL 17.11 local test instance passed all 4 test layers cleanly. |
| **Physical Mobile Device & Live Camera** | **NOT VERIFIED ON HARDWARE** | Headless Windows shell has no physical camera or mobile GPS hardware attached. Software mocks (`MediaDevices`, `navigator.geolocation`) pass 100%, but physical field testing on mobile devices remains required prior to production rollout. |
| **Remote Database & Staging/Production** | **NOT EXECUTED / UNMODIFIED** | Zero queries executed against remote databases. Zero migrations applied to staging or production. Full database isolation maintained. |

### 9.1 Correction of Unsupported Staging-Test Assumptions & Confirmed Repository Capabilities

A rigorous audit of repository database migrations, table definitions, test-mode support, scan event persistence, and application routes was conducted. All previously hypothesized staging testing concepts were verified against the actual codebase, and unsupported assumptions were eliminated:

| Hypothesized Concept | Actual Repository Reality | Confirmed Capability & Correction |
| :--- | :--- | :--- |
| `attendance_scan_events` | **DOES NOT EXIST.** | The authoritative scan audit log table is `public.qr_scan_events` (created in migration `20260702075213_attendance_qr_system.sql`). |
| `attendance_records` | **DOES NOT EXIST.** | Attendance shifts and check-ins are recorded in `public.staff_shift_checkins` (referenced by `checkin_id`). |
| `VERIFY_ONLY` scan action | **DOES NOT EXIST.** | `public.qr_scan_events` enforces `scan_type IN ('attendance', 'room', 'activation', 'unknown')`. Scan actions are dynamically derived from point type (`clock_in`, `clock_out`, `room_clean`, `room_occupied`). There is no dry-run or verification-only scan action. |
| Dedicated non-production branch configuration | **DOES NOT EXIST.** | The repository models exactly two physical branches: Main Spa (`c1000000-0000-0000-0000-000000000001`) and SM Branch (`c1000000-0000-0000-0000-000000000002`). There is no synthetic test branch. |
| Reversible staging attendance sessions | **DOES NOT EXIST.** | `public.qr_scan_events` is explicitly an **immutable append-only audit trail** (`comment on table public.qr_scan_events is 'Append-only audit trail...'`). The system has no administrative session-rollback or undo RPC. |

### 9.2 Confirmed Staging-Test Protocol (Using Confirmed Repository Capabilities)

Because `qr_scan_events` is immutable and append-only, and `staff_shift_checkins` directly drives live staff payroll and shifts:
> [!CAUTION]
> **STRICT PRODUCTION SAFETY RULE:** Never test against production using synthetic attendance records. Synthetic scans in production permanently pollute immutable audit logs and create invalid payroll records. Never execute `supabase db reset` against any shared, staging, or production environment.

**Safe Staging Verification Procedure:**
1. **Isolated Staging Environment:** Testing must be conducted against an isolated STAGING Supabase project (or local Supabase development stack) using branch `fix/attendance-qr-flow-20261101`.
2. **Authentic Seed Identities:** Utilize existing seeded test staff accounts from `supabase/migrations/20260430000002_demo_org_workflow_seed.sql` (e.g. therapist `f1000000-0000-0000-0000-000000000020` Drew Coscolluela).
3. **Device Binding:** Authenticate on a physical mobile device with the test staff account, generating a device registration record in `public.staff_devices` via `public.device_activation_tokens`.
4. **Physical Optical Scanning:** Use the device's native camera viewfinder in the Staff PWA (`/staff/scan`) to scan an active physical or monitor-displayed QR point (`public.qr_points`).
5. **Hardware Geolocation Fix:** Allow browser geolocation prompt (`navigator.geolocation.getCurrentPosition`) with `enableHighAccuracy: true`.
6. **Server Geofence Verification:** Verify that `POST /api/attendance/public-scan` validates distance to branch coordinates ($100\text{m}$ Main Spa, $150\text{m}$ SM Branch) and accuracy ($\le 75\text{m}$).
7. **Audit & State Persistence:** Confirm that the scan transaction appends to staging `public.qr_scan_events` and inserts/updates staging `public.staff_shift_checkins`.
8. **Staging Environment Teardown:** Reset test state cleanly on an isolated test instance by re-running database seeding. Never execute `supabase db reset` against any shared, staging, or production environment.

---

## 10. Confirmation of Scoped Implementation Changes

The scope of functional changes on branch `fix/attendance-qr-flow-20261101` was strictly restricted to the authorized geofence radius safety fix and its regression suite:

1. **`src/lib/attendance/geofence-server.ts`:**
   - Modified `verifyAttendanceGeofence` to look up `branchPolicy` and require `configuredRadius <= branchPolicy.radiusMeters`.
   - Main Spa radius cannot exceed $100\text{m}$.
   - SM Branch radius cannot exceed $150\text{m}$.
   - Any wider override fails closed with `"geofence_configuration"`.
   - Valid tighter overrides continue to be accepted.
   - Unknown branches, non-numeric strings, negative numbers, and zero fail closed with `"geofence_configuration"`.
2. **`tests/lib/attendance/geofence-server.test.ts`:**
   - Extended from 4 to 13 tests covering disabled mode, invalid mode, missing location, missing coordinates, default branch limits, exact boundaries, valid tighter overrides, rejected wider overrides, malformed overrides, accuracy limit (75m), freshness window (-5s to 20s), and unknown branch handling.
3. **Preservation of Existing Functionality:**
   - Zero changes made to QR scanning state machine, scanner grants, device registration, transactional scan RPCs, home-service clock-out, or exception-handling logic.

---

## 11. Remaining Risks, Limitations, & Rollback Considerations

1. **Remaining Physical-Device & Production Verification Gates:**
   - **Optical Viewfinder Performance:** Real-world camera decoding speed on physical iOS Safari (WebKit PWA) and Android Chrome.
   - **Indoor GPS Reception:** Real GPS satellite tri-lateration under indoor spa roofing to confirm field accuracy meets the $\le 75\text{m}$ threshold.
   - **PWA App Lifecycle & Multitasking:** Ensuring the 120s scan grant cookie is preserved when the PWA is backgrounded during native OS permission prompts.
   - **Production Environment Variable Requirement:** In production, `ATTENDANCE_GEOFENCE_MODE=enabled` must be explicitly configured in the hosting environment. If unset or disabled, geofence verification is bypassed.
2. **Rollback Considerations:**
   - The working branch `fix/attendance-qr-flow-20261101` is strictly isolated.
   - Because no migrations were applied to remote databases and no production code was deployed, rollback is clean, immediate, and risk-free via standard git branch switching without remote database intervention.

---

## 12. Conclusion & Owner Sign-Off Gate

The approved geofence safety correction and targeted regression tests have been implemented and verified. All automated suites pass (599 Vitest tests, 100% clean TypeScript check, 4 PostgreSQL 17 test layers). The branch remains under controlled stabilization, awaiting owner review before merge or deployment.
