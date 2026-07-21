## 2026-07-22 - NOTIFICATIONS-001 validation notes

- The initial `web-push` install encountered a Windows package-store `EPERM`
  rename after package/lock changes were written. Re-running with the repository's
  pnpm 11 runtime completed the dependency state; install, type-check, test, and
  production build now pass.
- Initial notification UI lint found React 19 effect-state errors in two async
  initializers. Both loads now begin from scheduled effect callbacks; lint exits
  successfully with only the pre-existing unused Attendance helper warning.
- `pnpm exec supabase db lint --local` could not connect to
  `127.0.0.1:54322` because no local Supabase database is running. No database was
  started or reset and no remote migration was applied. The migration's RLS,
  grants, indexes, publication, and no-second-history invariants have focused
  tests, and the hand-maintained generated TypeScript additions compile.

## 2026-07-21 - CRM-PERF-002 verification and deferred evidence

- The first production build shared `.next` with an already-running user dev server and stalled without a compiler diagnostic until the command wrapper timed out. Resolution: run the same Next 16.2.4 build with a temporary isolated `distDir`; compilation, TypeScript, page collection, and all 110 route generations passed. The temporary config hook, generated output, and `tsconfig` additions were removed.
- The first navigation contract run used the wrong sidebar fixture path. It was corrected to `components/features/dashboard/sidebar.tsx`; the contract and full suite pass.
- A new Owner Reports test initially used a deliberately simplified marker object that did not satisfy the report row type. The fixture was changed to the canonical `{ name, revenue, count }` shape; type checking passes.
- `apply_patch` could not delete the two very large legacy Availability component files. They remain unreachable behind the `/crm/availability` redirect and have no active repository imports. Their seven raw refresh calls are documented as inert technical debt, not active fallbacks.
- Authenticated browser access was CRM/front-desk only. Owner Reports and Owner Marketing/Attendance Rule live click-through could not be performed in that session; automated retained-data/canonical-action evidence passes, but Owner browser certification remains pending.
- Lint exits zero with two existing unrelated warnings: unused `applyLaunchRecovery` and unused `AdminClient`.

## 2026-07-15 - FIX-003 first-login wrong-branch requests cannot resume without a device

- **User-visible symptom:** Resolving request
  `fc714d92-7644-4d66-98b3-af93b267a247` showed “The branch resolution did not
  complete. The request is still pending and can be retried.”
- **Source evidence:** Its linked scan
  `474ee58d-2f80-45f2-8dde-4f3d835af5b6` is a valid matching, non-Test-Mode
  `wrong_branch` event with action `first_scan_register_device`, but
  `qr_scan_events.device_id` is null. The staff/current/destination branch and QR
  identities match and are active; there is no open Attendance, active temporary
  authorization, active staff device, or nearby device registration to recover.
- **Exact failing operation:**
  `resumeAttendanceScanFromStoredSource(...)` rejects the source identity at the
  required-device check before `p_scan_commit` is built and before
  `resolve_staff_branch_correction_transaction(...)` is called. Its thrown
  `ATTENDANCE_TRANSACTION_FAILED` is caught without preserving the stage, so the
  branch service falls through to the generic `REVIEW_FAILED` message.
- **SQLSTATE/Supabase code:** Not applicable. No database RPC was invoked, no RPC
  row was returned, and therefore no PostgreSQL or PostgREST error exists for this
  attempt. Supabase API/Postgres log retrieval was also unavailable to this agent
  identity, but this pre-RPC path emits no resolver error log in the current code.
- **Why the source is incomplete:** During authenticated first-scan login, the
  no-existing-device wrong-branch branch returns before inserting the verified
  phone. The later correction request can link the event but cannot invent the
  missing device identity safely.
- **Atomicity evidence:** The live request remains pending, profile branch is
  unchanged, and no temporary authorization or Attendance row exists.
- **Resolution:** Authenticated first-scan login now registers the verified phone
  before canonical wrong-branch evaluation. This does not grant target-branch
  authority. Existing incomplete requests return a specific safe “ask the staff
  member to scan again” result. The supplied request remains pending and no
  arbitrary device was attached.

### Exact live RPC failure captured with a valid-device QA request

- **SQLSTATE:** `42702` (`ambiguous_column`).
- **Failed stage:** The authoritative Attendance commit inserted its continuation
  work, then the outer resolver reached the final `attendance_exceptions` update.
  PostgreSQL rejected unqualified `scan_event_id` because it can mean either the
  function's `RETURNS TABLE` output parameter or
  `attendance_exceptions.scan_event_id`.
- **Failing expression:**
  `scan_event_id = v_source_event.id or latest_scan_event_id = v_source_event.id`.
  The rejection path contains the same unsafe unqualified expression.
- **Root cause classification:** Live/local function-body defect, not missing RPC,
  permission, schema drift, JSON mismatch, source identity, internal RPC signature,
  or uniqueness conflict. The live body matches the original local migration.
- **Atomicity observed:** PostgreSQL aborted the full resolver statement. The QA
  transaction persisted no authorization, profile transfer, continuation event,
  Attendance row, exception resolution, or request decision.
- **Resolution:** Applied and recorded guarded additive migration
  `20260715113001_attendance_branch_resolution_transaction_fix.sql`. It qualifies
  both `attendance_exceptions` updates with `exception_row`, preserves invoker
  security, `search_path=public, extensions`, service-only ACL, locks, result
  contract, and all existing behavior, then refreshes PostgREST.
- **Live verification:** Shift, business-day, permanent, controlled missing-device,
  forced rollback, and same-decision second-manager replay scenarios passed in a
  rollback transaction. Duplicate authorization/Attendance assertions passed and
  post-QA counts were zero across synthetic auth, branch, staff, QR, device, scan,
  request, assignment, and Attendance rows.

## 2026-07-15 - Wrong-branch approval did not continue Attendance

- **Symptom:** The former Branch Corrections Approve action permanently changed
  `staff.branch_id` but left the captured scan unfinished and instructed staff to
  scan again. Approval intent and temporary scope were ambiguous.
- **Resolution:** Generic approval is disabled. A locked transaction now records
  temporary shift/day access, permanent transfer, or rejection and continues the
  stored scan through the canonical Attendance engine atomically.
- **Safety evidence:** Replay and uniqueness guards prevent duplicate Attendance;
  rejection creates no Attendance; synthetic QA used rollback-only records and
  left zero residue.
- **Remaining limitation:** Arbitrary date-range authorization is deliberately
  deferred. Broader migration-history drift remains unrelated; the exact focused
  version is recorded, but a blind full migration push is still unsafe.

## 2026-07-15 - Smart dynamic clock-out verification notes

- **Symptom:** The first isolated Training Mode resolver probe failed with an
  operator error comparing `schedule.id` (UUID) with
  `Attendance.schedule_source_id` (text).
- **Root cause:** The resolver followed the semantic relationship but did not
  account for the older text storage type on the Attendance snapshot column.
- **Resolution:** Compare `schedule.id::text`, reapply the idempotent migration,
  and rerun the safe probe. The first successful resolution wrote the dynamic
  schedule-backed snapshot; an identical second resolution returned
  `changed=false`. No live clock-out occurred.

- **Symptom:** The first full Vitest run had one failure in the new static
  migration contract after the UUID/text correction; 1,061 other tests passed.
- **Resolution:** Updated the assertion to require the explicit `::text` cast.
  A clean full-suite rerun is required before release.

- **Database note:** The isolated migration is live, but migration history still
  reports 81 local-only and 5 remote-only versions. Do not run a blind full
  migration push or mark this version in history until the broader drift is
  reconciled through the separate migration-history workstream.

- **Lint note:** The final linked Supabase CLI lint could not use the direct
  port-5432 path from this environment. The configured 6543 pooler did run the
  linter and reported four pre-existing ambiguous-column findings in
  `reconcile_provisional_attendance_clock_out`,
  `review_staff_device_registration_request`,
  `reset_attendance_state_transaction`, and
  `commit_attendance_scan_transaction`. It reported no finding in the new smart
  resolver, portal commit, or event-trigger functions. These older functions
  were not changed opportunistically in this release; repair them in a focused
  migration with regression coverage.

---

## 2026-07-15 - Vercel Hobby rejected frequent Attendance cron

- **Symptom:** The production deployment for the merged `main` commit was
  rejected because `vercel.json` scheduled
  `/api/attendance/closing-interventions` every five minutes.
- **Root cause:** Vercel Hobby accepts only daily cron schedules, while the
  closing worker depended on frequent HTTP execution to create and deliver due
  interventions.
- **Resolution:** Removed only the frequent Attendance Vercel entry. Supabase
  now calls one database function directly through four exact daily UTC jobs;
  three partial indexes restrict work to due open CRM closing records. The
  protected route remains manual-only and delegates to the same function.
- **Production evidence:** `pg_cron` 1.6.4 is enabled, the four jobs are active,
  a temporary direct-SQL QA cron completed three successful empty runs, the QA
  job was removed, and the verification window produced zero intervention,
  notification, or task writes.

---

## 2026-07-13 - CRADLE-ATTENDANCE-DIAGNOSTICS-AND-SCAN-REPAIR-009 scan interruption root cause

- **Symptom:** Real public Attendance QR scans could reach the workflow and then
  display generic "Scan interrupted" / "Something interrupted the scan" even
  though the backend had a concrete failure.
- **Root cause:** The public route and scan server actions caught all backend
  exceptions and returned a generic HTTP 200 result. At the same time, scan
  engine exceptions used internal values such as `missing_schedule`,
  `ambiguous_scan`, `late_clock_in`, `early_clock_out`, and
  `likely_closing_scan_without_clock_in`, while the live
  `attendance_exceptions.exception_type` CHECK constraint only allows stable DB
  values such as `unscheduled`, `late`, `early_leave`, `overtime`,
  `missed_checkout`, and `manual`.
- **Impact:** Atomic scan commits could fail on a Recovery exception insert, and
  the phone saw only a generic interruption instead of a safe actionable code.
- **Resolution:** Internal exception reasons now map to stable DB exception
  values before the RPC/direct insert, with the original internal reason stored
  in metadata for Recovery UI. Public route/actions now return structured safe
  error codes with operation IDs and non-200 status for unexpected backend
  failures.

- **Symptom:** `supabase db push --linked --dns-resolver https` still times out
  on the direct Postgres pooler from this environment.
- **Impact:** The attendance scan contract migration could not be applied via
  normal migration push. The remote migration history also remains partially
  behind live schema effects from prior manual repairs.
- **Resolution:** Applied
  `20260713082146_attendance_scan_contract_repair.sql` idempotently through
  linked `db query` and inserted the migration record for this version. Future
  DB work should reconcile the broader recent migration history from a working
  direct DB path before a blind `db push`.

---

## 2026-07-13 - CRADLE-SCHEDULE-LEFTOVER-CLEANUP-008 data cleanup note

- **Symptom:** The first stale schedule cleanup approach attempted to mark
  deterministic superseded active `single` windows inactive, but the live
  `validate_staff_schedule_window` trigger only allows inactive rows as the
  canonical day-off marker (`single`, `window_order=1`, `00:00-00:01`,
  `ends_next_day=false`).
- **Impact:** Updating stale overlapping rows to inactive would either fail the
  trigger or collide with existing day/window identity. It also would leave
  ambiguous inactive siblings in the runtime table after the schedule contract
  moved to explicit ordered windows.
- **Resolution:** The live-applied cleanup backs up affected rows to
  `schedule_repair_backups` first, then deletes only deterministic stale active
  `single` windows that are superseded by newer active Opening/Closing rows.
  Ambiguous overlapping Opening/Closing data remains active for CRM review.

- **Symptom:** Linked Supabase migration-history reads through the direct
  pooler path still time out from this environment.
- **Impact:** The live schema/data effects of
  `20260713090000_schedule_leftover_cleanup.sql` are verified through linked SQL
  probes, but migration-history reconciliation is not certified here.
- **Resolution:** Reconcile recent schedule migrations from a working
  migration-history connection before any blind migration push.

---

## 2026-07-13 - CRADLE-SCHEDULE-SYSTEM-UNIFICATION-007 database notes

- **Symptom:** Before this task, Daily Timeline realtime subscriptions included
  schedule tables but the linked database publication had none of the required
  runtime tables in `supabase_realtime`.
- **Impact:** Client subscriptions could be wired correctly while Postgres
  changes still failed to publish for schedules, overrides, blocks, check-ins,
  bookings, staff, or resources.
- **Resolution:** Added and live-applied
  `supabase/migrations/20260713064332_schedule_realtime_publication.sql`.
  Verification confirmed `staff`, `staff_schedules`, `schedule_overrides`,
  `blocked_times`, `staff_shift_checkins`, `bookings`, and
  `branch_resources` are now published.

- **Symptom:** Linked Supabase migration-history reads through the direct
  pooler path remain unreliable/time out from this environment.
- **Impact:** Live schema effects for schedule repair and realtime publication
  are verified through Management API SQL probes, but migration history is not
  certified from this environment.
