# HANDOFF - Next Agent Session

## Current Task - 2026-07-04

ATTENDANCE-MOBILE-SCAN-FLOW-006 is locally complete.

## Latest Mobile Scan Flow Checkpoint

- Confirmed `/scan/[publicCode]/page.tsx` renders `PublicScanProcessor` and passes the async App Router `publicCode` param into the public scan action.
- Confirmed `PublicScanProcessor` is client-side, starts at `recognizing`, schedules `processing`, invokes the server action from `useEffect` after mount, catches failures, and always settles to `result`.
- Added `src/app/scan/[publicCode]/loading.tsx` so the route shows the same recognizing shell while the page itself is resolving.
- Kept `src/lib/attendance/scan-engine.ts` as the authoritative backend path for QR lookup, trusted-device cookie checks, branch validation, duplicate protection, event logging, check-in insert, and check-out update.
- Extended public scan result metadata with optional `reasonCode`, `severity`, and `securityNote` so mobile blocked/error/recovery states can render cleanly without changing existing consumers.
- Added user-safe server action fallbacks for scan, activation, and recovery action failures.
- Wired public scan/recovery writes to the existing `revalidateAttendanceSurfaces()` helper, covering `/crm/attendance`, `/crm/availability`, `/crm/today`, and `/staff-portal`.
- Active-service clock-out blocks now pass the existing service countdown data back to the public result UI when available.

## Latest Verification

- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS, Next.js 16.2.4, 105 routes.
- Local dev server is running on port `3000` with PID `31160` from `pnpm exec next dev -H 0.0.0.0`.
- Browser smoke via `agent-browser` on `http://localhost:3000/scan/test-public-code`: PASS. The invalid QR flow rendered `QR not recognized`, body content was nonblank, and no Next.js/Vite overlay was found.
- Smoke screenshot: `C:\Users\eleur\.agent-browser\tmp\screenshots\screenshot-1783127833941.png`.

## Still Open

- Authenticated/live phone QA remains pending for real staff devices, branch QR codes, duplicate-scan timing, revoked/wrong-branch devices, and recovery links.
- For local phone testing, current LAN IP is `192.168.137.149`; start dev with `pnpm dev -- -H 0.0.0.0` and open `http://192.168.137.149:3000/scan/<publicCode>` from the phone on the same network.
- Existing untracked local artifacts are still present and intentionally not removed: `.attendance-scan-backups/` and `tmp-attendance-device-registry-verify.sql`.

---

## Current Task - 2026-07-03

ATTENDANCE-DEVICE-REGISTRY-005 is locally complete and live DB verified.

## Latest Attendance Device Registry Checkpoint

- Added and applied `supabase/migrations/20260703151111_attendance_device_registry_recovery.sql`.
- Live SQL verification returned `ok` for the migration-history row, all new `staff_devices` / `device_activation_tokens` columns, `public.consume_attendance_device_recovery`, and the `service_role` execute grant.
- Linked migration-history SQL also found earlier local versions `20260703130922`, `20260703144603`, and `20260703145113` present remotely.
- Added typed backend helpers for registry data, recovery link generation, rename, revoke, pending-link revocation, token preview, and recovery consumption.
- Replaced the Attendance Devices tab UI with registry filters, table, pending recovery links, selected-device panel, recovery-link dialog, rename dialog, and revoke dialog.
- `/scan/activate/[token]` now renders the recovery confirmation screen and does not consume recovery tokens until staff taps the restore button.
- `src/app/scan/actions.ts` writes the new `cradle_attendance_device` cookie at `/` and still reads legacy `cradle_device` for compatibility.
- Recovery consumption does not clock staff in/out or start service sessions; it creates the trusted device and writes an activation audit row only.

## Latest Verification

- `pnpm db:types`: PASS.
- `pnpm type-check`: PASS.
- `pnpm lint`: PASS.
- `pnpm vitest run tests/lib/attendance/device-recovery.test.ts`: PASS, 3 tests.
- `pnpm test`: PASS, 67 files / 595 tests.
- `pnpm build`: PASS, 105 routes.
- `git diff --check`: PASS, line-ending notices only.

## Still Open

