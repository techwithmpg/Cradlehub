# PR #58 Attendance Dependency Slice Report — Branch Authority, Staff Schedules, and Device Registration

**Repository:** `techwithmpg/Cradlehub`\
**Target Worktree:** `E:\cradlehub\.tmp\attendance-qr-flow-20261101`\
**Branch:** `fix/attendance-qr-flow-20261101`\
**Verified HEAD:** `6f67e56ff3ea72920996c1a8be157e714c761cf5`\
**Accepted Baseline (`main`):** `18bfb406bdfbd94c0a56581446bce9b74e131162` (Merge base: `f3291826a1fb1a61107e5ce87591cd9e0b7524ef`)\
**Database Target:** Disposable LOCAL PostgreSQL 17.11 (`127.0.0.1:55444`). Strictly zero production database access or remote changes.

---

## 1. Verified Git & Working Tree State

Inspection of `E:\cradlehub\.tmp\attendance-qr-flow-20261101`:
- Current branch: `fix/attendance-qr-flow-20261101`
- Exact HEAD: `6f67e56ff3ea72920996c1a8be157e714c761cf5`
- Working tree status (`git status --porcelain=v1 --untracked-files=all`):
  ```
  ?? docs/reports/PR58-BRANCH-SCHEDULE-DEVICE-CONTRACT-REPORT-2026-11-02.md
  ?? tests/database/pr58-branch-schedule-device-local-slice.sql
  ?? tests/database/pr58-branch-schedule-device-local-test.sql
  ```
- Tracked status (`git ls-files --stage`):
  All three files are currently **untracked working-tree files**. They are preserved locally in the worktree directory on disk, but are not yet staged or committed.
- Ignore status (`git check-ignore -v`):
  Exit code `1` (none of the three files are git-ignored).

---

## 2. Artifacts & SHA-256 Checksums

| File Path | SHA-256 Checksum | Tracked Status | Description |
|---|---|---|---|
| `tests/database/pr58-branch-schedule-device-local-slice.sql` | `36748D9AFA19A4523D0305AB4DF4D44E7409CF709D891567B706F2AE97A2E0D9` | Untracked (`??`) | Dependency slice DDL, constraints, triggers, and RPCs |
| `tests/database/pr58-branch-schedule-device-local-test.sql` | `957B9C2955C5A8279C7FF3D84973F8C326A4532F3996DC8C5B5237BF9BE138D9` | Untracked (`??`) | Automated SQL test suite covering all operational and security paths |
| `docs/reports/PR58-BRANCH-SCHEDULE-DEVICE-CONTRACT-REPORT-2026-11-02.md` | Recorded on disk | Untracked (`??`) | Full evidence report and architectural documentation |

---

## 3. SQL Integrity & Source-versus-TEST Deviations

Every definition was cross-referenced against accepted repository migrations. The SQL reflects authoritative contracts plus three deliberate, documented TEST-only compatibility adjustments:

