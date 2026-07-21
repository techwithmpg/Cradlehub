# 📋 PROJECT CONTEXT — Single Source of Truth

> **⚠️ MANDATORY: Every AI agent MUST read this entire file before doing ANY work.**
> **⚠️ MANDATORY: Every AI agent MUST update this file after completing ANY task.**

---

## Latest Agent Update (2026-07-22 — NOTIFICATIONS-001)

- `workspace_notifications` remains the only durable notification history.
  RLS-scoped Supabase Realtime INSERT/UPDATE events now reconcile the shared bell
  immediately; a five-minute/visibility/reconnect fetch covers missed events
  without minute polling or `router.refresh()`.
- One visible tab claims each fresh event for its Sonner toast and optional
  booking chime. Cross-tab/session storage contains IDs only, and the chime
  preference remains local to the browser.
- Opt-in Web Push adds own-row subscription delivery state, authenticated
  same-origin APIs, a safe service worker, server-only VAPID handling, exact
  branch/role/staff/driver targeting, endpoint deactivation, and best-effort
  dispatch only after the durable notification insert wins.
- Pending online bookings alert CRM only. Assigned Staff and Driver are notified
  after payment confirmation; paid assignment, reassignment, reschedule, and
  cancellation events address only the affected recipients. Owner has an
  account-level booking delivery preference. Manager product UI is unchanged.
- Type-check, production build, 161 files / 1,180 tests, and lint with one
  pre-existing Attendance warning pass. The generated additive migration was
  not applied. Production VAPID configuration plus browser/device QA remain the
  deployment gate. See `docs/operations/BROWSER_PUSH_NOTIFICATIONS.md`.

## Latest Agent Update (2026-07-22 — CRM-RETENTION-001)

- Selected a manual retained-module registry using stable React 19.2.4 Activity;
  Next 16.2.4 Cache Components remains disabled because its global dynamic/auth
  rendering migration was not proven safe for current Supabase routes.
- CRM Work Queue, Bookings, Schedule, Attendance, and Customers use a four-entry
  user/role/branch-scoped LRU. Owner Overview, Reports, and Bookings use a
  three-entry rollout when the public flag is `all`; default is CRM-first and
  `off` is rollback.
- Hidden frames are inaccessible and Activity cleans timers, polling, observers,
  and Realtime Effects. Dirty/stale SWR modules reconcile once on activation;
  fresh modules do not refetch. Existing booking events are reused.
- Scroll, local component state, URL-backed filters/tabs/ranges, safe drafts, and
  identity-prefixed in-memory SWR data are retained. Dirty/unsaved entries avoid
  eviction, and logout/scope changes purge retained operational state.
- Dispatch and Owner Schedule remain outside full DOM retention. Manager,
  business rules, permissions/RLS, release-readiness fixes, and visual design are
  unchanged.
- Authenticated CRM QA passed retained and evicted instant returns, canonical
  query restoration, Back/Forward, inert hidden frames, and a four-frame LRU.
  Type-check, build, 152 files / 1,152 tests, and lint with one existing warning
  pass. Owner and exact browser performance-panel certification remain pending.
  See `docs/performance/CRM-RETENTION-001-REPORT.md`.

## Latest Agent Update (2026-07-21 — CRM-PERF-002)

- CRM and Owner now use a persistent workspace interaction architecture: 22 route loaders were removed, root authenticated loading is non-visual, shell navigation has local pending feedback, and route prefetching is session-de-duplicated.
- Active CRM/Owner routine `router.refresh()` usage is zero. Repository calls fell from 74 to 26; the remainder is auth/out-of-scope plus seven unreachable legacy Availability calls.
- Owner Reports, Owner Bookings, Attendance, Dispatch, and Schedule retain initial/cached data with scoped SWR revalidation. Services, Staff, Marketing, Attendance Rules, Payroll, booking, and dispatch mutations patch optimistic/canonical local state.
- Explicit subviews are URL/history backed. CRM Schedule Back/Forward and mounted Setup selection retention were verified in an authenticated browser with the shell visible and no console errors.
- Type check, production build (110 routes), diff check, focused interaction tests, and 145 files / 1,117 complete-suite tests pass; lint has no errors and two unrelated existing warnings. Authenticated Owner browser certification remains pending. See `docs/performance/crm-perf-002-report.md`.

---

## Latest Agent Update (2026-07-15 — Branch resolution transaction fix)

- Captured live SQLSTATE `42702` in the existing branch resolver: unqualified
  `scan_event_id` in two `attendance_exceptions` updates conflicted with the
  function's table-return output parameter. This was a live/local function-body
  defect, not a missing RPC, payload mismatch, permission failure, or schema gap.
- Applied and recorded guarded migration `20260715113001`. The resolver remains
  one exact 11-argument `SECURITY INVOKER` function with explicit search path,
  service-only execution, unchanged result columns, locks, replay behavior, and
  one-statement rollback.
- Live rollback-only QA passed temporary shift/day, permanent transfer, forced
  Attendance failure, missing-device controlled failure, and second-manager
  replay. No duplicate Attendance or authorization was created and all synthetic
  residue counts were zero.
- The supplied real pending request was inspected only. Its first-login source
  event has no device ID and cannot be resumed safely; future authenticated first
  scans now register the verified phone before wrong-branch capture, while this
  existing request needs one new scan after deployment.
- Supabase types, 138 files / 1,103 tests, type-check, build, live verification,
  and diff checks pass. Lint has no errors and one existing unrelated warning.
  Authenticated deployed browser/device QA remains conditional release evidence;
  the broader 81-local / 5-remote migration drift is unchanged.

---

## Latest Agent Update (2026-07-15 — Attendance branch correction resolution)

- Branch Corrections now requires one explicit decision: temporary target-branch
  access for the original shift or business day, permanent current-profile
  transfer, or scan rejection. Generic approval is disabled.
- Approved decisions resume the captured source scan through the canonical
  Attendance intent/commit engine in one locked transaction. Same-decision replay
  returns the committed result; conflicting decisions and duplicate Attendance
  writes are blocked.
- Temporary authority is bounded, branch-specific, revocable, and linked to the
  source request/scan. Permanent transfer preserves historical home/actual branch
  snapshots and does not rewrite bookings, schedules, services, payroll, devices,
  or prior Attendance; targeted follow-up work records impacts that need review.
- Focused migration `20260715113000` is live and recorded. Generated types match;
  RLS, SELECT-only browser grants/policies, service-only resolver ACLs, indexes,
  and rollback-only synthetic shift/day/permanent/reject QA were verified.
- Type-check, build, lint (one pre-existing warning), 23 focused tests, and the
  complete 136-file / 1,086-test suite pass. No real staff Attendance was used
  for QA. Arbitrary date ranges are deliberately deferred.

---

## Latest Agent Update (2026-07-15 — CRM Open-Close normalization)

- Adjust Schedule now offers an explicit CRM/CSR/front-desk-only repair when a
  day has exactly one overlapping Opening and one Closing window. The draft
  moves only the Opening end to the Closing start and still uses the existing
  strict validation and atomic weekly replacement save.
- Unique coverage arithmetic merges overlap and exact adjacency without double
  counting, preserves real gaps, and supports overnight duration fit. The live
  four-day fixture correctly shows 62h before and after repair.
- Resolver and Attendance behavior treat the eligible adjacent pair as continuous
  coverage while retaining Opening responsibility before handoff, Closing
  responsibility afterward/after midnight, and the originating business date.
- No migration, booking write, Attendance row write, enum, dependency, or Vercel
  config change was required. Authenticated localhost QA saved and reopened the
  live regression fixture at 10:00-17:00 plus 17:00-01:30 next day with zero
  timeline conflicts.
- Verification passed: 93 focused tests; 135 files / 1,075 full tests;
  type-check; lint with one pre-existing unrelated warning; diff check; and the
  Next.js 16.2.4 production build with 110 routes.