- Authenticated browser QA for `/crm/attendance?tab=devices`, the recovery dialog copy flow, and a real staff phone recovery scan.
- `pnpm db:status` and `pnpm db:push` still time out on the Supabase port `5432` migration-history path even though live schema is verified.
- Rotate the pasted Supabase DB password and update only git-ignored local/deployment secrets.
- Manually remove `tmp-attendance-device-registry-verify.sql` if it still appears; sandbox deletion was denied and elevated delete was blocked by environment usage limits.

---

## Current Task - 2026-07-03

DATABASE-CONNECTION-STABILIZATION-001 is in progress. The secure reusable Supabase tooling layer and runbook are in place, but live remote success still requires rotated local database credentials and/or working Supabase CLI auth.

## Latest Database Tooling Checkpoint

- Added project-local wrappers under `scripts/database/`:
  - `db-doctor.mjs`
  - `db-status.mjs`
  - `db-verify.mjs`
  - `db-types.mjs`
  - `db-link.mjs`
  - `db-push.mjs`
  - `db-migration-new.mjs`
  - `_shared.mjs`
- Updated `package.json` database scripts to call these wrappers.
- Updated `.env.example` with placeholders only; `.env.local` and `.env.database.local` remain git-ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md`.
- Confirmed direct project-local Supabase CLI shim works: `.\node_modules\.bin\supabase.CMD --version` -> `2.95.6`.
- Confirmed `pnpm exec supabase --version` is unreliable in this managed shell, returning command-not-found even though the local shim exists.
- Confirmed no active `supabase` or `postgres` process was running during audit.
- Confirmed `psql` is not installed, so the emergency pooler transaction path cannot run here yet.

## Database Tooling Still Open

- Rotate the Supabase database password in the Supabase dashboard and update only git-ignored local/deployment secrets.
- Put rotated values in `.env.local` or `.env.database.local`:
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_DB_PASSWORD`
  - `SUPABASE_DB_POOLER_URL`
- Re-run:
  - `pnpm db:doctor`
  - `pnpm db:status`
  - `pnpm db:verify`
  - `pnpm db:push`
  - `pnpm db:types`
- Current verification results:
  - `pnpm db:doctor`: starts successfully but exits nonzero due unconfirmed DB password rotation, missing `SUPABASE_DB_POOLER_URL`, and linked migration-history timeout.
  - `pnpm db:status`: local migration count 83; remote migration history read times out; remote schema changed no.
  - `pnpm db:verify`: linked SQL probe PASS and critical table checks PASS; pooler fallback WARNING because env is missing.
  - `pnpm db:push -- --dry-run`: remote schema changed no; remote migration connection timed out.
  - `pnpm db:types`: not run until migration push/history is stable.
- Inspect and reconcile migration-history drift before applying pending migrations. Known recent version requiring inspection: `20260703022600`.
- Do not apply emergency direct SQL without `psql` or another explicitly approved, documented SQL path.

---

## Previous Task - 2026-07-03

ATTENDANCE-FULL-INTEGRATION-002 is partially complete. The feed/deep-link slice is implemented and verified; broader trusted-device first-scan and staff-history work remains.

## Latest Attendance Feed Checkpoint

- CRM Work Queue (`/crm/today`) now renders `AttendanceScanFeedCard` above Fast Actions.
- Owner Overview (`/owner`) renders the same card; `/owner/attendance` reuses the existing `AttendanceWorkspace` for the selected branch so there is no duplicate Attendance module.
- Feed data comes from `src/lib/attendance/recent-scans.ts`, using successful `qr_scan_events` clock-in/out rows plus the explicit `qr_scan_events_checkin_id_fkey` join to `staff_shift_checkins`.
- `/api/attendance/recent-scans` provides authenticated no-store JSON for SWR refresh.
- `useAttendanceScanFeed` subscribes to Supabase Realtime inserts on `qr_scan_events` and refreshes the feed when successful attendance clock-in/out scans arrive.
- Records deep links now work with `/crm/attendance?tab=records&staffId=<id>&date=<yyyy-mm-dd>`; invalid staff/date/branch params are rejected server-side against branch-scoped Attendance data.
- Owner attendance tab changes stay under `/owner/attendance` and preserve the selected branch id.
- `AttendanceRecordsTab` now has date, branch, staff, status, and search filters; linked rows are highlighted and include a staff profile link.
- Focused tests live at `tests/lib/attendance/scan-feed.test.ts` and `tests/lib/attendance/tabs.test.ts`.