- **Resolution:** Do not blind `db push`; reconcile migration history from a
  working migration-history connection, then rerun DB status/types and app
  verification.

---

## 2026-07-12 - ATTENDANCE-AUTONOMY-HARDENING-001 blockers and prevention notes

- **Symptom:** Local migration verification cannot run because `supabase migration list --local` cannot connect to `127.0.0.1:54322`.
- **Impact:** `supabase/migrations/20260712000100_attendance_state_reset.sql` and `supabase/migrations/20260712035222_attendance_autonomy_hardening.sql` are ready locally but were not verified as applied in a local Supabase database.
- **Resolution:** Start/repair local Supabase or use the repository's approved working remote DB path, then rerun migration list/status and regenerate types. Do not manually alter migration history.

- **Symptom:** Linked migration-history reads still time out to `aws-1-ap-northeast-1.pooler.supabase.com:5432`.
- **Impact:** `pnpm db:status` exits non-zero after reporting `Remote schema changed: no`; `pnpm db:doctor` passes CLI/link/token/pooler checks but exits with migration-history timeout.
- **Resolution:** Confirm DB password/network/pooler access from a working environment, apply pending migrations there, then rerun `pnpm db:status`, `pnpm db:types`, `pnpm type-check`, `pnpm test`, and `pnpm build`.

- **Symptom:** `pnpm db:types` succeeded against the linked schema, but the remote schema does not yet include pending local migrations.
- **Impact:** Generated types briefly regressed local pending columns such as `branch_booking_rules.home_service_free_km` and new Attendance hardening fields.
- **Resolution:** Reconciled `src/types/supabase.ts` locally for pending migration columns after generation. Prevention: avoid treating linked type generation as final while unapplied local migrations exist.

- **Symptom:** Attendance scan persistence is still app-level orchestration, not a single PostgreSQL transaction.
- **Impact:** App-level idempotent replay reduces retry duplication, and indexes/constraints reduce duplicate records, but simultaneous scan edge cases are not fully closed until the database owns the transaction.
- **Resolution:** Implement a transactional scan RPC that reserves request id, locks staff/shift state, resolves or commits the final result, writes scan/Recovery/audit records, and returns the committed result.

- **Symptom:** Attendance corrections now check failed updates/audits, but not every correction action is wrapped in one database transaction.
- **Impact:** A later multi-step failure can still leave partial state for correction flows that are not yet RPC-backed.
- **Resolution:** Move Reset Attendance State, manual clock-in/out, adjust, void, rebuild, resolve exception, and archive test data into transactional RPCs with permission checks and row locks.

---

## 2026-07-12 - ATTENDANCE-TODAY-ALIGNMENT-RESET-001 verification notes

- **Symptom:** `pnpm db:doctor` and `pnpm db:status` still time out while reading linked Supabase migration history on `aws-1-ap-northeast-1.pooler.supabase.com:5432`, even after unrestricted retries.
- **Impact:** New migration `supabase/migrations/20260712000100_attendance_state_reset.sql` was created locally but not applied/pushed from this environment. The app code type-checks/builds, but production use of `reset_attendance_state` requires the migration.
- **Resolution:** App verification passed locally. `pnpm db:status` reported `Remote schema changed: no` before failing the migration-history read. Apply/push from a working DB path and rerun `pnpm db:status`, `pnpm db:types`, and app checks.

- **Symptom:** `git diff --check` exits non-zero because of pre-existing unrelated blank-line-at-EOF issues in non-attendance files plus line-ending warnings across the dirty worktree.
- **Impact:** Whitespace check cannot be used as a clean final gate for this task without editing unrelated files.
- **Resolution:** No unrelated files were cleaned. Attendance edits passed type-check/lint/test/build; the `git diff --check` findings should be handled in a separate cleanup window.

---

## 2026-07-11 - CRM-PERFORMANCE-OPTIMIZATION-001 verification note

- No new application defect or blocker was found during the performance pass.
- Bookings remains NOT CERTIFIED only because authenticated browser interaction QA is still pending from the existing certification record.
- Broad bundle/query/database optimizations were deferred by guardrail, not because of a failing check.

---

## 2026-07-10 - ATTENDANCE-RECOVERY-RULES-001 migration/QA follow-up

- New migration `supabase/migrations/20260710040835_attendance_recovery_rules.sql` was created locally for Attendance Recovery rule fields and correction audit columns, but it was not applied/pushed during the implementation pass.
- Until that migration is applied, the page can still read Attendance data with normalized defaults, but new correction/rule actions that write the new audit columns/action types may fail on a shared database.
- Authenticated CRM browser QA is still recommended after migration application for Recovery Rules, Apply Recovery, manual clock-out, and staff-day reset flows.

---

## 2026-07-02 - ATTENDANCE-REFIT-005 NEXT_REDIRECT and browser QA notes

- **Symptom:** Routine Attendance mutations such as QR generation could expose `NEXT_REDIRECT`-style behavior in the UI and made tab/action flows feel like route work instead of local workspace updates.
- **Root cause:** Attendance server actions used redirect/status-query patterns for normal success/error feedback. Under Server Actions, redirects are control-flow exceptions; surfacing them from routine mutations created confusing UX and could show framework internals.
- **Resolution:** `src/app/(dashboard)/crm/attendance/actions.ts` now returns typed `AttendanceActionResult` payloads. The client workspace handles toasts, inline notices, and local state updates without `redirect()`, `router.refresh()`, or status query params for routine actions.
- **Related performance root cause:** Tab switches were URL/route driven. The refit keeps one mounted client workspace and mirrors tab state with `window.history.replaceState()`, so switching Overview/Records/Sessions/QR Codes/Devices/Exceptions/Reports does not tear down local state.
- **Browser verification limitation:** Existing local dev server reached `http://localhost:3000/crm/attendance`, but unauthenticated browser traffic redirected to `/login`. `agent-browser` verified the login page has content and no Next/Vite overlay. Authenticated Attendance browser QA still needs a valid CRM/front-desk session.

---

## 2026-06-17 - AUTH-RESET-SUPABASE-CONNECTION-001 verification/config note

- Password-reset implementation validation passed: `pnpm type-check`, `pnpm lint` (0 errors, 4 existing warnings), `pnpm test` (49 files / 513 tests), `pnpm build` (100 routes), and requested unsafe scans.
- Production configuration still matters outside the repo: set Vercel/host `NEXT_PUBLIC_APP_URL` to the deployed CradleHub origin and configure Supabase Auth Site URL/Redirect URLs for `https://cradlewellnessliving.com` and `/reset-password`.
- The service-role scan still finds `src/lib/supabase/admin.ts`, which is expected and server-only; no client service-role exposure was introduced.
- Authenticated manual QA should still click a real Supabase recovery email in local/prod to confirm the provider email template uses the configured `/reset-password` redirect.

---

## 2026-06-17 - AUTH-STAFF-RECOVERY-001 verification note

- `pnpm test` still reports the known unrelated booking progress failures in `tests/lib/bookings/progress.test.ts`:
  1. `blocks not_started -> session_started (must check in first)`
  2. `returns correct actions for walkin not_started`
- Auth recovery focused tests, type-check, lint, build, credential/token scan, and client service-role scan passed.
- No new auth-specific blocker was found.

---

## 2026-06-17 - CRM-INDIVIDUAL-SCHEDULE-LIVE-SYNC-001 findings and QA note

- **Silent schedule save risk found and fixed:** Both CRM individual schedule save paths could report success without selecting saved `staff_schedules` rows back. The fixed actions now use the verified `staff_id,day_of_week,shift_type` conflict target, chain `.select(...)`, verify returned row count, and return safe CRM-facing errors.
- **Live Staff source mismatch found and fixed:** Live Staff combined `get_daily_schedule` work spans with a separate raw active `staff_schedules` query for shift labels. It now uses resolved `schedule_windows` from the shared resolver.
- **Group fallback mismatch found and fixed in app resolver:** Inactive individual rows now mean individual day off and do not fall through to group fallback in Live Staff or booking availability post-filter.
- **RLS finding:** Existing migrations cover authenticated table grants plus branch-scoped SELECT/INSERT/UPDATE for operational CRM/CSR roles on `staff_schedules`; no new RLS migration was needed for the upsert flow. Operational DELETE remains not broadened.
- **Authenticated visual QA limitation:** Code-level validation passed, but a real CRM-authorized browser session is still needed for manual modal/table confirmation.

---

## 2026-05-28 - CRM-MODAL-002 scroll bug diagnosis

- **Symptom:** Edit Service Capabilities modal footer visible, but services continued below viewport with no usable scroll. Expanded category content was cut off behind footer.
- **Root causes identified:**
  1. `AdminDialog` used `top-1/2 left-1/2 translate-x/y-1/2` centering. For tall content, the centered fixed element could push against viewport edges, making the inner scrollbar clipped or unreachable.
  2. Stacked accordion layout rendered all categories into one scroll column. When a category with 50+ services expanded, the single `overflow-y-auto` body had to contain all of it. The flex parent (`DialogPrimitive.Popup`) had `max-h` but the flex algorithm didn't reliably establish a definite height for the `flex-1` body in all browsers.
  3. `pb-24` padding-bottom hack on the body was an attempt to clear the footer, but padding-bottom in `overflow-y-auto` containers is inconsistently respected by browsers during overflow.
  4. Inline styles throughout the component made layout debugging fragile.
- **Resolution:**
  - Changed `AdminDialog` to `top-6` top-anchored positioning with explicit `h-auto max-h-[calc(100dvh-3rem)]`.
  - Rewrote `staff-service-editor-sheet.tsx` with split-pane layout: category rail + independently scrollable service list panel.
  - `AdminOverlayBody` uses `overflow-hidden p-0 flex flex-col`; inner wrapper is `flex flex-1 min-h-0 flex-col sm:grid sm:grid-cols-[220px_1fr]`.
  - Only active category services render in the right panel.
  - Removed all inline styles; everything uses Tailwind utilities.
  - Replaced `baselineRef` (read in `useMemo`) with `baselineIds` state to avoid React ref-in-render errors.

---

## 2026-05-29 - CRM-SCHEDULE-AVAILABILITY-001 verification notes

- **Lint issue found and fixed:** Initial `pnpm lint` failed on `react-hooks/set-state-in-effect` in the new modal tabs and modal shell. Refactored prop-derived state into mount-time state with keyed modal content, removing synchronous state resets from effects.
- **Browser verification blocked:** `/crm/schedule` and `/crm/schedule?tab=staff` both redirected to `/login` on the currently running local dev server. Authenticated modal click-through still needs a valid local CRM session.
- **Pre-flight file note:** Root `ROADMAP.md`, `PROJECT_CONTEXT.md`, and `AGENT_RULES.md` were not present at the repository root. Read available equivalents in `docs/` / `.claude/worktrees/.../docs/` plus `CLAUDE.md` and `AGENTS.md`.

---

## 2026-05-29 - CRM-SCHEDULE-AVAILABILITY-002 RLS and permission diagnosis

- **Symptom:** CRM Edit Availability modal appeared to work visually but saving schedule edits was blocked for CRM/CSR users.
- **Root causes identified:**
  1. `staff` table RLS had no branch-read policy for CRM/CSR roles. `getStaffWithAvailability` (regular Supabase client) returned only the logged-in CRM user's own record, so the Staff Schedule tab showed only 1 staff member.
  2. `staff_schedules`, `schedule_overrides`, and `blocked_times` RLS policies were manager/owner-only. CRM/CSR could not write schedule data through the regular client.
  3. The Day Overrides and Block Time tabs call `manager/staff/actions.ts`, which uses the regular client. These tabs failed silently for CRM because RLS blocked the writes.
  4. The Weekly Hours tab used `createAdminClient()` (service role) in its server action, which bypassed RLS. This masked the real problem and created inconsistency.
  5. `SCHEDULE_EDIT_ROLES` in both action files excluded `csr_staff` and `csr`.
  6. `canAdjustStaffSchedule()` in `permissions.ts` excluded `csr_staff` and `csr`.
- **Resolution:**
  - Created migration `20260529000002_crm_csr_schedule_rls.sql` adding branch-scoped RLS policies for all operational roles on `staff`, `staff_schedules`, `schedule_overrides`, and `blocked_times`.
  - Replaced manager-only schedule policies with operational-role policies covering `manager`, `assistant_manager`, `store_manager`, `crm`, `csr_head`, `csr_staff`, `csr`.
  - Expanded `SCHEDULE_EDIT_ROLES` in `crm-schedule-availability.ts` and `manager/staff/actions.ts`.
  - Switched CRM weekly action from `createAdminClient()` to `createClient()` for defense-in-depth.
  - Updated `canAdjustStaffSchedule()` to include CSR staff.
- **Verification:** `pnpm type-check` ✅, `pnpm lint` ✅, `pnpm build` ✅ (89 routes).

---

## 2026-05-29 - CRM-STAFF-PROFILE-SAVE-001 RLS and permission diagnosis

