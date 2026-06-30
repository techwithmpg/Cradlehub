# Current Task - CRM-SCHEDULE-WORKSPACE-COMPLETION-2026-07-01

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
