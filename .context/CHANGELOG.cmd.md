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


---

### 2026-05-01 — Kimi DevCoder (SCHED-003 — Compact Staff Schedule List + Detail Panel)

**Task:** Redesign staff schedule management page to scale for large teams (50–100 staff).

**Files Created:**
- `src/lib/utils/staff-schedule-summary.ts` — intelligent weekly hours summary helper
- `src/components/features/staff-schedule/staff-schedule-toolbar.tsx` — search, filter, sort toolbar
- `src/components/features/staff-schedule/staff-schedule-list.tsx` — compact table header + rows
- `src/components/features/staff-schedule/staff-schedule-row.tsx` — individual staff row with summary
- `src/components/features/staff-schedule/staff-schedule-detail-panel.tsx` — right-side Sheet with tabs
- `src/components/features/staff-schedule/staff-weekly-hours-editor.tsx` — extracted per-day editor
- `src/components/features/staff-schedule/staff-day-overrides-editor.tsx` — extracted override editor
- `src/components/features/staff-schedule/staff-block-time-editor.tsx` — extracted block time editor
- `src/components/features/staff-schedule/staff-schedule-page-client.tsx` — main client orchestrator

**Files Changed:**
- `src/app/(dashboard)/manager/staff/page.tsx` — server page now fetches data and passes to client component
- `src/components/features/dashboard/schedule-manager.tsx` — preserved but no longer used by manager staff page

**Design decisions:**
- Replaced expanded `ScheduleManager` cards (one per staff) with compact list + detail Sheet.
- List columns: Staff, Role/Tier, Weekly Hours Summary, Overrides, Blocks, Status, Action.
- Weekly hours summary logic: all-same → "daily", weekdays-only → "Weekdays", weekends-only → "Weekends", else → "Custom hours (N days)".
- Filters implemented: all, scheduled, not_scheduled, has_overrides, has_blocks, active, inactive.
- Sort: name (A–Z), tier (Senior→Mid→Junior).
- Detail panel uses shadcn Sheet from right side, tabs for Weekly Hours / Day Overrides / Block Time.
- All editors use optimistic local state updates (no Sheet close on save).
- On Sheet close, `router.refresh()` updates list summaries.
- Existing server actions preserved unchanged.

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** No new errors


---

### 2026-05-01 — Kimi DevCoder (UI-001 — Premium Service Card Grid)

**Task:** Replace flat service list with premium responsive card grid for spa service catalog manager.

**Files Created:**
- `src/components/features/services/service-image-thumbnail.tsx` — image or placeholder by name-matching SPA_IMAGES
- `src/components/features/services/service-status-toggle.tsx` — custom sliding toggle (no Switch in UI lib)
- `src/components/features/services/service-card.tsx` — full card with image, badge, stats, toggle, actions
- `src/components/features/services/service-card-skeleton.tsx` — skeleton loading state
- `src/components/features/services/services-toolbar.tsx` — search, category filter, status filter, sort
- `src/components/features/services/service-category-section.tsx` — category header + card grid
- `src/components/features/services/services-empty-state.tsx` — empty state with CTA or clear filters
- `src/components/features/services/services-page-client.tsx` — client orchestrator with filtering/sorting
- `src/app/(dashboard)/owner/services/[serviceId]/page.tsx` — edit service form

**Files Changed:**
- `src/app/(dashboard)/owner/services/page.tsx` — card grid with owner query (shows inactive)
- `src/app/(dashboard)/owner/services/actions.ts` — added `toggleServiceActiveAction`, `deleteServiceAction`
- `src/lib/validations/service.ts` — `isActive` in update schema, toggle/delete schemas
- `src/lib/queries/services.ts` — `getAllServicesForOwner()` returns all services including inactive

**Design decisions:**
- Cards use CSS grid with `repeat(auto-fill, minmax(280px, 1fr))` for responsive layout.
- Images resolved by name keyword matching against `SPA_IMAGES` constants (no DB image field).
- Placeholder: warm cream background with image icon + "No image" text.
- Inactive cards at 72% opacity with muted borders but fully readable.
- Hover: subtle lift (-2px translateY) + stronger shadow + warmer border.
- Toggle uses optimistic UI with revert on failure.
- Delete uses browser `confirm()` dialog.

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** No new errors


---

### 2026-05-01 — Kimi DevCoder (UI-002 — Premium New Service Builder)

**Task:** Redesign `/owner/services/new` from plain stacked forms into a premium service builder with live card preview.

**Files Created:**
- `src/components/features/services/service-card-preview.tsx` — live preview card that mirrors the service grid cards
- `src/app/(dashboard)/owner/services/new/service-builder-client.tsx` — full client form builder with 5 sections

**Files Changed:**
- `src/app/(dashboard)/owner/services/new/page.tsx` — pure server wrapper passing categories to client
- `src/lib/validations/service.ts` — `isActive` added to `createServiceSchema` with default `true`
- `src/app/(dashboard)/owner/services/actions.ts` — `createServiceAction` now inserts `is_active`

**Design decisions:**
- Two-column layout: form left (scrollable), preview right (sticky at top: 20px).
- Category section uses tabbed control: "Use existing category" vs "Create new category".
- Creating a new category is done inline with a button; success shown as a green banner.
- Description changed from single-line input to textarea.
- All inputs have improved placeholders and helper text.
- Visibility section shows a large toggle with active/inactive description.
- Image section shows a dashed placeholder (upload not wired yet).
- Form validation shows clear error messages per field.
- Submitting creates the service and redirects to `/owner/services`.

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** No new errors

---

### 2026-05-01 — Codex (CSR-001 — CRM Role-Based Access for CSR Head/Staff)

**Task:** Add `csr_head` and `csr_staff` access to the existing CRM workspace (no separate CSR workspace), enforce booking/customer permissions server-side, and remove manager walk-in page.

**Files Changed (high impact):**
- `src/lib/permissions.ts` (new centralized CSR/CRM permission helpers)
- `src/components/features/dashboard/nav-config.ts` (role-specific CRM/CSR sidebars)
- `src/components/features/dashboard/sidebar.tsx` (role-forced workspace nav for CRM/CSR pages)
- `src/components/features/dashboard/header.tsx`
- `src/components/features/dashboard/role-badge.tsx`
- `src/proxy.ts` (route guards for `crm`, `csr_head`, `csr_staff`)
- `src/app/(auth)/login/actions.ts` (CSR redirects to `/crm`)
- `src/app/(dashboard)/crm/actions.ts` (CSR access to CRM customer actions)
- `src/app/api/customers/search/route.ts` (CSR access for customer search)
- `src/app/(dashboard)/crm/bookings/new/page.tsx` (in-house wizard allowed for CRM/CSR/owner; manager blocked)
- `src/lib/actions/inhouse-booking.ts` (server-side role enforcement for in-house booking create)
- `src/app/(dashboard)/manager/bookings/page.tsx` (operations context + role-aware action menu)
- `src/app/(dashboard)/manager/bookings/actions.ts` (server-side checks for cancel/reassign by role)
- `src/app/(dashboard)/manager/walkin/actions.ts` (aligned operation-role allowlist)
- `src/app/(dashboard)/crm/customers/page.tsx` (CRM customers alias route)
- `src/app/(dashboard)/manager/walkin/page.tsx` (deleted; dedicated manager walk-in route removed)
- `src/app/(dashboard)/owner/staff/new/staff-invite-form.tsx` (CSR role options)
- `src/app/(dashboard)/owner/staff/[staffId]/staff-edit-form.tsx` (CSR role options)
- `src/lib/validations/staff.ts` (CSR role enum support)
- `src/types/index.ts` (expanded role constants)
- `supabase/migrations/20260501000002_csr_roles.sql` (CSR role schema updates)

**Quality/verification updates:**
- Fixed lint blockers in:
  - `src/components/features/dashboard/customer-search.tsx`
  - `src/components/features/dashboard/time-slot-grid.tsx`
  - `src/components/features/dashboard/walkin-form.tsx`
  - `src/app/(dashboard)/owner/services/new/service-builder-client.tsx`
  - `src/app/(dashboard)/owner/branches/[branchId]/branch-edit-form.tsx`
  - `src/app/(dashboard)/owner/staff/actions.ts`
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing
- `pnpm test`: ✅ Passing (after sandbox worker permission escalation)

---

### 2026-05-01 — Codex (CSR-002 — CSR Daily Operations Pages in CRM Workspace)

**Task:** Build CSR-focused operational CRM routes without creating a separate CSR workspace.

**Files Added:**
- `src/app/(dashboard)/crm/today/page.tsx`
- `src/app/(dashboard)/crm/bookings/page.tsx`
- `src/app/(dashboard)/crm/schedule/page.tsx`
- `src/components/features/dashboard/customer-create-form.tsx`

