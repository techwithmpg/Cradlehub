# Current Task - CRM-STABILIZATION-CHECKPOINT-2-WORK-QUEUE-2026-06-30

Status: IN_PROGRESS
Started: 2026-06-30
Last updated: 2026-06-30

## Description

Implement Checkpoint 2 of the CRM stabilization/simplification pass: convert the current Today / Front Desk page into the visible `Work Queue`, merge useful Control Center actions without keeping `/crm/control` as a competing workspace, and preserve existing CRM actions/routes.

Latest attached direction supersedes the older "Front Desk only" wording for visible navigation:

- Primary daily CRM nav target: `Work Queue`, `Bookings`, `Schedule`, `Customers`, `Home Service`.
- Secondary collapsed target: `System Management` with Staff & Access, Services & Providers, Rooms & Resources, Booking Rules, Schedule Management, System Health, and Close Day.
- Do not rebuild stable parts. Stabilization and action reliability are more important than visual polish.
- Keep old CRM routes and redirects alive; this checkpoint is a shell/navigation update, not a page or database rewrite.

## Most Recent Implemented Checkpoint

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

- `npm run type-check`: PASS (after Bookings / Quick Booking completion)
- `npm run lint`: PASS with 4 unrelated warnings:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`.
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings.
- `npm run build`: PASS, 103 app routes
- Authenticated CRM browser pass: PASS for walk-in, phone, future, home-service creation; Bookings tabs; drawer open; browser logs empty.
- RLS/runtime errors: none surfaced during authenticated create flows.
- `npm run test`: NOT RUN for this checkpoint.

## Next Agent Pickup

1. Read the two latest attached prompts if available in the session, plus `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.
2. Checkpoint 1 nav shell is implemented, but not committed.
3. Bookings / Quick Booking is complete and browser-verified; do not restart it unless the user reports a regression.
4. Continue with remaining Checkpoint 2 Work Queue / Today / Control Center simplification carefully, reduce competing dashboards, and keep one primary action per row.
5. Before exposing System Management to ordinary CRM/CSR roles, review page gates and action/RLS permissions deliberately. Current sidebar System Management follows the existing management-authorized route model.
6. Do not claim additional workflows work until traced through UI -> Server Action/API -> Supabase/RLS -> refresh feedback.