---

## Latest Agent Update (2026-07-15 — Smart dynamic clock-out)

- Expected clock-out is now schedule-backed and dynamically resolved from final
  work completion by one restricted database resolver. Therapist/salon rows use
  own final service, CRM Closing uses the branch final in-spa service, drivers
  use their final assigned trip, and schedule end remains the no-work fallback.
- Dynamic evidence is persisted in the existing expected/window/deadline and
  policy snapshot fields. QR recalculates before classification; early and
  overtime clock-outs remain record-first/flag-second.
- Staff Portal clock-out is server/device-authorized only for final completed
  home service, final trip, or an eligible therapist/CRM Closing shift. Active
  and upcoming assignments block portal completion; ordinary staff use branch QR.
- Relevant booking, schedule, override, and policy events recalculate affected
  open rows only and share the QR/portal staff lock. The existing four Supabase
  safety jobs still process stored CRM dynamic deadlines; Vercel has no frequent
  Attendance cron.
- Isolated migration `20260715021703_attendance_smart_dynamic_clock_out.sql` is
  live on the linked project and generated types match live schema. A Training
  Mode schedule-fallback probe passed and an unchanged second resolution made no
  write. The migration is intentionally not recorded in remote migration history
  because the broader 81 local-only / 5 remote-only drift remains unresolved.
- Release commit `5b0ce6cb` is on `origin/main`; its Vercel production deployment
  reached READY with no build error. The public `www` domain returned 200 and
  unauthenticated Staff Portal safely rendered sign-in. Authenticated role/device
  E2E remains follow-up evidence, not a claimed result of this task.

---

## Latest Agent Update (2026-07-15 — Attendance hybrid closing automation)

- Vercel no longer schedules Attendance every five minutes; only the unrelated
  daily agent follow-up cron remains.
- CRM/CSR closing deadlines remain snapshotted on the Attendance record at
  clock-in, and normal clock-out naturally removes eligibility and resolves
  already-issued signals.
- Supabase pg_cron 1.6.4 now runs reminder, manager escalation, auto-close, and
  catch-up at 15:00, 15:30, 16:00, and 16:10 UTC for the two verified
  `Asia/Manila` active branches.
- The single restricted database processor uses bounded `FOR UPDATE SKIP LOCKED`
  queries and three partial indexes over only open live CRM closing records.
- Live empty-run verification succeeded with zero intervention, notification,
  or task writes. The isolated migration is live but remains absent from remote
  migration history alongside the broader known 79 local-only / 5 remote-only
  drift; do not run a blind full migration push.

---

## 🏗️ Project Identity

| Field              | Value                                      |
|--------------------|---------------------------------------------|
| **Project Name**   | `[PROJECT_NAME]`                           |
| **Codename**       | `[CODENAME]`                               |
| **Version**        | `0.1.0`                                    |
| **Stack**          | Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase |
| **Package Manager**| pnpm                                       |
| **Node Version**   | ≥ 18.17                                    |
| **Author**         | Malcom P. Gwanmesia (MPG Technologies)     |
| **Repo**           | `[REPO_URL]`                               |
| **License**        | Proprietary                                |

---

## 🧭 Project Vision

> **One-liner:** _[Describe what this project does in one sentence]_

> **Problem:** _[What problem does it solve?]_

> **Target Users:** _[Who uses this?]_

> **Success Metric:** _[How do we know it works?]_

---

## 📁 Directory Structure

```
root/
├── .context/                    # 🧠 AI Agent Memory (NEVER delete)
│   ├── CHANGELOG.cmd.md         # What has been done (append-only log)
│   ├── CURRENT_TASK.cmd.md      # What is being worked on RIGHT NOW
│   ├── DECISIONS.cmd.md         # Architecture decisions & rationale
│   ├── ERRORS.cmd.md            # Known bugs, errors, dead-ends
│   └── HANDOFF.cmd.md           # Context for the next agent session
├── docs/                        # Human-readable documentation
│   ├── ARCHITECTURE.md          # System design & data flow
│   ├── API_REFERENCE.md         # API endpoints & contracts
│   └── DB_SCHEMA.md             # Database schema documentation
├── src/
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # shadcn/ui primitives
│   │   └── features/            # Domain-specific components
│   ├── lib/                     # Utilities, helpers, configs
│   │   ├── supabase/            # Supabase client & helpers
│   │   ├── utils/               # Pure utility functions
│   │   └── validations/         # Zod schemas
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── constants/               # App-wide constants
├── supabase/
│   └── migrations/              # SQL migrations (sequential)
├── public/                      # Static assets
├── tests/                       # Test files
├── PROJECT_CONTEXT.md           # ← YOU ARE HERE
├── AGENT_RULES.md               # Rules every AI agent must follow
├── ROADMAP.md                   # Development roadmap with progress
├── .env.local                   # Environment variables (git-ignored)
├── .env.example                 # Template for env vars
└── CLAUDE.md                    # Claude Code-specific instructions
```

---

## 🔧 Tech Stack Details

### Frontend
- **Framework:** Next.js 16 (App Router, Server Components by default)
- **Language:** TypeScript (strict mode)

---

## Recent Operational Context

- 2026-07-15 Attendance beta audit: the requested clean baseline was confirmed.
  A live schema drift (`staff.is_cross_branch` missing) blocked every valid scan
  before device recognition and was repaired additively with migration
  `20260714180606`. Fresh unknown-phone login now renders correctly on mobile,
  Training Mode results are visibly non-live, atomic request replay passes, and
  types/tests/build are green. Attendance remains NO-GO because July 12-15 live
  migration effects are not reconciled in migration history and authenticated
  real-device clock-in/out/registration/Recovery/realtime QA is incomplete.
- 2026-07-14 CRM closing Attendance policy: Owner selected-branch details now
  include structured, effective-dated Attendance Rules and category inheritance.
  CRM/front-desk Closing shifts snapshot a branch-close-to-buffer window (default
  10:30–11:00 PM), remind at 11:00 PM, escalate at 11:30 PM, and provisionally
  close at 11:00 PM when still open at midnight. Provisional closes never create
  fake QR evidence; a later real QR scan reconciles the same record. Migration
  `20260714180000` and its `20260714143000` prerequisite remain unapplied pending
  migration-history reconciliation, so scheduler/live DB/authenticated QA are not
  production-certified.
- 2026-07-14 CRM Bookings desktop redesign: the CRM-only desktop route now uses
  a two-pane selected-date list and selected-booking command center with compact
  quick/exact filters, preserved legacy links, existing lifecycle/action/modal
  paths, and real timestamp/metadata Activity. Mobile and manager/owner booking
  surfaces remain unchanged. No migration or RLS change; authenticated browser
  certification remains blocked by the local `/login` redirect.
- 2026-07-13 attendance scan repair: public Attendance QR failures now use
  structured safe codes plus operation IDs instead of generic Scan Interrupted.
  Internal Recovery reasons map to stable `attendance_exceptions.exception_type`
  DB values and keep the exact reason in metadata. Live migration
  `20260713082146_attendance_scan_contract_repair.sql` was applied through the
  linked SQL query path because direct `db push` still timed out on the pooler.
  Registered physical-phone QA remains pending before final operator
  certification.
- **Styling:** Tailwind CSS v3 + CSS variables for theming
- **Components:** shadcn/ui (New York style, neutral palette)
- **Forms:** React Hook Form + Zod validation
- **State:** React Server Components first → Zustand only when needed
- **Icons:** Lucide React

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email + magic link)
- **Storage:** Supabase Storage (for file uploads)
- **API:** Next.js Route Handlers + Supabase RPC
- **Realtime:** Supabase Realtime (when needed)

