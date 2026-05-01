# 📜 CHANGELOG — What Has Been Done

> APPEND ONLY. Never delete entries. Every agent adds to the bottom.

---

### 2026-04-29 — Codex (Phase 0 initialization)

**Task:** Full CradleHub project scaffold
**Files Changed:**
- `src/` — entire source tree created from scratch
- `supabase/migrations/` — 7 migration files ready for linking
- `.env.local` — environment variables configured
- All config files: tsconfig, prettier, eslint, package.json scripts

**Roadmap Items Completed:** 0.1 → 0.14
**Notes:** Supabase link + type generation happens after this commit (needs keys).
**Build Status:** ✅ Passing
### 2026-04-29 — Codex/Kimi (Sprint 1 — Server Engine)

**Task:** Complete server engine — validations, queries, engine utilities, server actions, API route
**Files Created:**
- `src/lib/validations/booking.ts` — all booking Zod schemas
- `src/lib/validations/staff.ts` — staff, schedule, override, blocked time schemas
- `src/lib/validations/service.ts` — service category, service, branch_service schemas
- `src/lib/validations/branch.ts` — branch schemas
- `src/lib/validations/customer.ts` — customer update + search schemas
- `src/lib/queries/branches.ts` — branch read functions
- `src/lib/queries/services.ts` — service read functions
- `src/lib/queries/staff.ts` — staff read functions
- `src/lib/queries/bookings.ts` — booking read functions
- `src/lib/queries/customers.ts` — customer read functions
- `src/lib/engine/availability.ts` — slot query + seniority assignment + validation
- `src/lib/engine/snapshot.ts` — price + service metadata snapshot
- `src/lib/engine/booking-time.ts` — end_time computation
- `src/app/api/booking/available-slots/route.ts` — public slots API
- `src/app/(public)/book/actions.ts` — online booking server action
- `src/app/(dashboard)/manager/walkin/actions.ts` — walk-in creation
- `src/app/(dashboard)/manager/bookings/actions.ts` — status + edit
- `src/app/(dashboard)/manager/staff/actions.ts` — schedule management
- `src/app/(dashboard)/owner/branches/actions.ts` — branch CRUD
- `src/app/(dashboard)/owner/staff/actions.ts` — staff CRUD + invite
- `src/app/(dashboard)/owner/services/actions.ts` — service + category CRUD
- `src/app/(dashboard)/staff-portal/actions.ts` — read-only own data

**Business rules encoded:**
  RULE 1  Auto-confirm: all bookings created with status='confirmed'
  RULE 2  Any-therapist: seniority assignment (Senior→Mid→Junior, then alpha)
  RULE 3  Cross-branch therapists: no branch filter on therapist pool
  RULE 4  Price snapshot: price_paid + service_name + duration_minutes in metadata
  RULE 5  30-day booking window on online bookings
  RULE 6  Phone required on all booking paths
  RULE 7  Staff-only cancellation: no public cancel route
  RULE 8  All slots returned from API (available + unavailable)
  RULE 9  Home service travel buffer defaults to 30 min
  RULE 10 Manager can edit any booking field, availability re-checked on time/staff/service change

**Build status:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 2 — Auth + Dashboard Shell)

**Files Created:**
- src/proxy.ts (renamed from middleware.ts)
- src/app/(auth)/layout.tsx
- src/app/(auth)/login/page.tsx
- src/app/(auth)/login/actions.ts
- src/app/(dashboard)/layout.tsx
- src/components/features/dashboard/nav-config.ts
- src/components/features/dashboard/sidebar.tsx
- src/components/features/dashboard/header.tsx
- src/components/features/dashboard/role-badge.tsx
- src/components/features/dashboard/page-header.tsx
- 16 placeholder dashboard pages