**Files Updated (high impact):**
- `src/app/(dashboard)/crm/page.tsx` (`/crm` now routes to `/crm/today`)
- `src/app/(dashboard)/crm/customers/page.tsx` (full customers operations page)
- `src/app/(dashboard)/crm/bookings/new/page.tsx` (customer prefill support + updated back nav)
- `src/components/public/booking-wizard.tsx` (supports `initialCustomer` prefill)
- `src/app/(dashboard)/crm/actions.ts` (create customer action + expanded contact update)
- `src/lib/validations/customer.ts` (create schema + phone update field)
- `src/components/features/dashboard/customer-notes-form.tsx` (edit full name/phone/email/notes)
- `src/app/(dashboard)/crm/[customerId]/page.tsx` (book-again links + customer edit wiring)
- `src/lib/queries/bookings.ts` (`getAllBookings` adds `staffId` filter)
- `src/components/features/dashboard/nav-config.ts` (CSR/CRM nav now points to CRM-native operational routes)
- `src/app/(dashboard)/crm/repeats/page.tsx` and `src/app/(dashboard)/crm/lapsed/page.tsx` (customers tab path updates)

**Outcome:**
- Added `/crm/today` with:
  - quick actions
  - daily stats
  - next appointment
  - booking queue
  - home-service queue
  - recent customer updates/notes
- Added `/crm/bookings` with date/status/type/therapist filters and role-safe booking actions.
- Added `/crm/schedule` as CSR-facing availability view reusing existing schedule board.
- Added usable `/crm/customers` flow:
  - fast search
  - create customer
  - edit basic contact details
  - start new booking from customer context

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** ✅ Passing | **Tests:** ✅ Passing

---

### 2026-05-01 — Kimi DevCoder (CSR-001 — CRM Role-Based Access + CSR Daily Operations Pages)

**Task:** Add `csr_head` and `csr_staff` system_role values with centralized RBAC, role-based navigation, middleware route guards, and CSR-focused CRM operational pages.

**Files Created:**
- `src/lib/permissions.ts` — Centralized RBAC: role constants, permission helpers (canCreateBooking, canCancelBooking, canReassignBooking, etc.), nav filtering, route access rules
- `supabase/migrations/20260501000002_csr_roles.sql` — DB migration expanding system_role CHECK constraint to include `csr_head` and `csr_staff`; updates role_definitions and job_title_definitions
- `src/app/(dashboard)/crm/today/page.tsx` — CSR daily operations queue: stats, next appointment highlight, today's booking queue, home service bookings, day progress panel, quick actions
- `src/app/(dashboard)/crm/bookings/page.tsx` — Filterable booking list for CSR with date, status, and type filters
- `src/app/(dashboard)/crm/customers/page.tsx` — Customer list with search, pagination, segment badges, quick book action
- `src/app/(dashboard)/crm/schedule/page.tsx` — Schedule view reusing DailyScheduleBoard with date navigation and inline stats

**Files Changed:**
- `src/components/features/dashboard/nav-config.ts` — Added CSR-specific nav configs (csr_head: Today/Bookings/Customers/Schedule/Reports Lite; csr_staff: Today/Bookings/Customers/Schedule)
- `src/components/features/dashboard/sidebar.tsx` — Added workspace meta for csr_head and csr_staff with distinct accent colors and icons
- `src/components/features/dashboard/role-badge.tsx` — Added badge styles for csr_head and csr_staff
- `src/app/globals.css` — Added `--cs-csr-head-*` and `--cs-csr-staff-*` CSS tokens
- `src/proxy.ts` — Middleware: CSR roles default to `/crm`; allowed into `/crm/*`, `/manager/schedule`, `/manager/bookings`, `/manager/walkin`; blocked from `/owner`, `/dev`, `/manager/staff`, `/manager/operations`, `/manager/reports`
- `src/lib/actions/inhouse-booking.ts` — Expanded allowed roles for booking creation to include all CSR variants
- `src/app/(dashboard)/manager/bookings/actions.ts` — Granular permissions: updateBookingStatusAction blocks cancel for CSR Staff; editBookingAction blocks reassign for CSR Staff
- `src/app/(dashboard)/manager/walkin/actions.ts` — Expanded allowed roles for walk-in creation
- `src/app/(dashboard)/crm/bookings/new/page.tsx` — Expanded allowed roles for in-house booking wizard
- `src/app/(dashboard)/crm/page.tsx` — Redirects all users to `/crm/today`

**Design Decisions:**
- No separate CSR workspace created — all pages live under `/crm/*` and reuse existing components
- `/crm/today` serves as the primary CSR dashboard with operational focus (queue-centric, not analytics-centric)
- Permission checks enforced server-side in actions, not just UI hiding
- Existing `csr` role treated as backward-compatible alias for `csr_staff`
- CSS tokens follow existing warm spa palette with slightly darker accent for CSR Head to distinguish supervisor level

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** ✅ Passing (0 errors, 0 warnings)

---

### 2026-05-01 — Kimi DevCoder (DEV-001 — Fix Dev Auth Bypass for Staff Portal)

**Task:** Create centralized dev auth bypass helper and apply it consistently across middleware, layout, page guards, and server actions so developers can test all dashboard pages without a linked staff record.

**Files Created:**
- `src/lib/dev-bypass.ts` — Centralized helper: `isDevAuthBypassEnabled()`, `getDevBypassLayoutStaff()`, `getDevBypassStaffRecord()`, `devBypassAuthMessage()`
- `tests/lib/dev-bypass.test.ts` — 10 tests for bypass logic, mock shapes, and auth messages

**Files Changed:**
- `src/proxy.ts` — Uses `isDevAuthBypassEnabled()` instead of inline env checks
- `src/app/(auth)/login/actions.ts` — Uses centralized helper for login redirect fallback
- `src/app/(dashboard)/layout.tsx` — Falls back to mock staff profile when bypass is active
- `src/app/(dashboard)/staff-portal/actions.ts` — Returns mock staff + empty data instead of "Unauthorized"
- `src/app/(dashboard)/crm/**/page.tsx` (today, bookings, customers, schedule) — Dev bypass in page guards
- `src/app/(dashboard)/manager/**/page.tsx` (today, schedule, bookings) — Dev bypass in page guards
- `src/app/(dashboard)/owner/*/actions.ts` (services, branches, staff, bookings) — Dev bypass in `requireOwner()` / `requireOwnerOrManager()`
- `src/app/(dashboard)/crm/actions.ts` — Dev bypass in `requireCrmAccess()`
- `src/app/(dashboard)/manager/*/actions.ts` (walkin, staff, bookings) — Dev bypass in auth helpers
- `src/lib/actions/inhouse-booking.ts` — Dev bypass with explicit branchId requirement for safety

**Design Decisions:**
- `DEV_AUTH_BYPASS` is the canonical env var; `DEV_ALLOW_ALL_MODULES` is still supported for backward compatibility
- Mock staff uses `system_role: "owner"` for layout (nav items come from pathname, not role)
- Mock staff uses `system_role: "staff"` for staff portal actions (realistic for testing)
- Server actions that require a real branch_id (walk-in booking) show a helpful error instead of silently failing
- Production is never bypassed — helper returns false regardless of env flags when `NODE_ENV === "production"`

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** ✅ Passing | **Tests:** ✅ 18 passed


---

### 2026-05-01 � Kimi DevCoder (STAFF-003 � Home Service Tracking Workflow Refinement)

**Task:** Refine home-service tracking with explicit status column, typed server actions, state machine helpers, progress stepper UI, and tests.

**Files Created:**
- src/lib/home-service-tracking.ts � pure state machine helpers (getNext, canTransition, getLabel, isComplete, getTimestampField)
- 	ests/lib/home-service-tracking.test.ts � 18 tests covering all valid/blocked transitions

**Files Changed:**
- supabase/migrations/20260501000003_home_service_tracking.sql � added home_service_tracking_status TEXT NOT NULL DEFAULT 'not_started' with CHECK constraint; updated RPC to set status alongside timestamps
- src/types/supabase.ts � added home_service_tracking_status to bookings Row/Insert/Update
- src/app/(dashboard)/staff-portal/actions.ts � rewrote updateHomeServiceTrackingAction with typed HomeServiceTrackingResult (ok: true | false with specific error codes: UNAUTHORIZED, NOT_FOUND, NOT_HOME_SERVICE, ALREADY_COMPLETED, INVALID_TRANSITION, DATABASE_ERROR); added server-side pre-validation before RPC call
- src/components/features/staff-portal/types.ts � updated to use HomeServiceTrackingStatus from @/lib/home-service-tracking; simplified getTrackingStage/getNextTrackingStage/isTrackingComplete to read from status column
- src/components/features/staff-portal/tracking-timer.tsx � added TimestampLabel component for static timestamps; TrackingTimer now takes explicit label prop
- src/components/features/staff-portal/home-service-tracking-actions.tsx � replaced 4-button grid with compact stepper (? Travel � ? Arrived � ? Session � ? Complete) + single primary action button for next step + status-specific labels (Travel active, Arrived at 3:22 PM, Session active, Completed at 4:35 PM)
- src/components/features/staff-portal/staff-appointment-card.tsx � removed old timer/tracking inline logic; now delegates all tracking UI to HomeServiceTrackingActions

**Design Decisions:**
- Kept RPC with SECURITY DEFINER for actual UPDATE (staff still lack direct booking UPDATE RLS)
- Added server-side pre-validation in action for friendly typed errors before hitting RPC
- Single primary action button pattern (not 4 buttons) � cleaner on mobile
- Stepper uses filled dots for completed stages, accent dot for current, hollow dots for pending
- Timer shows either travel timer or session timer depending on current stage