- **Symptom:** CRM/CSR user `86ce597a-2e35-4741-8394-fa84fc21c00e` could not save staff profile edits from the CRM Edit Staff Profile drawer. Owner/dev accounts could save successfully.
- **Root causes identified:**
  1. `staff` table had no UPDATE RLS policy for operational roles. The only UPDATE policy was `staff_owner_all` (owner only). CRM/CSR users could SELECT via `staff_operational_read_branch` but could not UPDATE.
  2. `staff_services` table had no WRITE policy for operational roles. Only `staff_services_manager_all` (manager only) and `staff_services_owner_all` allowed writes.
  3. `MANAGER_SAFE_ROLES` in `updateStaffAction` was missing `driver` and `utility`, blocking role assignment to those valid staff types.
  4. `updateStaffAction` had no defensive check for 0 rows affected. If RLS silently blocked the UPDATE, `updateResult.error` would be null and the action would return `{ success: true }`, masking the failure.
- **Resolution:**
  - Extended migration `20260529000002_crm_csr_schedule_rls.sql` with:
    - `staff_operational_update_branch` policy (UPDATE) for operational roles on staff in their branch.
    - `staff_services_operational_all` policy (ALL) for operational roles on `staff_services` in their branch, replacing `staff_services_manager_all`.
  - Added `driver` and `utility` to `MANAGER_SAFE_ROLES` in `src/app/(dashboard)/owner/staff/actions.ts`.
  - Added defensive 0-row check after `staff` UPDATE in `updateStaffAction`.

---

## 2026-05-29 - CRM-STAFF-PROFILE-SAVE-002 Final fix and silent failure elimination

- **Symptom:** CRM/CSR user `86ce597a-2e35-4741-8394-fa84fc21c00e` still could not save staff profile edits after the 001 fix.
- **Root causes identified:**
  1. **Migration never applied:** `supabase db push` could not connect (timeout at "Initialising login role..."), so the `staff_operational_update_branch` policy never reached production. The SQL execution attempt failed with `42501: must be owner of table staff` because it was run through a non-owner connection.
  2. **Silent failure pattern in Supabase client:** `.update().eq("id", ...)` without `.select()` returns `error: null, status: 204` even when RLS blocks the update. The server action returned `{ success: true }` because both `error` and `count` were null.
  3. **Missing `nickname` field:** `updatePayload` in `updateStaffAction` did not include `nickname`, so nickname edits were silently dropped even when the update succeeded.
  4. **Same pattern in `toggleStaffActiveAction`:** Also vulnerable to silent RLS failures.
- **Resolution:**
  - Created new idempotent migration `20260529000003_crm_csr_staff_update_rls.sql` to reliably add the policies.
  - Fixed `updateStaffAction` to chain `.select("id")` after `.update()` and verify `data.length > 0`. RLS blocks now surface as `"No rows were updated..."`.
  - Fixed `toggleStaffActiveAction` with the same `.select("id")` + 0-row detection.
  - Added `nickname` to `updatePayload`.
  - Added `driver` and `utility` to `MANAGER_SAFE_ROLES`.
- **Verification:** `pnpm type-check` ✅, `pnpm lint` ✅, `pnpm build` ✅.

---

## 2026-05-30 - CRM-BACKEND-STABILIZATION-001 root causes and resolutions

### Silent failure pattern (Supabase .update() without .select())
- **Symptom:** Server actions returned `{success:true}` or `{ok:true}` even when RLS blocked the DB write.
- **Root cause:** Supabase client `.update().eq(...)` without `.select()` returns `error:null, status:204` on RLS block — indistinguishable from a successful 0-row update.
- **Resolution:** All CRM mutation actions now chain `.select("id")` and check `data.length === 0`.
- **Files fixed:** `crm/actions.ts`, `crm/bookings/actions.ts`, `crm/waitlist/actions.ts`, `crm/reconciliation/actions.ts`, `owner/staff/actions.ts`

### "Unauthorized" from schedule weekly save — case-insensitive UUID mismatch
- **Symptom:** `updateCrmStaffWeeklyAvailabilityAction` returned `{ok:false,error:"Unauthorized"}` for csr_staff even though the role was in `SCHEDULE_EDIT_ROLES`.
- **Root cause:** `getScheduleEditContext` compared `me.branch_id !== branchId` using JavaScript `!==` which is case-sensitive. Zod v4's `z.guid()` preserves input case without normalising to lowercase, while PostgreSQL UUIDs from the DB are lowercase. Any case difference in the branch ID string caused the branch-scope check to fail.
- **Resolution:** Changed comparison to `.toLowerCase()` on both sides. Also changed generic null → "Unauthorized" return to specific typed error messages per failure path.
- **File:** `src/lib/actions/crm-schedule-availability.ts`

### Zod v4 z.string().uuid("msg") compatibility
- **Symptom:** `updateStaffServicesFromCrmAction` returned `{ok:false,message:"Invalid service ID"}` for all inputs including valid UUIDs.
- **Root cause:** Zod v4 changed how `z.string().uuid("rawString")` interprets the raw string argument vs `z.guid("msg")` which is Zod v4 native.
- **Resolution:** Changed `z.array(z.string().uuid("Invalid service ID"))` to `z.array(z.guid("Invalid service ID"))`.
- **File:** `src/lib/actions/crm-staff-services.ts`

---

## 2026-05-30 - CRM-EDIT-STAFF-PROFILE-TABBED browser verification limitation

- **Symptom:** Browser verification for `/crm/staff?tab=management` could not complete in the in-app browser.
- **Observed behavior:** PowerShell `Invoke-WebRequest` returned HTTP 200 for the route, but the in-app browser reported `ERR_CONNECTION_REFUSED` after the route redirected toward `/login`.
- **Impact:** Type-check, lint, and production build passed, but authenticated visual click-through of the modal still needs a reachable local browser session and valid CRM/CSR login.
- **Resolution:** No code change required for this limitation. Re-run browser verification once the local browser can reach `localhost:3000` and a CRM/CSR session is available.

---

## 2026-05-31 - CRM route-tab audit fragile dependencies

- **Bookings deep-link mismatch:** Multiple CRM components link to `/crm/bookings?highlight=<bookingId>`, but the Bookings workspace currently selects/open rows from `bookingId`, not `highlight`. Impact: deep links from Today/action queues may land on Bookings without selecting the intended booking. Mitigation: normalize links to `bookingId` or teach Bookings to consume `highlight` before converting booking filters.
- **Staff availability tab param ignored:** Links to `/crm/staff-availability?tab=coverage|individual|overrides` exist, but `/crm/staff-availability` does not read `tab`. Impact: deep links from Schedule right rails can land on the wrong default panel. Mitigation: preserve and implement initial tab support or redirect those links to the future canonical Schedule tab.
- **Waitlist stale followup risk:** Waitlist followup is reached through `/crm/customers?tab=followup`, while waitlist status updates revalidate `/crm/waitlist`. Impact: after status changes, the Customers followup tab can show stale rows. Mitigation: revalidate `/crm/customers` and/or apply local optimistic removal when this tab is converted.

---

## 2026-05-31 - CRM-STAFF-TABS-001 browser verification limitation

- **Symptom:** Browser route checks for `/crm/staff` and each Staff `?tab=` deep link redirected to `/login` in the in-app browser.
- **Impact:** Authenticated click-through could not verify Staff Management rendering, Service Assignments rendering, Status rendering, Applications review behavior, edit profile save, service capabilities save, activate/deactivate, or green success toasts.
- **Resolution:** Code-level verification, type-check, lint, and production build passed. Re-run browser verification with a valid local CRM/CSR session.

---

## 2026-06-03 - CRM-BOOKINGS-WORKFLOW-001 browser/auth verification limitation

- **Symptom:** Shell route checks for `/crm/bookings?tab=needs-confirmation`, `/crm/bookings?tab=confirmed`, and `/crm/bookings?tab=callback-followup` returned HTTP 200, but full visual click-through could not be completed because a valid local CRM/CSR browser session was not available. Tool discovery also did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Code-level checks, production build, and unauthenticated route/API smoke checks passed, but manual modal flows still need authenticated verification: Booking Follow-up, Customer Arrived, Assign Room / Change Room, and Callback Follow-up actions.
- **Resolution:** No code change required for this limitation. Re-run authenticated browser verification on `http://localhost:3000/crm/bookings?tab=needs-confirmation` after logging in as a CRM/CSR user.

---

## 2026-06-03 - CRM-BOOKINGS-COMMAND-CENTER-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached the existing local dev server at `http://localhost:3000`, but `/crm/bookings` redirected to `/login`.
- **Impact:** The command-center redesign passed type-check, lint, and build, but the authenticated visual check of the Bookings Command Center, selected-booking panel, and modals still needs a valid local CRM/CSR browser session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a CRM/CSR user.

---

## 2026-06-03 - CRM-SCHEDULE-FULL-CALENDAR-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/crm/schedule`, but the route redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and route reachability passed, but the authenticated visual check for selecting a staff member and opening the `View Full Schedule` modal still needs a valid local CRM/CSR session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a CRM/CSR user, then open `/crm/schedule`, select a staff member, and click `View Full Schedule`.

---

## 2026-06-03 - AUTH-WORKSPACE-SWITCHING-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/select-workspace`, but unauthenticated traffic redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and unauthenticated proxy behavior passed, but full workspace-switch click-through still needs local authenticated users for CRM-only, Staff-only, CRM+Staff, Driver, Owner/Admin, and no-workspace cases.
- **Resolution:** No code change required for this limitation. Re-run authenticated browser verification with seeded users for each access combination.

---

## 2026-06-03 - STAFF-PORTAL-SHELL-NAV-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/staff-portal/profile`, but unauthenticated traffic redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and route reachability passed, but visual confirmation of the authenticated Staff Portal sidebar still needs a valid local staff/CSR+staff session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a multi-access CSR/staff user and opening `/staff-portal/profile`.

---

## 2026-06-03 - STAFF-PORTAL-PROFILE-EDIT-001 browser/auth verification limitation

- **Symptom:** The in-app browser reached `http://localhost:3000/staff-portal/profile`, but unauthenticated traffic redirected to `http://localhost:3000/login`.
- **Impact:** Type-check, lint, production build, and protected-route reachability passed, but the authenticated Staff Portal profile edit/save flow still needs a valid local staff session.
- **Resolution:** No code change required for this limitation. Re-run browser verification after logging in locally as a staff or CSR+staff user, edit Full Name/Nickname, save, and confirm role/tier fields remain locked.

---

## 2026-06-03 - DRIVER-STAFF-PORTAL-MOBILE-001 browser/auth verification limitation

- **Symptom:** The existing local dev server at `http://localhost:3000` responded, but unauthenticated staff portal routes redirected to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this thread.
- **Impact:** Code-level checks, production build, and protected-route smoke checks passed, but the authenticated mobile visual flow still needs a valid driver staff session to confirm the persistent bottom nav, Profile sheet save/photo controls, schedule cards, and driver job actions in-browser.
- **Resolution:** No code change required for this limitation. Re-run authenticated browser verification after logging in locally as a driver staff user, then check `/staff-portal`, `/staff-portal/dispatch`, `/staff-portal/map`, `/staff-portal/jobs`, `/staff-portal/schedule`, `/staff-portal/stats`, and the Profile bottom sheet.

---

## 2026-06-04 - MOBILE-NAV-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected staff and driver mobile routes redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** `pnpm type-check`, `pnpm lint`, `pnpm build`, and unauthenticated route reachability passed, but visual mobile confirmation of the floating glass nav still needs valid local Basic Staff, Therapist, Driver Staff Portal, and standalone Driver sessions.
- **Resolution:** No code change required for this limitation. Re-run authenticated mobile browser verification at 390px width after logging in, checking `/staff-portal`, `/staff-portal/schedule`, `/staff-portal/service-progress`, `/staff-portal/dispatch`, `/driver`, and `/driver/dispatch`.

## 2026-06-04 - MOBILE-NAV-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, and local Next.js docs in `node_modules/next/dist/docs/`.
- **Resolution:** No code change required.

---

## 2026-06-04 - DRIVER-TRIPS-MOBILE-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected `/driver/dispatch` and `/staff-portal/dispatch` routes redirected unauthenticated traffic to `/login`.
- **Impact:** Type-check, lint, production build, diff check, and route reachability passed, but the authenticated mobile visual check of the new Trips tabs/cards still needs a valid local driver staff session.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, checking Today, Upcoming, History, active trip, empty states, and bottom nav persistence.

---

## 2026-06-04 - DRIVER-MAP-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected `/staff-portal/map`, `/driver/map`, and `/driver/dispatch` routes redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but the authenticated mobile visual check of the new Route Map header, summary chips, map panel, bottom sheet, actions, stops strip, and persistent bottom nav still needs a valid local driver staff session.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, then check `/staff-portal/map` and `/driver/map`.

## 2026-06-04 - DRIVER-MAP-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, and local Next.js docs in `node_modules/next/dist/docs/`.
- **Resolution:** No code change required.

---

