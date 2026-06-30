# 📜 CHANGELOG — What Has Been Done

> **APPEND ONLY. Never delete entries. Every agent adds to the bottom.**

---

## Format

```
### [DATE] — [AGENT_TYPE] (e.g., Claude Code / Codex / Human)

**Task:** Brief description of what was done
**Files Changed:**
- `path/to/file.tsx` — what changed
- `path/to/other.ts` — what changed

**Roadmap Items Completed:** 0.1, 0.2
**Notes:** Any additional context
**Build Status:** ✅ Passing / ❌ Failing (with reason)

---
```

## Log

### 2026-05-15 — Claude Code (Sonnet 4.6) [2]

**Task:** Supabase Data API explicit grants — forward-compat for May 30 / Oct 30 2026 rollout

**Files Changed:**
- `supabase/migrations/20260521000001_data_api_explicit_grants.sql` — New: explicit GRANT statements for all 30 public tables + RPC function execute grants
- `docs/audits/SUPABASE_DATA_API_GRANTS_AUDIT.md` — New: full audit table, role analysis, RLS issues found
- `docs/database/MIGRATION_GRANT_RULES.md` — New: mandatory grant rules for all future migrations
- `docs/database/check-data-api-grants.sql` — New: verification SQL script for post-migration checks

**Notes:**
- No existing RLS policies modified — grants are additive
- 6 tables granted to `anon` (truly public: branches, services, service_categories, branch_services, public_site_sections, public_site_assets)
- 30 tables granted to `authenticated` and `service_role`
- `booking_events` — SELECT only for authenticated (trigger-written, immutable)
- `booking_payment_logs` — SELECT/INSERT only for authenticated (append-only audit)
- `role_definitions`, `job_title_definitions` — SELECT only for authenticated (reference tables)
- RLS issue documented: departments, staff_service_categories, role_definitions, job_title_definitions have RLS enabled but no policies — access works only via service_role currently
- RPC function execute grants added for 10 functions
- `customer_preferences` is NOT a separate table — columns on `customers` table (no action needed)

**Build Status:** ✅ Passing — type-check clean, lint 2 pre-existing warnings, build succeeds

---

### 2026-05-15 — Claude Code (Sonnet 4.6)

**Task:** Phase 5 — Production Observability (structured logging, business audit trail, console cleanup)

**Files Changed:**
- `src/lib/logger.ts` — Added `logInfo`, `logBusinessEvent`; refactored to `emit()` helper; structured JSON output
- `src/lib/actions/online-booking.ts` — Added `logError` + `logBusinessEvent` for online booking flow
- `src/lib/actions/inhouse-booking.ts` — Added `logError` + `logBusinessEvent` for CRM/inhouse booking flow
- `src/app/(dashboard)/manager/bookings/actions.ts` — Added `logError` + `logBusinessEvent` for booking status changes
- `src/app/(dashboard)/manager/walkin/actions.ts` — Added `logBusinessEvent`; fixed `resolvedStaffId` bug → `d.staffId`
- `src/app/(dashboard)/staff-portal/actions.ts` — Added `logError` + `logBusinessEvent` for progress updates
- `src/app/staff-onboarding/actions.ts` — Added `logError` + `logBusinessEvent` for submit, approve, reject
- `src/app/(dashboard)/owner/branches/actions.ts` — Added `logBusinessEvent` for all branch/service mutations
- `src/app/(dashboard)/manager/scheduling/actions.ts` — Added `logBusinessEvent` for rules + suggestion approve/reject
- `src/lib/notifications/create.ts` — Replaced `console.error` with `logError`
- `src/lib/notifications/workflow-signals.ts` — Replaced `console.error` with `logError`
- `src/lib/notifications/workflow-notifications-store.ts` — Replaced `console.error` with `logError`
- `src/lib/notifications/workflow-task-store.ts` — Replaced `console.error` with `logError`
- `src/lib/notifications/queries.ts` — Replaced `console.error` with `logError`
- `src/lib/notifications/workflow-queries.ts` — Replaced `console.error` with `logError`
- `src/app/error.tsx` — Added dev-only guard to `console.error` in root error boundary
- `src/app/(auth)/login/actions.ts` — Replaced `console.error` (removed PII email field); added `logError`
- `src/lib/queries/staff-context.ts` — Replaced `console.error` with `logError`
- `src/app/api/booking/available-slots/route.ts` — Replaced `console.error` with `logError`
- `src/proxy.ts` — Replaced `console.error` with `logError`; removed noisy redirect `console.log` calls
- `src/components/features/services/service-card.tsx` — Wrapped `console.error` in dev-only guard
- `src/components/features/services/service-status-toggle.tsx` — Wrapped `console.error` in dev-only guard
- `docs/audits/PRODUCTION_OBSERVABILITY_PLAN.md` — New: full implementation plan and gap analysis

**Notes:**
- `SpeedInsights` was already wired in `src/app/layout.tsx` — no change needed (Target G pre-done)
- No new packages installed; no DB migrations; no RLS changes
- No PII in any log context (email removed from login action log)
- Client error boundaries cannot reach production log drains without Sentry — documented in plan