**Build Status:** ? Passing | **Type-check:** ? Passing | **Lint:** ? Passing (0 errors, 0 warnings) | **Tests:** ? 36 passed



---

### 2026-05-01 � Kimi DevCoder (STAFF-004 � Unified Booking Progress Tracking)

**Task:** Refactor home-service-only tracking into a unified appointment progress model supporting home_service, walkin (in-spa), and online bookings.

**Files Created:**
- supabase/migrations/20260501000004_unified_booking_progress.sql � adds ooking_progress_status (CHECK constraint), checked_in_at, session_completed_at, 
o_show_at; backfills from home_service_tracking_status and completed_at; replaces RPC with update_booking_progress() that validates type-aware transitions
- src/lib/bookings/progress.ts � pure state machine helpers: getBookingProgressFlow, canTransitionBookingProgress, getNextAllowedProgressActions, getNextBookingProgressStatus, getBookingProgressLabel, isBookingProgressTerminal, getTimestampFieldForProgressStatus
- 	ests/lib/bookings/progress.test.ts � 28 tests covering all three booking type flows, blocked transitions, labels, timestamps
- src/components/features/staff-portal/booking-progress-actions.tsx � unified progress UI with type-specific stepper, status labels, timer, and action buttons

**Files Changed:**
- src/types/supabase.ts � added ooking_progress_status, checked_in_at, session_completed_at, 
o_show_at to bookings Row/Insert/Update; added update_booking_progress RPC type
- src/app/(dashboard)/staff-portal/actions.ts � replaced updateHomeServiceTrackingAction with updateBookingProgressAction({ bookingId, nextStatus }); added role-aware permission checks (therapist actions vs CSR actions); uses new update_booking_progress RPC
- src/components/features/staff-portal/types.ts � updated StaffPortalBooking to use BookingProgressStatus and include all new timestamp fields
- src/components/features/staff-portal/staff-appointment-card.tsx � replaced HomeServiceTrackingActions with BookingProgressActions for all booking types
- src/components/features/staff-portal/tracking-timer.tsx � added TimestampLabel component for static timestamps

**Files Removed:**
- src/components/features/staff-portal/home-service-tracking-actions.tsx � superseded by ooking-progress-actions.tsx

**Design Decisions:**
- Old columns (home_service_tracking_status, completed_at) preserved but no longer written by new code; migration backfills new columns from old ones
- RPC update_booking_progress enforces type-aware transitions at the database level (home_service vs walkin vs online)
- Server action adds role-aware pre-validation: therapist actions (travel/arrived/session/complete) require assigned staff or manager; CSR actions (check-in/no-show) require CSR, manager, or assigned staff
- Walk-in bookings show both primary next action and a secondary No Show button when applicable
- Progress stepper adapts to booking type (home_service shows 4 stages, walkin shows 3, online shows 2)

**Build Status:** ? Passing | **Type-check:** ? Passing | **Lint:** ? Passing (0 errors, 0 warnings) | **Tests:** ? 64 passed


---

### 2026-05-01 — Codex (STAFF-005 — My Week Mobile Accordion + Day-Card Refinement)

**Task:** Improve staff portal `My Week` mobile UX and day-card presentation for a premium weekly planner experience.

**Files Created:**
- `src/lib/staff-portal/week-summary.ts` — reusable helpers for day grouping, minutes/hours formatting, appointment count text, weekly stats derivation, and default expanded mobile day selection

**Files Changed:**
- `src/lib/staff-portal/week.ts`
  - Expanded appointment shape with `bookingType`, `status`, and day-level `totalMinutes`
  - Added `dayLabel` / `dayNumber` fields for UI mapping
  - Kept all data scoped to current logged-in staff bookings from existing action
- `src/components/features/staff-portal/mobile-week-accordion.tsx`
  - Converted to client-managed accordion state
  - Default expanded logic: today with appointments, else next available day with appointments, else all collapsed
- `src/components/features/staff-portal/mobile-week-day-row.tsx`
  - Rebuilt rows as accessible buttons with `aria-expanded`, `aria-controls`, and explicit action labels
  - Added compact collapsed-row meta and empty-day leaf indicator
  - Added animated expand/collapse panel with light transition
- `src/components/features/staff-portal/week-appointment-item.tsx`
  - Mobile-priority compact layout: time → customer → service → booking type badge → status badge → note hint
  - Added status badges (`Pending`, `Confirmed`, `In Progress`, `Completed`, `Cancelled`, `No Show`)
- `src/components/features/staff-portal/week-day-card.tsx`
  - Updated metadata rendering to use helper-based count/hours formatting and day-number mapping
- `src/components/features/staff-portal/my-week-header.tsx`
  - Compact mobile header structure with optional calendar button
  - Dedicated week navigation row: prev / center current-week pill / next
- `src/components/features/staff-portal/my-week-stats.tsx`
  - Compact 4-stat strip labels for mobile (`Total`, `Home`, `In-Spa`, `Hours`)
- `src/components/features/staff-portal/my-week-page.module.css`
  - Sticky compact mobile header
  - Compact stats strip sizing
  - Touch-friendly accordion row sizing
  - Today row highlight treatment
  - Appointment and badge styling improvements
  - Lightweight panel transition

**Verification:**
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅
- `pnpm test` ✅

### 2026-05-01 — Codex (BRAND-001 — Real Cradle Logo Implementation Across Public/Auth/Dashboard)

**Task:** Replace placeholder/incorrect logo renderings with the real Cradle logo and unify usage through a reusable shared component.

**Files Created:**
- `src/components/shared/brand-logo.tsx` — reusable `BrandLogo` component using `/images/images/cradle-logo.png`, intrinsic 2172x724 ratio, responsive sizing, and `object-contain`

**Files Changed:**
- `src/components/public/site-header.tsx` — replaced direct image usage with `BrandLogo`; improved hero-mode contrast with intentional compact cream container (no fake placeholder box)
- `src/components/public/site-footer.tsx` — replaced direct image usage with `BrandLogo`; added content-hugging cream container for contrast on dark footer
- `src/app/(auth)/login/page.tsx` — replaced desktop/mobile logo usage with `BrandLogo`; added intentional compact cream container on dark left panel
- `src/components/features/dashboard/sidebar.tsx` — replaced sidebar placeholder `C` mark with real `BrandLogo` in brand area

**Verification:**
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅

### 2026-05-01 — Codex (BRAND-002 — Gold Premium Logo Rollout)

**Task:** Replace old/legacy logo implementation with the newly approved gold premium logo and activate it across website + portal UI.

**Files Created / Added:**
- `public/images/brand/cradle-logo-gold.png` (copied from approved source image)

**Files Changed:**
- `src/components/shared/brand-logo.tsx`
  - Updated source to `/images/brand/cradle-logo-gold.png`
  - New API: `size?: "sm" | "md" | "lg"`, `withCard?: boolean`, `priority?: boolean`
  - Preserved aspect ratio with `object-contain` and responsive sizing
- `src/components/public/site-header.tsx`
  - Replaced logo usage with `BrandLogo` (`size="md"`, `withCard`)
- `src/components/public/site-footer.tsx`
  - Replaced footer brand slot with `BrandLogo` (`size="md"`, `withCard`)
- `src/app/(auth)/login/page.tsx`
  - Replaced desktop/mobile auth branding logo with `BrandLogo` (`size="lg"` desktop, `size="md"` mobile, both with card)
- `src/components/features/dashboard/sidebar.tsx`
  - Replaced sidebar brand slot with `BrandLogo` (`size="sm"`, `withCard`)

**Verification:**
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅

**Checks:**
- No remaining `/images/images/cradle-logo.png` references in `src/**`

### 2026-05-02 — Codex (BRAND-003 — PNG to Real SVG Logo System)

**Task:** Convert approved Cradle PNG logo into real vector SVG assets and roll out an SVG-based reusable brand logo system across web + portal surfaces.

**Files Created / Added:**
- `src/assets/brand/cradle-logo-horizontal.svg` (real vector paths, transparent background)
- `src/assets/brand/cradle-logo-mark.svg` (real vector paths, icon-only variant)
- `public/images/brand/cradle-logo-horizontal.svg` (public copy)
- `public/images/brand/cradle-logo-mark.svg` (public copy)
- `public/images/brand/cradle-logo-horizontal.png` (trimmed fallback)
- `public/images/brand/cradle-logo-mark.png` (trimmed fallback)
- `scripts/generate-brand-logo-assets.mjs` (repeatable PNG→SVG/PNG asset generator)
- `src/types/svg.d.ts` (TypeScript SVG module typing)

**Files Changed:**
- `next.config.ts`
  - Added Next.js 16 Turbopack SVG loader rule via `turbopack.rules["*.svg"] -> @svgr/webpack`
  - Removed custom webpack hook to keep `next build` Turbopack-compatible
- `src/components/shared/brand-logo.tsx`
  - Migrated from `next/image` PNG usage to SVG React component usage
  - New API: `mode?: "horizontal" | "mark"`, `size?: "sm" | "md" | "lg"`, `className?: string`
  - Default uses horizontal SVG and preserves aspect ratio with responsive width classes