## 2026-06-04 - DRIVER-JOBS-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected `/driver/jobs`, `/staff-portal/jobs`, and `/driver/dispatch` routes redirected unauthenticated traffic to `/login`.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but the authenticated mobile visual check of the Jobs header, tabs, summary row, active job timer, cards, detail links, center nav button, and persistent bottom nav still needs a valid local driver staff session.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, then check `/driver/jobs` and `/staff-portal/jobs`.

## 2026-06-04 - DRIVER-JOBS-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, and local Next.js docs in `node_modules/next/dist/docs/`.
- **Resolution:** No code change required.

---

## 2026-06-04 - DRIVER-PROFILE-EDIT-001 browser/auth verification limitation

- **Symptom:** Shell route checks reached the existing local dev server at `http://localhost:3000` and returned the expected 307 redirects to `/login`, but the in-app browser stayed on a Chrome connection-refused interstitial for `localhost:3000/login`.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but authenticated visual verification of the Profile bottom sheet still needs a valid local driver staff session and reachable in-app browser.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as a driver staff user, then open Profile from Home, Trips, Map, and Jobs, test Edit Profile, Cancel, Save Changes, photo upload, and Logout.

## 2026-06-04 - DRIVER-PROFILE-EDIT-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Supabase skill guidance.
- **Resolution:** No code change required.

---

## 2026-06-04 - MOBILE-LOADING-001 browser/auth verification limitation

- **Symptom:** The local dev server at `http://localhost:3000` responded, but protected driver and staff mobile routes redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Type-check, lint, production build, diff check, and protected-route reachability passed, but authenticated mobile visual confirmation of the top route-progress line, no-progress Profile modal behavior, and skeleton pairing still needs valid local staff/driver sessions.
- **Resolution:** No code change required. Re-run authenticated mobile browser verification at 390px width after logging in as Basic Staff, Therapist, and Driver users.

## 2026-06-04 - MOBILE-LOADING-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.
- **Resolution:** No code change required.

---

## 2026-06-04 - SCHEDULE-RULE-BUILDER-UI-001 browser/auth verification limitation

- **Symptom:** The local app routes for `/crm/staff-availability`, `/crm/staff-availability?tab=individual`, `/crm/staff-availability?tab=coverage`, and `/manager/staff-availability` redirected unauthenticated traffic to `/login`. Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Type-check, lint, production build, diff check, targeted code scan, and protected-route reachability passed, but authenticated visual confirmation of the redesigned General Rules and Individual Adjustments screens still needs a valid CRM/manager session.
- **Resolution:** No code change required. Re-run authenticated browser verification after logging in locally as CRM/manager, checking group switching, individual staff switching, save/reset states, overnight badges, role-specific shift columns, and responsive spacing.

---

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.
- **Resolution:** No code change required.

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 lint fix

- **Symptom:** Initial `pnpm lint` found two `react/no-unescaped-entities` errors in newly added therapist picker copy.
- **Impact:** Lint failed until the apostrophes were escaped.
- **Resolution:** Replaced the offending apostrophes with `&apos;`, then re-ran `pnpm type-check`, `pnpm lint`, and `pnpm build` successfully.

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 browser verification limitation

- **Symptom:** Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** `/book` returned HTTP 200 from the local dev server, but visual browser QA of the public booking therapist dropdown was limited to code review and route smoke testing.
- **Resolution:** No code change required. Run manual browser QA through the public booking flow to confirm final spacing with real service, location, slot, and provider data.

## 2026-06-05 - BOOKING-THERAPIST-DROPDOWN-001 availability API network timeout

- **Symptom:** During local dev-server smoke testing, `/book` loaded with HTTP 200, but one `/api/booking/available-slots` request returned 500 because the underlying availability RPC fetch timed out while connecting to the remote service.
- **Impact:** The page route and production build passed, but full slot-loading verification was limited by the remote fetch timeout in the local environment.
- **Resolution:** No code change made because the therapist picker did not change slot-fetching logic. Re-test the full booking flow when the remote backend is reachable.

---

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; used `.context/*` files, `AGENTS.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.
- **Resolution:** No code change required.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 lint fix

- **Symptom:** Initial `pnpm lint` found one `react-hooks/set-state-in-effect` error in `CradleBreathReveal`.
- **Impact:** Lint failed until immediate dismiss state updates were moved into browser callbacks.
- **Resolution:** Changed synchronous effect dismissals to zero-delay timeout callbacks, then re-ran `pnpm type-check`, `pnpm lint`, and `pnpm build` successfully.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 headless browser sandbox limitation

- **Symptom:** Initial non-escalated Chrome/Edge headless screenshot attempts failed with Windows crashpad/mojo access errors.
- **Impact:** Visual mobile verification needed an escalated one-time headless Chrome run and a temporary dev server on port 3001.
- **Resolution:** Captured mobile screenshots successfully after starting the temporary dev server in the same elevated context, then stopped the server.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-001 existing image sizes warnings

- **Symptom:** During screenshot verification, the dev server emitted existing Next/Image warnings for older `/images/spa/hero.jpg` and `/images/spa/cta-banner.jpg` usage.
- **Impact:** No blocker for this scoped mobile hero change; the warnings come from unchanged desktop/lower-section public image surfaces.
- **Resolution:** No code change made because the task explicitly did not redesign desktop or sections below the mobile hero.

---

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-FIX-001 root loading shell mismatch

- **Symptom:** Public mobile homepage could show the old generic gray skeleton before the Cradle Breath Reveal.
- **Impact:** The first-load experience felt disconnected from the new branded reveal/hero.
- **Root cause:** Root `src/app/loading.tsx` still rendered generic `Skeleton` blocks. Because root `loading.tsx` is the streamed Suspense fallback for the root segment, it can appear before public route content is ready.
- **Resolution:** Replaced the root fallback with a Cradle-branded deep-green loading bridge. Existing dashboard/staff/driver/CRM route-specific loading files remain in place.

## 2026-06-05 - PUBLIC-MOBILE-HOME-REVEAL-FIX-001 browser tool fallback

- **Symptom:** Tool discovery did not expose an in-app browser navigation/screenshot tool in this turn.
- **Impact:** Visual QA could not use the Browser plugin directly.
- **Resolution:** Captured mobile screenshots successfully with local headless Chrome against the already running `http://localhost:3000` dev server.

---

## 2026-06-05 - PUBLIC-MOBILE-HOME-DARK-SECTIONS-001 headless browser verification blocked

- **Symptom:** Non-escalated headless Chrome failed with Windows crashpad/mojo access denied errors while attempting mobile homepage screenshot capture.
- **Impact:** Automated screenshot verification of the dark mobile homepage sections could not be completed in this turn.
- **Resolution:** Requested escalation for the headless Chrome verification run, but the request was declined. Completed non-browser verification instead: `GET /` HTTP 200, rendered heading checks, targeted source scan for light card classes, `pnpm type-check`, `pnpm lint`, `pnpm build`, and `git diff --check`.

---

## 2026-06-06 - PUBLIC-MOBILE-LOADING-TRANSITIONS-001 browser verification limitation

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser navigation or screenshot controller during this turn.
- **Impact:** Visual confirmation of the intro animation, route-line timing, and back-navigation behavior was limited to code review, local HTTP route checks, rendered markup checks, and build/lint/type verification.
- **Resolution:** No code change required. Run manual mobile browser QA at a 390px viewport: clear `sessionStorage`, open `/`, confirm one short intro, navigate among `/services`, `/book`, `/branches`, `/about`, `/contact`, return to `/`, and confirm booking wizard step changes do not trigger the public route line.

---

## 2026-06-06 - PUBLIC-BOOKING-MOBILE-VIEWPORT-001 pre-flight file note

