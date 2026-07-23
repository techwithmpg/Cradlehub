# 🗺️ ROADMAP — Development Progress Tracker

> **Rule: Agents check off items as they complete them. Never skip ahead.**
> **Rule: If a task is blocked, mark it `🔴 BLOCKED` with a reason.**
> **Rule: Each phase must be 100% complete before moving to the next.**

---

## Status Legend

| Icon | Meaning |
|------|---------|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Completed |
| 🔴 | Blocked |
| ⏭️ | Skipped (with documented reason) |

---

## Current Delivery Notes

- 🟡 `PRODUCTION-READINESS-REPAIR-20260723` is source-release ready: the pinned
  clean-install toolchain, full 1,253-test suite, TypeScript, zero-warning lint,
  incremental formatting, optimized build, authenticated critical-path smoke,
  secrets/path/size audits, and Git divergence check pass. Tracked generated
  artifacts and three duplicate local migration prefixes were repaired without
  deploying the app or database. Commits `9ce90656`, `32ed2add`, and `bd1d03ad`
  are pushed to `origin/main`; database deployment stays 🔴 blocked by
  92-local-only / 5-remote-only linked migration-history drift.

- 🟡 `NOTIFICATIONS-001` is implementation-complete with automated gates passing
  on 2026-07-22: CRM/Owner/Staff/Driver/Utility bells now reconcile
  RLS-authorized `workspace_notifications` over Supabase Realtime, with
  cross-tab-once toast/chime delivery and an opt-in Web Push channel. Owner
  delivery preferences and exact paid Staff/Driver booking assignment events are
  included. Type-check, build, 161 files / 1,180 tests, lint (one pre-existing
  Attendance warning), and diff checks pass. The additive migration is not
  applied and VAPID-backed production browser/device QA remains deployment
  evidence; see `docs/operations/BROWSER_PUSH_NOTIFICATIONS.md`.

- 🟡 `CRM-RETENTION-001` reached CRM-certified conditional pass on 2026-07-22:
  React Activity now retains a user/role/branch-scoped CRM LRU (4) and optional
  Owner LRU (3), pauses hidden Effects, preserves scroll/state/SWR data, protects
  drafts, and reconciles dirty/stale modules quietly. CRM-first is the default
  rollout and `off` is rollback. Authenticated CRM retained/evicted returns,
  canonical state, Back/Forward, inert hiding, and the four-frame LRU pass.
  Owner plus exact heap/network/DOM-identity/CLS/long-task certification remains.

- 🟡 `CRM-PERF-002` reached implementation-complete conditional pass on 2026-07-21: all 22 CRM/Owner route loaders and active routine route refreshes are removed; retained SWR/canonical reconciliation now covers reports, bookings, attendance, dispatch, schedule, services, staff, marketing, attendance rules, and payroll; URL history restores workspace subviews. All automated gates and CRM browser history/state QA pass. Authenticated Owner Reports plus Marketing/Attendance Rule browser certification and the exact Work Queue → Bookings sequence remain release evidence.

- ✅ `ATTENDANCE-BRANCH-RESOLUTION-TRANSACTION-FIX-003` completed with
  conditional production certification on 2026-07-15: live SQLSTATE `42702` was
  traced to ambiguous exception-table columns, guarded migration `20260715113001`
  was applied and recorded, and linked rollback-only shift/day/permanent/replay/
  failure QA passed with zero residue. The transaction and live database are
  repaired; deploy the uncommitted app changes and complete authenticated
  browser/device QA before calling the full production path certified.

- ✅ `ATTENDANCE-BRANCH-CORRECTION-RESOLUTION-001` completed on 2026-07-15:
  Branch Corrections now uses explicit shift/day access, permanent transfer, or
  rejection; approved requests atomically resume the stored scan through the
  canonical Attendance engine, preserve historical branch truth, and replay
  without duplicate decisions or Attendance. The focused live migration, strict
  browser-write denial, generated types, synthetic rollback QA, full suite, and
  production build pass. Arbitrary date ranges remain deliberately deferred.