## Latest Verification

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/scan-feed.test.ts tests/lib/attendance/tabs.test.ts`: PASS, 2 files / 9 tests
- `npm run lint`: PASS
- `npm run build`: PASS, 105 app routes
- `git diff --check`: PASS, line-ending notices only

## Still Open

- Authenticated browser QA for Work Queue feed, Owner feed, API refresh, realtime refresh, and Records deep links.
- First-scan trusted-device sign-in/linking flow.
- Staff Portal My Attendance and staff profile attendance history.
- `pnpm db:push`, `pnpm db:types`, Supabase migration-history reconciliation, and database password rotation before deployment closure.

---

## Previous Current Task - 2026-07-02

ATTENDANCE-REFIT-005 - Complete locally. The CRM Attendance workspace has been refit into the requested compact, instant-tab operational UI while preserving the existing Attendance QR database, public scan routes, device activation, service-session engine, and Supabase security model. Authenticated CRM/browser QA remains pending.

## Latest Attendance Refit Checkpoint

- `/crm/attendance` remains the single protected Attendance route.
- `AttendanceWorkspace` is a client-owned shell with local state for tab, selected QR point, QR format, activation link, notices, and locally updated workspace data.
- Tab switching uses `window.history.replaceState()` through `src/lib/attendance/tabs.ts`; routine tab changes no longer use router navigation, refreshes, route links, or redirects.
- All tab panels stay mounted so filters, selected QR/format, dialogs, and activation links survive tab switches.
- KPI-card rows were removed from Attendance.
- Overview now centers live staff status, recent scan activity, active service sessions, exceptions requiring attention, and compact quick actions.
- Records, Sessions, Devices, Exceptions, and Reports are compact operational workspaces with filters, tables, dialogs, and preserved backend action paths.
- QR Codes now matches the approved direction: compact selectable QR list on the left, one branded preview on the right, format selector, download PNG/SVG, print, copy scan link, QR information, generate missing, generate attendance QR, and deactivate QR.
- Attendance server actions now return typed `AttendanceActionResult` payloads instead of redirecting to status query params; this removes the `NEXT_REDIRECT` symptom from routine mutations.
- CRM Attendance sidebar icon is now `ClipboardCheck`, which exists in the sidebar icon map.
- Added pure helper coverage for tab parsing, QR public URL/base URL guards, QR print SVG layouts, and export filenames.

## Previous Attendance QR / Database State

- Migration was applied to the linked Supabase project with `supabase db query --linked --file supabase\migrations\20260702075213_attendance_qr_system.sql`, then rerun after grant tightening.
- Live verification confirmed all seven new tables, new check-in/booking columns, the RPC, authenticated SELECT-only grants on readable attendance tables, no authenticated grant on `device_activation_tokens`, and SELECT-only authenticated RLS policies.
- `pg_cron` is not installed on the linked project, so the optional cron block did not schedule an automatic job.
- Because the migration was applied via `db query --file`, Supabase migration-history tracking may not be reconciled. Do not claim `db push` history success without checking.

## Validation

- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/lib/attendance/tabs.test.ts tests/lib/attendance/qr-url.test.ts tests/lib/attendance/qr-print-layout.test.ts tests/lib/attendance/qr-filenames.test.ts`: PASS, 4 files / 14 tests.
- `pnpm lint`: PASS with 0 warnings after final cleanup.
- `pnpm build`: PASS, 104 app routes.
- `pnpm test`: PASS outside sandbox; 60 files / 564 tests.
- `git diff --check`: PASS, line-ending notices only.
- Browser smoke via `agent-browser`: existing local server redirects unauthenticated `/crm/attendance` to `/login`; login page renders content and no Next/Vite overlay is present.

## Known Caveats