- `src/components/public/site-header.tsx`
  - Updated to SVG-based `BrandLogo` (removed PNG-era wrapper props)
- `src/components/public/site-footer.tsx`
  - Updated to SVG-based `BrandLogo`
- `src/app/(auth)/login/page.tsx`
  - Updated desktop/mobile auth branding to SVG-based `BrandLogo`
- `src/components/features/dashboard/sidebar.tsx`
  - Updated sidebar brand area to SVG-based `BrandLogo`

**Verification:**
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅
- `pnpm test` ✅ (64 passed)

**Notes:**
- SVG outputs are true vector path-based assets (no embedded `<image>`/base64 raster payloads).
- Legacy UI usage of `/images/images/cradle-logo.png` and `/images/brand/cradle-logo-gold.png` has been replaced with reusable SVG component usage.

---

### 2026-05-02 — Codex (PAY-001 — Payment Recording + Daily Cash Summary)

**Task:** Add real-time payment recording to all booking management surfaces and a daily cash summary KPI for managers and owners.

**Migration:**
- `supabase/migrations/20260502000002_payment_fields.sql` — adds 4 columns to bookings (`payment_method TEXT NOT NULL DEFAULT 'pay_on_site'`, `payment_status TEXT NOT NULL DEFAULT 'unpaid'`, `payment_reference TEXT`, `amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0`); 2 composite indexes for cash summary queries

**Types:**
- `src/types/supabase.ts` — added `amount_paid`, `payment_method`, `payment_reference`, `payment_status` to bookings `Row`, `Insert`, `Update`

**Validations:**
- `src/lib/validations/booking.ts` — added `PAYMENT_METHODS`, `PAYMENT_STATUSES` const arrays, `PAYMENT_METHOD_LABELS` record, `updateBookingPaymentSchema`, `UpdateBookingPaymentInput`

**Queries:**
- `src/lib/queries/bookings.ts` — updated `BOOKING_SELECT` + `getTodaysSchedule` to include payment fields; added `getDailyPaymentSummary(branchId, date)` returning totals + method breakdown
- `src/lib/queries/analytics.ts` — added `getCrossbranchCashSummary(fromDate, toDate, branchId?)` for owner-level cross-branch reporting

**Server Actions:**
- `src/app/(dashboard)/manager/bookings/actions.ts` — added `updateBookingPaymentAction(rawInput)` (CSR/manager roles; never touches booking status)
- `src/app/(dashboard)/owner/bookings/actions.ts` — added `getCashSummaryAction(fromDate, toDate, branchId?)`, `ownerUpdateBookingPaymentAction(rawInput)`

**Components Created:**
- `src/components/features/dashboard/payment-status-badge.tsx` — Paid/Unpaid/Pending/Refunded badge
- `src/components/features/dashboard/payment-method-badge.tsx` — Cash/GCash/Maya/Card/Pay on Site/Other label badge
- `src/components/features/dashboard/payment-action-menu.tsx` — client component with quick-pay dropdown (Cash/GCash/Maya/Card one-tap) + full edit form
- `src/components/features/dashboard/daily-cash-summary.tsx` — KPI row: Expected / Collected (green) / Outstanding (red); method breakdown pills

**Pages Updated:**
- `src/app/(dashboard)/manager/bookings/page.tsx` — payment badges + `PaymentActionMenu` per row + `DailyCashSummary` above list
- `src/app/(dashboard)/crm/bookings/page.tsx` — same payment integration for CSR staff
- `src/app/(dashboard)/owner/bookings/page.tsx` — payment badges (read-only)
- `src/app/(dashboard)/owner/reports/page.tsx` — `DailyCashSummary` pinned above analytics charts
- `src/app/(dashboard)/layout.tsx` — explicit `LayoutStaff` type + cast to fix pre-existing avatar_url type error from avatar task
- `src/lib/dev-bypass.ts` — added `avatar_url: string | null` to `getDevBypassLayoutStaff()` return type and value

**Business Rule Enforced:**
- Paying a booking NEVER changes its `status` column — `updateBookingPaymentAction` writes only payment columns

**Verification:**
- `pnpm type-check` ✅ (0 errors)
- `pnpm lint` ✅ (0 errors, 0 warnings)
- `pnpm build` ✅ (51/51 pages)

---

### 2026-05-05 — Gemini (CRADLE-SPACES-001 — Branch Spaces & Room Assignment)

**Task:** Implement branch-level bookable spaces (rooms, beds, chairs) and physical resource assignment for bookings to prevent collisions.

**Migrations:**
- `supabase/migrations/20260505000001_branch_resources.sql` — created `branch_resources` table with types (room, bed, chair, etc.), capacity, and RLS; added `resource_id` to `bookings` table.
- `supabase/migrations/20260505000002_update_get_daily_schedule.sql` — updated `get_daily_schedule` RPC to include `resource_id` and `resource_name` in booking objects.

**Types:**
- `src/types/supabase.ts` — added `branch_resources` table types and `resource_id` to `bookings`.
- `src/components/features/staff-portal/types.ts` — added `branch_resources` to `StaffPortalBooking`.
- `src/lib/queries/schedule.ts` — updated `DailyScheduleBooking` type.

**Logic & Engine:**
- `src/lib/engine/resource-availability.ts` — added `isResourceAvailable` helper to check capacity overlaps (ignoring cancelled/no_show).
- `src/app/api/manager/resource-check/route.ts` — new API for real-time room availability checking from the UI.
- `src/app/api/manager/context/route.ts` — updated to include active branch resources.

**Server Actions:**
- `src/app/(dashboard)/owner/branches/resources-actions.ts` — new file for branch resource CRUD (Owner/Manager roles).
- `src/app/(dashboard)/manager/walkin/actions.ts` — updated `createWalkinBookingAction` to include `resourceId` and enforce resource availability.
- `src/lib/actions/inhouse-booking.ts` — updated `createInhouseBookingMultiAction` to support resource assignment and conflict checking across multiple services.
- `src/app/(dashboard)/manager/bookings/actions.ts` — updated `editBookingAction` to support assigning/changing rooms after creation with conflict checks.

**UI Components:**
- `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx` — new management UI for branch spaces with add/edit/toggle-active features.
- `src/components/features/dashboard/walkin-form.tsx` — added "Assign Space" dropdown with real-time conflict warning.
- `src/components/features/schedule/schedule-booking-block.tsx` — booking blocks now show assigned room name; details dialog includes "Room / Bed Assignment" controls for post-booking management.
- `src/components/features/staff-portal/staff-appointment-card.tsx` — therapists now see their assigned room directly on their schedule card.

**Pages Updated:**
- `src/app/(dashboard)/owner/branches/[branchId]/page.tsx` — integrated `BranchResourcesManager`.
- `src/app/(dashboard)/manager/schedule/page.tsx`, `src/app/(dashboard)/owner/schedule/page.tsx`, `src/app/(dashboard)/crm/schedule/page.tsx` — all schedule views now fetch and pass branch resources for assignment capability.

**Business Rule enforced:**
- Physical space collisions are blocked during creation/edit if capacity is exceeded.
- Home Service bookings bypass room requirement.

**Verification:**
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅ (52/52 pages)

---

### 2026-05-05 — Gemini (CRADLE-SPACES-AUTO-001 — Auto Room Assignment)

**Task:** Automate room assignment on booking confirmation and update public booking flow to start as 'pending'.

**Logic & Engine:**
- `src/lib/engine/resource-availability.ts` — added `autoAssignBookingResource` to find the first available space for a given branch/time range.
- `src/app/(dashboard)/manager/bookings/actions.ts` — updated `updateBookingStatusAction` to trigger `autoAssignBookingResource` when status moves to `confirmed`.
- `src/lib/actions/online-booking.ts` — changed initial status of online bookings to `pending` (multi-service supported).
- `src/app/(dashboard)/manager/walkin/actions.ts` — added auto-assignment fallback if no resource is manually selected.
- `src/lib/actions/inhouse-booking.ts` — added auto-assignment for multi-service CRM bookings, ensuring the same room is kept for the entire combined duration.

**UI Components:**
- `src/components/features/dashboard/booking-action-menu.tsx` — added "Confirm" action for `pending` bookings.
- `src/app/(dashboard)/crm/bookings/page.tsx` — added `BookingActionMenu` to the CRM list view so CSR can confirm bookings.
- `src/components/public/booking-wizard.tsx` — updated success step messaging for public bookings ("Booking Received" instead of "Confirmed").

**Validation:**
- `src/lib/validations/booking.ts` — added `confirmed` to allowed status transitions in `updateBookingStatusSchema`.

**Verification:**
- `pnpm type-check` ✅
- `pnpm lint` ✅
- `pnpm build` ✅ (52/52 pages)

---

### 2026-05-09 — Codex (STABILITY-001 — Workspace Stabilization Audit and Fix Pass)

**Task:** Audit public and workspace routes, identify stabilization risks, fix workflow blockers only, and verify the app remains buildable.

