# Current Task - ATTENDANCE-SCHEDULE-LIVE-DATA-001

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