- Authenticated CRM/browser QA is still needed for `/crm/attendance` tabs and actions, device activation, attendance clock-in/out scans, room/resource session starts, countdown reopen, and blocked/revoked/wrong-branch duplicate-scan flows.
- `npm run db:types` is stale for the installed Supabase CLI because it uses removed `--project-ref`.
- Fresh linked type generation exposed unrelated live schema drift, so `src/types/supabase.ts` was restored from baseline and manually augmented for attendance.
- Two zero-byte `_tmp_14412_*` files remain in the repo root because scoped `Remove-Item -LiteralPath` returned Access denied.
- Follow-up FK fix: `qr_points_branch_id_fkey` was caused by dev bypass using the zero UUID branch. `src/lib/dev-bypass-server.ts` now resolves a real active branch; Attendance actions prefer real staff branch context first and validate branch existence before QR/settings inserts.

## Attendance Files To Inspect First

- `supabase/migrations/20260702075213_attendance_qr_system.sql`
- `src/app/(dashboard)/crm/attendance/page.tsx`
- `src/app/(dashboard)/crm/attendance/actions.ts`
- `src/app/scan/[publicCode]/page.tsx`
- `src/app/scan/activate/[token]/page.tsx`
- `src/app/scan/actions.ts`
- `src/components/features/attendance/attendance-workspace.tsx`
- `src/components/features/attendance/attendance-header.tsx`
- `src/components/features/attendance/attendance-tabs.tsx`
- `src/components/features/attendance/overview/*`
- `src/components/features/attendance/records/attendance-records-tab.tsx`
- `src/components/features/attendance/sessions/service-sessions-tab.tsx`
- `src/components/features/attendance/devices/registered-devices-tab.tsx`
- `src/components/features/attendance/exceptions/attendance-exceptions-tab.tsx`
- `src/components/features/attendance/reports/attendance-reports-tab.tsx`
- `src/components/features/attendance/qr-codes/*`
- `src/components/features/attendance/public-scan-processor.tsx`
- `src/lib/attendance/*`
- `src/types/supabase.ts`

## Next Attendance Steps

1. Run authenticated browser QA for the CRM Attendance workspace tabs, filters, actions, and QR preview/export controls.
2. Create a device activation link, activate a test device, then scan attendance and room/resource QR codes from that device.
3. Verify blocked flows: unknown device, revoked device, wrong branch, duplicate scan, and active-service clock-out block.
4. Decide whether to install/enable `pg_cron` or schedule `complete_due_service_sessions` externally.
5. Fix the stale `db:types` script separately from this feature.
6. Reconcile Supabase migration history if the team wants `db push` to know this migration was applied.
7. Continue broader CRM blocker cleanup only after this attendance flow has been click-tested end to end.

---

# Previous Handoff - CRM Schedule

## Current Task

CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01 - active CRM Schedule workspace is locally complete; authenticated CRM Schedule QA remains pending.

## Latest User Intent

The user explicitly asked to keep progress logged so another AI agent can resume if Codex credit runs out.

The focused stabilization prompt is the operational guardrail: production-safe small checkpoints, no broad rebuilds, preserve working behavior, and do not claim CRM workflows work until UI actions are traced through server actions/API, auth, Supabase/RLS, constraints, invalidation, and feedback.

## What Was Done Most Recently

- Added explicit staff selection shared between Daily Timeline and Full Schedule; Schedule no longer silently falls back to the first visible staff row.
- Updated the Selected Staff card no-selection state and added Edit Profile, Edit Capabilities, and View Full Schedule actions.
- Reused existing modal/sheet surfaces instead of rebuilding them:
  - shared administrative booking modal
  - check availability modal
  - staff profile modal
  - staff service-capabilities sheet
  - staff full schedule calendar modal
  - availability/block-time editor
- Added in-place Edit Capabilities from both Schedule views through `StaffServiceEditorSheet` and `updateStaffServicesFromCrmAction`.
- Added timeline lane assignment in `src/lib/utils/schedule-timeline.ts`; overlapping booking blocks now render in separate vertical lanes in Daily Timeline and Full Schedule.
- Added a Schedule header view toggle for `Daily Timeline` and `Full Schedule + Live Bookings`, driven by the `view` query param.
- Added the Full Schedule + Live Bookings master-detail view with staff list, Day/Week mode, layer toggles, shifts, live bookings, blocks, overrides, no-shift states, and booking conflict flags.
- Full Schedule booking clicks open the in-Schedule booking detail panel using the real booking id.
- Audited Schedule/staff-service permissions and existing migrations; no new migration was added. Relevant existing migrations:
  - `supabase/migrations/20260529000002_crm_csr_schedule_rls.sql`
  - `supabase/migrations/20260529000003_crm_csr_staff_update_rls.sql`
  - `supabase/migrations/20260617141348_crm_staff_service_capabilities_rpc.sql`