- **Symptom:** Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` were not present at the repository root during pre-flight.
- **Impact:** No implementation blocker; docs equivalents and `.context/*` files were available and read.
- **Resolution:** Used `.context/*`, `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, local Next.js docs in `node_modules/next/dist/docs/`, and the Next.js App Router skill guidance.

## 2026-06-06 - PUBLIC-BOOKING-MOBILE-VIEWPORT-001 browser verification limitation

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser navigation or screenshot controller during this turn.
- **Impact:** Full mobile tap-through of branch -> visit -> service -> date -> time bottom sheet could not be automated in the in-app browser. Code-level checks, production build, route smoke check, and headless Chrome mobile screenshots passed.
- **Resolution:** No code change required. Run manual mobile QA at 390px width on `/book`, select a branch, visit type, service, date, confirm the time bottom sheet opens, select a time, and confirm the selected date/time summary appears while the bottom action bar stays visible.

---

## 2026-06-07 - PUBLIC-PAGES-DARK-THEME-001 verification notes

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser navigation or screenshot controller during this turn.
- **Impact:** Visual QA used local headless Chrome screenshots instead of the in-app Browser plugin.
- **Resolution:** Captured final production screenshots from a temporary `next start` server on `http://localhost:3011` and stopped that server after verification.

- **Symptom:** A pre-existing Next dev server was already running for `E:\cradlehub`, so starting a second `next dev` server on another port failed with Next's "Another next dev server is already running" guard.
- **Impact:** The existing `localhost:3000` server was not used as the final authoritative visual baseline.
- **Resolution:** Ran `pnpm build`, started temporary production server `next start --port 3011`, verified `/services`, `/contact`, `/about`, and `/branches` HTTP 200 plus screenshots, then stopped the temporary server.

---

## 2026-06-11 - UI-MOBILE-PRELOAD-001 headless Chrome sandbox retry

- **Symptom:** The first non-escalated headless Chrome runtime verification did not expose a DevTools endpoint from inside the sandbox.
- **Impact:** Browser-level checks could not run until Chrome was relaunched outside the sandbox.
- **Resolution:** Re-ran the same local headless Chrome verification with approved escalation. Mobile first-visit, repeat-session, desktop, protected route, and reduced-motion checks all passed.

## 2026-06-11 - UI-MOBILE-PRELOAD-002 headless Chrome verification notes

- **Symptom:** Non-escalated headless Chrome again did not expose a DevTools endpoint from inside the sandbox. The first escalated CDP helper also leaked a PowerShell task result into the WebSocket variable, and one `--dump-dom` attempt returned no DOM output.
- **Impact:** Browser-level verification needed one corrected escalated CDP rerun and a longer mobile wait because the dev server loaded slowly enough that a short wait caught the overlay mid-fade.
- **Resolution:** Corrected the CDP helper, reran Chrome with approved escalation, and confirmed mobile first-paint overlay, cookie/storage marking, final fade removal, repeat-cookie skip, desktop no-cookie skip, and protected-route isolation.

## 2026-06-11 - CRM-SCHEDULE-UI-001 authenticated visual QA limitation

- **Symptom:** Tool discovery did not expose the in-app Browser/agent-browser controller, and local `/crm/schedule` requests redirect unauthenticated users to `/login`.
- **Impact:** Full visual inspection of the authenticated CRM Daily Timeline with live schedule data could not be completed from this thread.
- **Resolution:** Verified with `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and a local route probe returning `307 /login`. Authenticated CRM browser QA should confirm Fit Day, Expand/Collapse, right-rail behavior, and block alignment with real branch data.

## 2026-06-17 - RLS-GROUP-SCHEDULE-RULES-001 production RLS failure

- **Symptom:** Saving a new weekly group rule returned `new row violates row-level security policy for table "staff_group_schedule_rules"`.
- **Impact:** Active front-desk users carrying the legacy `csr` system role could read same-branch groups but could not create missing opening/closing rule rows.
- **Root cause:** The live CRM/CSR ALL policy omitted `csr` from its role array. The INSERT `WITH CHECK` therefore evaluated false even though actor and target group belonged to the same branch.
- **Resolution:** Applied forward migration `20260617123431_fix_staff_group_schedule_rules_rls.sql` with explicit command policies, complete approved role coverage, branch checks through the existing auth helpers, Owner-wide access, update old/new-row checks, and least-privilege grants. Added matching server-action checks and focused tests.

## 2026-06-17 - RLS-GROUP-SCHEDULE-RULES-001 verification limitations

- **Symptom:** Supabase MCP SQL/advisor calls returned permission errors or timeouts, and linked CLI SQL required an unavailable database-password connection path.
- **Impact:** Migration deployment and catalog verification could not use those two preferred interfaces.
- **Resolution:** Used the already-authorized Supabase Management API path to inspect catalog state, apply the exact migration atomically, record migration history, and run rollback-only live policy tests. Manual policy/grant/index/helper audits passed; the Supabase advisor endpoint itself could not be run.
- **Symptom:** No authenticated CRM/front-desk browser tab or test credentials were available.
- **Impact:** The final UI click-through save could not be performed.
- **Resolution:** Verified production RLS with real active production auth identities under `authenticated` role in rollback-only transactions, plus six server-action tests. Interactive browser save remains a named manual follow-up.

## 2026-06-15 - OWNER-RECONNECT-001 old Owner soft-pause blockers

- **Symptom:** Owner users could not reach `/owner` even though Owner routes, actions, constants, RLS policies, and workspace resolver support still existed.
- **Impact:** Owners were forced into CRM, Owner nav was hidden, and stale Owner warm-up/nav config could expose `/dev` or prefetch a nonexistent `/owner/settings` route once reactivated.
- **Root cause:** DEC-MVP-001 soft-paused Owner and Manager by hard-redirecting `/owner/*` and `/manager/*` layouts to `/crm`, hiding Owner nav, and mapping owner role fallback to CRM.
- **Resolution:** Replaced only the Owner layout redirect with an Owner workspace guard, restored Owner nav/default role resolution, removed stale Owner `/dev` and `/owner/settings` entries, and left Manager soft-paused.

## 2026-06-15 - OWNER-RECONNECT-001 full Vitest residual failure

- **Symptom:** `pnpm test` reports two failures in `tests/lib/bookings/progress.test.ts`: walk-in `not_started -> session_started` is currently allowed, while the tests expect check-in first.
- **Impact:** Full test suite is not green, but the failing area is booking progress state-machine behavior outside the Owner reconnect files.
- **Resolution:** No Owner reconnect code changed booking progress logic. Focused Owner workspace tests pass, and `pnpm type-check`, `pnpm lint`, and `pnpm build` pass. Follow-up should reconcile the booking progress implementation and tests separately.

## 2026-06-15 - OWNER-DASHBOARD-REDESIGN-001 full Vitest residual failure

- **Symptom:** `pnpm test` still reports the same two failures in `tests/lib/bookings/progress.test.ts`: walk-in `not_started -> session_started` is allowed by implementation while tests expect check-in first.
- **Impact:** Full Vitest remains partial, but the failing state-machine area is outside the Owner dashboard redesign. The new owner dashboard tests pass.
- **Resolution:** No dashboard code changed booking progress transitions. Verified `pnpm test tests/lib/owner/dashboard.test.ts`, `pnpm type-check`, `pnpm lint`, and `pnpm build` successfully. Resolve booking progress implementation/test expectations separately.

## 2026-06-15 - OWNER-DASHBOARD-REDESIGN-001 authenticated browser QA limitation

- **Symptom:** Local browser smoke for `http://localhost:3000/owner` redirected to `/login` because the in-app browser did not have an authenticated Owner session.
- **Impact:** The protected route/auth guard was verified, but the full dashboard visual with real Owner data could not be inspected in-browser from this unauthenticated session.
- **Resolution:** Production build and route generation passed; unauthenticated browser smoke captured no local app console errors. Run authenticated Owner QA with a logged-in Owner account to visually confirm spacing, responsive layout, filters, and live data.

## 2026-06-17 - CRM-DAILY-TIMELINE-REPLACEMENT-001 authenticated browser limitation

- **Symptom:** The local in-app browser redirected `/crm/schedule` to `/login` because it had no authenticated CRM session.
- **Impact:** The final board could not be inspected through the protected route with live branch data.
- **Resolution:** Rendered the real `ScheduleWorkspaceShell` and new `DailyTimelineTab` component tree through a temporary fixture-backed QA route, verified desktop/mobile layout and interactions, then deleted that route before the production build. The real protected route, authorization, queries, and route count remain unchanged; an authenticated live-data visual pass remains manual.

## 2026-06-17 - CRM-AUTHORIZATION-CONSISTENCY-001 Supabase linked-project CLI hang

- **Symptom:** `supabase db query --linked` hung for both the policy query and a minimal `select current_database(), current_user;` probe. The minimal probe timed out after 124 seconds with no result.
- **Impact:** Live `pg_policies`, grants, and helper function definitions could not be inspected from this thread.
- **Follow-up:** Re-run the policy/grant inspection from an environment with working Supabase Management API access or direct DB credentials before declaring the live DB portion complete.

- **Symptom:** `supabase db push --linked --dry-run` also hung and was manually terminated.
- **Impact:** Migration `20260617141348_crm_staff_service_capabilities_rpc.sql` was created locally but not dry-run or applied against the linked project from this thread.
- **Follow-up:** Apply the migration separately, then run an authenticated CRM/front-desk save test on `/crm/staff?tab=assignments`.

- **Symptom:** `supabase db lint --local --schema public` failed because local Postgres `127.0.0.1:54322` is not running.
- **Impact:** Local database lint for the new migration could not run.
- **Follow-up:** Start the local Supabase stack or lint against a reachable database.

## 2026-06-30 - CRM-STABILIZATION-HANDOFF-2026-06-30 pre-flight / stale-handoff risk

- **Symptom:** The latest focused stabilization prompt asks agents to read root `PROJECT_CONTEXT.md`, `AGENT_RULES.md`, and `ROADMAP.md`, but those files are not present at the repository root in this checkout. Equivalent files exist under `docs/`, and root `AGENTS.md` plus `CLAUDE.md` exist.
- **Impact:** A future agent following the prompt literally may think required governance files are missing and stop, or may read stale `.context`/`docs` records that point to old CRM Coach / observability work.
- **Resolution:** Updated `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/CURRENT_TASK.cmd.md`, `docs/HANDOFF.cmd.md`, and `docs/FRONT_DESK_REFACTOR_PROGRESS.md` to point to the active CRM stabilization/refactor. Future agents should read the `docs/` equivalents when root files are absent.
- **Follow-up:** Keep both `.context/*.cmd.md` and `docs/*.cmd.md` synchronized until the project chooses one canonical agent-memory location.

## 2026-06-30 - CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30 remaining access/header gap

- **Symptom:** Checkpoint 1 implements the approved sidebar labels and a collapsed System Management section, but the latest prompt also asks for broader CRM user access to occasional system editing and a compact CRM header with current page title, branch, search, notifications, persistent New Booking, and user menu.
- **Impact:** The sidebar checkpoint is verified, but the full CRM shell objective is not complete. Ordinary CRM/CSR users may still be redirected away from current setup/staff/schedule-management pages because those page gates were intentionally preserved in this nav-only pass. Adding a global New Booking button now would also duplicate existing page-level New Booking buttons.
- **Resolution:** No permission or header code was changed in this checkpoint. System Management follows the existing management-authorized route model. The next agent should review page gates/action permissions/RLS before broadening setup access, and handle header New Booking only while removing duplicate page-level buttons.
- **Follow-up:** Continue with Checkpoint 2 Work Queue simplification, then schedule a dedicated CRM header/access review before claiming the complete CRM shell is done.

## 2026-07-02 - ATTENDANCE-QR-001 Supabase type generation / scheduling notes

- **Symptom:** `npm run db:types` failed because the script still passes removed Supabase CLI option `--project-ref`.
- **Impact:** The automated type-generation script cannot currently refresh `src/types/supabase.ts`.
- **Resolution:** Generated linked types manually with the current CLI syntax, but the linked production schema omitted unrelated local surfaces needed by existing code. Restored the baseline `src/types/supabase.ts` and manually augmented it for the new attendance tables, booking/check-in columns, and RPC.
- **Follow-up:** Fix the package `db:types` script and reconcile unrelated live/local schema drift separately from Attendance.

- **Symptom:** `pg_cron` is not installed on the linked Supabase project.
- **Impact:** Migration `20260702075213_attendance_qr_system.sql` created `complete_due_service_sessions`, but the optional cron scheduling block did not create an automatic job.
- **Resolution:** Verified the RPC exists and can be called manually/server-side.
- **Follow-up:** Decide whether to enable/install `pg_cron` or invoke the RPC from app/server infrastructure.

- **Symptom:** Two zero-byte `_tmp_14412_*` files in the repo root could not be removed with scoped `Remove-Item -LiteralPath`; PowerShell returned Access denied.
- **Impact:** They remain as untracked files in `git status`.
- **Resolution:** No broad cleanup was attempted to avoid touching unrelated worktree state.
- **Follow-up:** Remove them manually after closing any process lock, or leave them ignored until a safe cleanup window.

## 2026-07-02 - ATTENDANCE-QR-001 qr_points branch FK failure

- **Symptom:** Creating the Attendance QR returned `insert or update on table "qr_points" violates foreign key constraint "qr_points_branch_id_fkey"`.
- **Impact:** QR generation failed because the insert used a branch id that does not exist in `public.branches`.
- **Root cause:** `getAttendanceActionContext()` returned the dev-bypass mock branch id `00000000-0000-0000-0000-000000000000` whenever dev bypass was enabled, even when the authenticated user had a real staff branch. The linked DB check confirmed no zero UUID branch exists.
- **Resolution:** Added a server-only dev-bypass branch resolver that uses `DEV_BYPASS_BRANCH_ID` when valid or the first active real branch. Attendance actions now prefer real staff branch context and validate branch existence before inserts.
- **Verification:** `npx tsc --noEmit --pretty false` passed, `npm run lint` passed with the same four unrelated warnings, and linked DB verification resolved fallback branch `c1000000-0000-0000-0000-000000000002`.

## 2026-07-02 - ATTENDANCE-REFIT-005 final verification blockers

- **Symptom:** Sandboxed `pnpm type-check` failed before the script started with Windows `EPERM` unlinking `_tmp_*` files.
- **Impact:** Final script results could not be trusted from the restricted sandbox.
- **Resolution:** Ran final checks outside the restricted sandbox with `CI=true`. Results: `pnpm type-check` PASS, `pnpm lint` PASS with 0 warnings, `pnpm test` PASS (60 files / 564 tests), and `pnpm build` PASS (104 app routes).

- **Symptom:** `pnpm lint` originally reported four `@typescript-eslint/no-unused-vars` warnings.
- **Resolution:** Fixed all four without eslint suppressions, `any`, or `@ts-ignore`:
  - `scripts/generate-service-image-assets.mjs:26`: removed unused `FALLBACK_IMAGE_URL`.
  - `scripts/generate-service-image-assets.mjs:523`: replaced unused `generationPrompt` destructuring with explicit `appManifestEntry()`.
  - `tests/components/payroll/employee-payroll-table.test.tsx:17`: kept typed mock argument and used `void staffId`.
  - `tests/components/payroll/employee-payroll-table.test.tsx:18`: kept typed mock argument and used `void staffId`.

- **Symptom:** Browser visual QA for `/crm/attendance?tab=qr` redirected to `/login` at 1440, 1280, 1024, 768, and 375 px.
- **Impact:** The QR list/preview layout, real interactions, export buttons, print/PDF flow, public-link truncation, Deactivate confirmation, and mobile stacking could not be approved in-browser.
- **Root cause:** The local browser has no authenticated Supabase CRM/front-desk session. `DEV_AUTH_BYPASS=true` does not create a user session; `src/proxy.ts` checks `supabase.auth.getUser()` before the dev bypass path.
- **Evidence:** Blocker screenshots saved at `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-1440.png`, `...\blocked-login-1024.png`, and `...\blocked-login-375.png`. Browser errors were empty; console showed only normal dev/HMR/Speed Insights messages.
- **Follow-up:** Rerun authenticated browser QA with a valid CRM/front-desk session and complete the requested viewport, interaction, export, phone-scan, and QR identity checks.

- **Symptom:** After dependency restoration, `pnpm exec supabase --version` reports `The process cannot access the file because it is being used by another process.`
- **Impact:** App verification is not affected, but local Supabase CLI commands may need a retry after the Windows file lock clears.
- **Resolution:** Restored the Supabase package binary and top-level shim; do not stop unrelated Node processes just to clear the lock.

- **Symptom:** CRM Schedule Daily Timeline logged `[crm/schedule] daily timeline load failed {}` in production.
- **Impact:** Operators saw a vague console error while the query failure cause was hidden.
- **Resolution:** Updated `src/app/(dashboard)/crm/schedule/page.tsx` to log branch/date/message and development-only stack details, and updated the API/query layer to return safe no-store errors while failing loudly by query stage.

- **Symptom:** Daily schedule query could fail when `schedule_overrides.shift_type` was missing or hidden by schema drift.
- **Impact:** Timed overrides could not be labeled as opening/closing/single, and the failure was previously hard to diagnose.
- **Resolution:** Added `shift_type` to the override query/type, propagated it into schedule views, and added a regression test that verifies a missing column surfaces as `Schedule-overrides query failed`.

- **Symptom:** Supabase MCP for project `lsrbwqhvzjfpiabeolkv` still returned permission errors for SQL/type generation, and the direct DB host resolved to IPv6 without a usable route.
- **Impact:** MCP could not be used to apply SQL or generate types from this environment.
- **Resolution:** Used the Supabase transaction pooler for read-only verification. Confirmed `schedule_overrides.shift_type` exists and no invalid values are present.

- **Symptom:** `pnpm db:push` and `pnpm db:types` are blocked locally by Supabase CLI/pnpm issues: ignored build scripts plus EPERM unlink/rename failures around pnpm temporary files and `pnpm-workspace.yaml`.
- **Impact:** Migration history is not synchronized, and generated Supabase types were not refreshed by CLI in this pass.
- **Resolution:** App code and existing types were verified locally; defer `pnpm db:push` and `pnpm db:types` until the local pnpm/Supabase CLI environment is repaired.

- **Symptom:** A live Supabase database password was pasted into chat during troubleshooting.
- **Impact:** Treat the credential as exposed.
- **Resolution:** Rotate the Supabase database password before production deployment and update deployment/local secrets.

## 2026-07-03 - ATTENDANCE-FULL-INTEGRATION-002 feed/deep-link notes

- **Symptom:** A large patch attempt partially applied CRM Today feed props before the shell/dashboard props were present, causing `pnpm type-check` to fail on `attendanceScanFeed`.
- **Impact:** The tree was briefly inconsistent during implementation.
- **Resolution:** Added the matching `CrmTodayShell` and `WorkQueueDashboard` props; current `npx tsc --noEmit --pretty false` passes.

- **Symptom:** `pnpm lint` reported React Compiler `preserve-manual-memoization` errors in `AttendanceRecordsTab`.
- **Impact:** The new date/staff filter memo dependencies were too narrow for the compiler's inferred `initialFilters` dependency.
- **Resolution:** Normalized `initialStaffId` and `initialDate` before the memos and depended on those stable values. Current `npm run lint` passes.

- **Symptom:** The full pasted prompt includes first-scan trusted-device sign-in/linking, Staff Portal My Attendance, and staff-profile attendance history.
- **Impact:** Those flows are still not implemented in this slice.
- **Resolution:** Completed only the dashboard feed/realtime/deep-link slice and documented the remaining work explicitly.

## 2026-07-03 - DATABASE-CONNECTION-STABILIZATION-001 tooling audit

- **Symptom:** `pnpm exec supabase --version` returned `'supabase' is not recognized as an internal or external command` in the managed shell, while `.\node_modules\.bin\supabase.CMD --version` returned `2.95.6`.
- **Impact:** Package scripts that rely on direct `supabase` command resolution or `pnpm exec supabase` are unreliable in this environment.
- **Resolution:** Added project-local database wrappers under `scripts/database/` that call the checked-out `node_modules/.bin/supabase.CMD` shim when present and avoid global CLI drift.

- **Symptom:** `pnpm list supabase --depth 0` failed with `ERR_SQLITE_ERROR unable to open database file`.
- **Impact:** Some pnpm store/index inspection commands are unreliable from the managed sandbox even though `pnpm --version` and direct project binaries can run.
- **Resolution:** Documented the failure and avoided package-manager repair that would mutate dependencies without a clear need.

- **Symptom:** `psql` is not installed locally.
- **Impact:** The documented transaction-pooler emergency fallback cannot be executed from this environment until `psql` is installed through an approved toolchain.
- **Resolution:** The runbook gates emergency pooler application on `psql --version` and warns against ad-hoc SQL executors.

- **Symptom:** A live Supabase database password was pasted in chat before this stabilization task.
- **Impact:** The old database password must be treated as compromised.
- **Resolution:** Rotation cannot be confirmed from the repo. The final workflow requires the user to rotate the DB password and update only git-ignored local/deployment secrets before trusting DB tooling.

## 2026-07-03 - ATTENDANCE-DEVICE-REGISTRY-005 verification notes

- **Symptom:** `pnpm db:status` and `pnpm db:push` timed out against `aws-1-ap-northeast-1.pooler.supabase.com:5432`.
- **Impact:** The project wrapper scripts still cannot read remote migration history or run the normal migration push path from this network.
- **Resolution:** Applied `20260703151111_attendance_device_registry_recovery.sql` through the linked Supabase SQL path, inserted the migration-history row, regenerated types, and verified the live migration row, columns, RPC, and grant with a read-only SQL probe.
- **Follow-up:** Re-run `pnpm db:status` and `pnpm db:push` from a network/path that can reach the required migration-history connection, or repair the wrapper to use a supported IPv4 shared-pooler migration path if Supabase CLI supports it.

- **Symptom:** `tmp-attendance-device-registry-verify.sql` could not be deleted after verification.
- **Impact:** The temporary read-only probe remains untracked in the repo root.
- **Resolution:** `apply_patch` delete and scoped `Remove-Item -LiteralPath tmp-attendance-device-registry-verify.sql` both failed with access denied; a narrow elevated delete request was blocked by the environment usage limit. No broader cleanup workaround was attempted.
- **Follow-up:** Delete that one temporary file manually after the file lock/sandbox condition clears.

## 2026-07-04 - ATTENDANCE-FIRST-SCAN-LOGIN-007 audit-event duplicate edge

- **Symptom:** The first implementation of the scan-login device registration helper wrote the successful `first_scan_device_registered` audit row with both `qr_point_id` and the new `device_id`.
- **Impact:** `findRecentDuplicate()` checks recent successful `qr_scan_events` by QR point and device. The activation audit row could have made the immediately resumed attendance scan look like a duplicate, returning the noop result instead of the intended first clock-in/out.
- **Resolution:** Kept the registration audit row as `scan_type = 'activation'` but removed `qr_point_id` from the row; the scanned QR point remains in event metadata for audit context. The resumed attendance scan now writes its own success/noop/block event through the normal scan engine path.
- **Validation:** `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass after the fix.

## 2026-07-04 - ATTENDANCE-FIRST-SCAN-LOGIN-008 first-scan continuation failures

- **Symptom:** The public scan page could stay on `Processing scan...` and never show either the sign-in form or a final result.
- **Impact:** The first missing-device scan appeared hung even though the server action returned.
- **Root cause:** `PublicScanProcessor` used the whole `props` object in the scan `useEffect` dependency array. When the animation moved to `processing`, React cleaned up the effect, marked the in-flight scan inactive, and `startedRef` prevented a restart.
- **Resolution:** Derived stable primitive dependencies (`mode`, `scanPublicCode`, `activationToken`) and used those in the effect.

- **Symptom:** `staff_devices` rows were inserted and the browser stored `cradle_attendance_device`, but the next scan still returned `reasonCode = "unknown_device"`.
- **Impact:** Valid active devices could not skip login; repeated scans created registration rows but did not resolve the trusted phone.
- **Root cause:** `resolveDevice()` selected `staff(full_name, staff_type, is_active)` from `staff_devices`. After device registry/recovery added `revoked_by`, Supabase had multiple relationships from `staff_devices` to `staff` and returned an ambiguous-relationship error. The resolver ignored the error and treated the device as missing.
- **Resolution:** Changed the join to `staff:staff!staff_devices_staff_id_fkey(...)` in the scan engine and Attendance workspace device query. Also disambiguated `device_activation_tokens -> staff` reads for activation/recovery.
- **Validation:** With an HttpOnly `cradle_attendance_device` cookie, `POST /api/attendance/public-scan` resolved active device `9395ae4f-65c1-4005-b491-19309e3a4b26`, wrote a `clock_in` event with that `device_id`, and the next UI scan rendered `Already recorded` rather than the sign-in form. `pnpm type-check`, `pnpm lint`, and `pnpm build` pass.

## 2026-07-09 - BOOKING-ATTENDANCE-BRANCH-SAFETY-001 diagnostics and migration push notes

- **Symptom:** Same-day walk-in booking/assignment could behave as if no one was available when no staff had checked in, despite schedule availability existing.
- **Impact:** Front desk could be blocked or misled on same-day walk-ins before staff attendance was recorded.
- **Resolution:** Booking auto-assignment now uses check-ins only as a same-day walk-in preference. When no eligible checked-in therapist exists, scheduled availability is used and the operator gets the explicit presence warning.

- **Symptom:** Attendance QR wrong-branch events were reported for a Main Spa QR.
- **Impact:** Valid Main QR scans could appear blocked if the code trusted stale `staff_devices.branch_id` before checking the current staff branch.
- **Resolution:** Scan validation now treats the scanned QR branch and current staff branch as authoritative. Stale device branch ids are synced when the current staff branch matches the QR branch; true staff branch mismatches still block.
- **Live data note:** Safe diagnostics showed recent Main QR wrong-branch events involved staff records whose current `staff.branch_id` is Living SM, with no active stale device branch mismatches. Those records need branch/membership correction if they are expected to scan Main QR codes.

- **Symptom:** `pnpm db:push` and direct `supabase db push --linked --dns-resolver https` timed out to `aws-1-ap-northeast-1.pooler.supabase.com:5432`.
- **Impact:** The normal migration push path did not apply or record `20260709054954`.
- **Resolution:** Verified linked `supabase db query` connectivity, applied the migration via `supabase db query --file`, inserted the migration-history row in `supabase_migrations.schema_migrations`, and verified the row, trigger, and `0` active device branch mismatches.

## 2026-07-09 - BRANCH-CORRECTION-REQUESTS-001 verification notes

- **Symptom:** The wrong-branch correction flow was only partially present: requests could be inserted from some scan contexts, but returning-scan metadata, duplicate-pending UI, CRM review tab, audit table, and staff-owned cancel handling were missing.
- **Impact:** Staff blocked by valid wrong-branch QR scans still had a dead-end or incomplete path to front-desk review, and approvals did not have a dedicated branch-change audit table.
- **Resolution:** Completed the request/review UI and server helpers, added `staff_branch_audit_logs`, hardened the review RPC, surfaced pending request metadata, and added focused policy/UI/migration tests.
- **Validation:** Focused tests, `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass locally.
- **Follow-up:** Apply pending Supabase migrations and run authenticated CRM/front-desk plus physical QR scan QA after deployment.

## 2026-07-09 - CRM-BOOKING-HOME-SERVICE-DISTANCE-001 completion notes

- **Symptom:** CRM quick booking could show the old generic `No therapist is available` / next-slot style copy even though the CRM-specific availability route had already been added.
- **Impact:** Front desk could still be misled by the public-slot availability behavior instead of seeing schedule-specific CRM availability messages.
- **Resolution:** Switched CRM quick booking pre-submit checks to `/api/booking/crm-availability` and used the schedule-specific fallback copy: `No scheduled therapist is available at this time. Try another time or check staff schedules.`

- **Symptom:** CRM Home Service address entry still accepted plain text and did not submit place id or coordinates.
- **Impact:** Internal Home Service bookings could not reliably calculate branch-to-customer distance or the travel fee.
- **Resolution:** Reused the public Places autocomplete in CRM, required a selected/geocoded place for Home Service, sent coordinates/components to the server action, and displayed the live distance/travel-fee quote before submit.

- **Symptom:** The first local `pnpm type-check` failed because owner spaces/rules fallback data did not include the new Home Service distance-fee fields.
- **Impact:** The project could not type-check after the schema/type additions.
- **Resolution:** Added fallback defaults for `homeServiceFreeKm` and `homeServiceExtraKmFee`; subsequent `pnpm type-check`, `pnpm lint`, focused tests, and `pnpm build` pass.

## 2026-07-09 - CRM-HOME-SERVICE-LOCATION-FIELD-CLEANUP-001 verification note

- **Symptom:** The first `pnpm type-check` run failed inside generated `.next/dev/types/validator.ts` with a parser error near a corrupted fragment: `e __Unused = __Check`.
- **Impact:** TypeScript could not reach source diagnostics until the stale generated dev artifact was removed.
- **Resolution:** Deleted only `.next/dev/types/validator.ts`, reran `pnpm type-check`, and verified source type-check, lint, focused distance-fee tests, and production build all pass.

## 2026-07-09 - SCHEDULE-CONFLICT-CENTER-001 verification notes

- **Symptom:** The first modal test could not find the `Rooms 1` tab by accessible name because the visible count was adjacent to the label and Testing Library read it as `Rooms1`.
- **Impact:** Keyboard/screen-reader naming was less clear than intended for counted tabs.
- **Resolution:** Added explicit `aria-label` values to Schedule Conflict Center category tabs; focused schedule tests pass.

- **Symptom:** `pnpm lint` flagged the first dialog close-reset effect with `react-hooks/set-state-in-effect`.
- **Impact:** React Compiler lint rejected synchronous state reset inside an effect.
- **Resolution:** Moved modal reset behavior into the dialog `onOpenChange` handler; `pnpm lint` and `pnpm type-check` pass.

## 2026-07-09 - AGENT-COACH-IDLE-LOOP-001 runtime error

- **Symptom:** Runtime error `Maximum update depth exceeded` pointed to `AgentCoachProvider.useEffect.resetIdle` at `setIsIdle(false)`.
- **Impact:** CRM/Owner pages with Agent Coach enabled could crash when idle-reset events nested through repeated activity/scroll updates.
- **Root cause:** The idle reset listener requested `setIsIdle(false)` for every activity event even when the provider was already active.
- **Resolution:** Added a ref-backed guard around idle state updates and moved the timeout handle to a ref. Repeated active events now only reschedule the idle timer; React state updates only on real boolean changes.
- **Validation:** Targeted provider regression test, `pnpm type-check`, `pnpm lint`, and `pnpm build` pass.

## 2026-07-10 - CRM-BOOKING-FOLLOWUP-STABILIZATION-001 runtime and RLS fixes

- **Symptom:** CRM Today could throw `UnrecognizedActionError` around the Work Queue ETA refresh button.
- **Impact:** The Today Work Queue could break at runtime when refreshing Home Service ETA.
- **Root cause:** A server action was passed through a multi-level client/server prop chain as `refreshEtaAction`; this boundary was fragile in the current Next.js app shape.
- **Resolution:** Removed the CRM Today prop chain and imported `refreshHomeServiceEtaAction` directly in `work-queue-panel.tsx`.

- **Symptom:** Booking Follow-up/status changes could fail with raw `booking_events` row-level security errors.
- **Impact:** CRM/front-desk users could update a booking row but have the status trigger/audit write fail, surfacing confusing RLS text in the UI.
- **Root cause:** `booking_events` is intentionally SELECT-only for authenticated users and written by triggers/service-role paths. Some operational mutations were still relying on authenticated writes that caused trigger/audit INSERT failures.
- **Resolution:** Status, follow-up cancel, reschedule, and staff reassignment paths now use branch-checked service-role actions for booking updates/audit writes, annotate trigger-created rows when status changes, and show friendly UI errors if a permission issue still occurs.
- **Validation:** `pnpm type-check`, `pnpm lint`, focused assignment tests, and `pnpm build` pass.

## 2026-07-12 - ATTENDANCE-AUTONOMY-HARDENING-001 migration-history drift

- **Symptom:** Linked schema inspection shows recent Attendance columns, constraints, indexes, and the new `commit_attendance_scan_transaction` / `reset_attendance_state_transaction` RPCs are present, but `supabase_migrations.schema_migrations` returns `0` rows for `20260710040835`, `20260710055131`, `20260712000100`, `20260712035222`, `20260712044527`, and `20260712045429`.
- **Impact:** The database can run the verified live schema, but the normal Supabase migration engine cannot be trusted to know these migrations are applied. A future `db push` from a healthy migration-history connection may try to replay SQL that is already partially present.
- **Resolution:** Applied only the two new RPC definitions through linked `supabase db query --file` after normal `db push --dry-run` remained blocked by migration-history timeouts. Verified function presence, grants, and no-mutation rejection probes. Do not manually edit migration history from this environment.
- **Follow-up:** Reconcile migration history from a working Supabase DB path, then regenerate types and rerun final app checks. Review any replay plan carefully because some earlier migration effects are already live.

## 2026-07-13 - CRADLE-BACKEND-STABILIZATION-AND-SCHEDULE-REPAIR-001 blockers and findings

- **Symptom:** `pnpm db:doctor` and `pnpm db:status` still time out while reading linked Supabase migration history on `aws-1-ap-northeast-1.pooler.supabase.com:5432`.
- **Impact:** The schedule repair migration `supabase/migrations/20260712165012_backend_stabilization_schedule_repair.sql` was created and rollback dry-run verified, but was not applied to production from this environment. `db:status` reports `Remote schema changed: no` before failing the migration-history read.
- **Resolution:** Do not run a blind `db push` here. Apply the migration from a working migration-history connection, then rerun `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`.

- **Symptom:** Linked generated types do not include `branch_booking_rules.home_service_free_km` or `branch_booking_rules.home_service_extra_km_fee`, while existing app code expects those fields.
- **Impact:** Regenerating `src/types/supabase.ts` from the current linked schema can remove pending local columns and break type-check.
- **Resolution:** The schedule repair migration adds/backfills the two columns from `branches`; `src/types/supabase.ts` was locally reconciled after type generation. Regenerate types again after the migration is applied so the generated file matches the real schema without manual reconciliation.

- **Symptom:** Live data contains corrupted Main Spa scheduling minimums, stale older active `single` staff schedules superseded by newer opening/closing rows, overlapping active group default templates, and ambiguous Nikki opening/closing overlaps with the same created timestamp.
- **Impact:** Coverage/readiness can report impossible staffing requirements, stale rows can create schedule conflicts, and ambiguous same-timestamp overlaps cannot be safely repaired without business confirmation.
- **Resolution:** The migration backs up and fixes deterministic cases only: corrupted scheduling minimums, older superseded `single` rows, and overlapping group templates. Nikki overlaps remain manual follow-up.

- **Symptom:** Live duplicate staff identities are present and staged in `staff_merge_map_work`, but the merge was not executed.
- **Impact:** Duplicate staff can still appear in operational surfaces unless archived/merged/test/non-schedulable fields are honored.
- **Resolution:** Availability provider selection now filters inactive, archived, merged, test, and explicitly non-schedulable staff. Full staff identity merge remains a separate data-governance task because bookings, attendance, payroll, and Auth ownership must be reviewed first.

## 2026-07-13 - CRADLE-INDIVIDUAL-SCHEDULING-SIMPLIFICATION-005 verification blockers

- **Symptom:** `pnpm db:doctor` and `pnpm db:status` time out while reading linked Supabase migration history through `aws-1-ap-northeast-1.pooler.supabase.com`.
- **Impact:** Local migrations for individual-only runtime scheduling were created but not applied or verified in production from this environment.
- **Resolution:** Do not claim live DB completion or run blind `db push` here. Apply from a working migration-history connection and rerun type generation plus app checks.

- **Symptom:** `pnpm db:verify` reports linked SQL probe and required table checks as PASS, but exits nonzero because `psql` is not installed for the documented fallback path.
- **Impact:** DB table visibility is verified, but the emergency fallback capability remains unavailable locally.
- **Resolution:** Install `psql` or run fallback checks from an environment that has it before relying on fallback operations.

- **Symptom:** Regenerated linked Supabase types omit `branch_booking_rules.home_service_free_km` and `home_service_extra_km_fee`.
- **Impact:** Type generation can break app code until pending migrations are applied.
- **Resolution:** `src/lib/queries/branch-booking-rules.ts` now treats those fields as optional so the app compiles against both schemas; regenerate types again after production migration apply.

## 2026-07-13 - CRADLE-ADJUST-SCHEDULE-MODAL-003 limitations and QA blockers

- **Symptom:** Authenticated CRM browser certification was not run for the new Adjust Schedule modal.
- **Impact:** Local type/lint/test/build verification passed, but final visual/operator acceptance against live branch data still needs a signed-in CRM session and viewport checks.
- **Resolution:** Run CRM Schedule browser QA: open Daily Timeline, select staff, use Quick Actions > Adjust Staff, use selected-card Adjust Schedule, edit preview, validate overlap blocking, save, refresh, reopen, and test desktop/tablet/mobile widths.

- **Symptom:** Weekly schedule saves validate/persist ordered windows but do not yet call a server-calculated affected-booking impact analysis.
- **Impact:** Existing bookings are not changed by the save path, and the modal requires operator impact acknowledgement, but it does not return authoritative affected-booking counts.
- **Resolution:** Add a server action/RPC that evaluates proposed weekly/override changes against future bookings and returns affected booking details before save confirmation.

- **Symptom:** The existing `schedule_overrides` and `blocked_times` action contracts do not cover every reference-image requirement.
- **Impact:** Date mode currently saves one date at a time, override overnight state is not persisted, blocked-time reasons remain the existing enum, and Approved Exceptions cannot show durable records.
- **Resolution:** Extend schema/actions in a separately scoped migration only after the persistence contract is approved.

## 2026-07-13 - CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006 root cause and remaining blocker

- **Symptom:** CRM Adjust Schedule weekly save showed only "We could not update this schedule. Please try again."
- **Root cause:** The linked live schema did not expose `public.replace_staff_weekly_schedule(uuid, uuid, jsonb)`, but the app save action called it. The table also still enforced `staff_schedules_staff_day_shift_unique` instead of ordered `staff_id, day_of_week, window_order`.
- **Resolution:** Added/applied `supabase/migrations/20260713035024_schedule_update_integration_repair.sql`, creating the RPC/helpers/trigger, replacing the unique constraint, widening `window_order` to 1..12, backing up and normalizing stale inactive placeholders, and reloading PostgREST schema. App actions now classify missing RPC, stale constraint, RLS, overlap, overnight, and shift-eligibility errors with safe codes/messages.

- **Symptom:** `pnpm db:push --dry-run` and `pnpm db:status` still time out on `aws-1-ap-northeast-1.pooler.supabase.com:5432` even when retried with escalation.
- **Impact:** Live schema is repaired and verified through the Management API path, but linked migration history cannot be certified from this environment.
- **Resolution:** Do not blind push pending migrations from this shell. Restore a working direct Postgres pooler/migration-history path, then rerun `pnpm db:status` and reconcile migration history with the live-applied corrective SQL.
## 2026-07-13 - Attendance DB end-to-end diagnostic failures

- **Symptom:** Device recovery returned a structured generic failure.
- **Root cause:** `consume_attendance_device_recovery` used unqualified
  `staff_id` while also returning a `staff_id` output column (`42702`).
- **Resolution:** Qualify the active-device count with the table alias in
  migration `20260713120237`.

- **Symptom:** Replacement recovery failed after the ambiguity repair.
- **Root cause:** The RPC inserted a new default-primary device before revoking
  the selected old primary, violating `staff_devices_one_active_primary_idx`
  (`23505`).
- **Resolution:** Revoke first inside the same transaction, then insert; rollback
  restores the old device if any later statement fails.

- **Symptom:** Clock-out returned `Attendance not confirmed` with operation
  `4b8e9251-cb03-4565-b459-5c406cd03b53`.
- **Root cause:** `bookings` has two foreign keys to `branch_resources`; the
  unqualified embed in `has_active_service` returned PostgREST `PGRST201`.
- **Resolution:** Pin all three attendance booking embeds to
  `bookings_resource_id_fkey`.

- **Symptom:** Attendance Activity stayed empty while blocked/exception rows
  existed.
- **Root cause:** The query filtered to successful clock-in/out only, discarded
  staff-less rows, hardcoded Manila boundaries, and subscribed to a table absent
  from the Realtime publication.
- **Resolution:** Include all safe attendance outcomes, preserve missing staff,
  resolve branch timezone, refresh all attendance inserts, and publish
  `qr_scan_events`.

- **Symptom:** Preflight and final Attendance operational counts differ by the
  entire former dataset.
- **Evidence:** `pg_stat_statements` shows two `DELETE FROM
  public.qr_scan_events` calls deleting 281 rows, two exception deletes removing
  192 rows, two check-in deletes removing 23 rows, and one device delete removing
  24 rows.
- **Resolution:** Not attributable or reversible from this task. No destructive
  SQL was issued here and this checkout has no reset backup. Find the external
  reset operator/process and backup before historical reporting is trusted.

## 2026-07-13 - ONLINE-STAFF-PREFERENCE-EXCEPTIONS-001 QA limitation

- **Symptom:** The local in-app browser redirects `/crm/today` to `/login`.
- **Impact:** The real public picker was verified end-to-end through manual
  preference selection, but authenticated CRM warning and resolution clicks
  could not be certified in-browser without a safe signed-in CRM fixture.
- **Resolution:** Run the CRM manual-verification matrix in an authenticated
  test session. Static, unit, type, lint, build, and full-suite verification
  cover the implementation contracts in this task.

## 2026-07-14 - CRM-BOOKINGS-DESKTOP-REDESIGN-001 browser QA limitation

- **Symptom:** The in-app browser redirects local `/crm/bookings` to `/login`.
- **Impact:** Page identity, desktop reference fidelity, and real lifecycle/modal
  interactions could not be certified against authenticated booking data. The
  login redirect itself produced no console warnings or errors.
- **Resolution:** Run the documented CRM Bookings manual matrix in a safe
  signed-in CRM session. Focused component/selector tests, full Vitest,
  type-check, lint, and production build cover the implementation contracts.

## 2026-07-14 - CRM-BOOKING-ACTIONS-COMPACT-001 lookup defect

- **Symptom:** A booking visible and selected in CRM Bookings could return
  `Booking not found` when confirming, cancelling, rescheduling, or running
  another selected-booking action.
- **Root cause:** The UI correctly carried the real `bookings.id` UUID, but the
  shared server loader began with a large relational embed and returned `null`
  for both an absent row and every query/RLS/relationship error. Callers then
  converted all of those different outcomes into `Booking not found`.
- **Resolution:** The action boundary now validates the UUID, loads only
  `id, branch_id, status, booking_progress_status, customer_id` first, performs
  branch/RLS diagnostics without weakening policy, and loads additional detail
  separately. It returns distinct safe errors/codes for missing, wrong branch,
  permission, load, final status, and update failures and logs only action name,
  UUID, authenticated user id, branch id, and safe code.
- **Prevention:** Focused server-action tests assert the base select, real UUID,
  malformed/display-ID rejection, wrong-branch/RLS/missing/database distinctions,
  update failures, and cancellation final-state guards.

## 2026-07-14 - ATTENDANCE-STAFF-SELF-SERVICE-001 deployment and QA blockers

- **Symptom:** `pnpm db:doctor` and `pnpm db:status` identify the correct linked
  Supabase project but time out connecting to the remote Postgres pooler on
  port 5432, including an unrestricted-network retry.
- **Impact:** Migration `20260714050554_attendance_staff_self_service.sql`, its
  RLS policies, and its review/completion RPCs are committed locally but are not
  claimed as remotely applied or production-verified.
- **Resolution:** Restore the approved pooler/direct SQL connection, inspect
  migration history, apply the migration once, regenerate types from the live
  schema, then run RPC/RLS probes before deployment.

- **Symptom:** Local `/staff-portal/attendance` and `/staff-portal/profile`
  redirect the only in-app browser session to `/login`.
- **Impact:** Static/component/server contracts and the full production build
  pass, but same-phone request/approval/activation and physical first-scan
  device behavior are not browser/device-certified.
- **Resolution:** Use safe authenticated staff and CRM test accounts plus a
  physical/test phone after the migration is applied; certify Method 1,
  request/approve/reject/replace, expiry, duplicate submission, cookie
  persistence, clock-in/out, and self-only history.
## 2026-07-14 - ATTENDANCE-COMPLETE-SYSTEM-001 Phase 0 live-schema blocker

- **Symptom:** `pnpm db:doctor` and `pnpm db:status` time out connecting to the
  linked Supabase Postgres pooler on port 5432 while reading migration history.
- **Impact:** The source/migration architecture and focused tests are mapped,
  but deployed Attendance migrations, RLS policies, RPC grants, and scheduler
  capabilities cannot be certified. Phase 1 is intentionally not started.
- **Evidence:** Project identity, link, token, pooler configuration, and type
  generation checks pass. `db:doctor` exits 2 at migration history;
  `db:status` finds 105 local migrations and reports no remote schema change
  before exiting 1 at the same read.
- **Recovery:** Restore an approved authoritative SQL/migration-history
  connection, inspect the live contracts, reconcile history without a blind
  push, and rerun the Phase 0 verification commands.
## 2026-07-14 - Missing staff device registration request table resolved

- **Symptom:** Attendance rendered `Could not find the table
  'public.staff_device_registration_requests' in the schema cache`.
- **Root cause:** The application and generated types contained the Staff Portal
  phone-request feature, but migration `20260714050554` had not been applied to
  the linked database. A live prerequisite query returned `to_regclass(...) =
  null` while all required helper functions and device columns existed.
- **Resolution:** Applied the focused migration through `supabase db query
  --linked`, sent `NOTIFY pgrst, 'reload schema'`, and verified SQL plus
  service-role REST access.
- **Security verification:** RLS enabled; three scoped SELECT policies;
  authenticated SELECT only; anon SELECT denied; service-role CRUD; review and
  completion RPCs executable by service role and not authenticated users.
- **Remaining maintenance:** Reconcile migration version `20260714050554` from
  a working migration-history connection before any broad migration push.

## 2026-07-14 - False Attendance no-device Recovery incidents

- **Symptom:** Recovery showed roughly 60 urgent `Staff has no connected phone`
  cards without corresponding scan attempts.
- **Root cause:** `buildRecoveryIssues()` mapped every static device-registry row
  through `issueForDeviceEntry`; ordinary `no_device` inventory was promoted to
  an operational incident with high priority.
- **Resolution:** Removed inventory-to-incident conversion. Device Recovery is
  now sourced only from blocked scan events or persisted Attendance exceptions,
  and repeated equivalent blocked events are grouped into one card with a count.

## 2026-07-14 - Attendance resolution migration trigger mismatch

- **Symptom:** First focused migration apply failed transactionally with
  `function public.set_updated_at() does not exist`.
- **Root cause:** The migration referenced a generic trigger helper name while
  this schema's established helper is `public.fn_update_updated_at()`.
- **Resolution:** Corrected the trigger to the existing helper before reapplying;
  the failed SQL request did not partially apply its transaction.

## 2026-07-14 - Fluid Attendance migration deployment intentionally deferred

- **Symptom:** Local application code now calls
  `resolve_effective_attendance_branch` and `apply_attendance_review_correction`,
  which do not exist in production until migration `20260714143000` is applied.
- **Cause:** The linked project still has unreconciled migration history and the
  standing handoff explicitly forbids a blind `db push`.
- **Impact:** Local static/tests/build verification can be completed, but the new
  scan and correction runtime must not be deployed ahead of the migration.
- **Recovery:** Reconcile history from a healthy authoritative connection, apply
  the focused migration transactionally, reload PostgREST, regenerate types, and
  verify RLS, grants, triggers, resolver order, concurrency, and rollback behavior.

## 2026-07-14 - CRM closing policy deployment verification deferred

- **Symptom:** The new branch rules, policy snapshot, intervention, and
  reconciliation contracts exist locally but are absent from the linked database.
- **Cause:** `20260714180000_attendance_crm_closing_policy.sql` builds on pending
  `20260714143000_attendance_fluid_operations.sql`, while linked migration history
  remains unreconciled and the project explicitly forbids a blind broad push.
- **Impact:** Source/unit/integration/build verification can complete, but live DB
  functions, generated-from-live types, worker execution, and end-to-end auto-close
  cannot be certified or deployed yet.
- **Recovery:** Reconcile history, apply both migrations in order through an
  approved transactional path, reload PostgREST, regenerate types, verify RPC/RLS
  and concurrency/idempotency probes, then observe the configured Vercel cron.
- **Evidence:** `pnpm db:verify` reaches linked SQL and all prior Attendance tables,
  then correctly fails `attendance_rule_versions`,
  `attendance_staff_category_rules`, and `attendance_closing_interventions` as
  absent from PostgREST. `pnpm db:status` sees 108 local migrations but the linked
  migration-history read times out on port 5432.

- **Symptom:** The in-app browser redirects Owner branch routes to `/login`.
- **Impact:** The card has component/static verification, but protected desktop and
  mobile visual/operator flows are not authenticated-browser certified.
- **Recovery:** Repeat QA with an approved Owner test session; do not submit saved
  credentials without explicit user authorization.

## 2026-07-15 - Public Attendance success time ignored non-Manila branch timezone

- **Symptom:** The backend greeting used the resolved branch-local time, but the
  large date/time on the public success card always formatted in `Asia/Manila`.
- **Impact:** A branch configured in another timezone could show a committed
  greeting and card timestamp that disagreed.
- **Resolution:** The committed Attendance result now carries the authoritative
  branch timezone and the existing formatter receives it for the displayed date,
  event time, and session-start time. A non-Manila regression test covers this.

## 2026-07-15 - Valid-phone Attendance browser certification remains pending

- **Symptom:** The available browser session could reach authenticated CRM
  Attendance QR management and the public invalid-QR state, but no approved staff
  credentials were supplied for the real phone-link/Attendance mutation.
- **Impact:** Source, component, transaction-contract, full-suite, type, lint, and
  build verification pass, but a physical valid-phone one-scan write is not claimed.
- **Resolution:** With a safe staff test account, scan the active QR from a clean
  phone profile, sign in once, and confirm one final Attendance action with no
  second scan; also repeat invalid-login and revoked-device checks against test data.
## 2026-07-15 - ATTENDANCE-BETA-READINESS-001 launch blockers

- **Valid QR scan failed before device recognition.** Live `staff` lacked the
  historical `is_cross_branch` column while the scan engine and deployed branch
  resolver selected it. A focused additive repair is live and the fresh unknown-
  device login path now works.
- **Migration history is not trustworthy.** Live Attendance objects from the
  July 12-15 migrations exist, but `supabase_migrations.schema_migrations` stops
  at `20260713120237`. The focused repair was applied through linked SQL and is
  also not history-recorded. Do not broad-push until effects and versions are
  reconciled from a working migration-history workflow.
- **Authenticated/physical E2E remains unavailable.** No safe staff credentials
  or raw active-device credential were available, so registered-device clock-in,
  credential login continuation, clock-out, Recovery correction, realtime UI,
  and cross-browser certification remain unproven.
- **Legacy grants are broader than necessary.** RLS blocks unauthorized rows and
  audited policies are branch/self scoped, but `anon`/`authenticated` retain broad
  historical table grants on some Attendance tables. Tighten grants after a role
  matrix rollback test; do not change them blindly during beta audit.

## 2026-07-15 - Core beta readiness certification blockers

- `pnpm db:status` cannot read linked migration history because the Supabase
  direct pooler connection times out. REST table probes pass, but deployment
  ordering and live/local migration parity remain uncertified.
- The available authenticated browser identity is CRM/front desk only. Dedicated
  owner, manager, driver, utility, ordinary staff, and transactional QA identities
  were not available, so the required 34-step write-heavy E2E and complete role/RLS
  matrix could not be executed safely.
- The temporary production server on localhost:3100 logged sanitized Supabase
  `refresh_token_not_found` errors for the reused cross-port browser session even
  though authorized pages rendered. The configured localhost:3000 login was clean;
  repeat stale/expired-session recovery with a purpose-built QA session before beta.
- `pnpm lint` exits successfully with one existing warning in the Attendance-only
  `attendance-correction-service.ts`; it is outside this audit's implementation
  scope and is not a core-system blocker.
## 2026-07-15 - Live database/UI connection limitations

- The session/direct pooler on port 5432 resolves but remains unreachable from
  this environment. The transaction pooler on 6543 is reachable and passes
  read-only SQL.
- `supabase migration list` cannot use the transaction pooler because it triggers
  a duplicate prepared-statement error. `db:status` therefore falls back to the
  official linked Management API and can now read migration metadata safely.
- Migration history is materially divergent: 107 unique local versions versus 33
  remote, with 79 local-only and 5 remote-only. The remote-only entries are four
  CRM operational RLS migrations and one overnight-schedule migration. Two local
  version prefixes are duplicated (`20260521000001`, `20260522000001`). No history
  or schema repair was attempted.
- Only the existing CRM/front-desk browser session is available. Dedicated staff,
  driver, manager, and owner storage states, controlled writes, cleanup, realtime,
  and full live RLS matrices remain unverified.
- Full lint exits zero with one existing Attendance-only unused-function warning.

### ERR-BRANCH-REPLAY-001: Branch decision depended on stale Attendance replay

**Date:** 2026-07-16
**Agent:** PowerShell automation
**Severity:** HIGH
**Status:** FIXED

**Symptom:** Reusing Branch Corrections for another staff member returned “The original Attendance scan can no longer be resumed safely.”
**Root Cause:** The CRM UI still called the deprecated replay-based resolver and read the legacy request table.
**Fix / Workaround:** CRM now reads staff_branch_assignment_issues and calls resolve_staff_branch_assignment_issue. The old scan is never replayed; staff scan again after resolution.
**Prevention:** Keep Branch assignment and Attendance mutations transactionally independent.

---
# RELEASE-READINESS-001-RESUME validation notes — 2026-07-21

- Running lint, the full suite, and the production build concurrently caused seven UI tests to exceed the five-second timeout while 1,130 passed. A serial rerun passed all 150 files / 1,137 tests; this was resource contention, not a behavior failure.
- Linked `supabase db lint --linked --fail-on error` timed out through the configured pooler on port 5432 both inside and outside the sandbox. Database lint remains unverified; no database state changed.
- `pnpm install --frozen-lockfile` declined to proceed without a TTY because it wanted to remove the current modules directory. It was not forced, preserving the user's installed workspace.
- Direct opening of the Supabase changelog markdown endpoint was rejected by the web safety layer; the official breaking-change index was searched instead. Relevant cron guidance was incorporated.
## 2026-07-21 - CRM-RETENTION-001 verification notes

- The first retained-provider test exposed an update loop because a freshly
  allocated module descriptor was a layout-effect dependency. The descriptor is
  now memoized by workspace/path/search; the regression test passes.
- React's purity lint rejected render-time clocks/ref synchronization. Activation
  timestamps and scroll reads now occur in events/layout Effects, staleness is
  evaluated from activation versus last-refresh timestamps, and refs synchronize
  after commit. No lint suppression was added.
- The first full suite after prefetch changes failed because the restored Owner
  route allow-list fixture omitted the existing `/owner/attendance` route. The
  fixture was updated; no route or permission was added.
- The first live retained host cached the App Router layout outlet. That outlet is
  mutable, so a hidden Work Queue frame later rendered Schedule. Retained pages
  now register their concrete page subtree; the layout outlet is never cached.
- A nested custom SWR provider failed when a streamed retained Bookings subtree
  outlived the provider's initialized global state. Participating SWR keys are now
  user/role/branch-prefixed in SWR's stable cache, and workspace teardown purges
  that cache. The authenticated Bookings route then mounted without error.
- Bare sidebar URLs initially discarded retained query-backed filters/tabs. The
  registry now reopens the last canonical query state and keeps an unmounted
  element/URL/scroll descriptor after LRU eviction. Browser QA verified an
  evicted Work Queue remount with `filter=exceptions` and no bootstrap skeleton.
- Dev Fast Refresh briefly preserved a pre-restoration reducer state and logged a
  missing-restoration error. A clean reload after compilation had no new console
  error; focused tests and the production build use fresh state and pass.
- Authenticated CRM QA is complete. The available identity has Front Desk and
  Staff Portal access but no Owner access, so Owner and exact heap/network/CLS/
  long-task evidence remain pending rather than fabricated.