**Design system established:**
- Warm charcoal sidebar (#1C1917) + amber accent (#D97706)
- DM Sans typography
- Role badge colors: owner=violet, manager=amber, crm=sky, staff=green

**Build:** ✅ Passing | **Middleware warning:** ✅ Resolved

### 2026-04-29 — Kimi/Codex (Sprint 3 — Owner Workspace)

**Files Created:**
- src/app/(dashboard)/owner/page.tsx (overview dashboard)
- src/app/(dashboard)/owner/branches/page.tsx + new/page.tsx + [branchId]/page.tsx + branch-edit-form.tsx
- src/app/(dashboard)/owner/staff/page.tsx + new/page.tsx
- src/app/(dashboard)/owner/services/page.tsx
- src/app/(dashboard)/owner/bookings/page.tsx
- src/app/api/branches/route.ts
- src/components/features/dashboard/stat-card.tsx
- src/components/features/dashboard/booking-status-badge.tsx
- src/components/features/dashboard/booking-type-badge.tsx
- src/components/features/dashboard/empty-state.tsx

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 4 — Manager Workspace)

**Files Created:**
- src/app/(dashboard)/manager/page.tsx (schedule timeline)
- src/app/(dashboard)/manager/walkin/page.tsx
- src/app/(dashboard)/manager/bookings/page.tsx
- src/app/(dashboard)/manager/staff/page.tsx
- src/components/features/dashboard/schedule-timeline.tsx
- src/components/features/dashboard/booking-action-menu.tsx
- src/components/features/dashboard/walkin-form.tsx
- src/components/features/dashboard/schedule-manager.tsx
- src/components/features/dashboard/time-slot-grid.tsx
- src/app/api/manager/context/route.ts
- src/app/api/customers/lookup/route.ts

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 5 — CRM Workspace)

**Files Created:**
- src/app/(dashboard)/crm/page.tsx
- src/app/(dashboard)/crm/repeats/page.tsx
- src/app/(dashboard)/crm/lapsed/page.tsx
- src/app/(dashboard)/crm/[customerId]/page.tsx
- src/components/features/dashboard/customer-search.tsx
- src/components/features/dashboard/customer-notes-form.tsx
- src/app/api/customers/search/route.ts

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 6 — Staff Portal)

**Files Created:**
- src/app/(dashboard)/staff-portal/page.tsx
- src/app/(dashboard)/staff-portal/week/page.tsx
- src/app/(dashboard)/staff-portal/stats/page.tsx

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 7 — Online Booking Flow)

**Files Created:**
- src/app/(public)/layout.tsx
- src/app/(public)/book/page.tsx (Step 1: branch)
- src/app/(public)/book/[branchId]/page.tsx (Step 2: service)
- src/app/(public)/book/[branchId]/[serviceId]/page.tsx (Step 3: time)
- src/app/(public)/book/confirm/page.tsx (Step 4: details)
- src/app/(public)/book/success/page.tsx (confirmation)
- src/components/features/booking/booking-progress.tsx
- src/components/features/booking/slot-picker.tsx
- src/components/features/booking/booking-form.tsx

**Build:** ✅ Passing

### 2026-04-29 — Kimi/Codex (Sprint 8 — Public Website) 🎉

**Files Created:**
- src/app/page.tsx (homepage — replaced placeholder)
- src/app/(public)/services/page.tsx
- src/app/(public)/branches/page.tsx
- src/app/(public)/about/page.tsx
- src/app/(public)/contact/page.tsx
- src/components/features/public/public-nav.tsx
- src/components/features/public/public-footer.tsx
- src/components/features/public/service-card.tsx
- src/components/features/public/branch-card.tsx
- src/app/(public)/layout.tsx (updated with nav + footer)

**Build:** ✅ Passing

**STATUS: CRADLEHUB IS COMPLETE ✅**
All 8 sprints committed. System is production-ready pending data setup.

### 2026-04-30 — Kimi DevCoder (ORG-001 — Staff Organizational Structure)