**Build Status:** ✅ Passing — type-check clean, lint 2 pre-existing warnings (not introduced here), build succeeds

---

### 2026-05-15 — Claude Code (Sonnet 4.6) [3]

**Task:** Fix failing Supabase Data API grants migration — correct tables, complete function grants

**Root Cause:** `20260521000001` included GRANTs for `role_definitions` and `job_title_definitions`
which do not exist in the live database. Migration failed with `42P01: relation "public.role_definitions"
does not exist`. Section 4 (all function execute grants) never ran, which caused the
`[layout] staff lookup error {}` — RLS policy evaluation on `staff` table failed because
`get_auth_role()`, `get_auth_branch_id()`, `get_auth_staff_id()` lacked execute grants for
the `authenticated` role.

**Files Changed:**
- `supabase/migrations/20260521000002_data_api_explicit_grants_fix.sql` — New: completes all
  missing table grants (13 tables) + all 11 function execute grants that failed to run
- `docs/audits/SUPABASE_DATA_API_GRANTS_AUDIT.md` — Updated: corrected status header,
  marked role_definitions/job_title_definitions as non-existent in live DB

**What the fix migration adds:**
- Table grants: branch_resources, branch_booking_rules, daily_cash_reconciliations,
  booking_payment_logs (SELECT/INSERT only for authenticated — append-only),
  waitlist_requests, staff_onboarding_requests, workspace_notifications, workflow_tasks,
  staff_services, scheduling_rules, staff_scheduling_preferences,
  schedule_suggestions, schedule_health_checks
- Function execute grants: get_auth_role, get_auth_branch_id, get_auth_staff_id (anon+auth+service),
  compute_booking_end_time (anon+auth+service), update_booking_progress, update_home_service_tracking,
  get_daily_schedule, get_bookable_staff, get_available_slots (auth+service),
  upsert_customer (service only), get_effective_price (auth+service)

**What was excluded (intentionally):**
- `role_definitions` — does not exist in live DB (no migration effect applied it)
- `job_title_definitions` — does not exist in live DB
- `staff_location_snapshots` — no migration defines this table; cannot safely grant

**Notes:**
- GRANT is idempotent in PostgreSQL — safe to run even if some grants already partially applied
- The `[layout] staff lookup error {}` should resolve once function grants are applied

**Build Status:** N/A — SQL migration only, no source code changes

---

### 2026-06-30 — Codex

**Task:** Update current CRM stabilization/refactor handoff records so another AI agent can resume safely if the current Codex session stops.

**Files Changed:**
- `.context/CURRENT_TASK.cmd.md` — replaced stale CRM Coach active task with current CRM stabilization/refactor state.
- `.context/HANDOFF.cmd.md` — replaced stale CRM Coach handoff with current CRM pickup guidance.
- `.context/CHANGELOG.cmd.md` — appended matching handoff entry.
- `.context/ERRORS.cmd.md` — logged pre-flight path mismatch / stale handoff risk.
- `docs/CURRENT_TASK.cmd.md` — mirrored active CRM task.
- `docs/HANDOFF.cmd.md` — mirrored current pickup guidance.
- `docs/CHANGELOG.cmd.md` — appended this entry.
- `docs/ERRORS.cmd.md` — logged docs-side pre-flight note.
- `docs/PROJECT_CONTEXT.md` — updated current status/latest update.
- `docs/ROADMAP.md` — logged CRM stabilization handoff.
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md` — added continuation protocol and latest navigation direction.

**Notes:**
- No app/source behavior changed in this docs-only update.
- Latest CRM direction: primary nav should move toward `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`; secondary tools should live under collapsed `System Management`.
- Previous code checkpoint still stands: `getFrontDeskContext()` exists and target CRM daily pages now reuse it.

**Build Status:** Not rerun — documentation-only handoff update. Last code checkpoint passed `npm run type-check`, `npm run lint`, and `npm run build`.

---

### 2026-06-30 — Codex

**Task:** Complete CRM stabilization Checkpoint 1 for the sidebar/navigation shell.

**Files Changed:**
- `src/components/features/dashboard/nav-config.ts` — CRM primary nav is now `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`; management tools were moved to System Management definitions.
- `src/components/features/dashboard/sidebar.tsx` — added collapsed `SYSTEM / System Management` bottom section, gear icon, query-aware active matching, and prefetch opt-out for secondary links.
- `src/components/features/workspace/workspace-prefetch-config.ts` — CRM auto-prefetch now warms only primary daily routes.
- `.context/*`, `docs/*`, and `docs/FRONT_DESK_REFACTOR_PROGRESS.md` — updated checkpoint status and next-agent notes.

**Notes:**
- Existing CRM routes were preserved. No database logic, server actions, route deletes, or Supabase changes were made.
- System Management remains aligned with the current management-authorized page gates; broader CRM/CSR system-tool access is still a documented follow-up.
- The CRM header and page-level Work Queue/Bookings/Schedule simplification remain pending checkpoints.

**Build Status:** Passing — `npm run type-check`, `npm run lint` (4 unrelated existing warnings), `npm run build`, and `git diff --check` passed.

---