### Dev Tools
- **Linting:** ESLint + Prettier
- **Testing:** Vitest + React Testing Library
- **Deployment:** Vercel
- **CI/CD:** GitHub Actions

---

## 📊 Current Status

| Metric              | Value       |
|----------------------|-------------|
| **Phase**           | `Stabilization` |
| **Sprint**          | `CRM-BOOKINGS-DESKTOP-REDESIGN-001`  |
| **Completion**      | `CRM desktop Bookings two-pane redesign implemented with existing lifecycle/actions preserved; static and automated checks pass`        |
| **Last Agent**      | `Codex` |
| **Last Updated**    | `2026-07-14` |
| **Blockers**        | `Authenticated CRM Bookings browser certification is blocked by the local /login redirect; linked Supabase migration-history reconciliation remains a separate existing blocker`      |

---

## ⚡ Quick Commands

```bash
# Development
pnpm dev                    # Start dev server (localhost:3000)
pnpm build                  # Production build
pnpm lint                   # Run linter
pnpm type-check             # TypeScript check
pnpm test                   # Run tests

# Database
pnpm db:migrate             # Run pending migrations
pnpm db:reset               # Reset database
pnpm db:seed                # Seed with test data
pnpm db:types               # Generate TypeScript types from Supabase

# Codegen
pnpm ui:add [component]     # Add shadcn/ui component
```

---

## 🚨 Critical Rules (Summary)

> Full rules in `AGENT_RULES.md` — these are the non-negotiables:

1. **READ `.context/` files BEFORE any work**
2. **UPDATE `.context/` files AFTER any work**
3. **Never skip the checklist** — see AGENT_RULES.md § Pre-Flight
4. **One task at a time** — finish or document why you stopped
5. **No God components** — if a file exceeds 200 lines, refactor
6. **Server Components by default** — only `'use client'` when you need interactivity
7. **Type everything** — no `any`, no implicit types
8. **Test what matters** — business logic, data transforms, edge cases

---

## Latest Agent Update (2026-07-13 - Schedule Leftover Cleanup)

- Completed `CRADLE-SCHEDULE-LEFTOVER-CLEANUP-008` after live auditing the three leftover warnings.
- Dante/Boy's conflict is genuine invalid individual schedule data (`02:00-22:00`, 20 hours), now emitted as `schedule_invalid_time_window` / `INVALID_TIME_WINDOW` with source ids and fingerprint instead of generic conflict text.
- Angels Massage no longer produces a missing-room warning unless its service metadata explicitly requires a room/resource.
- Main Spa's false 29-staff coverage warning was traced to corrupted `scheduling_rules` minima and repaired to defaults after backup.
- Added and live-applied `supabase/migrations/20260713090000_schedule_leftover_cleanup.sql`; `schedule_repair_backups` verifies 7 stale schedule rows and 1 scheduling-rule row were backed up before cleanup.
- Runtime warning contract now requires exact schedule issue codes, explicit service/resource metadata for missing room/resource, and explicit coverage requirements for coverage-gap conflicts.
- Verification passed: `npx tsc --noEmit`, focused schedule/manager tests (5 files / 24 tests), `pnpm test --run` (95 files / 735 tests), `pnpm lint`, and `pnpm build` (Next.js 16.2.4, 108 routes).
- Migration-history reads through the direct Supabase pooler path still need reconciliation from a working DB connection.

## Previous Agent Update (2026-07-12 - Attendance Transactional Continuation)

- Added `supabase/migrations/20260712044527_attendance_transactional_scan_rpc.sql` with `public.commit_attendance_scan_transaction(...)`.
- Normal interpreted Attendance clock-in, clock-out, active-service-blocked, and Recovery-intent commits now persist interpreted records, scan events, Recovery issues, device seen timestamps, and idempotent public results inside one PostgreSQL transaction.
- Added `supabase/migrations/20260712045429_attendance_transactional_corrections_rpc.sql` with `public.reset_attendance_state_transaction(...)`.
- Selected-record Attendance State Reset now voids the interpreted check-in, resolves linked open Recovery cases, and writes the correction audit inside one PostgreSQL transaction.
- Updated generated Supabase types for the new RPCs and added `tests/lib/attendance/transactional-scan-rpc-migration.test.ts`.
- Applied both new RPCs to the linked database via `supabase db query --linked --dns-resolver https --file ...` and verified they are `security invoker`, service-role-only executable, and reject invalid no-mutation probes.
- Final verification passed: focused Attendance tests (5 files / 30 tests), `pnpm type-check`, `pnpm lint`, `pnpm test` (88 files / 699 tests), and `pnpm build` (Next.js 16.2.4, 108 routes).
- Migration history is still not reconciled: linked `supabase_migrations.schema_migrations` reports `0` rows for the six recent Attendance versions even though the linked schema has the recent columns/functions. Do not declare Attendance production-closed until that history path is repaired.

## Previous Agent Update (2026-07-12 - Attendance Autonomy Hardening)

- Implemented `ATTENDANCE-AUTONOMY-HARDENING-001` locally without replacing the existing Attendance engine.
- Added stable shift-instance identity and branch-local time/business-date handling in `src/lib/attendance/shift-instance.ts`.
- Added `src/lib/attendance/attendance-state-machine.ts` for current Attendance state and next expected scan action.
- Extended the scan path to persist immutable schedule snapshots, dedupe active Recovery issues, store operation id/result replay metadata, and revalidate Attendance-first surfaces more narrowly.
- Updated Device Registry to load staff first and devices by staff id instead of trusting stale device branch metadata.
- Added migration `supabase/migrations/20260712035222_attendance_autonomy_hardening.sql` and reconciled generated types for pending local columns after linked `pnpm db:types`.
- Added `docs/maintenance/attendance-operations-runbook.md`.
- Verified focused Attendance tests, `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`; migration verification remains blocked because local Supabase is not running and linked migration-history reads time out.

## Previous Agent Update (2026-07-12 - Attendance Today Alignment)