| Component / Object | Authoritative Migration Source | Classification | Verification & Deviation Analysis |
|---|---|---|---|
| `public.get_auth_staff_id()` | `20260429000003_helper_functions.sql:54-64`<br>`20260521000001_data_api_explicit_grants.sql:184` | **Accepted Contract** | Exact verbatim transcription. `SECURITY DEFINER`, `search_path=public`, returns `staff.id` where `auth_user_id = auth.uid() AND is_active = true`. |
| `staff_devices.id` default | `20260702075213_attendance_qr_system.sql:69` | **TEST-Only Compatibility Adjustment** | The narrow prerequisite fixture `pr58-staff-current-contract-local-dependencies.sql` defined `id uuid primary key` without `default gen_random_uuid()`. Applying `alter column id set default gen_random_uuid()` restores the authoritative migration contract. |
| Pre-existing device hash backfill | `20260702075213_attendance_qr_system.sql:72` | **TEST-Only Compatibility Adjustment** | Preceding test fixtures (`pr58-staff-current-contract-local-test.sql`, `pr58-staff-test-privileges-local-test.sql`) inserted two synthetic devices (`...401`, `...402`) before the hash column existed. Updating null hashes with synthetic seeds allows `NOT NULL` and `UNIQUE` constraints to apply cleanly. |
| `public.staff_devices` alterations | `20260702075213_attendance_qr_system.sql:68-83`<br>`20260703151111_attendance_device_registry_recovery.sql:8-62`<br>`20260712035222_attendance_autonomy_hardening.sql:160-209` | **Accepted Contract** | Columns (`device_role`, `security_state`, `superseded_by_device_id`, `revocation_reason`), partial unique index `staff_devices_one_active_primary_idx`, and updated_at trigger match accepted migrations. |
| `staff_devices` RLS & Grants | `20260702075213_attendance_qr_system.sql:464-491` | **Accepted Contract** | `anon` revoked completely; `authenticated` granted `SELECT` only; `service_role` granted CRUD. Policies for `owner`, branch managers, and staff self-read. |
| `public.schedule_overrides` | `20260429000001_core_tables.sql:115-130`<br>`20260703022600_add_shift_type_to_schedule_overrides.sql`<br>`20260713082146_attendance_scan_contract_repair.sql:6-25` | **Accepted Contract** | Includes `shift_type`, `ends_next_day`, and strict `schedule_overrides_time_check`. RLS front-desk CRUD policies match `20260701130413_crm_schedule_rls_grants.sql`. |
| `public.staff_attendance_branch_assignments` | `20260714143000_attendance_fluid_operations.sql:8-50`<br>`20260715113000_attendance_branch_correction_resolution.sql:42-68`<br>`20260715113002_attendance_shift_branch_closure.sql` | **Accepted Contract** | Includes `valid_from`, `valid_until`, `attendance_business_date`, `scope`, `is_test`, `consumed_checkin_id`. Authenticated `SELECT` only. |
| `public.staff_shift_checkins` | `20260523000001_staff_shift_checkins.sql`<br>`20260715113002_attendance_shift_branch_closure.sql:12-40` | **Accepted Contract** | Trigger `staff_shift_checkins_expire_branch_authorization` auto-revokes shift authorizations upon clock-out. |
| `public.staff_permanent_branch_transfers` | `20260821034409_repair_attendance_branch_authority.sql:7-64` | **Accepted Contract** | Authenticated `SELECT` only; `service_role` CRUD. |
| `public.attendance_device_audit_events` | `20260714143000_attendance_fluid_operations.sql:59-139` | **Accepted Contract** | Table and lifecycle trigger `audit_attendance_device_lifecycle()` on `public.staff_devices`. |
| `public.resolve_effective_attendance_branch` | `20260821034409_repair_attendance_branch_authority.sql:442-645` | **Accepted Contract** | Exact verbatim transcription of 4-argument and 3-argument overloads. Executable strictly by `service_role`. |
| `public.device_activation_tokens` | `20260702075213_attendance_qr_system.sql:101-114`<br>`20260703151111_attendance_device_registry_recovery.sql:79-125` | **Accepted Contract** | Revoked from client roles; `service_role` CRUD. |
| Registration RPCs table alias qualification | `20260714050554_attendance_staff_self_service.sql:190-196` | **TEST-Only Compatibility Adjustment** | In `review_staff_device_registration_request`, queries on `public.staff_devices` are qualified with table alias `sd.` (`sd.staff_id`, `sd.branch_id`) to prevent PostgreSQL PL/pgSQL runtime parser ambiguity with the return table output parameters of the same name. Function signature, interface, and logic remain unchanged. |

---

## 4. Independent Review Confirmation

- **Subagent Role:** Independent Attendance Contract Auditor
- **Subagent Conversation ID:** `683e4e70-20b9-4e99-8dcc-b07cfd894b45`
- **Files Inspected by Subagent:**
  - `tests/database/pr58-branch-schedule-device-local-slice.sql` (SHA-256: `36748D9AFA19A4523D0305AB4DF4D44E7409CF709D891567B706F2AE97A2E0D9`)
  - `tests/database/pr58-branch-schedule-device-local-test.sql` (SHA-256: `957B9C2955C5A8279C7FF3D84973F8C326A4532F3996DC8C5B5237BF9BE138D9`)
- **Review Verdict:** **PASS**
- **Findings Summary:** Verified exact source alignment, zero `anon` exposure, strict service-role isolation for sensitive administrative RPCs, comprehensive device state coverage (registered, unregistered, revoked, security-blocked, wrong-user, wrong-branch), exclusion constraint schedule overlap validation (`23P01`), replacement phone workflows, and lifecycle audit event generation.

