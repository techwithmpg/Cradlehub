# Front Desk Refactor Progress

Last updated: 2026-06-30

## Current Checkpoint

This document is the handoff marker for the Front Desk CRM simplification work. If work stops unexpectedly, resume from the next unchecked item in this file.

Checkpoint 1 status: complete locally and verified. The sidebar/nav shell now reflects the latest approved primary CRM destinations while keeping existing routes alive.

Bookings / Quick Booking checkpoint status: complete locally and authenticated-browser verified. The interrupted Quick Booking form/schema/action patch has been finished without replacing the existing booking action.

## Agent Continuation Protocol

If another AI agent picks this up, start here:

1. Read this file completely.
2. Read `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `.context/ERRORS.cmd.md`, and `.context/DECISIONS.cmd.md`.
3. Read `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, and `docs/AGENT_RULES.md`; root-level `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are not present in this checkout.
4. Run `git status --short --branch` and inspect the dirty files before editing.
5. Use the scripts that exist in `package.json`: `npm run type-check`, `npm run lint`, `npm run build`, `npm run test`.
6. Do not claim any CRM action works until it has been traced through UI, server action/API, auth/role check, Supabase query/RPC, RLS/grants, database constraints, refresh/invalidation, and success/failure feedback.

## Latest Direction Update

Two newer attached prompts were read on 2026-06-30:

- `CradleHub CRM Workspace — Final Combined Redesign`
- `focused stabilization and simplification task for the CRM workspace`

The focused stabilization prompt should govern the next implementation pass: production usability and action reliability come before visual polish or broad rebuilds.

Important naming/navigation reconciliation:

- Older checkpoint language in this file uses `Front Desk`, `Dispatch`, and `Admin & Setup`.
- Latest target visible CRM nav is `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Latest target secondary area is a visually quiet, collapsed `System Management` section with Staff & Access, Services & Providers, Rooms & Resources, Booking Rules, Schedule Management, System Health, and Close Day.
- Do not blindly continue the earlier "Phase 2 Customers first" plan without reconciling this newer product direction.

Current implementation checkpoint:

- Visible CRM sidebar primary nav now shows `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Management-authorized CRM workspace users additionally see a collapsed bottom `SYSTEM / System Management` section.
- System Management links preserve current routes/deep links:
  - `Staff & Access` -> `/crm/staff`
  - `Services & Providers` -> `/crm/setup?tab=services`
  - `Rooms & Resources` -> `/crm/setup?tab=spaces`
  - `Booking Rules` -> `/crm/setup?tab=booking_rules`
  - `Schedule Management` -> `/crm/staff-availability`
  - `System Health` -> `/crm/setup?tab=health`
  - `Close Day` -> `/crm/reconciliation`
- CRM automatic prefetching now warms only primary daily routes; secondary/system routes wait for explicit navigation.
- Workspace switcher label now says `Front Desk` instead of `CRM / Front Desk`.
- Header dropdown no longer sends ordinary non-management roles to `/crm/setup`.
- `/crm/setup`, `/crm/staff`, and `/crm/staff-availability` are server-gated to owner/manager/assistant manager/store manager roles.
- Today shell quick action `Add Follow-up` now links to `/crm/customers?tab=followup` instead of `/crm/notifications`.
- Today shell no longer exposes the non-functional `End of Day` tab.
- Today shell dead `View all` labels, fake clickable attention rows, and the 24-hour day progress bar were removed.
- `src/lib/queries/crm-context.ts` now exposes a richer `getFrontDeskContext()` with user id, role, branch id, branch name, role capabilities, and allowed Front Desk destinations.
- `/crm/today`, `/crm/bookings`, `/crm/control`, and `/crm/live-operations` now reuse `getFrontDeskContext()` instead of duplicating user/staff/branch Supabase lookups.

Bookings / Quick Booking completion:

- `/crm/bookings/new` now uses a CRM Quick Booking form for walk-in, phone, future, and home-service bookings.
- Existing-customer search and inline new-customer creation both flow through the existing server action/customer upsert path.
- Home-service booking captures address, city/barangay, landmark, and location notes without requiring a room.
- Staff and room remain in More Options; automatic assignment is used where the backend has availability/resources.
- The `createInhouseBookingMultiAction` contract now matches the form and schema, preserves values on validation failure, returns human messages, records pending vs paid payment state, and revalidates CRM booking surfaces best-effort after commit.
- Quick Booking success redirects to `/crm/bookings?date=...&bookingId=...` so the created booking drawer opens on the correct date.
- Bookings groups are Needs Action, Upcoming, Active, and Completed. Active progress states no longer also appear in Upcoming.

## Guardrails Confirmed

- Read the attached "Front Desk CRM Workspace" prompt.
- Read local Next.js 16 docs required by `AGENTS.md`:
  - `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  - `node_modules/next/dist/docs/01-app/02-guides/data-security.md`