- Completed `ATTENDANCE-TODAY-ALIGNMENT-RESET-001`: the QR Attendance scan path now resolves branch-local time and current staff schedule before considering open attendance rows.
- Open attendance rows are classified as matching current shift, stale prior row, or same-day conflict; only a matching current-shift row can be used for clock-out.
- Stale/conflicting rows create or update Recovery exceptions and no longer reverse the next scan.
- Reset Staff Day was replaced by selected-record Attendance State Reset / Reset Next Scan State with required reason, required void confirmation, preserved raw scan events, resolved related exceptions, and correction audit history.
- Added migration `supabase/migrations/20260712000100_attendance_state_reset.sql` for the new `reset_attendance_state` action.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`; Supabase migration-history reads still time out from this environment.

## Latest Agent Update (2026-05-11)

- Completed `MGR-MOB-001`: added a mobile-first Manager Workspace variant that activates only on mobile breakpoints.
- Desktop `/manager` page preserves the existing `ManagerTodayWorkspace` exactly via responsive `hidden md:block` / `block md:hidden` wrapper.
- Mobile experience includes 5 bottom-nav tabs (Today, Schedule, Bookings, Staff, More) with simplified card-based screens, large touch targets, and spa design tokens.
- Reuses existing data queries (`getTodaysSchedule`, `getDailySchedule`, `getStaffByBranch`, `getPendingStaffByBranch`) without new auth, RLS, or schema changes.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing.

## Latest Agent Update (2026-05-14)

- Completed `NOTIF-001`: added a premium workflow signal foundation with deduped notifications and a new `workflow_tasks` action layer.
- Staff onboarding submission now creates one manager review task and one applicant status update.
- Routine onboarding no longer creates urgent owner notification noise, and CRM receives no HR onboarding notification.
- Manager onboarding review tasks resolve on approval/rejection, and applicant approval/rejection updates are deduped by entity and recipient.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; lint still reports the two pre-existing onboarding-form warnings.

## Latest Agent Update (2026-05-14)

- Completed `BOOKING-WIZARD-UX-10.2`: public booking wizard service selection is now compact and category-based.
- Active `/book` source path uses the modern Places API (New) widget via `google.maps.importLibrary("places")` and `PlaceAutocompleteElement`; no legacy Places Autocomplete usage remains under `src`.
- Public staff selection now filters to real service-provider staff and respects selected service eligibility mappings; drivers, utility, and non-service staff are hidden from specific provider selection.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; `/book` returned `200 OK` from the existing local dev server.

## Latest Agent Update (2026-05-15)

- Completed `STAFF-NICKNAME-001`: added nullable `staff.nickname` via migration and updated local Supabase types.
- Owner/manager staff edit forms and staff onboarding now capture optional nicknames without requiring them.
- Public booking and tracking display nickname first for customer recognition; internal manager/CRM/owner/dispatch surfaces show full name plus nickname.
- Staff search now includes nickname in staff management and related schedule/booking filtering.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; lint still reports the two pre-existing onboarding-form warnings.

## Latest Agent Update (2026-05-15)

- Completed `DISPATCH-LIVE-001`: `/manager/dispatch` now validates the selected date and loads real branch-scoped dispatch data through `getDispatchData()`.
- Active dispatch tabs now render live items, stats, alerts, locations, ETA/location snapshots, and completed/cancelled records instead of mock arrays.
- Removed production dispatch mock data and fake map components, including the unused duplicate prototype dispatch folder.
- Assignment and notification controls are disabled with clear copy until a real selector/action UI is intentionally connected.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; lint still reports the two pre-existing onboarding-form warnings.

## Latest Agent Update (2026-05-20)

- Completed `BOOKING-MOBILE-SERVICE-GRID-001`: patched the public booking wizard service selection step for compact mobile card grids.
- Mobile service cards now stay inside bounded 2/3/4-column responsive grids with compact image, name, duration, price, and selected state.
- Category chips remain horizontally scrollable only inside their own row, and the public booking shell now clips accidental horizontal overflow.
- Booking data loading, category filtering, selected service logic, provider/date/details flow, desktop layout, and the floating circular widget were preserved.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; browser smoke checks covered 360px, 390px, 430px, 520px, 768px, and desktop widths with no document-level horizontal overflow.

## Latest Agent Update (2026-05-20)

- Completed `BOOKING-HOME-SERVICES-001`: public booking home-service services now read the same branch-service source of truth used by admin service management.
- Public booking now preserves branch-scoped `available_home_service`, `available_in_spa`, `visibility`, custom price, and custom duration fields, while dropping inactive base services.
- Visibility updates write to the current `branch_services.visibility` column with legacy fallback, and branch-service cache invalidation expires immediately.
- ESLint and Git now ignore `.codex-artifacts/**` so temporary verification artifacts are not scanned or listed as source files.
- No booking UI, step order, provider/date/payment/confirmation behavior, floating widget, hardcoded services, or dummy data was changed.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; API smoke confirmed 6 Home-eligible public services and 3 non-Home services for the Cradle branch.

## Latest Agent Update (2026-05-20)

- Completed `SCHEDULE-ADJUSTMENT-001`: added manual individual staff availability adjustments inside the existing `/manager/schedule` and `/crm/schedule` Staff view.
- Added shared `adjustStaffScheduleAction` with RBAC, branch-scope checks, target-staff branch validation, date override upsert/delete, blocked-time insert/delete, and route revalidation.
- Added a compact Manual Adjustment section for custom hours, day off, blocked time, clearing overrides, and removing blocks without redesigning the schedule page.
- Daily schedule rows now expose the current date override and real blocked-time IDs so remove actions are precise.
- Existing booking availability/assignment engine was left intact because it already respects `schedule_overrides`, `blocked_times`, weekly `staff_schedules`, and bookings.
- Verified `pnpm type-check`, `pnpm lint`, and `pnpm build` are passing; build renders 83 app routes.

## Latest Agent Update (2026-06-06)

- Completed `PUBLIC-MOBILE-LOADING-TRANSITIONS-001`: public mobile loading now has one short first-homepage intro and one thin warm-gold route-loading line for top-level public page navigation.
- Homepage intro uses `sessionStorage` key `cradle_public_intro_seen`, skips desktop/reduced-motion/repeat sessions, and no longer has a full-screen branded root loading bridge before it.
- Root-mounted route progress is allow-listed to `/`, `/services`, `/book`, `/branches`, `/about`, and `/contact`; booking subroutes/steps, external links, hashes, phone/email links, and protected workspaces are ignored.
- Booking logic, APIs, Supabase/database logic, server actions, protected portals, auth/RBAC, and middleware were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and local public route smoke checks are passing; lint still reports two pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

## Latest Agent Update (2026-06-06)

- Completed `PUBLIC-BOOKING-MOBILE-VIEWPORT-001`: public mobile `/book` now uses a viewport-fitted wizard shell with compact header/progress, internal active-step scrolling, and fixed bottom actions.
- Mobile Date & Time opens a warm dark bottom sheet for available slots after date selection; selecting a time still updates the existing `selectedSlot` state through the current callback path.
- Services now work inside the constrained mobile shell, with category chips and selected summary compact while the service grid scrolls internally.
- Booking logic, step order, validation, slot fetching/API behavior, submit payloads, Supabase/database logic, server actions, protected portals, auth/RBAC, and desktop layout behavior were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, `/book` HTTP 200, and headless Chrome mobile screenshots; lint still reports two pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

## Latest Agent Update (2026-06-07)

- Completed `PUBLIC-PAGES-DARK-THEME-001`: `/services`, `/contact`, `/about`, and `/branches` now use the dark warm Cradle visual system across mobile page components and desktop public sections.
- Shared `ServiceCatalogClient` now uses dark page surfaces, dark glass category/service cards, muted gold borders/actions, and cream text.
- Shared public `SiteHeader` now stays dark in desktop scrolled mode instead of switching to a cream header.
- Mobile Contact/Branches branch data rows now wrap long names/addresses and keep action labels inside the viewport.
- Booking logic, service/branch data behavior, Supabase/database logic, server actions, protected portals, auth/RBAC, APIs, and backend behavior were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, scoped light-surface source scan, production HTTP 200 checks for `/services`, `/contact`, `/about`, `/branches`, and headless Chrome production screenshots; lint still reports two pre-existing warnings in `scripts/generate-service-image-assets.mjs`.

## Latest Agent Update (2026-06-11)

- Completed `UI-MOBILE-PRELOAD-001`: added `MobileFirstVisitPreloader` for the public Cradle experience.
- The preloader is mounted on `/` through `src/app/page.tsx` and on public route-group pages through `src/app/(public)/layout.tsx`.
- It is mobile-only, session-only via `cradle_mobile_preloader_seen`, and uses scoped component keyframes/classes with reduced-motion support.
- The older mobile homepage `CradleBreathReveal` mount was removed so the new preloader is the only public first-visit splash.
- Route progress bars, workspace loaders, skeleton loaders, global loading files, protected portals, booking logic, Supabase/database logic, APIs, server actions, auth/RBAC, and middleware were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and headless Chrome runtime checks for mobile first visit, repeat session, desktop skip, protected route skip, public navigation skip, and reduced motion.

## Latest Agent Update (2026-06-11)

- Completed `UI-MOBILE-PRELOAD-002`: fixed the public mobile preloader so no-cookie public responses render overlay markup before client hydration or landing-page animations.
- `/` and the public route-group layout now read `await cookies()` for `cradle_mobile_preloader_seen` and pass `initiallyVisible` to `MobileFirstVisitPreloader`.
- Mobile first visits set both the session cookie and sessionStorage fallback to `1`; repeat-cookie visits skip server markup, desktop visits remove the overlay without setting the cookie, and protected routes do not mount or mark it.
- The preloader now uses the approved dark forest, warm gold, and ivory visual treatment with scoped component CSS and a temporary `.sp-public` animation pause guard while visible.
- Route progress bars, workspace loaders, skeleton loaders, global loading files/CSS, protected portals, booking logic, Supabase/database logic, APIs, server actions, auth/RBAC, and middleware were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, raw HTML cookie/no-cookie behavior, and headless Chrome CDP checks for mobile first paint, fade removal, repeat-cookie skip, desktop no-cookie skip, and protected-route isolation.

## Latest Agent Update (2026-06-11)

- Completed `CRM-SCHEDULE-UI-001`: CRM Schedule Daily Timeline now defaults to Fit Day mode so the full active day fits inside the main schedule column while the right rail remains visible.
- Added an Expand/Collapse control beside the density controls; Expanded mode hides the CRM right rail and gives the timeline full page width with horizontal scrolling for detail inspection.
- Timeline range is calculated from staff work hours, current overrides, bookings, and blocked times, with an 8 AM to 11 PM fallback when no active data is available.
- Booking blocks, blocked-time blocks, off-duty overlays, grid lines, hour labels, and the current-time marker now share percent-based full-day positioning.
- Public mobile preloader, public landing page, booking logic, schedule generation logic, Supabase schema/database logic, workspace loaders, and skeleton loaders were not changed.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, `git diff --check`, and a local unauthenticated `/crm/schedule` route probe returning `307 /login`; authenticated visual QA still needs a logged-in CRM session.

## Latest Agent Update (2026-06-15)

- Completed `OWNER-RECONNECT-001`: restored the existing Owner workspace for authorized owner users.
- `/owner` now uses an Owner workspace guard instead of the old soft-pause redirect to `/crm`, while Manager remains soft-paused to CRM.
- Owner role/default navigation now resolves to `/owner`; Owner nav is visible again and no longer exposes `/dev`.
- Owner prefetch no longer warms stale `/owner/settings` or `/dev` routes.
- No Supabase schema, RLS, migration, CRM workflow, Staff Portal, Driver Portal, public booking, scheduling, dispatch, or payroll business logic changes were made.
- Verified `pnpm type-check`, `pnpm lint`, focused Owner workspace tests, production `pnpm build`, service-role/RLS/stale-route scans; full `pnpm test` still has two unrelated booking progress failures.

## Latest Agent Update (2026-06-15)

- Completed `OWNER-DASHBOARD-REDESIGN-001`: rebuilt `/owner` Overview to match the approved Owner Dashboard reference inside the existing Owner shell.
- Added a server-side Owner dashboard loader with real bookings, branches, staff, schedules/check-ins, notifications, workflow tasks, and fixed-monthly payroll data.
- Dashboard sections now show partial error states instead of silently converting failed queries to zero metrics.
- Added pure dashboard business-rule helpers and 13 focused Vitest tests for bookings, completed sessions, paid revenue, active branches/staff, action counts, branch normalization, payroll totals, staff on-shift, auth access, empty data, missing payroll setup, and partial failures.
- No Supabase schema, RLS, migration, global shell, CRM workflow, Staff Portal, Driver Portal, public booking, booking progress, or schedule engine changes were made for the dashboard.
- Verified `pnpm test tests/lib/owner/dashboard.test.ts`, `pnpm type-check`, `pnpm lint`, `pnpm build`, and unauthenticated `/owner -> /login` browser smoke; full `pnpm test` still has two unrelated booking progress failures.

## Latest Agent Update (2026-07-13)

- Completed the local code portion of `CRADLE-INDIVIDUAL-SCHEDULING-SIMPLIFICATION-005`.
- Runtime scheduling is now CRM-controlled individual scheduling: manual paper importer files/actions were removed, group fallback was removed from the resolver/runtime consumers, old CRM schedule routes redirect to `/crm/schedule`, and the Schedule workspace now exposes only Daily Timeline and Schedule Setup.
- Deleted duplicate/stale schedule UI clusters: Live Availability/Coverage/Staff Schedule schedule tabs, group rule cards/right rail, old staff schedule list/page/card/detail editors, manual importer, group schedule actions, group schedule query helper, and group realtime subscription.
- Shared resolver consumers now treat missing schedules as `NO_SCHEDULE_CONFIGURED`, configured inactive rows as day off, invalid/overlapping rows as non-operational conflicts with exact windows, and valid split/overnight schedules as ordered windows.
- Individual weekly saves route through `replace_staff_weekly_schedule`, verify `staff_id/day_of_week/window_order`, reject non-operational staff, and insert only real work windows plus minimal day-off markers.
- Verification passed: `pnpm db:types`, `pnpm type-check`, `pnpm lint`, `pnpm test --run` (88 files / 702 tests), `pnpm build` (108 routes), and `git diff --check`.
- DB caveat: `pnpm db:doctor` and `pnpm db:status` still time out reading linked Supabase migration history over the pooler. `pnpm db:verify` can run linked SQL/table probes but exits nonzero because `psql` is not installed for fallback. The new migrations are local and must be applied from a working migration-history connection before claiming production DB completion.
- Type-generation caveat: linked generated types still omit pending `branch_booking_rules.home_service_free_km` and `home_service_extra_km_fee`; `src/lib/queries/branch-booking-rules.ts` now tolerates both migrated and not-yet-migrated schemas. Regenerate types again after production migration apply.

## Latest Agent Update (2026-06-17)

- Completed `CRM-INDIVIDUAL-SCHEDULE-LIVE-SYNC-001`: CRM individual staff schedule saves now verify Supabase returned rows from `staff_schedules` before reporting success.
- Added a shared effective schedule resolver using priority: date day-off override, date custom override, individual weekly schedule, staff-group fallback, then unscheduled.
- Live Staff now reads resolved `schedule_windows` from the daily schedule query instead of combining an aggregated daily span with a separate raw active `staff_schedules` query.
- Multiple shift windows now display in the Live Staff Staff List as `2 shifts` with each opening/closing time range.
- A saved inactive individual weekly row is treated as an individual day off and no longer falls through to group fallback in Live Staff or booking availability post-filter.
- `/api/crm/availability` and the CRM Live Availability SWR fetch no longer retain short stale cached responses after schedule saves.
- Existing RLS/grants were verified for CRM/CSR operational SELECT/INSERT/UPDATE on `staff_schedules`; no new migration was needed because this upsert flow does not require DELETE.
- Verified `pnpm type-check`, `pnpm test`, `pnpm lint`, `pnpm build`, and the requested swallowed-error scan; authenticated CRM click-through remains a manual QA step.

## Latest Agent Update (2026-06-17)

- Completed `AUTH-RESET-SUPABASE-CONNECTION-001`: self-service and Owner-triggered password recovery now build Supabase reset links from trusted `NEXT_PUBLIC_APP_URL` and land on `/reset-password`.
- Production reset links reject localhost app URLs; local development still falls back to `http://localhost:3000/reset-password`.
- `/reset-password` forwards Supabase recovery `code` or `token_hash` params to `/auth/callback`, which exchanges/verifies the recovery session, sanitizes the next path, and marks the recovery session before the password form renders.
- Password updates require the recovery marker and current Supabase user, apply shared password policy rules, call `auth.updateUser({ password })`, sign out, and return to `/login?passwordUpdated=true`.
- `/login` shows the reset affordance as `Forgot password?` beside the Password label and now displays a post-reset confirmation banner.
- Supabase dashboard follow-up: set Site URL to `https://cradlewellnessliving.com`, add redirect URLs for `http://localhost:3000/reset-password` and `https://cradlewellnessliving.com/reset-password`, and replace any Vercel placeholder with the real deployment URL.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build`, focused auth tests, and requested unsafe scans; only the existing server-only Supabase admin client references `SUPABASE_SERVICE_ROLE_KEY`.

## Latest Agent Update (2026-06-17)

- Deployed `RLS-GROUP-SCHEDULE-RULES-001` to production project `lsrbwqhvzjfpiabeolkv` as migration `20260617123431`.
- Root cause was the legacy `csr` system role missing from the live CRM/CSR group-rule write policy; its same-branch INSERT `WITH CHECK` failed with PostgreSQL `42501`.
- Group-rule RLS now uses explicit authenticated command policies: Owner-wide access, branch-scoped Manager/CRM/front-desk writes, update old/new-row checks, branch-readable staff SELECT, and no anonymous table grants.
- Server upsert/delete actions now independently verify Auth user, active staff role, centralized schedule permission, active target group, and branch ownership before using the normal session client.
- Live rollback-only authorization tests passed 14 cases. Schedule data remained intact at 58 group rules and 401 individual schedules, while daily schedule and booking availability RPCs continued returning data.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm test` (50 files / 519 tests), and `pnpm build` (100 routes). Authenticated browser save is still pending because no CRM/front-desk test session was available.

## Latest Agent Update (2026-06-17)

- Completed `CRM-DAILY-TIMELINE-REPLACEMENT-001`: replaced only the CRM Schedule Daily Timeline tab with the approved role-aware operations board.
- The existing `/crm/schedule` route, module header, URL-driven date/tab state, Live Availability, Schedule Setup, Coverage Issues, and Staff Schedule tabs remain.
- The board reuses resolved schedule windows, overrides, bookings, blocked periods, branch context, and realtime refresh; no database, schedule engine, availability, save, RLS, or authorization behavior changed.
- Added operational staff groups, filters, sticky timeline rows, current-time status, coverage, contextual selection, existing-workflow quick actions, available staff, and daily summary.
- Removed the Daily-only right rail and unreferenced legacy CRM SWR wrapper while retaining shared Owner/Manager schedule components.
- Verified type-check, lint, 51 test files / 525 tests, 100-route production build, and responsive browser QA at 1440x1000 and 390x844. Authenticated live-data visual QA remains a manual follow-up.

## Latest Agent Update (2026-06-17)

- Completed the local code portion of `CRM-AUTHORIZATION-CONSISTENCY-001`: CRM Staff service capability saves now use a transactional SECURITY INVOKER RPC instead of a non-atomic delete-then-insert Server Action sequence.
- Added migration `20260617141348_crm_staff_service_capabilities_rpc.sql` with `replace_staff_service_capabilities`, explicit branch-scoped `staff_services` operational policies, authenticated table grants, and locked-down function execute grants.
- Assignment reads now distinguish query/RLS failure from legitimate empty data and are scoped through active staff in the current branch.
- CRM Staff Management and Service Assignments update local state from the authoritative returned service IDs before route refresh, so the table/editor no longer depend on a timeout or stale props.
- Added `docs/CRM_AUTHORIZATION_INVENTORY.md` for the focused role/RLS/action inventory and documented remaining broader drift candidates.
- Verified `npx tsc --noEmit`, focused assignment-state test, `pnpm lint`, `pnpm test` (52 files / 528 tests), and `pnpm build` (100 routes).
- Live Supabase inspection/application is still pending because `supabase db query --linked` and `supabase db push --linked --dry-run` hung from this environment; apply and verify the migration from a working Supabase connection before marking the live DB work complete.

## Latest Agent Update (2026-06-30)

- Active task is now `CRM-STABILIZATION-HANDOFF-2026-06-30`.
- The latest CRM direction has been logged for future agents: primary daily navigation should move toward `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`; secondary configuration should live under collapsed `System Management`.
- The prior code checkpoint added richer `getFrontDeskContext()` in `src/lib/queries/crm-context.ts` and replaced duplicated CRM context lookups in Today, Bookings, Control, and Live Operations pages.
- The dedicated continuation log is `docs/FRONT_DESK_REFACTOR_PROGRESS.md`.
- `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `docs/CURRENT_TASK.cmd.md`, and `docs/HANDOFF.cmd.md` were updated so agents do not resume stale CRM Coach / observability tasks.
- No source behavior changed in the handoff-only update; last code checkpoint passed `npm run type-check`, `npm run lint`, and `npm run build`.

## Latest Agent Update (2026-06-30)

- Completed `CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30`: CRM sidebar primary navigation now shows `Work Queue`, `Bookings`, `Schedule`, `Customers`, and `Home Service`.
- Added a collapsed bottom `SYSTEM / System Management` section for current management-authorized CRM setup tools.
- System Management links reuse existing CRM routes/deep links and no routes, server actions, Supabase logic, RLS, or database behavior were changed.
- CRM workspace prefetching now warms only primary daily routes automatically; secondary/system routes wait for explicit navigation.
- Verified `npm run type-check`, `npm run lint` (4 unrelated existing warnings), `npm run build`, and `git diff --check`.
- Remaining work: Work Queue/Control consolidation, compact CRM header, duplicate New Booking cleanup, broader system-tool access review, and authenticated action/RLS workflow QA.

## Latest Agent Update (2026-07-02)

- Completed local implementation of `ATTENDANCE-QR-001`: CRM `/crm/attendance`, public `/scan/[publicCode]`, and public `/scan/activate/[token]` are wired.
- Added migration `20260702075213_attendance_qr_system.sql` with QR points, devices, activation tokens, scan events, exceptions, corrections/settings, booking/check-in extensions, RLS/grants, and `complete_due_service_sessions`.
- Applied the migration to the linked Supabase project via `db query --linked --file` and verified live tables, columns, RPC, grants, and policies; migration history may still need reconciliation because this was not a `db push`.
- `pg_cron` is not installed on the linked project, so automatic due-session completion was not scheduled.
- Added `qrcode`/`@types/qrcode`, server-only attendance helpers, CRM actions, QR SVG rendering, device activation cookies, scan engine logic, and focused timing tests.
- Verified `npx tsc --noEmit --pretty false`, `npm run lint` (same 4 unrelated existing warnings), `npx vitest run src/lib/attendance/time.test.ts`, and `npm run build` (104 routes).
- Remaining work: authenticated CRM/browser QA for activation, attendance scans, room/resource session scans, and blocked/revoked/wrong-branch duplicate flows; fix stale `db:types` script separately.

## Latest Agent Update (2026-07-02 - FK Follow-up)

- Fixed Attendance QR creation failing with `qr_points_branch_id_fkey`.
- Root cause was dev bypass returning zero UUID branch `00000000-0000-0000-0000-000000000000` before the Attendance action checked the authenticated staff branch.
- Added `src/lib/dev-bypass-server.ts` to resolve dev bypass to `DEV_BYPASS_BRANCH_ID` when valid, otherwise the first active real branch.
- Attendance actions now prefer the real staff branch and validate branch existence before settings/QR inserts.
- Verified `npx tsc --noEmit --pretty false`, `npm run lint`, and linked DB branch checks; attempted `npm run build` after this fix timed out without a result.

## Latest Agent Update (2026-07-02 - Attendance Refit)

- Completed `ATTENDANCE-REFIT-005`: refit `/crm/attendance` into one compact client-owned operational workspace across Overview, Records, Sessions, QR Codes, Devices, Exceptions, and Reports.
- Tab switching now uses local state plus `window.history.replaceState()`; routine tab changes do not use route links, router refresh/navigation, or redirects.
- Attendance server actions now return typed `AttendanceActionResult` payloads instead of redirecting to status query params, resolving the `NEXT_REDIRECT` symptom for routine QR/device/exception/session mutations.
- Removed Attendance KPI-card rows and rebuilt Overview around live staff, recent scans, active sessions, exceptions requiring attention, and quick actions.
- Reworked QR Codes into a compact selectable QR list plus selected branded preview with print formats, PNG/SVG/print/copy helpers, QR information, generation, and deactivate actions.
- Fixed the CRM Attendance sidebar icon by switching to supported `ClipboardCheck`.
- Added focused helper tests for tab parsing, QR public URL/base URL guards, print SVG layout, and export filenames.
- Verified `npx tsc --noEmit --pretty false`, targeted Attendance Vitest helpers, `npm run lint` (4 unrelated existing warnings), `npm run build` (104 routes), full `npm test -- --run` outside sandbox (60 files / 564 tests), and `git diff --check` (line-ending notices only).
- Browser smoke on the existing local dev server confirmed unauthenticated `/crm/attendance` redirects to `/login`, the login page renders, and no Next/Vite overlay is present. Authenticated CRM Attendance browser QA remains pending.

## Latest Agent Update (2026-07-02 - Attendance Final Verification Continuation)

- Completed the requested final verification cleanup with `pnpm`.
- Fixed all four prior lint warnings:
  - Removed unused `FALLBACK_IMAGE_URL`.
  - Replaced unused `generationPrompt` rest destructuring with explicit app-manifest projection.
  - Preserved payroll mock staff-id signatures with `void staffId` instead of suppressing lint.
- Final checks pass:
  - `pnpm type-check`
  - `pnpm lint` with 0 warnings
  - `pnpm test` (60 files / 564 tests)
  - `pnpm build` (104 app routes)
- Browser QA for `/crm/attendance?tab=qr` remains blocked by missing authenticated Supabase CRM/front-desk session. The route redirects to `/login` at 1440, 1280, 1024, 768, and 375 px; process-local `DEV_AUTH_BYPASS=true` does not bypass `src/proxy.ts`'s real-user requirement.
- Blocker screenshots were captured in `.codex-artifacts/attendance-qr-qa/`.
- Still pending before marking the QR refit fully complete: authenticated QR layout visual QA, real QR interactions, PNG/SVG/print export scans with a phone camera, and QR identity preservation checks before/after preview/export.

## 2026-07-03 - Attendance + Schedule Repair Context

- CRM Schedule Daily Timeline repair is locally complete: contextual error logging, no-store API responses, loud query-stage failures, `schedule_overrides.shift_type` propagation, live SWR refresh wiring, and focused regression tests are in place.
- Live Supabase verification through the transaction pooler confirmed the `schedule_overrides.shift_type` column/check constraint and a successful `get_daily_schedule` call for the active SM branch/date.
- Local app verification passed through type check, lint, focused tests, full Vitest, production build, and diff whitespace checks.
- Deployment is still gated on repairing local pnpm/Supabase CLI behavior so `pnpm db:push` and `pnpm db:types` can reconcile migration history and generated types.
- Rotate the Supabase database password before production deployment because a live password was pasted during troubleshooting.

## Latest Agent Update (2026-07-03 - Attendance Feed/Deep Links)

- Added the reusable live Attendance scan feed to CRM Work Queue and Owner Overview.
- Feed rows use existing `qr_scan_events`/`staff_shift_checkins` data and deep-link into the existing `/crm/attendance` Records tab.
- Added `/api/attendance/recent-scans` for authenticated refresh and Supabase Realtime invalidation.
- Added `/owner/attendance` as a selected-branch owner entry that reuses the existing Attendance workspace to avoid a duplicate Attendance module.
- Owner Attendance tab changes stay on `/owner/attendance` with the selected branch id.
- Records now accepts server-validated `staffId` and `date` filters and highlights the matching row.
- Verified `npx tsc --noEmit --pretty false`, focused helper tests, `npm run lint`, `npm run build`, and `git diff --check`.
- Remaining: authenticated browser QA, first-scan trusted-device sign-in/linking, Staff Portal My Attendance, staff profile attendance history, Supabase CLI/migration-history repair, and database password rotation.

## Latest Agent Update (2026-07-03 - Database Connection Stabilization)

- Added secure reusable Supabase database wrappers under `scripts/database/`.
- Updated package database commands to use `pnpm db:doctor`, `pnpm db:status`, `pnpm db:verify`, `pnpm db:link`, `pnpm db:push`, `pnpm db:types`, and `pnpm db:migration`.
- Added placeholders to `.env.example` only and unignored `.env.example`; local secret files remain ignored.
- Added `docs/DATABASE_CONNECTION_RUNBOOK.md` covering setup, migration push, type generation, verification, troubleshooting, migration-history repair, and emergency pooler fallback.
- Confirmed the direct project-local Supabase CLI shim works at version `2.95.6`; `pnpm exec supabase` remains unreliable in this managed shell.
- Remaining: rotate the exposed database password, populate local git-ignored secrets, rerun DB verification/push/types, and reconcile migration history.

## Latest Agent Update (2026-07-03 - Attendance Device Registry)

- Completed `ATTENDANCE-DEVICE-REGISTRY-005`: extended the existing Attendance QR schema for device registry metadata and one-time recovery links, applied `20260703151111_attendance_device_registry_recovery.sql`, and verified the live migration row/columns/RPC/grant by linked SQL.
- Added typed backend registry/recovery helpers, CRM actions, staff recovery confirmation flow, new attendance-device cookie handling, and focused recovery tests.
- Replaced the Attendance Devices tab with the Device Registry and Recovery Center UI: filters, registry table, pending recovery links, selected-device panel, recovery-link generation, rename, and revoke.
- Recovery link consumption is explicit staff-confirmed behavior and does not clock attendance in/out or start service sessions.
- Verified `pnpm db:types`, `pnpm type-check`, `pnpm lint`, focused recovery tests, full `pnpm test`, `pnpm build`, and `git diff --check`.
- Remaining: authenticated browser QA, real phone recovery scan QA, DB password rotation, and repair of the `pnpm db:status`/`pnpm db:push` port-5432 timeout path.

## Latest Agent Update (2026-07-09 - QR Wrong Branch Correction Requests)

- Completed `BRANCH-CORRECTION-REQUESTS-001`: QR Attendance wrong-branch blocks now expose an actionable correction request path instead of a dead end.
- Found the flow was partially present, then completed missing pieces: returning-scan correction metadata, duplicate-pending UI, CRM Staff Management Branch Corrections tab, secure review/cancel actions, and a dedicated branch-change audit migration.
- Added `supabase/migrations/20260709083908_staff_branch_audit_logs.sql` to create `staff_branch_audit_logs`, add missing request indexes, validate active requested branches on approval, and write audit rows from the review RPC.
- CRM/front-desk users can review only correction requests for their own requested/scanned branch; owner/manager roles can review all. Staff can request/cancel own pending requests but cannot change or approve their own branch.
- Approval updates `staff.branch_id` through the secure RPC and relies on the existing `trg_staff_branch_sync_devices` trigger to sync active `staff_devices.branch_id`.
- Verified focused branch-correction tests (5 files / 16 tests), `pnpm type-check`, `pnpm lint`, and `pnpm build`.
- Remaining: apply pending Supabase migrations, regenerate generated Supabase types if required, and run authenticated CRM/front-desk plus physical QR phone scan QA after deployment.

## Latest Agent Update (2026-07-09 - Schedule Conflict Clarity)

- Completed `SCHEDULE-CONFLICT-CLARITY-001`: CRM Schedule Daily Timeline / Coverage conflict counts now use one central `LiveScheduleConflict` model with plain-language details for front desk staff.
- Added a clickable conflict count, expandable details panel, affected staff/booking timeline indicators, and safe quick actions that route to existing booking/schedule review flows instead of direct conflict-resolution writes.
- Conflict detection now covers staff overlap, room double-booking, missing room, booking outside shift, booking on day off, booking during blocked time, missing schedule, duplicate schedule window, Home Service travel-buffer warning, and coverage gap.
- Attendance/check-in remains live status only and does not create schedule conflicts by itself; public/online booking, CRM booking availability, QR attendance, and schedule setup behavior were preserved.
- Verified `pnpm type-check`, `pnpm lint`, `pnpm build`, focused schedule conflict/UI tests, and relevant booking/availability safety tests.
- Remaining: authenticated CRM browser QA against live branch data.

## Latest Agent Update (2026-07-09 - Schedule Conflict Resolution Center)

- Completed `SCHEDULE-CONFLICT-RESOLUTION-CENTER-001`: finalized the new impact-group Schedule Conflict Center cleanup after the initial modal wiring landed.
- The modal now compiles against impact groups and tabs for All, Must Fix, Needs Approval, Cleanup, Rooms, Staff, Home Service, Accepted, and Audit.
- Added safe resolution-panel typing, refreshed the legacy summary helper for the impact model, and covered approval-level accept exceptions with reason/scope/audit UI tests.
- Preserved the existing live conflict model, conflict count, timeline/staff warning indicators, SWR refresh, and conflict action routing.
- Public/online booking, CRM booking availability, QR attendance, schedule setup writes, and attendance-as-live-status guardrails were not changed.
- Verified `pnpm type-check`, `pnpm lint`, focused schedule tests, relevant booking/availability safety tests, and `pnpm build`.
- Remaining: authenticated CRM browser QA against live branch data for final visual/operator confirmation.

## Latest Agent Update (2026-07-09 - Agent Coach Idle Loop)

- Completed `AGENT-COACH-IDLE-LOOP-001`: fixed the `Maximum update depth exceeded` crash in `AgentCoachProvider`.
- Root cause was the idle reset listener calling `setIsIdle(false)` on every activity/scroll event even when the provider was already active.
- Idle state now uses refs to guard duplicate state updates and keep the timeout handle stable.
- Added a focused regression test covering repeated active events, the 45-second idle transition, and reset from idle back to active.
- Verified targeted provider test, `pnpm type-check`, `pnpm lint`, and `pnpm build`.

## Latest Agent Update (2026-07-10 - CRM Booking Follow-up Stabilization)

- Completed `CRM-BOOKING-FOLLOWUP-STABILIZATION-001`: fixed CRM Today ETA refresh runtime fragility and Booking Follow-up `booking_events` RLS failures.
- CRM Today ETA refresh no longer passes a server action prop through the Today page/shell/dashboard/panel chain; the Work Queue button imports the stable action directly.
- Booking follow-up cancel/no-answer/reschedule/confirm-later paths now save through branch-checked CRM actions with service-role audit writes and operator-safe error messages.
- Change Staff now reuses the assignment assistant, blocks unavailable therapists, preserves the appointment time, records assignment metadata/audit, and notifies newly assigned staff.
- Reschedule now has a dedicated modal and action that moves only date/time, validates current therapist/room availability, records metadata/history/audit, and notifies the assigned therapist.
- Verified `pnpm type-check`, `pnpm lint`, focused assignment recommendation tests, and `pnpm build`.
- Remaining: authenticated CRM browser QA for `/crm/today` ETA refresh and `/crm/bookings` follow-up/reschedule/change-staff flows.

## Latest Agent Update (2026-07-13 - Adjust Schedule Modal)

- Completed local `CRADLE-ADJUST-SCHEDULE-MODAL-003`: CRM Schedule Daily Timeline Quick Actions > Adjust Staff and the selected-staff card > Adjust Schedule now open the same reusable Adjust Schedule modal.
- The selected-staff card keeps Edit Profile, Edit Capabilities, and View Full Schedule, and now adds Adjust Schedule without changing the Daily Timeline board.
- The modal uses individual `staff_schedules` as the authoritative weekly source, supports role-aware Opening/Regular/Closing vs Regular-only controls, split windows, explicit overnight, Not Configured vs Day Off, live preview, validation, and the existing centralized schedule refresh path.
- Group schedule controls and inherited/fallback language were intentionally excluded.
- Specific Date and Unavailable Time reuse existing real override/block actions; Approved Exceptions stays an honest empty state until a durable exception model exists.
- Verified focused tests, `pnpm type-check`, `pnpm lint`, full `pnpm test --run`, `pnpm build`, and `git diff --check`.
- Remaining: authenticated CRM browser visual/operator QA, production migration apply from a healthy Supabase migration-history path, and future server-calculated affected-booking impact analysis.

## Latest Agent Update (2026-07-13 - Schedule Update Integration Repair)

- Completed `CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006`: fixed the generic CRM weekly schedule update failure by repairing the live `staff_schedules` write contract.
- Root cause was a missing live `replace_staff_weekly_schedule(uuid, uuid, jsonb)` RPC plus the stale `staff_schedules_staff_day_shift_unique` constraint.
- Added/applied `supabase/migrations/20260713035024_schedule_update_integration_repair.sql` through the Supabase Management API query path, because the direct migration-history pooler path still times out.
- Live schema now has the staff/day/window unique constraint, `window_order` 1..12 check, validation trigger, operational helper functions, and PostgREST-visible replacement RPC.
- Legacy inactive placeholders were backed up and cleaned; live probes show zero duplicate staff/day/window keys and zero invalid inactive placeholders.
- Adjust Schedule, Schedule Setup, and manager single-day saves now use the same ordered-window RPC contract with safe structured error codes.
- Verified focused schedule/action tests, `npx tsc --noEmit`, live schema/RPC probes, rollbacked RPC round-trip, and `pnpm build`.
- Remaining: `pnpm db:status`/`db:push --dry-run` direct pooler path still times out, so migration history must be reconciled from a working DB path; authenticated CRM browser QA is still recommended.

## Latest Agent Update (2026-07-14 - Attendance Fluid Operations)

- Completed the local record-first Attendance refactor: valid ordinary scans are
  evidence first, a sole open row closes, uncertainty is reviewed, and only
  security/identity failures block.
- Added effective branch resolution, single-open concurrency enforcement, atomic
  exception-linked corrections, device lifecycle audit, and compatibility comments
  for deprecated policy fields in migration `20260714143000`.
- Added the exact shared operational statuses and reduced reporting to three real,
  filterable/exportable operational reports.
- Full suite passes at 123 files / 859 tests; type-check and lint pass. Migration
  apply and authenticated physical-device E2E remain gated by migration-history
  reconciliation.

## Latest Agent Update (2026-07-15 - Attendance Scan Results and Record First)

- Completed `ATTENDANCE-SCAN-RESULTS-AND-RECORD-FIRST-001` without adding a new
  scanner, device system, or closing policy.
- Ordinary valid first scans outside normal windows now create Attendance and an
  atomic review exception; likely forgotten closing scans remain captured without
  fabricated clock-ins, while QR/device/staff security failures remain blocked.
- The secure unregistered-phone continuation still connects the phone and completes
  the same scan with `nextScanRequired: false`.
- Backend-committed, deterministic nickname-first greetings use branch-local time;
  public success remains green with an optional compact amber review label, and
  public results no longer expose operation/security implementation details.
- Local verification passes: type-check, focused lint, 7 files / 70 focused tests,
  130 files / 956 full tests, and the Next.js production build. Valid-phone live E2E
  still needs an approved staff test credential and physical/clean browser profile.
## Release readiness status — 2026-07-21

CradleHub passes current code-level gates for a controlled pilot: 150 test files / 1,137 tests, TypeScript, lint with one existing dormant warning, and the 110-page production build. Multi-person packages are consultation/manual only, and public booking/waitlist endpoints have strict validation, honeypots, payload bounds, duplicate suppression, and safe errors.

Operational activation remains conditional on live migration-history reconciliation, stale-recovery migration verification, four Attendance cron jobs, linked database lint/RLS probes, authenticated browser/device/payment/dispatch checks, backup evidence, and a one-day controlled pilot. Distributed public rate limiting is not yet configured.