- ✅ `CRM-OPEN-CLOSE-SCHEDULE-NORMALIZATION-001` completed on 2026-07-15:
  eligible CRM/CSR/front-desk Open-Close overlaps now have an explicit targeted
  Adjust Schedule repair; weekly totals use unique coverage, exact handoffs are
  continuous for availability and Attendance, strict global overlap rejection
  remains in place, and no migration or booking mutation was introduced.
  Authenticated localhost QA persisted and reopened the live Wed-Sat fixture at
  62h with zero timeline conflicts; all automated gates and the production build
  pass.

- ✅ `ATTENDANCE-SMART-DYNAMIC-CLOCK-OUT-001` completed and production-accepted
  on 2026-07-15: one schedule-backed resolver now derives dynamic
  expected clock-out from final service, branch-closing service, home service,
  or driver trip; branch QR remains default, limited portal clock-out is fully
  server/device authorized, event triggers target affected open rows, and stored
  deadlines remain compatible with the four Supabase safety stages. The isolated
  migration is live, a Training Mode resolver probe passed, all automated gates
  are green, and commit `5b0ce6cb` reached READY on Vercel production. Dedicated
  authenticated physical-device/multi-role E2E remains follow-up evidence.

- ✅ `ATTENDANCE-HYBRID-CLOSING-AUTOMATION-001` completed on 2026-07-15:
  removed the Vercel Hobby-incompatible five-minute Attendance cron, deployed one
  restricted database processor with three open-record partial indexes, enabled
  four exact Supabase Cron jobs for the verified Asia/Manila branches, observed
  successful empty scheduled runs with zero action writes, and retained the
  protected manual route as fallback only. Production Vercel acceptance is the
  final release observation after the commit reaches `main`.

- ✅ `ATTENDANCE-SCAN-RESULTS-AND-RECORD-FIRST-001` completed locally on
  2026-07-15: ordinary valid outside-hours first scans now record and flag,
  first-closing ambiguity stays capture-only, one-scan secure phone registration
  is preserved, and committed branch-time personalized success copy uses a
  secondary review badge. Valid-phone physical E2E remains pending.
- ✅ `ATTENDANCE-CRM-CLOSING-POLICY-001` completed locally on 2026-07-14:
  Owner branch details now host the effective-dated Attendance Rules UI; CRM
  Closing shifts use a historically snapshotted branch operational window, and
  idempotent reminder/escalation/provisional-close plus late real-QR reconciliation
  extend the existing Attendance/notification/review systems. Live migration,
  observed scheduler execution, and authenticated Owner/phone QA remain gated by
  migration-history reconciliation.
- ✅ `CRADLE-SCHEDULE-LEFTOVER-CLEANUP-008` completed on 2026-07-13:
  leftover legacy warnings now require authoritative contracts. Dante/Boy's
  real invalid 20-hour schedule window surfaces with exact issue code/source
  data, Angels Massage no longer gets a missing-room warning without explicit
  service metadata, and Main Spa's corrupted coverage minima were backed up and
  restored to defaults.
- ✅ `CRADLE-SCHEDULE-SYSTEM-UNIFICATION-007` completed on 2026-07-13:
  CRM-controlled individual `staff_schedules` are the runtime schedule source,
  Schedule Setup and Adjust Schedule share the same weekly draft/save path,
  Daily Timeline starts from the operational branch roster, missing schedule is
  distinct from day off/conflict, split and overnight windows render correctly,
  and live realtime publication now includes the schedule runtime tables.
- 🔴 Supabase migration-history reconciliation remains required from a working
  direct DB path. Do not blind `db push` while live schema effects are verified
  but migration history is not certified from this environment.

---

## Phase 0: Project Bootstrap `[STATUS: ⬜]`

> **Goal:** Repo exists, runs, and every developer/agent can start working immediately.

- [ ] `0.1` Initialize Next.js 15 project with TypeScript + pnpm
- [ ] `0.2` Configure Tailwind CSS + CSS variables for theming
- [ ] `0.3` Install and configure shadcn/ui (New York style)
- [ ] `0.4` Set up project directory structure (src/ organization)
- [ ] `0.5` Configure ESLint + Prettier with project rules
- [ ] `0.6` Set up path aliases (`@/` → `src/`)
- [ ] `0.7` Create `.env.example` with all required variables
- [ ] `0.8` Set up Supabase project + local dev (supabase init)
- [ ] `0.9` Create Supabase client utilities (server + client + middleware)
- [ ] `0.10` Create `.context/` directory with all .cmd.md template files
- [ ] `0.11` Create base layout (root layout + metadata)
- [ ] `0.12` Create error.tsx + loading.tsx + not-found.tsx at root
- [ ] `0.13` Verify `pnpm build` passes with zero errors
- [ ] `0.14` First git commit: "chore: initialize project with full scaffold"