**Route / workflow audit completed:**
- Public: `/`, `/services`, `/branches`, `/about`, `/contact`, `/book`, `/staff-onboarding`, plus existing `/products` and legacy booking guide routes.
- Owner: dashboard, bookings, branches, branch details/rules/resources, services, staff, onboarding, marketing, notifications, reports, schedule.
- Manager: dashboard/today, schedule, bookings, staff, onboarding, resources, operations, settings, reports, notifications.
- CRM: root redirect, today, bookings, new booking, customers, customer detail, schedule, waitlist, reconciliation, repeats, lapsed, notifications.
- Staff: portal/today, week, stats, profile, notifications.
- Specialized: `/driver`, `/utility`, `/dev`.

**Files Changed:**
- `.context/CURRENT_TASK.cmd.md` — switched active task to STABILITY-001 and logged audit/fix status.
- `.context/ERRORS.cmd.md` — logged stabilization issues, Vitest sandbox worker blocker, and interrupted server cleanup.
- `.context/HANDOFF.cmd.md` — updated handoff for the stabilization pass.
- `docs/ARCHITECTURE.md` — corrected auth guard reference from `src/middleware.ts` to `src/proxy.ts`.
- `docs/PROJECT_CONTEXT.md` — updated current status and latest agent update.
- `docs/ROADMAP.md` — added stabilization audit log entry.
- `src/app/(dashboard)/manager/today/page.tsx` — added redirect alias to `/manager`.
- `src/app/(dashboard)/staff-portal/today/page.tsx` — added redirect alias to `/staff-portal`.
- `src/app/(public)/book/success/page.tsx` — changed booking success copy from confirmed to request-received language.
- `src/components/features/notifications/notification-bell.tsx` — fixed unread count refresh to use the full unread count and redirected driver/utility notification links to existing panels.

**Bugs Fixed:**
- Public booking success page incorrectly implied online bookings were confirmed immediately, while current online booking behavior creates pending/front-desk-reviewed requests.
- Notification bell could undercount unread notifications after opening the popover because it derived the badge from only the limited popover result set.
- Driver and utility notification "View all" links pointed to missing `/driver/notifications` and `/utility/notifications` routes.
- `/manager/today` and `/staff-portal/today` were missing even though the audit checklist called them out as workspace Today routes.
- Architecture docs referenced the deprecated/missing `src/middleware.ts` instead of the active Next.js 16 `src/proxy.ts`.

**Verification:**
- `pnpm lint`: passing.
- `pnpm type-check`: passing.
- `pnpm test`: passing, 70 tests after elevated rerun for the known sandbox `spawn EPERM` worker issue.
- `pnpm build`: passing, 68 app routes.
- Public HTTP checks returned 200 for `/`, `/services`, `/branches`, `/about`, `/contact`, `/book`, `/book/confirm`, `/book/success`, `/products`, `/staff-onboarding`, and `/login`.
- Unauthenticated protected route checks returned redirects for owner, manager, CRM, staff portal, driver, utility, and dev routes.

**Scope Confirmation:**
- No new features added.
- No database schema or migration changes.
- No booking logic, CRM logic, Supabase booking rules, or RLS policy changes.
- No new dependencies.

---

### 2026-05-09 — Codex (STAFF-BRANCH-001 — Group Staff by Branch in Owner Staff Page)

**Task:** Surface branch separation in the owner staff management page — both Active Staff and Pending Staff views now group staff under branch section headings with a count badge.

**Files Changed:**
- `src/app/(dashboard)/owner/staff/page.tsx`
  - Added `BranchGroup` local type.
  - Extracted `groupStaffByBranch(staff)` helper: groups by `branch_id`, sorts branches alphabetically, puts "Unassigned Branch" last.
  - Changed `readBranchName` null fallback from "Unknown branch" to "Unassigned Branch".
  - Replaced inline `groupsMap` block for active staff with `groupStaffByBranch`.
  - Added count badge to each active staff branch section heading.
  - Applied `groupStaffByBranch` to pending staff — replaced flat "Awaiting Approval" / "Invites Sent" top-level sections with branch-level sections; each branch section shows claimed (linkable, "Review & Approve") and unclaimed ("Not claimed") rows in their query order (created_at desc).

**Behavior:**
- Active Staff: staff are grouped under named branch headings with count badge; unassigned staff go under "Unassigned Branch" sorted last; inactive staff remain visible with "Inactive" badge at 0.5 opacity.
- Pending Staff: pending staff are grouped under named branch headings with count badge; each row retains its "Review & Approve" (claimed) or "Not claimed" (unclaimed) badge; empty state unchanged.
- Staff with null branch_id are safely handled as "Unassigned Branch" — no crash.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

### 2026-05-13 — Codex (RBAC-001 — Align Cradle Staff Roles with Workspace Access)

**Task:** Implement the smallest safe RBAC forward-fix to align the real Cradle org structure with workspace routing. Four phases: schema fix, permission helpers, real staff seed, hardcoded role audit.

**Files Created:**

- `supabase/migrations/20260513000001_rbac_role_constraint_fix.sql`
  — Drops and re-creates `staff_system_role_check` with the full role set:
  `owner`, `manager`, `assistant_manager`, `store_manager`, `crm`, `csr`, `csr_head`, `csr_staff`, `staff`, `service_head`, `service_staff`, `driver`, `utility`.
  Fixes the migration conflict where 20260429000009 added `assistant_manager`/`store_manager` but 20260501000002 dropped them.

- `supabase/migrations/20260513000002_real_staff_rbac_seed.sql`
  — Seeds Anna Liza F. Lacson (owner). Updates all existing staff records seeded by migration 010 to use precise `system_role` and `staff_type` values: `csr_head`/`csr_staff` for CSR team, `service_head`/`service_staff` for salon/therapy dept, `driver` for drivers, `utility` for housekeeping.

**Files Changed:**

- `src/lib/permissions.ts`
  — `SYSTEM_ROLES`: added `assistant_manager`, `store_manager`, `service_head`, `service_staff`, `driver`, `utility`.
  — `MANAGERS` constant: added `assistant_manager`, `store_manager` so `isManager()` covers all manager variants.
  — `ROLE_LABELS`: labels for all new roles.
  — `getDefaultDashboardPath()`: added cases for `driver` → `/driver`, `utility` → `/utility`; `service_head`/`service_staff` fall through to `/staff-portal`.

- `src/proxy.ts`
  — `resolveWorkspace()`: added `assistant_manager`, `store_manager` → `/manager`; `service_head`, `service_staff` → `/staff-portal`; `driver` → `/driver`; `utility` → `/utility`.

- `src/app/(dashboard)/owner/staff/actions.ts`
  — `requireOwnerOrManager` inline check: added `assistant_manager`, `store_manager`.
  — Branch invite restriction: extended to all non-owner manager variants.
  — Branch update restriction: extended to all non-owner manager variants.

- `src/app/(dashboard)/owner/branches/actions.ts`
  — `requireOwnerOrBranchManager`: extended `manager` check to include `assistant_manager`, `store_manager`.

- `src/app/(dashboard)/owner/branches/resources-actions.ts`
  — `requireOwnerOrManager`: extended `manager` check to include `assistant_manager`, `store_manager`.

- `src/app/(dashboard)/manager/bookings/actions.ts`
  — `getOperationsContext` `allowedRoles`: added `assistant_manager`, `store_manager`.

- `src/lib/actions/inhouse-booking.ts`
  — `bookingRoles`: added `assistant_manager`, `store_manager`.

- `src/lib/queries/branch-booking-rules.ts`
  — `canManageBranchBookingRules`: extended `manager` check to include `assistant_manager`, `store_manager`.

- `src/app/(dashboard)/driver/page.tsx`
  — `requireDriverAccess`: allows `driver` role in addition to `owner`.

- `src/app/(dashboard)/utility/page.tsx`
  — `requireUtilityAccess`: allows `utility` role in addition to `owner`.

**Known migration conflict (documented, not fixed here):**
On a fresh `db reset`, migration 20260501000002 may fail row validation because migration 010 inserts `assistant_manager`/`store_manager` rows before 20260501000002 removes those values from the CHECK. The forward-fix migration (20260513000001) resolves this on running instances. Fresh-reset recovery requires manual intervention or editing 20260501000002 (not done here per the immutable-migrations rule).

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

---

### 2026-05-09 — Codex (STAFF-UI-001 — Staff Management Workspace Redesign)

**Task:** Rebuild the owner Staff Management workspace UI to match the approved dashboard layout while preserving existing data, actions, RBAC/auth, booking logic, active/pending/invite behavior, and branch grouping.