**Task:** Integrate real spa org structure without breaking existing roles/RLS/booking.
**Files Changed:**
- `supabase/migrations/20260430000001_staff_org_structure.sql` — added `staff_type`, `is_head` to staff; created `staff_services` table with RLS
- `src/constants/staff.ts` — new constant/type file for staff types and labels
- `src/lib/validations/staff.ts` — added `staffType`, `isHead`, `serviceIds` to schemas
- `src/lib/queries/staff.ts` — added `staff_type`, `is_head` selects; added `getStaffServices`, `getStaffIdsByService`
- `src/lib/engine/availability.ts` — safe capability filter with legacy fallback
- `src/app/(dashboard)/owner/staff/actions.ts` — create/update now handle `staff_type`, `is_head`, `serviceIds`
- `src/app/(dashboard)/owner/staff/page.tsx` — list shows job function + head badge
- `src/app/(dashboard)/owner/staff/new/page.tsx` — passes services to form
- `src/app/(dashboard)/owner/staff/new/staff-invite-form.tsx` — added job function, head toggle, service capability checkboxes
- `src/app/(dashboard)/owner/staff/[staffId]/page.tsx` — fetches services + current staff_services
- `src/app/(dashboard)/owner/staff/[staffId]/staff-edit-form.tsx` — added job function, head toggle, service capability checkboxes
- `src/app/(dashboard)/manager/staff/page.tsx` — shows job function + head badge
- `src/app/api/public/booking-context/route.ts` — includes `staffType` and `isHead` in response
- `src/types/supabase.ts` — manually added `staff_type`, `is_head`, `staff_services` table
- `.context/DECISIONS.cmd.md` — added DEC-008

**Build Status:** ✅ Passing

### 2026-04-30 — Kimi DevCoder (ORG-002 — Demo Org/Workflow Seed Data)

**Task:** Create safe, idempotent demo seed data for org structure and booking workflow testing.

**Files Created:**
- `supabase/migrations/20260430000002_demo_org_workflow_seed.sql`
- `docs/SEED_DEMO_DATA.md`

**Files Updated:**
- `.context/CURRENT_TASK.cmd.md`
- `.context/DECISIONS.cmd.md` (DEC-009)
- `.context/ERRORS.cmd.md`
- `.context/HANDOFF.cmd.md`

**Seed coverage:**
- Branches, categories, services, branch-level pricing
- Staff org structure (`system_role`, `staff_type`, `is_head`)
- `staff_services` capability mapping
- Weekly schedules, overrides, blocked times
- Demo customers and bookings (confirmed, completed, cancelled, no_show, in_progress, home_service)

**Verification:**
- `pnpm type-check`: ✅ Passing
- `db push`: ⚠️ Blocked in this environment due Supabase CLI/DNS network limitation


### 2026-04-30 — Kimi DevCoder (Sprint 9 — UI/UX Design System Overhaul)

**Task:** Replace generic SaaS aesthetic with warm, premium spa identity inspired by Cradle Wellness Living Inc. brand reference.
**Files Changed:**
- `src/app/globals.css` — new `--cs-*` token system (warm-white, sand, clay, sage, deep-charcoal)
- `src/app/layout.tsx` — added Playfair Display font alongside DM Sans
- `src/components/features/dashboard/sidebar.tsx` — role-aware identity badge, accent color per role, left-border nav
- `src/components/features/dashboard/header.tsx` — frosted glass effect, workspace title in Playfair Display
- `src/components/features/dashboard/role-badge.tsx` — warm earth-tone badge colors
- `src/components/features/dashboard/stat-card.tsx` — Playfair Display numbers, trend indicators, floating shadow
- `src/components/features/dashboard/page-header.tsx` — icon slot, Playfair title, warm border divider
- `src/components/features/dashboard/empty-state.tsx` — warm sand icon container
- `src/app/(dashboard)/layout.tsx` — warm page background, sticky sidebar
- `src/app/(dashboard)/owner/page.tsx` — strategic owner overview with KPI grid, branch performance, quick actions
- `src/app/(auth)/login/page.tsx` — spa-luxury card with sand gradient CTA
- `src/components/features/public/public-nav.tsx` — Playfair Display brand wordmark
- All `src/app/` and `src/components/` files — migrated `var(--ch-*)` → `var(--cs-*)`

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** No new errors introduced


