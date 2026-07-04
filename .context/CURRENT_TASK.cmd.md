# Current Task - ATTENDANCE-DEVICE-REGISTRY-005

Status: COMPLETED_DB_VERIFIED
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Build the Device Registry and Recovery Center backend first, then replace the Attendance Devices tab.

Scope:
- Reuse the existing Attendance tables and scan/device architecture.
- Audit current `staff_devices`, `device_activation_tokens`, attendance events/sessions, activation route, token hashing, device cookie, RLS, and permissions before changing schema.
- Add only the missing database columns/indexes/constraints/RPC needed for one-time device recovery links, device metadata, rename, revocation, pending links, and atomic recovery consumption.
- Implement typed registry queries, server actions, permission checks, and recovery consumption before final UI work.
- Replace only the Attendance Devices tab content with the approved Device Registry and Recovery Center UI.
- Add the staff recovery confirmation screen at `/scan/activate/<token>` without consuming tokens on page load.
- Preserve permanent Attendance QR clock-in/out behavior and service QR behavior.

## Pre-flight Notes

- Required prompt read from `C:\Users\eleur\.codex\attachments\c5b7a049-06d2-49d3-a790-060b34f4ee33\pasted-text.txt`.
- Supabase skill guidance read; Supabase changelog checked on 2026-07-03 for the public-table explicit grant change.
- Local Next.js 16 docs consulted under `node_modules/next/dist/docs/` for Server Actions, Route Handlers, Server/Client Components, and async cookies before editing app code.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- The prior database connection task remains below for handoff context. The Supabase DB password pasted earlier must still be rotated outside the repo/session.

## Mandatory Sequence

1. Audit existing Attendance schema and code.
2. Repair or extend the database.
3. Implement backend queries, actions, permissions, and atomic recovery.
4. Test and verify the backend.
5. Replace the Devices tab UI.
6. Implement the staff recovery-link screen.
7. Wire realtime refresh and deep links.
8. Run full verification and update project context.

## Completion Checkpoint - 2026-07-03

Completed:
- Added migration `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql` and applied it to the linked Supabase database.
- Extended the existing `staff_devices` and `device_activation_tokens` model instead of creating duplicate attendance/device tables.
- Added atomic recovery consumption RPC `public.consume_attendance_device_recovery`, granted only to `service_role`.
- Added typed device registry/recovery backend helpers, CRM actions, scan recovery consumption, and generated Supabase types.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI, including filters, selected-device panel, pending recovery links, rename, revoke, recovery-link generation, and staff confirmation screen.