**Files Changed:**
- `src/app/(dashboard)/owner/staff/page.tsx` — thin server page fetching existing staff data and rendering the new workspace.
- `src/components/features/staff/staff-management-workspace.tsx` — new workspace layout orchestration.
- `src/components/features/staff/staff-management-utils.ts` — branch grouping, filtering, status, and role/title display helpers.
- `src/components/features/staff/staff-stats-cards.tsx` — KPI cards.
- `src/components/features/staff/staff-filter-bar.tsx` — search and filters.
- `src/components/features/staff/staff-tabs.tsx` — Active/Pending segmented tabs.
- `src/components/features/staff/staff-branch-section.tsx` — branch grouped table shell.
- `src/components/features/staff/staff-table-row.tsx` — dense staff table rows with row actions.
- `src/components/features/staff/staff-preview-panel.tsx` — selected staff profile and quick actions rail.
- `src/components/features/staff/staff-badges.tsx` — status and role badges.
- `src/components/features/staff/staff-empty-list.tsx` — empty state.
- `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `.context/ERRORS.cmd.md` — updated task docs and execution notes.

**Behavior:**
- Active Staff and Pending tabs remain separate.
- Branch grouping applies after search/filtering.
- Staff with missing branch data render under `Unassigned Branch`.
- Existing invite/edit/review action routes are preserved.
- Managers/admin/support roles no longer display therapist tier text; tier only appears for eligible therapist rows.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

---

### 2026-05-09 — Codex (STAFF-TIER-001 — Staff Display Tier Eligibility Fix)

**Task:** Fix Staff page role/tier subtitles so therapist/service tier labels only appear for staff types that actually use tiers.

**Files Changed:**
- `src/components/features/staff/staff-management-utils.ts`
  - Added typed `StaffDisplayRole`.
  - Added `getStaffDisplayRole(staff)` and `getStaffDisplaySubtitle(staff)`.
  - Uses `job_title` first, then safe staff type/system role fallbacks.
  - Suppresses tier for owner, manager, assistant manager, store manager, CRM, CSR roles, service head, driver, utility, managerial, and salon head rows.
- `src/components/features/staff/staff-table-row.tsx`
  - Uses `getStaffDisplaySubtitle()` so row subtitle displays `Role · Tier · Phone` only when tier is eligible.

**Behavior:**
- Managers and admin/support staff no longer display `Therapist · Junior`.
- Therapists still display tier when available.
- CSR, driver, utility, owner, and manager rows never show therapist tier labels even if legacy data has `tier = junior`.
- Branch grouping, Active/Pending tabs, filters, selected staff rail, and staff actions are unchanged.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

---

### 2026-05-09 — Codex (STAFF-UI-002 — Staff Management Display Normalization)

**Task:** Refine Staff Management display logic and compact the selected staff profile panel without changing auth, RBAC, booking, schema, staff CRUD, or public pages.

**Files Changed:**
- `src/components/features/staff/staff-management-utils.ts`
  - Added shared `getStaffDisplayMeta(staff)` for role label, staff type label, badge label, tier eligibility, and subtitle parts.
  - Uses `job_title` first for position identity.
  - Derives Staff Type from protected `system_role` mappings so managers/admin/front-desk/support rows do not inherit stale `staff_type = therapist` data.
  - Shows tier only for service access roles (`staff`, `service_staff`) with service staff types (`therapist`, `nail_tech`, `aesthetician`) and hides legacy default tiers from admin/support roles.
- `src/components/features/staff/staff-badges.tsx`
  - Allows Staff Management role badges to use the shared display helper when a staff member is available.
- `src/components/features/staff/staff-table-row.tsx`
  - Uses `getStaffDisplayMeta()` for row subtitle, position/role display, and access role badge.
  - Removes the repeated Branch cell from rows inside branch-grouped tables.
- `src/components/features/staff/staff-branch-section.tsx`
  - Removes the Branch column from branch-grouped tables.
  - Keeps compact branch sections with existing per-branch show more/show less behavior.
- `src/components/features/staff/staff-preview-panel.tsx`
  - Uses `getStaffDisplayMeta()` for profile subtitle, System Role, Staff Type, and badge display.
  - Makes the right profile panel content-height/self-start instead of vertically stretched.
  - Keeps existing detail-page links for review/edit/assign/change/deactivate flows.
- `src/components/features/staff/staff-management-workspace.tsx`
  - Aligns the main grid to the top so the right rail does not stretch with the branch list.
- `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `.context/ERRORS.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`
  - Updated task documentation and verification notes.

**Behavior:**
- Charilyn Abellar and other manager/admin/support rows no longer display `Therapist` or `Junior` from stale raw staff data.
- Manager profile Staff Type now resolves to `Managerial`; admin/front-desk/support rows resolve to their protected staff type labels.
- Service staff can still display tier labels when eligible.
- Active/Pending tabs, search/filter behavior, branch grouping after filters, selected-row behavior, and existing staff action routes remain unchanged.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

---

### 2026-05-09 — Codex (BK-WS-001 — Shared Bookings Workspace + Mockup Alignment)

**Task:** Replace the three separate booking list implementations (Owner, Manager, CRM) with a single shared `BookingsWorkspace` + `BookingsTable` component pair. Then align the implementation with the approved 4:3 mockup layout.

**Files Created:**
- `src/components/features/bookings/bookings-workspace.tsx` — shared server-renderable workspace: header, filter bar with integrated New Booking CTA (CRM only), 4 KPI cards, and `BookingsTable` render. Accepts `cashSummary` for KPI computation only (no DailyCashSummary widget rendered). KPI labels: Total Bookings / Confirmed / Checked In / Today's Collection.
- `src/components/features/bookings/bookings-table.tsx` — `"use client"` table with auto-select-first-booking, always-on 2-column layout (table + details panel), responsive panel hiding below 1100px. Column order: Booking ID | Customer | Type | Time | Service | [Branch] | Status | Payment | Amount | Actions.

**Files Changed:**
- `src/app/(dashboard)/owner/bookings/actions.ts` — added `getOwnerWorkspaceBookingsAction` (calls `getAllBookings` which includes payment fields) and `ownerUpdateBookingPaymentAction` (cross-branch, no branch filter).
- `src/app/(dashboard)/owner/bookings/page.tsx` — replaced previous implementation with thin wrapper passing `statusAction` and `paymentAction` as props.
- `src/app/(dashboard)/manager/bookings/page.tsx` — replaced with thin wrapper; passes `cashSummary` for KPI.
- `src/app/(dashboard)/crm/bookings/page.tsx` — replaced with thin wrapper; passes `cashSummary` for KPI.
- `src/components/features/dashboard/booking-action-menu.tsx` — added optional `statusAction` prop override so owner context can inject cross-branch action without forking the component.
- `src/components/features/dashboard/payment-action-menu.tsx` — added optional `paymentAction` prop override for same reason.

**Design decisions:**
- All three routes use the same component tree — role differences are prop-only (`workspaceContext`, `viewerRole`, `statusAction`, `paymentAction`).
- Owner passes `statusAction`/`paymentAction`; manager/CRM use default hardcoded branch-scoped actions.
- `DailyCashSummary` widget removed from bookings pages — `cashSummary` data still feeds KPI collection/expected totals.
- Details panel always occupies the second column; responsive CSS (`bw-panel`) hides it below 1100px.
- First booking in the filtered list is auto-selected on mount so the panel is never empty.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.

---

### 2026-05-10 — Codex (BK-WS-002 — Shared Bookings Workspace Polish)

**Task:** Polish the current shared BookingsWorkspace to match the approved simplified mockup more closely without changing auth, RBAC, booking engine logic, payment rules, public booking flow, or the shared Owner/Manager/CRM layout.

**Files Changed:**
- `src/components/features/bookings/bookings-workspace.tsx`
  - Removed the old centered footer count so the table card owns its pagination/count area.
- `src/components/features/bookings/bookings-table.tsx`
  - Added client-side pagination after search filtering, defaulting to 8 rows per page with 8/10/20 row options.
  - Added bottom pagination with range text, previous/next, page buttons, and rows-per-page selector.
  - Removed the visible Branch column so table columns are Booking ID, Customer, Type, Time, Service, Status, Payment, Amount, Actions.
  - Tightened fixed-layout table sizing, compact row cells, truncation/tooltips, and narrow Actions/Amount columns.
  - Replaced row-level `Actions` + `Pay` buttons with a single compact three-dot action trigger.
  - Simplified the right details panel actions into disabled `Edit Booking`, `Change Status`, `Take Payment`, and optional separate `Cancel Booking`.
- `src/components/features/dashboard/booking-action-menu.tsx`
  - Added typed trigger variants and action scopes so the same existing status actions can render as row icon actions, panel status actions, or cancel-only action.
- `src/components/features/dashboard/payment-action-menu.tsx`
  - Added typed trigger label/variant/full-width props while preserving existing payment mutation behavior and owner action override support.

**Behavior:**
- Owner, Manager, and CRM still share the same BookingsWorkspace component tree.
- Existing booking status actions and payment actions remain wired through the existing server actions/action overrides.
- Pagination happens after the current filters/search.
- Selected booking details fall back to the first visible row when page/search changes.
- The details panel no longer shows cramped action buttons.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.


---

### 2026-05-10 — Codex (LAYOUT-001 — Desktop Workspace Layout Width Fix)

**Task:** Remove the global 1280px max-width constraint on dashboard workspace content so cards, tables, and panels can use available desktop space.

**Files Changed:**
- `src/app/(dashboard)/layout.tsx`
  - Root flex container: `minHeight: "100vh"` → `height: "100vh"` to constrain the dashboard shell to the viewport.
  - `<main>`: removed `maxWidth: 1280`.
  - `<main>`: added `minWidth: 0` and `overflowY: "auto"` so the content area scrolls independently and flex grandchildren size correctly.