---

## 5. Test Execution Evidence & Reproducibility

The complete verification pipeline was rerun in a fresh disposable LOCAL PostgreSQL 17.11 database (`pr58_evidence_verification_20261102` on `127.0.0.1:55444`):

```powershell
& "E:\cradlehub\.tmp\postgresql-17.11-5-windows-x64-binaries\pgsql\bin\psql.exe" -X -q -1 -v ON_ERROR_STOP=1 `
  -h 127.0.0.1 -p 55444 -U postgres -d pr58_evidence_verification_20261102 `
  -f "tests/database/pr58-staff-current-contract-local-prereqs.sql" `
  -f "tests/database/pr58-staff-current-contract-local.sql" `
  -f "tests/database/pr58-staff-current-contract-local-dependencies.sql" `
  -f "tests/database/pr58-staff-duty-assignments-baseline.sql" `
  -f "tests/database/pr58-schedule-local-correction.sql" `
  -f "tests/database/pr58-staff-current-contract-local-test.sql" `
  -f "tests/database/pr58-staff-test-privileges-overlay.sql" `
  -f "tests/database/pr58-staff-test-privileges-local-test.sql" `
  -f "tests/database/pr58-branch-schedule-device-local-slice.sql" `
  -f "tests/database/pr58-branch-schedule-device-local-test.sql"
```

**Output:**
```
PR58 current staff contract LOCAL checks passed
PR58 TEST privilege overlay LOCAL checks passed
PR58 branch authority, schedules, and device dependency slice LOCAL checks passed
```
**Exit Code:** `0` (Success).\
Both disposable verification databases (`pr58_evidence_verification_20261102` and `pr58_branch_schedule_device_stage_20261102`) were subsequently dropped cleanly via `dropdb.exe`.

---

## 6. Remaining Limitations & Required Owner Decisions

While the proposed TEST-only privilege overlay successfully removes dangerous table-level privileges (`TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`) and completely revokes `anon` access, table-wide `UPDATE` remains granted to `authenticated`.

### Technical Risk Analysis
- In PostgreSQL, RLS controls **which rows** an authenticated user can update, but does **not** restrict **which columns** can be modified once row access is granted.
- If `public.staff` is accessible via PostgREST / Supabase Data API, a user permitted by RLS to update a row could submit updates to sensitive columns on that row unless restricted by column-level privileges or trigger constraints.
- Sensitive columns at risk: `system_role` (privilege escalation), `auth_user_id` (account takeover), `branch_id` (bypassing transfer governance and triggering unintended device branch sync), and `archived_at` / `is_active` / `merged_into_staff_id` (uncontrolled deactivation).

### Required Owner Decisions Prior to Remote Application (TEST / STAGING / PROD)
1. **Field-Level Protection Strategy:**
   - *Option A (Recommended):* Implement a `BEFORE UPDATE` database trigger (`fn_staff_column_guard`) on `public.staff` that raises an exception if non-owner / non-service roles attempt to modify `system_role`, `auth_user_id`, `branch_id`, `archived_at`, or `merged_into_staff_id`.
   - *Option B:* Replace table-wide `UPDATE` with explicit column-level grants (`GRANT UPDATE (full_name, phone, tier, staff_type, is_head, nickname) ON public.staff TO authenticated`).
2. **Explicit Authorization for Remote Migration:**
   - Formal owner approval is required before applying the TEST privilege overlay (`REVOKE ALL FROM anon`, revocation of `arwdDxtm`) to remote TEST, STAGING, or PRODUCTION Supabase instances.
3. **Data API Exposure Audit:**
   - Confirm that all public scan flows and booking routes continue to execute via backend handlers using the `service_role` admin client, ensuring zero regressions when `anon` table grants are revoked in remote environments.
4. **Migration Packaging:**
   - Package the reviewed slice and privilege remediations into a clean, forward-dated migration rather than editing historical migrations or replaying candidates.

---

## 7. Evidence Verdict

**Final Verdict: PASS**

The branch authority, scheduling, and device registration dependency slice is verified, dependency-closed, and locally tested. The evidence gate is resolved with all discrepancies cataloged and confirmed.