Verification:
- Live SQL probe: migration row, new columns, RPC, and `service_role` execute grant all returned `ok`.
- Live migration-history query also found the earlier local versions `20260703130922`, `20260703144603`, and `20260703145113` present remotely.
- `pnpm db:types`: PASS.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm vitest run tests/lib/attendance/device-recovery.test.ts`: PASS, 3 tests.
- `pnpm test`: PASS, 67 files / 595 tests.
- `pnpm build`: PASS, 105 routes.
- `git diff --check`: PASS, line-ending notices only.

Known limitations:
- `pnpm db:status` and `pnpm db:push` still time out on `aws-1-ap-northeast-1.pooler.supabase.com:5432`; live schema was verified directly through linked SQL instead.
- Authenticated browser QA for `/crm/attendance?tab=devices` and the staff recovery confirmation flow still needs a real CRM/front-desk session and a real phone/browser scan.
- A temporary SQL probe file `tmp-attendance-device-registry-verify.sql` remains untracked because Windows denied deletion and the elevated delete request was blocked by the environment usage limit.

---

# Previous Task - DATABASE-CONNECTION-STABILIZATION-001

Status: BLOCKED_ON_ROTATED_SECRETS_AND_REMOTE_MIGRATION_CONNECTIVITY
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Reset and establish a secure reusable Supabase migration, SQL, and type-generation connection.

Scope:
- Stabilize the project-local Supabase CLI workflow through `pnpm`.
- Keep linked Supabase CLI as the primary migration/type-generation path.
- Keep the transaction-pooler URL only as a local, git-ignored diagnostic and emergency fallback.
- Add reusable database doctor/status/verify/types wrappers that do not contain or print secrets.
- Document database setup, migration, type-generation, verification, fallback, and migration-history reconciliation procedures.
- Do not modify application business logic, reset production data, delete production data, or hardcode credentials.

## Pre-flight Notes

- Read the attached database stabilization prompt, Supabase skill guidance, `.context/*.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, root `AGENTS.md`, and root `CLAUDE.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; documented equivalents under `docs/` are being used.
- Supabase changelog was checked on 2026-07-03. Current relevant risks include Data API exposure defaults for new tables, direct DB host IPv6/IPv4 limitations, and pooler/prepared-statement behavior.
- Previous active scheduling repair is preserved below as a handoff; those dirty scheduling files are not part of this database tooling task.
- A Supabase database password was previously pasted in chat and must be treated as compromised until rotated outside this repo/session.

## Initial Plan

1. Audit local Supabase CLI package/shims, pnpm build-script state, stale processes, and link metadata.
2. Add secure environment placeholders and git-ignored local-secret guidance without committing credentials.
3. Create focused `scripts/database/*` wrappers for doctor/status/verify/types.
4. Update package database scripts to use the wrappers and project-local `pnpm exec supabase` workflow.
5. Document the reusable database runbook and context decisions/errors.
6. Run safe verification and report any remaining external blockers.

## Implementation Checkpoint - 2026-07-03

Completed:
- Added secure project-local Supabase wrappers in `scripts/database/`.
- Replaced stale hardcoded database package scripts with reusable `pnpm db:*` commands.
- Added `.env.example` placeholders for Supabase runtime and local-only database tooling variables.
- Updated `.gitignore` so `.env.example` can be tracked while `.env.local`, `.env.database.local`, and `supabase/.temp` stay ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Updated context, decision, error, handoff, project context, and roadmap notes.

Verified:
- `node --check scripts/database/*.mjs`: PASS
- `pnpm db:doctor`: RUNS; exits nonzero because DB password rotation is unconfirmed, `SUPABASE_DB_POOLER_URL` is missing, and linked migration history times out through the Supabase pooler.
- `pnpm db:status`: RUNS; local migration count is 83, remote history read times out, and no remote schema change occurred.
- `pnpm db:verify`: RUNS; linked SQL probe passes and the listed critical tables verify through service-role REST, but pooler fallback warns because `SUPABASE_DB_POOLER_URL` is missing.
- `pnpm db:push -- --dry-run`: RUNS; no remote schema change occurred, but the dry-run cannot connect to the remote migration database path.
- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS, 66 files / 592 tests
- `pnpm build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only
- Secret scan: PASS for tracked files and reviewed project placeholders; only placeholder URLs/variable names were found.

Not run:
- `pnpm db:types` was intentionally not run because `db:push --dry-run` is still blocked and generated types should not be refreshed from unreconciled remote schema history.

Remaining blockers:
- Rotate the Supabase database password outside the repo/session; the previously pasted password must be treated as compromised.
- Add the rotated pooler URL to `.env.local` or `.env.database.local` as `SUPABASE_DB_POOLER_URL`.
- Re-run `pnpm db:doctor`, `pnpm db:status`, `pnpm db:push -- --dry-run`, `pnpm db:push`, `pnpm db:types`, and `pnpm db:verify`.
- Reconcile migration-history drift before applying pending migrations.

---

# Previous Task - SCHEDULING-BACKBONE-AUDIT-001

Status: REPAIRED_LOCALLY
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Audit and repair all schedule-dependent operational flows before daily-use simulations.

Scope:
- Produce a scheduling dependency map before broad refactoring.
- Verify canonical schedule precedence across TypeScript and SQL/RPC paths.
- Repair confirmed timezone, group-membership, duration, blocking-status, realtime/cache, resource, dispatch, attendance, and Staff Portal inconsistencies where safe.
- Inspect the full local `supabase/migrations` folder and actual `get_daily_schedule`, `get_available_slots`, and `compute_booking_end_time` SQL definitions before changing schema or RPC behavior.
- Do not create a second scheduling engine, reset production data, regenerate QR codes, or start the large daily-use simulation suite during this task.

## Pre-flight Notes

- Read the attached master prompt, root `AGENTS.md`, `CLAUDE.md`, `docs/AGENT_RULES.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and the active `.context/*.cmd.md` files.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the documented `docs/` equivalents are being used.
- Next.js 16.2.4 local docs under `node_modules/next/dist/docs/` were consulted for Server Components, Server Actions/mutations, Route Handlers, and caching before edits.
- Supabase skill guidance was read. Direct Supabase CLI/type-generation remains historically blocked in this environment, so database verification must report exact command results honestly.
- Latest `main` is clean and synced after Attendance feed commit `7cae28f5`.

## Initial Plan

1. Create `docs/SCHEDULING_BACKBONE_AUDIT.md` with the required source/consumer map.
2. Inspect schedule resolver, availability, group rules/memberships, schedule workspaces, timezone helpers, Staff Portal, Attendance, booking duration, resource, dispatch, and SQL/RPC definitions.
3. Repair confirmed high-risk inconsistencies in the lowest shared layer first.
4. Add focused invariant/helper tests before broad simulations.
5. Run available verification and update context/handoff with exact blockers.

## Implementation Checkpoint - 2026-07-03

Completed in this slice:
- Added branch-local `YYYY-MM-DD` helpers in `src/lib/engine/slot-time.ts` and rewired touched Schedule pages, week/full-schedule views, coverage cards, CRM availability, and live timeline status away from UTC/machine-date defaults.
- Repaired Manager and Owner Schedule default selected dates to use branch business date.
- Repaired Full Schedule and Staff Full Schedule modal date navigation/labels to avoid `Date` + `toISOString()` serialization drift.
- Repaired Daily Timeline live status and Schedule Staff Mode summaries for branch-local current time and overnight windows.
- Repaired group-rule fallback lookups in CRM full schedule and assignment recommendations to use mapped plus raw group keys.
- Made group schedule apply fail closed when no explicit staff IDs are supplied.
- Added migration `supabase/migrations/20260703130922_scheduling_rpc_group_overnight_parity.sql` to align `get_available_slots` and `get_daily_schedule` with TypeScript group-key mapping, active booking-hold status semantics, and overnight schedule windows.
- Completed `docs/SCHEDULING_BACKBONE_AUDIT.md` with source map, consumer map, confirmed defects, repairs, SQL/RPC parity, verification, and remaining follow-ups.

Verified:
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run src/lib/engine/availability.test.ts tests/lib/schedule/resolve-staff-schedule.test.ts tests/lib/schedule/schedule-timeline.test.ts tests/lib/schedule/daily-timeline-operations.test.ts tests/lib/schedule/daily-schedule-query.test.ts tests/lib/actions/staff-schedule-groups.test.ts`: PASS, 11 files / 79 tests
- `git diff --check`: PASS, line-ending notices only

Remaining follow-ups:
- The new SQL migration has not been applied to the linked database in this pass.
- `compute_booking_end_time` and `get_available_slots` still need a separate schema/API decision for `branch_services.custom_duration_minutes`, because app code/generated types reference the column but local migrations do not define it.
- Overnight date-specific overrides/bookings/blocks remain a schema-level follow-up; this pass repaired overnight schedule windows and local UI/status math.
- Authenticated Schedule browser QA remains pending.

---

# Previous Task - ATTENDANCE-FULL-INTEGRATION-002

Status: IN_PROGRESS - dashboard feed/deep-link slice complete
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Upgrade and fully integrate the existing CradleHub Attendance system without creating a second attendance module.

Scope:
- Preserve existing QR public codes, scan URLs, activation links, device records, scan records, session/check-in rows, correction logic, permission helpers, realtime hooks, QR exports, and print behavior.
- Inspect the existing Attendance QR implementation before adding or changing schema/UI.
- Complete the trusted-device first-scan flow where a staff member signs in once, confirms device linking, receives an HttpOnly attendance-device cookie, and completes the first clock-in without a second scan.
- Keep future registered-device scans automatic while preserving duplicate-scan protection and safe revoked/unknown/wrong-branch handling.
- Add one reusable `AttendanceScanFeedCard` for the CRM Work Queue right rail and Owner overview/dashboard surfaces.
- Add or reuse focused attendance queries, deep links, realtime invalidation, staff profile attendance history, Staff Portal My Attendance, device management, and correction workflows where safely possible.
- Avoid destructive migrations, QR regeneration, production data resets, or edits to previously applied migrations.

## Pre-flight Notes

- Read `.context/CHANGELOG.cmd.md`, `.context/CURRENT_TASK.cmd.md`, `.context/DECISIONS.cmd.md`, `.context/ERRORS.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, root `AGENTS.md`, and root `CLAUDE.md`.
- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; the documented `docs/` equivalents are being used.
- Supabase changelog was checked on 2026-07-03. Relevant current risk remains Data API exposure for new public tables and direct DB/CLI connectivity limitations.
- Existing local verification from the previous checkpoint is green, but `pnpm db:push`/`pnpm db:types` remain blocked by direct DB connectivity and local Supabase CLI path issues.
- The Supabase database password was pasted earlier and must be rotated before production closure.

## Implementation Checkpoint - 2026-07-03

Completed in this slice:
- Added a reusable live `AttendanceScanFeedCard` backed by `qr_scan_events` and `staff_shift_checkins`.
- Wired the card into CRM Work Queue (`/crm/today`) and Owner Overview (`/owner`).
- Added `/api/attendance/recent-scans` for authenticated SWR refresh and Supabase realtime invalidation.
- Added `/owner/attendance` as a branch-aware owner entry that reuses the existing `AttendanceWorkspace` instead of creating a duplicate Attendance module.
- Preserved `/owner/attendance` tab switching on the owner route with the selected `branchId`.
- Added `/crm/attendance?tab=records&staffId=<id>&date=<yyyy-mm-dd>` filter handling, server-side invalid staff/date rejection, row highlighting, and a staff profile link.
- Added focused helper tests for feed record links and badge labels.

Verified:
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/scan-feed.test.ts tests/lib/attendance/tabs.test.ts`: PASS, 2 files / 9 tests
- `npm run lint`: PASS
- `npm run build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only

Still not complete from the full pasted prompt:
- First-scan trusted-device sign-in/linking flow was not rebuilt in this slice.
- Staff Portal "My Attendance" and staff-profile attendance history were not added.
- Authenticated browser QA still needs a valid CRM/front-desk session.
- `pnpm db:push`, `pnpm db:types`, migration-history repair, and database password rotation remain operational blockers before production closure.

---

# Previous Task - ATTENDANCE-SCHEDULE-LIVE-DATA-001

Status: IN_PROGRESS
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Fix the production Attendance public URL failure and wire CRM Schedule Daily Timeline coverage to fresh live schedule data.

Scope:
- Replace Attendance page-origin resolution from the unreliable browser `Origin` header with a server-only request-origin helper using forwarded host/protocol and host.
- Resolve QR public URLs through `APP_URL`, public URL fallbacks, Vercel production URL, safe request origin, and development-only localhost.
- Keep Attendance non-QR data loading even when QR URL configuration is unavailable.
- Scope QR unavailable state to QR actions only while preserving existing QR point IDs, public codes, versions, resource associations, and scan history.
- Add live SWR-backed Schedule daily data from the existing `/api/crm/schedule` endpoint with no-store responses.
- Centralize Schedule realtime invalidation and remove duplicate display-level subscriptions.
- Correct Coverage Overview scheduled-staff denominator and show regular/single schedule rows when present.
- Preserve timed override shift classification through a nullable `schedule_overrides.shift_type` migration and legacy fallback.

## Pre-flight Notes

- Read `.context/*`, root `CLAUDE.md`, root `AGENTS.md` via session instructions, and `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md` because root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout.
- Installed stack is Next.js 16.2.4 and React 19.2.4; local Next.js docs under `node_modules/next/dist/docs/` were consulted for async `headers()`, route handlers, and environment variable behavior.
- Supabase changelog and current Realtime/CLI docs were checked; no new-table Data API exposure work is needed for the nullable column migration, and Realtime Postgres Changes should use one channel with table-specific subscriptions.
- Worktree was already dirty with unrelated Bookings selected-card changes and locked temp files; do not revert or clean unrelated files.

---

# Previous In-Progress Task - BOOKINGS-SELECTED-CARD-REFIT-002

Status: IN_PROGRESS
Started: 2026-07-03
Last updated: 2026-07-03

## Description

Refit only the selected booking right-hand panel in the Bookings module to match the approved compact Selected Booking card mockup.

Scope:
- Keep the booking list, filters, tabs, header, pagination, CRM shell, and workspace layout unchanged except for the selected-panel footprint if needed.
- Preserve existing booking workflow server actions, status transitions, payment controls, notes, service countdown, recommendation logic, permission checks, and modal flows.
- Consolidate duplicated selected-booking details into one compact customer/booking summary.
- Provide one next-best primary action, secondary actions, overflow actions, compact payment and note summaries, collapsed full details, and compact recommendation warnings.
- Use the active-service countdown state in place of normal next actions when a service is running.
- Add focused coverage for next-action selection, overflow action availability, payment/note/full-details behavior, handler invocation, and key booking states.

## Pre-flight Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; equivalents in `docs/` plus root `AGENTS.md`, `CLAUDE.md`, and `.context/*` were read.
- Installed stack is Next.js 16.2.4 and React 19.2.4; relevant local Next.js docs under `node_modules/next/dist/docs/` are being consulted before source edits.
- Current branch is `main`; prior Attendance work was committed and pushed. Four locked zero-byte `_tmp_*` files remain untracked and unrelated.

---

# Previous Task - ATTENDANCE-REFIT-005

Status: BLOCKED ON AUTHENTICATED QR VISUAL QA
Started: 2026-07-02
Last updated: 2026-07-02

## Description

Refit the existing CRM Attendance workspace without rebuilding its database, scan engine, service-session engine, device activation flow, or Supabase security model.

Scope:
- Keep `/crm/attendance` as the single Attendance route.
- Keep one client workspace with instant local tabs for Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Remove KPI-card rows from Attendance tabs, especially Overview.
- Reorganize Overview around live staff, recent scans, active sessions, exceptions, and compact quick actions.
- Rework QR Codes toward the approved compact list + selected branded preview design.
- Make Records, Sessions, Devices, Exceptions, and Reports professional compact workspaces.
- Fix the Attendance sidebar icon with `ClipboardCheck`.
- Preserve existing QR public codes, registered devices, scan routes, clock-in/out, room service-start logic, exceptions, records, reports, RLS, and branch access.
- Avoid `router.push`, `router.replace`, `router.refresh`, route links, or redirects for routine tab switching.
- Ensure QR generation actions return typed results and do not surface `NEXT_REDIRECT`.

## Pre-flight Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are absent in this checkout; equivalents in `docs/` plus root `AGENTS.md` and `CLAUDE.md` were read.
- Installed stack is Next.js 16.2.4 and React 19.2.4; local Next docs under `node_modules/next/dist/docs/` were read for Server/Client Components, Server Actions, instant navigation, preserved UI state, and redirect behavior.
- The prior `ATTENDANCE-QR-001` implementation is present as untracked source files in this dirty worktree. Do not revert unrelated user/previous-agent changes.

## Implementation Complete - 2026-07-02

- Rebuilt the Attendance workspace shell into a client-owned instant tab surface.
- Tab switches now use local state plus `window.history.replaceState()` through shared tab helpers; routine tab changes no longer use Next router refresh/navigation or route links.
- Removed Attendance KPI-card rows and replaced Overview with live staff status, recent scan activity, active service sessions, exceptions requiring attention, and compact quick actions.
- Split Records, Sessions, QR Codes, Devices, Exceptions, and Reports into compact professional tab workspaces.
- Reworked QR Codes into a selected-list + branded preview flow with reusable print layouts, export filenames, SVG/PNG/print/copy helpers, QR info, generate missing, generate attendance QR, and deactivate QR.
- Converted Attendance server actions from redirect/status-query patterns to typed `AttendanceActionResult` returns so server-action errors do not surface as `NEXT_REDIRECT`.
- Fixed the CRM Attendance sidebar icon by switching the nav config from missing `QrCode` to supported `ClipboardCheck`.
- Added pure helpers and coverage for tab parsing, QR URL/base URL production guards, print SVG layouts, and export filenames.

## Validation - 2026-07-02

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/tabs.test.ts tests/lib/attendance/qr-url.test.ts tests/lib/attendance/qr-print-layout.test.ts tests/lib/attendance/qr-filenames.test.ts`: PASS, 4 files / 14 tests.
- `npm run lint`: PASS with 4 unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- `npm run build`: PASS, 104 app routes including `/crm/attendance`, `/scan/[publicCode]`, and `/scan/activate/[token]`.
- `npm test -- --run`: PASS outside sandbox after sandboxed Vite config load failed with Windows `spawn EPERM`; 60 files / 564 tests.
- `git diff --check`: PASS, line-ending notices only.
- Source scan found no Attendance `redirect()`, `NEXT_REDIRECT`, `useRouter`, `router.*`, route `<Link>`, or `window.location` usage in the refit surface.
- Attendance component files are all under 200 lines; largest is `qr-codes-tab.tsx` at 189 lines.
- Final pnpm continuation: `pnpm type-check` PASS, `pnpm lint` PASS with 0 warnings, `pnpm test` PASS (60 files / 564 tests), and `pnpm build` PASS (104 app routes).
- The four previous lint warnings were fixed in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`; no eslint suppressions, `any`, or `@ts-ignore` were used.

## Follow-up / Limitations

- Authenticated browser QA for `/crm/attendance` tabs and real scan/device flows is still needed; the existing local dev server redirects unauthenticated browser sessions to `/login`.
- Browser smoke via `agent-browser` confirmed `/crm/attendance` redirects to `/login`, the login page renders content, and no Next/Vite error overlay is present.
- Existing QR/database/scan engine caveats from `ATTENDANCE-QR-001` still apply: pg_cron was not installed, migration history may need reconciliation, and `npm run db:types` remains a separate Supabase CLI script repair.
- Final browser QA attempted `/crm/attendance?tab=qr` at 1440, 1280, 1024, 768, and 375 px; every viewport redirected to `/login` because no authenticated Supabase CRM/front-desk browser session is available.
- Blocker screenshots were captured under `.codex-artifacts/attendance-qr-qa/`.
- Real QR interaction checks, phone-camera scans of exported PNG/SVG/print output, and QR identity preservation checks remain pending.

---

# Previous Task - ATTENDANCE-QR-001

Status: COMPLETE LOCALLY; authenticated CRM/browser QR QA remains PENDING
Started: 2026-07-02
Last updated: 2026-07-02

## Description

Build and wire the CradleHub QR Attendance and Service Session system:

- CRM `/crm/attendance` workspace with Overview, Attendance Records, Service Sessions, QR Codes, Registered Devices, Exceptions, and Reports tabs.
- Permanent branch attendance QR and room/resource QR scan flows through public `/scan/*` routes.
- One-time CRM-controlled staff device activation with secure cookie credentials.
- Database schema/RLS/functions for QR points, devices, activation tokens, scan events, attendance exceptions, corrections/settings, and service session authority fields.
- Attendance automation for clock-in/clock-out, duplicate protection, wrong-branch/unknown-device/revoked-device handling, unscheduled exceptions, and active-service clock-out blocking.
- Service-session start flow that reuses existing booking progress/session fields and room/resource assignment rules.
- Server-driven due-session completion where supported.
- Context, architecture, schema, and roadmap documentation updates after implementation.

## Pre-flight Notes

- Root `AGENT_RULES.md`, `PROJECT_CONTEXT.md`, and `ROADMAP.md` are absent in this checkout; the available equivalents are `AGENTS.md`, `.context/*`, `docs/PROJECT_CONTEXT.md`, and `docs/ROADMAP.md`.
- Current branch: `main`.
- Worktree was already dirty before this task, including prior CRM role normalization changes and many schedule/UI files. Do not revert unrelated existing changes.
- Next.js local docs and the Next.js/Supabase skills are being used for route handlers, async cookies/search params, public scan routes, server mutations, Supabase schema/RLS, and security guidance.

## Implementation - 2026-07-02

- Added migration `supabase/migrations/20260702075213_attendance_qr_system.sql`.
- Added QR attendance tables for QR points, staff devices, one-time activation tokens, scan events, attendance exceptions, corrections, and settings.
- Extended `staff_shift_checkins` with schedule/method/scan/metric fields and `bookings` with service-session duration/due/source fields.
- Added RPC `public.complete_due_service_sessions(p_limit integer default 100)`.
- Added server-only attendance helpers under `src/lib/attendance/*` for QR SVG generation, device credentials, timing metrics, workspace queries, and scan processing.
- Added public scan routes `/scan/[publicCode]` and `/scan/activate/[token]`.
- Added CRM workspace `/crm/attendance` with Overview, Attendance Records, Service Sessions, QR Codes, Registered Devices, Exceptions, and Reports tabs.
- Added CRM server actions for creating attendance/room QR points, creating activation links, revoking devices, resolving exceptions, and manually completing due sessions.
- Added CRM navigation/prefetch/agent-prompt entries for Attendance.
- Added `qrcode` and `@types/qrcode`.

## Database Status

- Migration was applied to the linked Supabase project via `supabase db query --linked --file`, then rerun after grant tightening.
- Live catalog verification confirmed all new tables, new booking/check-in columns, the RPC, and RLS/select policies.
- Authenticated grants are SELECT-only on new read surfaces; `device_activation_tokens` has no authenticated grant; anon grants were not present in the checked results.
- `pg_cron` is not installed on the linked project, so the optional cron block did not schedule an automatic job. The RPC is available for manual/server-side execution.
- Because this was applied with `db query --file`, Supabase migration-history tracking may not show the migration as applied. Do not assume `db push` history is reconciled.

## Validation - 2026-07-02

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings in `scripts/generate-service-image-assets.mjs` and `tests/components/payroll/employee-payroll-table.test.tsx`.
- `npx vitest run src/lib/attendance/time.test.ts`: PASS, 1 file / 3 tests.
- `npm run build`: PASS, 104 app routes including `/crm/attendance`, `/scan/[publicCode]`, and `/scan/activate/[token]`.

## Follow-up / Limitations

- Authenticated browser QA was not run for CRM Attendance or real device scan flows.
- The `db:types` npm script is stale for the current Supabase CLI because it uses removed `--project-ref`; production type generation also exposed unrelated live schema drift, so `src/types/supabase.ts` was restored from baseline and manually augmented for attendance.
- Two zero-byte `_tmp_14412_*` files remain because PowerShell returned Access denied when attempting scoped `Remove-Item -LiteralPath`.

## FK Fix - 2026-07-02

- Fixed `qr_points_branch_id_fkey` failures when dev bypass is enabled.
- Root cause: Attendance server actions preferred `getDevBypassLayoutStaff()` before checking the real staff record, which supplied the zero UUID branch id `00000000-0000-0000-0000-000000000000`.
- Added `src/lib/dev-bypass-server.ts` to resolve dev bypass to a real active branch from Supabase, with optional `DEV_BYPASS_BRANCH_ID` support.
- Updated `getAttendanceActionContext()` to prefer the authenticated staff branch first, then fall back to the resolved real dev branch.
- Updated `getFrontDeskContext()` dev fallback to use the same real branch resolver.
- Added branch existence validation before attendance settings and QR point inserts so future invalid branch ids fail with a clear app-level message instead of a raw FK error.
- Verification: `npx tsc --noEmit --pretty false` PASS; `npm run lint` PASS with the same 4 unrelated warnings.
- Linked DB check confirmed zero UUID branch does not exist and the dev fallback branch resolves to `c1000000-0000-0000-0000-000000000002`.
- `npm run build` was attempted after the fix but did not return before the tool timeout; no build result is available for this follow-up patch.

---

# Previous Task - CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01

Status: COMPLETE LOCALLY; authenticated CRM Schedule QA remains PENDING
Started: 2026-07-01
Last updated: 2026-07-01

## Description

Complete the active CRM Schedule workspace before authenticated QA while preserving the shared administrative booking modal and prior Schedule modal-action work.

Latest attached direction supersedes the older "Front Desk only" wording for visible navigation:

- Primary daily CRM nav target: `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`.
- Secondary collapsed target: `System Management` with Staff & Access, Services & Providers, Rooms & Resources, Booking Rules, Schedule Management, System Health, and Close Day.
- Do not rebuild stable parts. Stabilization and action reliability are more important than visual polish.
- Keep old CRM routes and redirects alive; this checkpoint is a shell/navigation update, not a page or database rewrite.

## Latest Implementation - 2026-07-01

- Added explicit staff selection state shared by Daily Timeline and Full Schedule; no row is auto-selected from `visibleRows[0]`.
- Updated the Selected Staff card no-selection copy and added active actions for Edit Profile, Edit Capabilities, and View Full Schedule.
- Reused existing staff profile, staff service-capabilities, full schedule calendar, availability editor, block-time, check-availability, and administrative booking modal surfaces from inside `/crm/schedule`.
- Added in-place Edit Capabilities wiring through `StaffServiceEditorSheet` and `updateStaffServicesFromCrmAction`, with `/crm/schedule` revalidation after save.
- Added timeline lane assignment in `src/lib/utils/schedule-timeline.ts` and applied it to Daily Timeline booking blocks so overlapping bookings render as separate vertical lanes.
- Added the Schedule header view toggle:
  - `Daily Timeline`
  - `Full Schedule + Live Bookings`
- Added `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx` as a master-detail view with staff list, Day/Week mode, layer toggles, live bookings, shifts, blocks, overrides, no-shift states, and conflict flags.
- Full Schedule booking clicks now open the in-Schedule booking detail panel using the real booking id; they do not navigate away from `/crm/schedule`.
- Permission/RLS audit did not require a new migration. Existing relevant coverage remains:
  - `supabase/migrations/20260529000002_crm_csr_schedule_rls.sql`
  - `supabase/migrations/20260529000003_crm_csr_staff_update_rls.sql`
  - `supabase/migrations/20260617141348_crm_staff_service_capabilities_rpc.sql`

## Previous Implementation - 2026-06-30

- Added shared quick-booking option loaders and customer prefill action:
  - `src/lib/queries/quick-booking-options.ts`
  - `src/lib/actions/administrative-booking.ts`
- Mounted `AdministrativeBookingModalProvider` in the CRM layout.
- Extended `QuickBookingForm` for modal use: prefilled service/staff/date/time, stay-vs-redirect success behavior, cancel/success callbacks, and dirty-state reporting.
- Converted major CRM New Booking triggers to modal buttons across Bookings, Today/Work Queue, Customers, Waitlist, Setup flow cards, direct customer profile, and Schedule header.
- Preserved `/crm/bookings/new` as the direct/legacy full-page route, now backed by the same shared option helpers.
- Added active Schedule modal actions:
  - Add Booking opens the shared booking modal with selected staff/date/time where available.
  - Check Availability opens an in-context availability modal and can hand off selected slots to booking creation.
  - Edit Staff Profile opens the existing CRM staff profile modal after loading full staff data.
  - View Full Schedule opens the existing staff schedule calendar modal.
  - Adjust Staff / Block Staff Time open the existing availability editor, with block-time opening directly on the block form and selected date.
- Converted Schedule quick actions away from old `/crm/staff-availability` deep links inside the Schedule workspace where practical.

## Earlier Implemented Checkpoints

- Completed the interrupted Bookings / Quick Booking checkpoint:
  - Replaced `/crm/bookings/new` with a CRM Quick Booking form for walk-in, phone, future, and home-service modes.
  - Aligned the form, Zod schema, action input, customer upsert, home-service payload, assignment fields, payment state, metadata, and booking insert payload.
  - Preserved the existing `createInhouseBookingMultiAction`; no second booking action was added.
  - Completed Bookings grouping into Needs Action, Upcoming, Active, and Completed while preserving the existing drawer and row actions.
  - Verified authenticated CRM creation for walk-in, phone, future, and home-service bookings against live Supabase data.
- Prior checkpoint simplified visible CRM navigation to `Front Desk`, `Schedule`, `Customers`, `Dispatch`, plus management-only `Admin & Setup`.
- Fixed several misleading Today shell controls: dead `View all`, fake clickable rows, non-functional End of Day tab exposure, Add Follow-up destination, and 24-hour day progress indicator.
- Added richer `getFrontDeskContext()` in `src/lib/queries/crm-context.ts` with user id, role, branch id/name, capabilities, and allowed destinations.
- Replaced duplicated local CRM user/staff/branch lookups in:
  - `src/app/(dashboard)/crm/today/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/app/(dashboard)/crm/control/page.tsx`
  - `src/app/(dashboard)/crm/live-operations/page.tsx`
- Dedicated progress log: `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.

## Current Worktree State

Uncommitted changes are present. Do not revert them unless the user explicitly asks.

Changed areas include:

- Schedule workspace completion files:
  - `src/components/features/schedule/workspace/schedule-workspace-header.tsx`
  - `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-selection-card.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
  - `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx`
  - `src/lib/actions/crm-staff-services.ts`
  - `src/lib/utils/schedule-timeline.ts`
- Checkpoint 1 sidebar/nav shell files:
  - `src/components/features/dashboard/nav-config.ts`
  - `src/components/features/dashboard/sidebar.tsx`
  - `src/components/features/workspace/workspace-prefetch-config.ts`
- CRM page/context consolidation files listed above.
- CRM setup/staff/staff-availability gating from the previous checkpoint.
- Dashboard header/sidebar/nav/readiness/workspace-access changes from the previous checkpoint.
- Bookings / Quick Booking files:
  - `src/app/(dashboard)/crm/bookings/new/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/components/features/bookings/quick-booking-form.tsx`
  - `src/components/features/bookings/bookings-workspace.tsx`
  - `src/lib/actions/inhouse-booking.ts`
  - `src/lib/validations/booking.ts`
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md` handoff log.

Run `git status --short --branch` before continuing.

## Validation Last Run

- `npm run type-check`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`.
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings.
- `npm run build`: PASS, 103 app routes
- `git diff --check`: PASS, line-ending notices only
- Browser smoke via `agent-browser` on existing `http://localhost:3000`:
  - `/crm/schedule` redirects unauthenticated browser session to `/login`; login page loads with content and no Next.js error overlay.
- Browser console/errors on the unauthenticated smoke route: no page errors; only normal dev/HMR/Speed Insights messages.
- Authenticated CRM Schedule modal/browser flow: NOT RUN in this checkpoint because no authenticated CRM browser session was available.
- `npm run test`: NOT RUN for this checkpoint.

## Next Agent Pickup

1. Read `docs/FRONT_DESK_REFACTOR_PROGRESS.md` first.
2. Inspect current diffs before editing.
3. Do not rebuild the shared booking modal, Schedule modal wiring, or new Full Schedule view from scratch; type-check, lint, and build are passing.
4. Recommended next step is an authenticated CRM browser pass:
   - Open `/crm/schedule` and verify Daily Timeline selection, no-selection disabled actions, Add Booking, Check Availability, Edit Staff Profile, Edit Capabilities, View Full Schedule, Adjust Staff, and Block Staff Time.
   - Switch to `Full Schedule + Live Bookings`, select staff, toggle Day/Week and layers, open a live booking detail, and confirm conflicts/layers render correctly.
   - Save at least one safe staff capability edit only if using a disposable/test staff record.
   - Confirm internal CRM New Booking triggers still open the shared modal and do not navigate to `/crm/bookings/new`.
5. Keep `/crm/bookings/new` alive for direct links, agent fallback, and compatibility.
6. Continue broader Work Queue / Today simplification only after authenticated Schedule QA if possible.

## Current Continuation - ATTENDANCE-SCHEDULE-REPAIR-002

- Status: Code repair and local verification are complete for the Daily Timeline console error and live Schedule data stabilization.
- The prior production `{}` console log is now replaced by contextual logging with branch ID, selected date, message, and development-only stack details.
- The daily schedule query now includes `schedule_overrides.shift_type` and fails loudly on staff metadata, blocked-time, and override query failures instead of silently returning empty data.
- Live DB check succeeded through the transaction pooler; the direct Supabase DB host was unreachable from this environment because it resolved to IPv6 only.
- The live DB already has `schedule_overrides.shift_type` and its check constraint, but Supabase migration history does not show `20260703022600` as applied.
- Verification passed with `npx tsc --noEmit`, `npm run lint`, focused schedule tests, full `npx vitest run`, `npm run build`, and `git diff --check`.
- Remaining infrastructure blocker: fix local pnpm/Supabase CLI first, then rerun `pnpm db:push` and `pnpm db:types` to reconcile migration history and generated types.
- Remaining security task: rotate the Supabase database password because it was pasted into the chat.