## Previous Checkpoint

- Added shared quick-booking option loaders and a customer prefill server action.
- Mounted the shared administrative booking modal provider in the CRM layout.
- Extended `QuickBookingForm` for modal use while preserving `/crm/bookings/new` as a direct route.
- Converted major internal CRM New Booking triggers to modal buttons across Bookings, Today/Work Queue, Customers, Waitlist, Setup flow cards, direct customer profile, and Schedule header.
- Wired active CRM Schedule Daily Timeline actions:
  - Add Booking -> shared booking modal.
  - Check Availability -> in-context availability modal with slot-to-booking handoff.
  - Edit Staff Profile -> existing CRM staff profile modal with branch-authorized data load.
  - View Full Schedule -> existing staff schedule calendar modal.
  - Adjust Staff / Block Staff Time -> existing availability editor, including direct block-time tab/date prefill.
- Kept the existing booking server action; no duplicate booking action was introduced.

## Validation

- `npm run type-check`: PASS
- `npm run lint`: PASS with 4 unrelated existing warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings
- `npm run build`: PASS, 103 app routes
- `git diff --check`: PASS, line-ending notices only
- Browser smoke via `agent-browser` on existing `http://localhost:3000`: unauthenticated `/crm/schedule` redirects to `/login`, which loads with content and no Next.js error overlay.
- Browser console/errors on the unauthenticated smoke route: no page errors; only normal dev/HMR/Speed Insights messages.
- Authenticated CRM Schedule modal/browser QA: NOT RUN in this checkpoint because no authenticated CRM browser state was available.
- `npm run test`: not run for this checkpoint.

## Current Worktree

There are uncommitted changes. Do not revert user/previous-agent work.

Run:

```bash
git status --short --branch
```

Known changed areas:

- Schedule workspace completion:
  - `src/components/features/schedule/workspace/schedule-workspace-shell.tsx`
  - `src/components/features/schedule/workspace/schedule-workspace-header.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-tab.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-selection-card.tsx`
  - `src/components/features/schedule/tabs/daily-timeline-staff-row.tsx`
  - `src/components/features/schedule/tabs/full-schedule-live-bookings-view.tsx`
  - `src/lib/utils/schedule-timeline.ts`
  - `src/lib/actions/crm-staff-services.ts`