**Behavior:**
- All workspace pages (Owner, Manager, CRM, Staff Portal) now use the full available desktop width.
- Bookings table + details panel no longer feels squeezed.
- Staff management branch tables and right profile rail have more room.
- Schedule timeline board is no longer trapped in a narrow container.
- Header remains sticky while main content scrolls independently.
- Sidebar remains unchanged.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 68 app routes.


---

### 2026-05-10 — Kimi (SCHED-STAFF-001 — Staff Mode in Shared ScheduleWorkspace)

**Task:** Implement Staff Mode as the first complete view inside the shared ScheduleWorkspace, with Day/Week/Staff mode switching.

**Files Created:**
- `src/components/features/schedule/schedule-mode-switcher.tsx` — Day/Week/Staff toggle with icons
- `src/components/features/schedule/schedule-staff-mode.tsx` — Staff mode orchestrator (profile, summary, day list, upcoming, summary, weekly placeholder)
- `src/components/features/schedule/schedule-staff-profile-card.tsx` — Avatar, name, tier label, availability dot, assigned room
- `src/components/features/schedule/schedule-staff-summary-cards.tsx` — 5 compact cards: Today's Bookings, Scheduled Time, Utilization, Break Time, Travel Time
- `src/components/features/schedule/schedule-staff-day-list.tsx` — Vertical timeline rendering bookings, blocks, and off-duty gaps with status colors

**Files Changed:**
- `src/components/features/schedule/schedule-workspace.tsx`
  - Added `viewMode` state (default `"staff"`)
  - Replaced manual `useMemo` calls with plain derivations for React Compiler compatibility
  - Wired `viewMode` + `onViewModeChange` into `ScheduleBoardPanel`
- `src/components/features/schedule/schedule-board-panel.tsx`
  - Added `ScheduleModeSwitcher` to panel header
  - Added conditional body rendering: Day → `DailyScheduleBoard`, Staff → `ScheduleStaffMode`, Week → placeholder
- `src/components/features/schedule/schedule-booking-block.tsx` — removed unused `branchResources` destructuring
- `src/components/features/schedule/schedule-details-panel.tsx` — removed unused `Phone` import
- `src/components/features/schedule/schedule-kpi-cards.tsx` — removed unused `CalendarDays` import

**Design decisions:**
- Staff mode defaults to the first staff in the filtered rows. Prev/Next buttons cycle through all staff.
- Day list interleaves bookings, blocks, and off-duty gaps in chronological order.
- Upcoming bookings panel shows same-day remaining active bookings only (no future-week data yet).
- Weekly workload panel renders a safe placeholder — no fake data.
- All metrics derived safely from existing `getDailySchedule` data. No new queries or RPCs.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 68 app routes


---

### 2026-05-10 — Kimi (SCHED-WEEK-001 — Week Planning Mode in Shared ScheduleWorkspace)

**Task:** Implement Week Planning Mode inside the shared ScheduleWorkspace, replacing the placeholder with a real planning dashboard.

**Files Created:**
- `src/components/features/schedule/schedule-week-utils.ts` — Pure typed date helpers: `getWeekRange`, `formatWeekRange`, `formatDayCard`, `formatPreviewTitle`, `shiftDate`, `isToday`
- `src/components/features/schedule/schedule-week-day-card.tsx` — Day card with day name, date, booking/staff/alert metrics, 2–3 booking previews, "+X more", alert badge, selected/muted/empty states
- `src/components/features/schedule/schedule-week-day-preview.tsx` — Selected day preview: title with date, booking count badge, compact booking rows (time, service, staff, room, status), "View full day" button
- `src/components/features/schedule/schedule-week-mode.tsx` — Week orchestrator: header with date range, 7-card grid, selected day state, preview or placeholder for non-loaded days

**Files Changed:**
- `src/components/features/schedule/schedule-board-panel.tsx` — Replaced week placeholder with `<ScheduleWeekMode />`, passing all required props

**Untouched:**
- `schedule-workspace.tsx` (already wired for mode switching)
- All route pages, Staff Mode components, Day Mode components, Toolbar, KPI cards, Details panel, Alerts panel, Legend
- All queries, actions, auth, RBAC, schema, booking engine, public booking

**Design Decisions:**
- Uses **one-day data strategy** for safety: only the currently loaded date (from `getDailySchedule`) shows real metrics and booking previews. Other 6 days show safe placeholders ("—" / 0) with muted styling.
- Non-loaded selected day shows an info placeholder explaining how to use the date navigator.
- "View full day" button switches mode to "day" using the existing `onViewModeChange` callback.
- Booking rows in the preview reuse the existing `onBookingClick` → `selectedBookingId` → right Details panel flow.
- Week range is computed client-side from the server-provided `date` prop (Monday-Sunday).
- Alert counts are derived locally using the same logic as `ScheduleWorkspace` (travel buffer, missing assignment, room conflicts).

**Known Limitations:**
- Real weekly data requires either: (a) route pages fetching 7 days of `getDailySchedule`, (b) a new `getWeeklySchedule` RPC, or (c) client-side Supabase fetching. None of these are implemented yet.
- Mode resets on date navigation because `viewMode` is client-only state.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 68 app routes


---

### 2026-05-10 — Kimi (SCHED-DAY-POLISH-001 — Day Mode Timeline Visual Polish)

**Task:** Polish Day Mode visuals inside the existing shared ScheduleWorkspace without touching Staff Mode, Week Mode, route pages, or workspace plumbing.

**Files Changed:**
- `src/components/features/schedule/schedule-board-panel.tsx`
  - `ScheduleLegend` now conditionally renders only when `viewMode === "day"`
  - Added "Daily timeline" gold badge subtitle for Day mode
- `src/components/features/schedule/schedule-staff-cell.tsx`
  - Added initials/avatar circle with green (on-duty) / grey (off-duty) coloring
  - `formatStaffLabel`: null tier now returns "Service Staff" instead of "Staff"
  - Off-duty cells use muted background and text; status label reads "Off today"
- `src/components/features/schedule/schedule-booking-block.tsx`
  - Added 3px status-colored left border accent for quick visual status identification
- `src/components/features/schedule/schedule-blocked-time-block.tsx`
  - Added `formatBlockedLabel` helper: reason containing "break"/"lunch" → "Break", "travel" → "Travel", else "Blocked"
- `src/components/features/schedule/daily-schedule-board.tsx`
  - Fixed `minWidth` from hardcoded `STAFF_CELL_WIDTH_PX + 600` to `STAFF_CELL_WIDTH_PX + getTimelineTotalWidthPx()` for correct scrollable width

**Untouched:**
- `schedule-workspace.tsx`, `schedule-toolbar.tsx`, `schedule-kpi-cards.tsx`, `schedule-details-panel.tsx`, `schedule-alerts-panel.tsx`
- `schedule-legend.tsx`, `schedule-mode-switcher.tsx`
- All Staff Mode and Week Mode components
- All route pages, queries, actions, auth, RBAC, schema, booking engine, public booking

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 68 app routes

---

### 2026-05-10 — Kimi (SPACES-RULES-001 — Shared Spaces & Rules Workspace)

**Task:** Implement a shared "Spaces & Rules" workspace for Owner, Manager, and CRM roles, reusing existing components where safe.

**Files Created:**
- `src/components/features/spaces-rules/spaces-rules-workspace.tsx` — shared orchestrator: header, KPI cards, tabs, main panel + detail rail. Supports `workspaceContext: "owner" | "manager" | "crm"`.
- `src/components/features/spaces-rules/spaces-rules-utils.ts` — pure utilities: conflict detection, KPI computation, type helpers.
- `src/components/features/spaces-rules/spaces-rules-header.tsx` — branch selector (owner) or locked pill (manager/CRM) with context-aware title/subtitle.
- `src/components/features/spaces-rules/spaces-rules-kpi-cards.tsx` — 5 KPI cards (Total Spaces, Available Today, Active Rules, Conflicts, Missing Assignments). CRM mode hides Active Rules.
- `src/components/features/spaces-rules/spaces-rules-tabs.tsx` — tab navigation. CRM mode hides Booking Rules tab.
- `src/components/features/spaces-rules/overview-tab.tsx` — inventory breakdown, today's schedule preview, alerts summary.
- `src/components/features/spaces-rules/spaces-tab.tsx` — filter bar + `BranchResourcesManager` integration. Passes `readOnly` when `canManage=false`.
- `src/components/features/spaces-rules/booking-rules-tab.tsx` — reuses existing `BranchBookingRulesForm` + `RuleImpactPreview` side panel.
- `src/components/features/spaces-rules/rule-impact-preview.tsx` — read-only rule summary sidebar.
- `src/components/features/spaces-rules/conflicts-tab.tsx` — missing assignments, overlaps, capacity overflows with severity badges.
- `src/components/features/spaces-rules/space-detail-panel.tsx` — right rail: resource stats, today's bookings, quick actions (only when `canManage=true`).
- `src/app/(dashboard)/owner/spaces-rules/page.tsx` — owner route wrapper with branch selector, full management.
- `src/app/(dashboard)/manager/spaces-rules/page.tsx` — manager route wrapper with locked branch, full management.
- `src/app/(dashboard)/crm/spaces-rules/page.tsx` — CRM route wrapper with locked branch, read-only.

