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