- `src/lib/queries/crm-context.ts`
- `src/components/features/dashboard/nav-config.ts`
- `src/components/features/dashboard/sidebar.tsx`
- `src/components/features/workspace/workspace-prefetch-config.ts`
- `src/app/(dashboard)/crm/today/page.tsx`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/control/page.tsx`
- `src/app/(dashboard)/crm/live-operations/page.tsx`
- CRM setup/staff/staff-availability route gating files
- Dashboard header/sidebar/nav/readiness/workspace-access files
- `.context/*`, `docs/*` handoff files
- `docs/FRONT_DESK_REFACTOR_PROGRESS.md`

## Important Direction Reconciliation

Checkpoint 1 reconciled the visible sidebar labels toward:

- `Work Queue`
- `Bookings`
- `Schedule`
- `Customers`
- `Home Service`
- collapsed `System Management`

However, System Management follows the current management-authorized route gates. The latest prompt's broader statement that ordinary CRM users may occasionally edit system tools still needs an explicit permission/page-gate review before exposing setup pages to all CRM/CSR roles.

## Next Logical Steps

1. Read `docs/FRONT_DESK_REFACTOR_PROGRESS.md` first.
2. Inspect current diffs before editing.
3. Do not restart the booking-modal, Schedule modal wiring, or Full Schedule view checkpoint; it has passing type-check, lint, build, and unauthenticated smoke verification.
4. Run an authenticated CRM browser pass if credentials/session are available:
   - `/crm/schedule` Daily Timeline selection and no-selection disabled actions.
   - Add Booking, Check Availability, Edit Staff Profile, Edit Capabilities, View Full Schedule, Adjust Staff, and Block Staff Time.
   - `Full Schedule + Live Bookings` Day/Week mode, layer toggles, staff selection, live booking detail panel, and conflict/lane rendering.
   - Confirm internal CRM triggers do not navigate to `/crm/bookings/new`.
5. Keep `/crm/bookings/new` alive as compatibility for direct links and agent fallback.
6. Continue remaining Work Queue / Today / Control Center simplification without deleting working routes.
7. Trace each additional CRM action end-to-end before claiming readiness.

---

## 2026-07-02 - ATTENDANCE-REFIT-005 Final Verification Continuation

### Completed

- Resolved all four lint warnings:
  - Removed unused `FALLBACK_IMAGE_URL` from `scripts/generate-service-image-assets.mjs`.
  - Replaced unused `generationPrompt` rest destructuring with explicit `appManifestEntry()` projection.
  - Preserved payroll mock `staffId` signatures and marked them intentionally unused with `void staffId`.
- Reran final checks with the project package manager:
  - `pnpm type-check`: PASS.
  - `pnpm lint`: PASS, 0 warnings.
  - `pnpm test`: PASS, 60 files / 564 tests.
  - `pnpm build`: PASS, 104 app routes.
- Started local dev server and attempted `/crm/attendance?tab=qr` browser QA.
- Confirmed the route redirects to `/login` at all requested widths: 1440, 1280, 1024, 768, and 375 px.
- Captured blocker screenshots:
  - `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-1440.png`
  - `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-1024.png`
  - `E:\cradlehub\.codex-artifacts\attendance-qr-qa\blocked-login-375.png`

### Still Blocked

- Authenticated QR visual QA cannot be completed without a valid Supabase CRM/front-desk browser session. `DEV_AUTH_BYPASS=true` does not bypass `src/proxy.ts`'s requirement for an authenticated user.
- Manual interaction checks are still pending: select row(s), format changes, search/filter, copy link, PNG/SVG/download/print/export, print selected, and deactivate confirmation.
- Phone-camera scans are still pending for one attendance PNG, one room SVG, and one print/PDF preview.
- QR identity preservation still needs authenticated browser confirmation before/after preview/export for QR point ID, public code, scan URL, and version.
- Local Supabase CLI may need a retry after a Windows file lock clears: `pnpm exec supabase --version` currently reports `The process cannot access the file because it is being used by another process.`

### Next Pickup

1. Log in with a CRM/front-desk account or provide explicit local test credentials.
2. Reopen `http://localhost:3000/crm/attendance?tab=qr`.
3. Rerun visual QA at 1440, 1280, 1024, 768, and 375 px.
4. Complete the requested interaction, export, phone-scan, and QR identity checks before marking Attendance QR fully complete.

## Handoff - ATTENDANCE-SCHEDULE-REPAIR-002

Done:
- CRM Schedule Daily Timeline now logs actionable branch/date/error diagnostics and returns a safe unavailable message.
- Daily schedule query now selects `schedule_overrides.shift_type`, propagates it into timed override labels, and fails loudly on staff metadata, blocked-times, and override query errors.
- Schedule workspace uses live SWR schedule data and explicit refresh tokens instead of router refresh for setup changes.
- Attendance QR insert mapping type regression is fixed.
- Focused schedule regression tests were added for missing override shift type and staff metadata failures.
- Live DB read verification through the Supabase pooler confirmed the schema column/check constraint and a successful `get_daily_schedule` response for the active SM branch/date.
- Local verification passed: `npx tsc --noEmit`, `npm run lint`, focused schedule tests, full `npx vitest run`, `npm run build`, and `git diff --check`.

Still blocked:
- `pnpm db:push` and `pnpm db:types` cannot complete until the local Supabase CLI/pnpm issue is repaired.
- Supabase migration history does not show `20260703022600` applied even though the live column exists.
- The pasted Supabase database password should be rotated before deploy.

Suggested next steps:
1. Repair pnpm/Supabase CLI build-script approval or reinstall the Supabase CLI binary cleanly.
2. Rerun `pnpm db:push` and `pnpm db:types`.
3. Rotate the Supabase database password and update environment variables.
4. Deploy after migration history/type generation is clean.