**Files Changed:**
- `src/components/features/dashboard/nav-config.ts`
  - Owner: added "Spaces & Rules" → `/owner/spaces-rules`.
  - Manager: renamed "Spaces" → "Spaces & Rules", href → `/manager/spaces-rules`.
  - CRM: added "Spaces" → `/crm/spaces-rules`.
- `src/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager.tsx`
  - Added optional `onRowClick` prop for row selection into detail panel.
  - Added optional `readOnly` prop: hides Add Space button, Edit button, Toggle button.
  - Added `e.stopPropagation()` on Edit button to prevent row click interference.
- `next.config.ts` — added redirect `/manager/resources` → `/manager/spaces-rules`.
- `src/app/api/manager/resource-check/route.ts` — hardened API guard: now checks user role and branch ownership before returning resource availability.

**Capability Matrix by Context:**
| Capability | Owner | Manager | CRM |
|---|---|---|---|
| Switch Branch | ✅ | ❌ | ❌ |
| Manage Resources (add/edit/toggle) | ✅ | ✅ | ❌ |
| Edit Booking Rules | ✅ | ✅ | ❌ |
| View Booking Rules | ✅ | ✅ | ❌ (tab hidden) |
| View Conflicts | ✅ | ✅ | ✅ |
| View Resource Detail | ✅ | ✅ | ✅ |

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 69 app routes (new `/crm/spaces-rules` registered)


---

### 2026-05-10 � Kimi (NOTIF-001 � Workspace-Aware Notification Routing + Manager Workflow Alerts)

**Task:** Fix notification routing so alerts open in the correct workspace. Remove dedicated Manager Notifications page. Make manager alerts workflow-based. Fix persistent/repetitive notifications. Set Schedule default to Day mode.

**Files Created:**
- src/lib/notifications/notification-targets.ts � workspace-aware routing helper

**Files Changed:**
- src/lib/notifications/create.ts � dedupe refreshes created_at; removed dead createOwnerAndManagerNotification and createBranchWorkspaceNotification
- src/lib/notifications/queries.ts � popover fetches unread-only; 30-day staleness cutoff
- src/lib/notifications/setup-warnings.ts � uses helper for branch links
- src/app/staff-onboarding/actions.ts � uses helper for onboarding links
- src/app/(dashboard)/crm/reconciliation/actions.ts � uses helper; fixed manager href bug (/crm/reconciliation ? /manager)
- src/app/api/public/waitlist/route.ts � uses helper for waitlist link
- src/app/(dashboard)/manager/bookings/actions.ts � uses helper for staff booking links
- src/components/features/notifications/notification-card.tsx � runtime workspace-aware fallback for stored hrefs
- src/components/features/notifications/notification-bell.tsx � manager "View all" ? /manager
- src/app/(dashboard)/manager/notifications/page.tsx � redirect to /manager
- src/components/features/schedule/schedule-workspace.tsx � default viewMode "day"
- src/components/features/manager-today/manager-today-header.tsx � <a> ? <Link> (lint fix)
- src/components/features/manager-today/manager-today-utils.ts � removed unused 
owMins param
- src/components/features/manager-today/manager-today-workspace.tsx � removed unused import

**Behavior:**
- All notification creation sites use getNotificationTargetPath() for workspace-correct hrefs
- NotificationCard validates stored href against 	arget_workspace and corrects mismatches at runtime
- Manager has no dedicated notification inbox; bell routes to /manager
- Bell popover only shows unread notifications; 30-day cutoff prevents stale accumulation
- Schedule opens in Day mode by default for all workspaces

**Verification:**
- pnpm type-check: ? Passing
- pnpm lint: ? Passing (0 errors, 0 warnings)
- pnpm build: ? Passing, 71 app routes


---

### 2026-05-10 — Kimi (PUB-001 — Hide Therapist Tier from Public Booking)

**Task:** Remove internal staff tier labels (Junior/Mid/Senior) from the public booking wizard. Replace with customer-friendly role labels based on `staff_type`.

**Files Changed:**
- `src/components/public/booking-wizard.tsx`
  - Imported `STAFF_TYPE_LABELS` and `StaffType` from `@/constants/staff`.
  - Added `staffTypeMap` state to store `staffId → staffType` lookup from `/api/public/booking-context`.
  - Updated `StaffOption` type to include optional `staff_type`.
  - Updated `staffAtSlot()` to accept `staffTypeMap` and enrich each option with `staff_type`.
  - Parsed `data.staff` from booking-context response to populate `staffTypeMap` when branch changes.
  - Replaced tier badge in `StepTherapist` with a neutral role-label badge using `STAFF_TYPE_LABELS`.
  - Updated auto-assign helper text from "best available therapist by seniority" to "available qualified therapist for your selected service."
  - Removed unused `TIER_LABEL` constant.
  - Kept `TIER_ORDER` for internal seniority sorting (auto-assign logic unchanged).

**Behavior:**
- Public customers now see "Therapist", "Nail Tech", "Aesthetician / Facialist", etc. instead of "Junior", "Mid-Level", "Senior".
- Auto-assign option no longer mentions seniority/tier.
- Internal sorting by tier still works for auto-assignment priority.
- Owner/Manager staff pages, schedule views, and internal badges are unaffected.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 71 app routes.

---


---

### 2026-05-11 � Kimi (MGR-MOB-001 � Mobile Manager Workspace)

**Task:** Create a mobile-first simplified Manager Workspace that activates only on mobile breakpoints without breaking the existing desktop experience.

**Files Created:**
- src/components/features/manager/mobile/types.ts � shared mobile types
- src/components/features/manager/mobile/manager-mobile-workspace.tsx � main mobile orchestrator with tab state
- src/components/features/manager/mobile/manager-bottom-nav.tsx � fixed bottom navigation (Today, Schedule, Bookings, Staff, More)
- src/components/features/manager/mobile/manager-today-screen.tsx � greeting, KPIs, quick actions, today's flow, attention needed
- src/components/features/manager/mobile/manager-schedule-screen.tsx � staff schedule list with filter pills
- src/components/features/manager/mobile/manager-bookings-screen.tsx � bookings/issues cards with search and filters
- src/components/features/manager/mobile/manager-staff-screen.tsx � active/pending/off-duty staff cards
- src/components/features/manager/mobile/manager-approvals-screen.tsx � approval queue summary + operations tiles
- src/components/features/manager/mobile/manager-more-screen.tsx � branch summary, alerts, settings menu

**Files Changed:**
- src/app/(dashboard)/manager/page.tsx � responsive wrapper (hidden md:block desktop / lock md:hidden mobile); fetches schedule + staff data for mobile while preserving desktop props exactly

**Design Decisions:**
- Desktop workspace is completely untouched; same component tree, same props, same data flow.
- Mobile workspace reuses existing data queries and utility functions (computeKpiData, computeAlerts, getUrgencyScore, eadRelation, etc.).
- Bottom nav uses Lucide icons with large tap targets and clear active states.
- All screens use card-based layouts, large text, and spa design tokens (--cs-*).
- Empty states are included on every list screen.
- Placeholder actions (Review/Resolve) are rendered with disabled state where full server action wiring does not yet exist.

**Build Status:** ? Passing | **Type-check:** ? Passing | **Lint:** ? Passing (0 errors, 0 warnings)



---

### 2026-05-11 � Kimi (MGR-MOB-001-v2 � Mobile Manager Workspace Shell Separation + Spacing Polish)

**Task:** Fix mobile manager workspace so it no longer renders inside the desktop shell, and tighten spacing across all mobile screens.

**Files Changed:**
- src/app/(dashboard)/layout.tsx � desktop header wrapped in hidden md:block; main content padding changed to p-0 md:p-5
- src/components/features/dashboard/sidebar.tsx � mobile hamburger hidden on /manager* routes
- src/components/features/manager/mobile/manager-mobile-workspace.tsx � increased bottom padding to 96px for nav safe area
- src/components/features/manager/mobile/manager-bottom-nav.tsx � added env(safe-area-inset-bottom) padding
- src/components/features/manager/mobile/manager-today-screen.tsx � compact KPIs (32px icon, 10px padding), shorter quick actions (32px icon, 10px padding), tighter gaps (6px), smaller fonts
- src/components/features/manager/mobile/manager-schedule-screen.tsx � reduced card padding and font sizes
- src/components/features/manager/mobile/manager-bookings-screen.tsx � reduced card padding and font sizes
- src/components/features/manager/mobile/manager-staff-screen.tsx � reduced card padding and font sizes
- src/components/features/manager/mobile/manager-approvals-screen.tsx � reduced card padding and font sizes
- src/components/features/manager/mobile/manager-more-screen.tsx � reduced card padding and font sizes

**Design Decisions:**
- Global layout change (header hidden on mobile, responsive main padding) benefits all future mobile workspaces.
- Sidebar hamburger is route-guarded for /manager* only; other workspaces still get the hamburger on mobile.
- All manager mobile screens use consistent compact spacing: 12px horizontal page padding, 8px card padding, 11px body text, 14px headings.

**Build Status:** ? Passing | **Type-check:** ? Passing | **Lint:** ? Passing (0 errors, 0 warnings)