- Read the local Next.js and Supabase skills.
- Checked Supabase changelog via `Invoke-WebRequest https://supabase.com/changelog.md`.
  - Relevant recent notes: Data API exposure changes for new tables, pg_graphql breaking changes, Node.js 20 support deprecation, self-hosted auth URL change. No schema changes are planned in this phase.

## Route Audit Snapshot

Current CRM app routes found under `src/app/(dashboard)/crm`:

- `/crm` -> redirects to `/crm/today`
- `/crm/today`
- `/crm/bookings`
- `/crm/bookings/new`
- `/crm/control`
- `/crm/customers`
- `/crm/[customerId]`
- `/crm/schedule`
- `/crm/availability`
- `/crm/staff-availability`
- `/crm/dispatch`
- `/crm/live-operations`
- `/crm/notifications`
- `/crm/reconciliation`
- `/crm/setup`
- `/crm/services`
- `/crm/spaces-rules` -> already redirects to `/crm/setup?tab=spaces`
- `/crm/staff`
- `/crm/staff-applications`
- `/crm/repeats` -> already redirects to `/crm/customers?tab=repeat`
- `/crm/lapsed` -> already redirects to `/crm/customers?tab=lapsed`
- `/crm/waitlist` -> already redirects to `/crm/customers?tab=followup`

Current CRM API routes:

- `/api/crm/availability`
- `/api/crm/bookings`
- `/api/crm/schedule`
- `/api/crm/staff-schedule/overview`

## Navigation Audit Snapshot

Primary visible sidebar config is in `src/components/features/dashboard/nav-config.ts`.

Before this checkpoint, CRM sidebar items were:

- Today -> `/crm/today`
- Bookings -> `/crm/bookings`
- Schedule -> `/crm/schedule`
- Customers -> `/crm/customers`
- Setup Center -> `/crm/setup`
- Staff -> `/crm/staff`
- Dispatch -> `/crm/dispatch`

Related secondary tab navigation is in `src/components/features/crm/crm-tab-nav.tsx` and still contains overlapping labels/routes for Today, Control Center, Bookings, Live Availability, Schedule Setup, Waitlist / Follow-up, Setup, Services, and Live Map.

Notifications remain reachable through the header notification bell, with a standalone `/crm/notifications` route still present.

## Existing Context And Permission Findings

- `src/lib/queries/crm-context.ts` already exists but only returns `{ role, branchId }`.
- Several CRM pages still duplicate Supabase user/staff lookup to get `branchName` and `role`, especially:
  - `src/app/(dashboard)/crm/today/page.tsx`
  - `src/app/(dashboard)/crm/bookings/page.tsx`
  - `src/app/(dashboard)/crm/control/page.tsx`
  - `src/app/(dashboard)/crm/live-operations/page.tsx`
- Dashboard path access is guarded by `src/lib/auth/workspace-access.ts` and `src/lib/permissions.ts`.
- CRM action permissions are partially centralized in `src/lib/auth/crm-permissions.ts`.
- Ordinary CSR routes are currently broadly allowed under `/crm`; page/action-level permission checks remain important.

## Booking Status / Timestamp Audit Snapshot

Found existing booking status values in code:

- `pending`
- `pending_payment`
- `pending_crm_confirmation`
- `confirmed`
- `in_progress`
- `completed`
- `cancelled`
- `no_show`
- `expired`

Found progress/timestamp fields in booking queries and UI:

- `booking_progress_status`
- `checked_in_at`
- `travel_started_at`
- `arrived_at`
- `session_started_at`
- `session_completed_at`
- `completed_at`
- `no_show_at`

Found progress states in UI logic:

- `not_started`
- `checked_in`
- `travel_started`
- `arrived`
- `session_started`
- `completed`
- `no_show`

Found delivery type checks:

- `type === "home_service"`
- `delivery_type === "home_service"`
- metadata fallback checks for `delivery_type`

Found payment state checks:

- `paid`
- `unpaid`
- `pending`
- `pay_on_site`

## Oversized Components Noted

High-priority split candidates:

- `src/components/features/bookings/bookings-table.tsx` (~60 KB)
- `src/components/features/bookings/bookings-workspace.tsx` (~21 KB)
- `src/components/features/crm/today/crm-today-shell.tsx` (~19 KB)
- `src/components/features/crm/today/crm-booking-queue-panel.tsx` (~14 KB)
- `src/components/features/control-console/control-booking-card.tsx` (~22 KB)
- `src/components/features/dispatch/dispatch-flow-tab.tsx` (~19 KB)
- `src/components/features/dispatch/dispatch-travel-progress-tab.tsx` (~14 KB)
- `src/components/features/dispatch/dispatch-live-map-tab.tsx` (~14 KB)
- Staff/schedule setup components are also large and should move under Admin & Setup later.

## Key Link/Deep-Link Findings

Known legacy or overlapping internal links still exist to:

- `/crm/bookings`
- `/crm/control`
- `/crm/availability`
- `/crm/staff-availability`
- `/crm/live-operations`
- `/crm/services`
- `/crm/spaces-rules`
- `/crm/staff`
- `/crm/staff-applications`
- `/crm/reconciliation`
- `/crm/notifications`

Specific issue fixed in this checkpoint:

- `src/components/features/crm/today/crm-today-shell.tsx` had `Add Follow-up` linking to `/crm/notifications`; it now links to `/crm/customers?tab=followup`.

## Validation Commands Available

Package scripts:

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run test`

Use these exact scripts; do not invent `typecheck`.

## Validation Results

Last run after Bookings / Quick Booking completion:

- `npm run type-check` — passed.
- `npm run lint` — passed with 4 warnings unrelated to this refactor:
  - `scripts/generate-service-image-assets.mjs`: unused `FALLBACK_IMAGE_URL`, unused `generationPrompt`.
  - `tests/components/payroll/employee-payroll-table.test.tsx`: two unused `_staffId` warnings.
- `npm run build` — passed, 103 app routes.
- Authenticated CRM browser QA — passed for walk-in, phone, future, and home-service creation; Bookings tabs; drawer open; no browser console/runtime logs.
- RLS errors — none surfaced during the authenticated create flows.
- `npm run test` — not run in this checkpoint.

Docs-only handoff update after that checkpoint:

- Read the two latest CRM prompts and repo/context handoff files.
- Updated `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/CURRENT_TASK.cmd.md`, `docs/HANDOFF.cmd.md`, this file, changelogs, and pre-flight error notes.
- No code changed during the handoff-only update; validation was not rerun.

## Phase 1 Checklist

- [x] Read prompt and local framework/skill instructions.
- [x] Initial route audit.
- [x] Initial navigation/deep-link audit.
- [x] Initial duplicated context audit.
- [x] Initial booking status/timestamp/payment/delivery audit.
- [x] Create or extend shared `getFrontDeskContext()` using existing `getCrmContext()` as the base.
- [x] Replace duplicate local CRM context functions in daily-use pages.
- [x] Rename visible CRM/CSR workspace labels to Front Desk where safe.
- [x] Reduce visible sidebar to Front Desk, Schedule, Customers, Dispatch, and management-only Admin & Setup.
- [x] Server-gate management setup routes for ordinary front-desk staff.
- [x] Fix `Add Follow-up` so it no longer opens Notifications.
- [x] Remove non-functional End of Day from daily Front Desk tab navigation.
- [x] Fix or remove dead `View all` labels found in the Today shell.
- [x] Fix fake clickable rows found in the Today shell.
- [x] Fix or remove 24-hour day progress indicator found in the Today shell.
- [x] Run `npm run type-check`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Reconcile visible CRM sidebar to Work Queue, Bookings, Schedule, Customers, Home Service.
- [x] Add collapsed System Management section for existing management tools.
- [x] Remove setup/management links from automatic CRM route prefetching.
- [x] Finish CRM Bookings four-group mapping: Needs Action, Upcoming, Active, Completed.
- [x] Finish CRM Quick Booking for walk-in, phone, future, and home-service modes.
- [x] Verify at least one booking through authenticated CRM UI; completed all four requested booking modes.

## Next Recommended Step

Bookings / Quick Booking is locally complete. The next implementation pass should continue the remaining Work Queue part of Checkpoint 2:

1. Simplify Work Queue / Today / Control Center without deleting old routes.
2. Keep `/crm/control` alive as compatibility until useful controls are folded into Work Queue.
3. Review CRM header requirements separately: current page title, branch, search, notifications, persistent New Booking, and user menu.
4. Avoid adding a global New Booking button until duplicate page-level New Booking buttons are addressed.
5. Review system-tool access before exposing System Management to ordinary CRM/CSR roles; current page gates remain management-authorized.
6. Trace one high-priority CRM action end-to-end before moving to larger UI claims.