**Phase 0 Completion:** `___/14 tasks` | **Date Completed:** `_________`

---

## Phase 1: Authentication & Core Layout `[STATUS: ⬜]`

> **Goal:** Users can sign up, log in, and see a responsive shell layout.

- [ ] `1.1` Design database schema for users/profiles (migration 001)
- [ ] `1.2` Implement Supabase Auth (email + password)
- [ ] `1.3` Create auth pages (login, register, forgot-password)
- [ ] `1.4` Set up middleware for route protection
- [ ] `1.5` Build app shell layout (sidebar + header + main content area)
- [ ] `1.6` Implement responsive sidebar (collapsible on mobile)
- [ ] `1.7` Create user profile dropdown (avatar, name, logout)
- [ ] `1.8` Add role-based route guards
- [ ] `1.9` Create onboarding flow for first-time users
- [ ] `1.10` Write tests for auth flow + middleware

**Phase 1 Completion:** `___/10 tasks` | **Date Completed:** `_________`

---

## Phase 2: Core Data Models & CRUD `[STATUS: ⬜]`

> **Goal:** Primary entities exist in the database with full CRUD operations.

- [ ] `2.1` Design core entity schemas (migrations 002-00x)
- [ ] `2.2` Generate TypeScript types from Supabase schema
- [ ] `2.3` Create Zod validation schemas for all entities
- [ ] `2.4` Build reusable data table component (sorting, filtering, pagination)
- [ ] `2.5` Implement create/edit forms with React Hook Form + Zod
- [ ] `2.6` Create Server Actions for all CRUD operations
- [ ] `2.7` Add optimistic UI updates for mutations
- [ ] `2.8` Implement soft delete pattern
- [ ] `2.9` Add search and filter functionality
- [ ] `2.10` Write tests for validations + server actions

**Phase 2 Completion:** `___/10 tasks` | **Date Completed:** `_________`

---

## Phase 3: Business Logic & Features `[STATUS: ⬜]`

> **Goal:** Domain-specific features that make the app valuable.

- [ ] `3.1` _[Define feature 1]_
- [ ] `3.2` _[Define feature 2]_
- [ ] `3.3` _[Define feature 3]_
- [ ] `3.4` _[Define feature 4]_
- [ ] `3.5` _[Define feature 5]_

**Phase 3 Completion:** `___/5 tasks` | **Date Completed:** `_________`

---

## Phase 4: Dashboard & Analytics `[STATUS: ⬜]`

> **Goal:** Users can see meaningful insights and summaries.

- [ ] `4.1` Design dashboard layout with stat cards
- [ ] `4.2` Implement data aggregation queries (RPC functions)
- [ ] `4.3` Build chart components (Recharts integration)
- [ ] `4.4` Add recent activity feed
- [ ] `4.5` Create role-specific dashboard views
- [ ] `4.6` Add date range filtering for analytics
- [ ] `4.7` Implement data export (CSV/PDF)

**Phase 4 Completion:** `___/7 tasks` | **Date Completed:** `_________`

---

## Phase 5: Polish & Production `[STATUS: ⬜]`

> **Goal:** Production-ready — performant, accessible, documented.

- [ ] `5.1` Accessibility audit (keyboard nav, ARIA labels, contrast)
- [ ] `5.2` Performance optimization (lazy loading, image optimization)
- [ ] `5.3` SEO metadata for all public pages
- [ ] `5.4` Error boundary coverage for all route segments
- [ ] `5.5` Loading state coverage for all route segments
- [ ] `5.6` Mobile responsiveness audit (all breakpoints)
- [ ] `5.7` API documentation
- [ ] `5.8` User-facing documentation / help pages
- [ ] `5.9` Set up Vercel deployment + environment variables
- [ ] `5.10` Final QA pass — test all user flows end-to-end

**Phase 5 Completion:** `___/10 tasks` | **Date Completed:** `_________`

---

## 📈 Overall Progress