### 2026-05-01 — Kimi DevCoder (SCHED-001 — Daily Staff Schedule Grid)

**Task:** Build daily staff schedule view for managers and owners without touching booking logic.
**Files Created:**
- `supabase/migrations/20260501000001_get_daily_schedule.sql` — read-only RPC combining staff, schedules, bookings, blocked times
- `src/lib/queries/schedule.ts` — typed server-side wrapper around `get_daily_schedule`
- `src/lib/utils/schedule-grid.ts` — grid positioning helpers (timeToMinutes, event offsets, etc.)
- `src/components/features/schedule/staff-schedule-grid.tsx` — client component with Realtime subscription, booking blocks, blocked strips, greyed outside-hours
- `src/app/(dashboard)/owner/schedule/page.tsx` — owner schedule page with branch selector and date navigation

**Files Changed:**
- `src/app/(dashboard)/manager/schedule/page.tsx` — enhanced with date navigation, stats, and new grid
- `src/components/features/dashboard/nav-config.ts` — added Schedule link to owner workspace
- `src/types/supabase.ts` — added `get_daily_schedule` function type

**Design decisions:**
- Reused existing `ScheduleTimeline` patterns for grid layout but added work-hour greying and blocked-time visualization.
- Realtime channel refreshes server data via `router.refresh()` rather than client-side state mutation.
- Manager page auto-resolves branch from session; owner page supports branch selection.

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing

---

### 2026-05-01 — Kimi DevCoder (SCHED-002 — Row-Based Resource Timeline Board + CRM Booking Fix)

**Task:** Redesign daily schedule as a professional row-based resource timeline board. Fix CRM in-house booking error handling.

**Files Created:**
- `src/lib/utils/schedule-timeline.ts` — percent/pixel-based timeline helpers
- `src/components/features/schedule/daily-schedule-board.tsx` — main orchestrator with Realtime
- `src/components/features/schedule/schedule-time-header.tsx` — sticky horizontal time header
- `src/components/features/schedule/schedule-staff-cell.tsx` — sticky left staff info column
- `src/components/features/schedule/schedule-staff-row.tsx` — staff row with timeline lane
- `src/components/features/schedule/schedule-booking-block.tsx` — clickable booking bar with detail Dialog
- `src/components/features/schedule/schedule-blocked-time-block.tsx` — striped blocked-time bar
- `src/components/features/schedule/schedule-current-time-indicator.tsx` — gold "Now" line

**Files Changed:**
- `src/app/(dashboard)/manager/schedule/page.tsx` — simplified header, inline stats, "+ New Booking" CTA
- `src/app/(dashboard)/owner/schedule/page.tsx` — simplified header, uses DailyScheduleBoard
- `src/lib/actions/inhouse-booking.ts` — structured `{ ok, code, message }` errors, `[CRM_BOOKING_CREATE_FAILED]` logging
- `src/lib/actions/online-booking.ts` — matching `{ ok, code, message }` error shape
- `src/components/public/booking-wizard.tsx` — consumes new error shape
- `src/app/(dashboard)/crm/bookings/new/page.tsx` — removed redundant copy

**Design decisions:**
- 30-minute slots = 96px wide. Timeline spans 8:00 AM – 9:00 PM = 2496px.
- Staff cell width = 200px, sticky during horizontal scroll.
- No animation library used — CSS transitions only for hover lift on booking blocks.
- Booking colors aligned with spa theme: confirmed = forest green, in_progress = violet, completed = teal.
- Blocked times use diagonal stripes on muted beige.
- Off-duty areas shaded with semi-transparent overlay.

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** No new errors