| Phase | Status | Tasks | Done | % |
|-------|--------|-------|------|---|
| Phase 0: Bootstrap | ⬜ | 14 | 0 | 0% |
| Phase 1: Auth & Layout | ⬜ | 10 | 0 | 0% |
| Phase 2: Core CRUD | ⬜ | 10 | 0 | 0% |
| Phase 3: Features | ⬜ | 5 | 0 | 0% |
| Phase 4: Dashboard | ⬜ | 7 | 0 | 0% |
| Phase 5: Polish | ⬜ | 10 | 0 | 0% |
| **TOTAL** | | **56** | **0** | **0%** |

---

## 📝 Roadmap Change Log

| Date | Change | Reason | Agent |
|------|--------|--------|-------|
| _[DATE]_ | Initial roadmap created | Project kickoff | Human |
| 2026-07-11 | Completed CRM-PERFORMANCE-OPTIMIZATION-001 | Record frozen CRM performance baseline, safe render/effect optimizations, verification, and deferred bundle/query/database follow-ups | Codex |
| 2026-05-01 | Added CSR Head/CSR Staff RBAC completion note (CRM workspace only, no separate CSR workspace) | Align workspace access with front-desk org structure and server-side permission enforcement | Codex |
| 2026-05-01 | Logged STAFF-005 mobile accordion/day-card refinement for `/staff-portal/week` | Track focused mobile planner UX/accessibility improvements and verification run | Codex |
| 2026-05-09 | Logged STABILITY-001 workspace stabilization audit and blocker fixes | Stabilize route aliases, notification count behavior, public booking status copy, and Next.js 16 proxy documentation before broader client/staff testing | Codex |
| 2026-05-09 | Logged STAFF-UI-001 staff management workspace redesign | Track the owner staff dashboard rebuild with branch-grouped tables, filters, KPI cards, and selected staff preview rail | Codex |
| 2026-05-09 | Logged STAFF-UI-002 staff display normalization and compact profile panel | Track shared staff metadata helper usage, tier eligibility safeguards, branch-column removal, and profile panel compacting | Codex |
| 2026-05-10 | Logged BK-WS-002 shared bookings workspace polish | Track simplified booking detail actions, compact row action menu, table pagination, and fixed compact columns across Owner/Manager/CRM | Codex |
| 2026-05-11 | Logged MGR-MOB-001 mobile manager workspace | Track mobile-first manager variant with bottom nav, simplified card screens, and preserved desktop behavior | Kimi |
| 2026-05-13 | Logged STAFF-ORG-001 staff organization/access model fix | Track full staff edit role/function separation, driver/utility/service role exposure, manager-safe RBAC, and conditional service capability behavior | Codex |
| 2026-05-14 | Logged NOTIF-001 premium workflow signal foundation | Track deduped workflow task layer, staff onboarding routing cleanup, manager attention strip, and quiet bell grouping | Codex |
| 2026-05-14 | Logged BOOKING-WIZARD-UX-10.2 public booking wizard optimization | Track modern Places-only active booking path, compact category service picker, and qualified service-provider staff filtering | Codex |
| 2026-05-15 | Logged STAFF-NICKNAME-001 staff/therapist nicknames | Track optional `staff.nickname`, public nickname-first booking display, and internal full-name-plus-nickname manager/CRM/owner displays | Codex |
| 2026-07-10 | Logged ATTENDANCE-RECOVERY-RULES-001 schedule-aware Attendance Recovery Center | Track smart QR scan intent classification, closing-scan recovery, Recovery/Rules/Audit UI, correction actions, and migration follow-up | Codex |
| 2026-07-10 | Completed CRM-BOOKING-FOLLOWUP-STABILIZATION-001 | Stabilize CRM Today ETA refresh, fix booking follow-up `booking_events` RLS path, add audited Change Staff and Reschedule flows | Codex |
| 2026-05-15 | Logged DISPATCH-LIVE-001 manager dispatch live data wiring | Remove production mock dispatch data and connect `/manager/dispatch` to real branch-scoped Supabase dispatch query data | Codex |
| 2026-05-20 | Logged BOOKING-MOBILE-SERVICE-GRID-001 mobile service grid patch | Keep public booking service cards compact on mobile, preserve desktop, and verify no page-level horizontal overflow | Codex |
| 2026-05-20 | Logged BOOKING-HOME-SERVICES-001 public home-service availability fix | Align public booking service reads with admin branch-service Home/Public settings and preserve branch custom price/duration | Codex |
| 2026-05-21 | Logged CRM-OPS-002E Schedule Setup universal group UI redesign | Redesign `/crm/staff-availability` with tabbed workspace, group cards, universal rules panel, weekly pattern matrix, right rail, and preserved individual schedule editor | Claude Code |
| 2026-05-21 | Logged CRM-OPS-002E-A Individual Adjustments UI polish | Stat strip, filter pills, cleaner table, status chips, colored avatars, improved Manage button | Claude Code |
| 2026-05-21 | Logged CRM-OPS-002E-B Manage Individual Schedule modal redesign | Redesign sheet header, tabs, weekly hours editor, overrides editor, block time editor with warm cards, status chips, and cleaner forms | Claude Code |
| 2026-06-06 | Logged PUBLIC-MOBILE-LOADING-TRANSITIONS-001 public mobile loading transitions | Track one-session homepage intro, public top route line, and removal of the root full-screen loading bridge from public first load | Codex |
| 2026-06-06 | Logged PUBLIC-BOOKING-MOBILE-VIEWPORT-001 public booking mobile viewport wizard | Track viewport-fitted `/book` shell, internal step scrolling, fixed bottom actions, compact mobile steps, and mobile Date & Time bottom sheet | Codex |
| 2026-06-07 | Logged PUBLIC-PAGES-DARK-THEME-001 public pages dark theme pass | Track dark Cradle restyling for `/services`, `/contact`, `/about`, `/branches`, shared service catalog, and scrolled public header | Codex |
| 2026-06-11 | Logged UI-MOBILE-PRELOAD-001 mobile first-visit public preloader | Track mobile-only, session-only preloader mounted on public pages without changing protected workspaces or global loaders | Codex |
| 2026-06-11 | Logged UI-MOBILE-PRELOAD-002 mobile preloader first-paint fix | Track cookie-backed server mounting before public landing animations while preserving desktop/protected routes and global loaders | Codex |
| 2026-06-11 | Logged CRM-SCHEDULE-UI-001 Daily Timeline fit/expand polish | Track CRM Schedule Fit Day layout, expanded full-width timeline mode, percent-based active-day positioning, and right-rail behavior | Codex |
| 2026-06-15 | Logged OWNER-RECONNECT-001 Owner workspace restoration | Restore existing Owner workspace routing, nav, workspace switching, and authorization without database or operational workflow changes | Codex |
| 2026-06-15 | Logged OWNER-DASHBOARD-REDESIGN-001 Owner Overview dashboard redesign | Track real-data executive Owner dashboard, section-level partial error states, staff/payroll/action summaries, and focused dashboard business-rule tests | Codex |
| 2026-06-17 | Logged CRM-INDIVIDUAL-SCHEDULE-LIVE-SYNC-001 individual schedule live sync fix | Track verified staff_schedules upserts, shared effective schedule resolver, Live Staff multi-window display, stale availability cache removal, and CRM schedule validation results | Codex |
| 2026-06-17 | Logged AUTH-STAFF-RECOVERY-001 staff password recovery and diagnostics | Track secure Supabase Auth password recovery, password visibility controls, and Owner-only staff login diagnostics for CRM/front desk access issues | Codex |
| 2026-06-17 | Logged AUTH-RESET-SUPABASE-CONNECTION-001 Supabase reset URL connection | Track trusted NEXT_PUBLIC_APP_URL reset links, `/reset-password` recovery-session routing, safe reset/login copy, password policy validation, and production Supabase URL configuration notes | Codex |
| 2026-06-17 | Logged RLS-GROUP-SCHEDULE-RULES-001 production group schedule rule repair | Track legacy CSR policy correction, explicit branch-aware write policies, least-privilege grants, server-action authorization, live rollback-only RLS matrix, and schedule regression checks | Codex |
| 2026-06-17 | Completed CRM-DAILY-TIMELINE-REPLACEMENT-001 role-aware Daily Timeline replacement | Replace only the CRM Daily Timeline visual layer while preserving the Schedule module, existing tabs, authoritative schedule data, setup workflows, booking availability, and authorization | Codex |
| 2026-06-17 | Logged CRM-AUTHORIZATION-CONSISTENCY-001 staff service assignment repair | Track atomic staff-services RPC, hidden query-error fix, local assignment state update, focused CRM authorization inventory, and pending live Supabase migration verification | Codex |
| 2026-06-20 | Logged AGENT-CRM-COACH-001 CRM AI coach MVP | Build Claude 3.5 Sonnet powered CRM guide with floating chat, proactive idle tips, suggested actions, and full audit logging | Kimi |
| 2026-06-30 | Logged CRM-STABILIZATION-HANDOFF-2026-06-30 | Record current CRM/front-desk stabilization state, latest Work Queue/Home Service/System Management direction, prior context-consolidation checkpoint, and next-agent continuation protocol | Codex |
| 2026-06-30 | Completed CRM-STABILIZATION-CHECKPOINT-1-NAV-SHELL-2026-06-30 | Update CRM sidebar primary nav to Work Queue/Bookings/Schedule/Customers/Home Service, add collapsed System Management, and keep secondary/system routes out of automatic CRM prefetch | Codex |
| 2026-07-02 | Completed local ATTENDANCE-QR-001 implementation | Add QR Attendance CRM workspace, public scan/activation routes, Supabase attendance schema/RLS/RPC, device activation, scan engine, QR generation, and verified build/lint/type-check with authenticated QR QA remaining | Codex |
| 2026-07-02 | Completed local ATTENDANCE-REFIT-005 workspace refit | Refit Attendance into an instant local-tab workspace, remove KPI-card rows, rebuild QR Codes preview/export flow, return typed server-action results, fix sidebar icon, and verify type/lint/test/build with authenticated browser QA remaining | Codex |
| 2026-07-02 | Finalized ATTENDANCE-REFIT-005 pnpm verification cleanup | Resolve four lint warnings, rerun `pnpm type-check`, `pnpm lint`, `pnpm test`, and `pnpm build`; document authenticated QR visual/export/phone-scan blocker | Codex |
| 2026-07-03 | Completed local ATTENDANCE-SCHEDULE-REPAIR-002 stabilization | Fix CRM Daily Timeline hidden error logging, carry `schedule_overrides.shift_type`, fail loudly on schedule query stages, verify live DB via pooler, and document `pnpm db:push`/`db:types` CLI blocker plus required DB password rotation | Codex |
| 2026-07-03 | Completed ATTENDANCE-FULL-INTEGRATION-002 feed/deep-link slice | Add live Attendance scan feed to CRM Work Queue and Owner Overview, realtime/SWR refresh API, Records staff/date deep links, selected-branch Owner Attendance entry, and focused helper tests while preserving the existing Attendance module | Codex |
| 2026-07-03 | Started DATABASE-CONNECTION-STABILIZATION-001 | Add secure reusable Supabase DB tooling wrappers, local-only env placeholders, runbook, and documented blockers for password rotation, migration-history reconciliation, and linked verification | Codex |
| 2026-07-03 | Completed ATTENDANCE-DEVICE-REGISTRY-005 | Add Attendance Device Registry and Recovery Center backend/UI, atomic one-time recovery links, staff confirmation screen, live DB verification, and focused recovery tests while preserving QR attendance/service scan behavior | Codex |
| 2026-07-09 | Completed BRANCH-CORRECTION-REQUESTS-001 | Add QR wrong-branch correction request/review flow, requested-branch-scoped CRM inbox, approval audit log migration, duplicate-pending UI, and focused verification tests | Codex |
| 2026-07-09 | Completed CRM-BOOKING-HOME-SERVICE-DISTANCE-001 | Fix CRM schedule-first availability checks, require live Places Home Service addresses, calculate/store distance and travel fee, and verify type-check/lint/build/focused tests | Codex |
| 2026-07-09 | Completed CRM-HOME-SERVICE-LOCATION-FIELD-CLEANUP-001 | Remove redundant CRM Home Service city/barangay/landmark/location-note fields, keep one Places-backed service address, add access note metadata, and verify checks | Codex |
| 2026-07-09 | Completed BRANCH-LOCATION-HOME-SERVICE-ORIGIN-001 | Add editable Places-backed branch service origin coordinates on branch details so CRM Home Service distance uses selected branch lat/lng as origin | Codex |
| 2026-07-09 | Completed SCHEDULE-CONFLICT-CLARITY-001 | Make live Schedule conflict counts clickable and plain-language with a central conflict model, timeline indicators, safe guided actions, and verified booking/attendance guardrails | Codex |
| 2026-07-09 | Completed SCHEDULE-CONFLICT-CENTER-001 | Replace the inline right-rail conflict details card with a centralized Schedule Conflict Center modal launched from Coverage Overview | Codex |
| 2026-07-09 | Completed SCHEDULE-CONFLICT-RESOLUTION-CENTER-001 | Finalize Schedule Conflict Center impact groups, accepted-exception flow, typing cleanup, focused tests, and build verification | Codex |
| 2026-07-09 | Completed AGENT-COACH-IDLE-LOOP-001 | Fix Agent Coach idle listener maximum-update-depth crash by guarding duplicate idle state updates | Codex |
| 2026-07-12 | Completed ATTENDANCE-TODAY-ALIGNMENT-RESET-001 | Repair QR Attendance scan ordering so current schedule decides clock-in/out before open rows, isolate stale/conflicting rows into Recovery, and replace broad staff-day reset with selected-record Attendance State Reset | Codex |
| 2026-07-12 | Implemented local ATTENDANCE-AUTONOMY-HARDENING-001 | Add stable shift-instance snapshots, branch timezone/business-date behavior, Attendance state machine, Recovery dedupe, staff-first Device Registry, production device-secret enforcement, migration/types/runbook updates, and record remaining production closeout blockers | Codex |
| 2026-07-12 | Continued ATTENDANCE-AUTONOMY-HARDENING-001 transactional hardening | Add linked-applied transactional scan commit and selected-record reset RPCs, service-role-only grants, generated type updates, focused migration tests, and document remaining migration-history/correction/QA blockers | Codex |
| 2026-07-13 | Implemented local CRADLE-INDIVIDUAL-SCHEDULING-SIMPLIFICATION-005 | Remove paper import, group runtime fallback, duplicate schedule UI, and route runtime consumers through CRM-entered individual schedules; production migration apply remains blocked by migration-history connectivity | Codex |
| 2026-07-13 | Completed local CRADLE-ADJUST-SCHEDULE-MODAL-003 | Add reusable Adjust Schedule modal from Daily Timeline Quick Actions and selected-staff card, preserve Daily Timeline UI and individual schedule authority, add role-aware split/overnight weekly editing and focused verification | Codex |
| 2026-07-13 | Completed CRADLE-SCHEDULE-UPDATE-INTEGRATION-REPAIR-006 | Repair live CRM schedule save failure by applying ordered-window staff_schedules RPC/constraint migration, structured save errors, stale inactive cleanup, and focused/live verification; migration-history pooler path remains blocked | Codex |
| 2026-07-14 | Completed local ATTENDANCE-FLUID-OPERATIONS-001 | Make Attendance record-first with sole-open close semantics, effective branch authority, shared operational status, atomic audited review corrections, device lifecycle audit, and exactly three reports; migration apply/authenticated E2E pending | Codex |
| 2026-07-14 | Completed local ATTENDANCE-CRM-CLOSING-POLICY-001 | Integrate selected-branch Attendance Rules, effective category policy, CRM Closing operational windows, idempotent interventions, provisional auto-close, and same-row real-QR reconciliation; migration/scheduler/authenticated QA pending | Codex |
| 2026-07-15 | Completed local ATTENDANCE-SCAN-RESULTS-AND-RECORD-FIRST-001 | Record ordinary outside-hours scans with review, preserve one-scan secure phone registration, and add committed branch-local personalized success copy with a secondary review badge | Codex |
## RELEASE-READINESS-001 — Complete (conditional production verification)

- [x] Attendance launch defects and recovery assets
- [x] Consultation-only multi-person booking enforcement
- [x] Public booking/waitlist baseline abuse protection
- [x] Migration and operational verification assets
- [x] Full automated/type/lint/build validation
- [ ] Production migration, cron, database lint, authenticated browser/device, and controlled-pilot evidence

## REPO-CLEANUP-001 — Complete (conservative)

- [x] Evidence-based candidate audit and cleanup report
- [x] Confirmed unused type/debug noise removed; unfinished Owner placeholder hidden
- [x] Dormant/uncertain code and historical/operational assets retained
- [x] Dependencies reviewed; none safely removable
