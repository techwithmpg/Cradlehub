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

... [86,000 characters omitted] ...

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 71 app routes.

---

### 2026-05-11 — Kimi (MGR-MOB-001 — Mobile Manager Workspace)

**Task:** Create a mobile-first simplified Manager Workspace that activates only on mobile breakpoints without breaking the existing desktop experience.

**Files Created:**
- `src/components/features/manager/mobile/types.ts` — shared mobile types
- `src/components/features/manager/mobile/manager-mobile-workspace.tsx` — main mobile orchestrator with tab state
- `src/components/features/manager/mobile/manager-bottom-nav.tsx` — fixed bottom navigation (Today, Schedule, Bookings, Staff, More)
- `src/components/features/manager/mobile/manager-today-screen.tsx` — greeting, KPIs, quick actions, today's flow, attention needed
- `src/components/features/manager/mobile/manager-schedule-screen.tsx` — staff schedule list with filter pills
- `src/components/features/manager/mobile/manager-bookings-screen.tsx` — bookings/issues cards with search and filters
- `src/components/features/manager/mobile/manager-staff-screen.tsx` — active/pending/off-duty staff cards
- `src/components/features/manager/mobile/manager-approvals-screen.tsx` — approval queue summary + operations tiles
- `src/components/features/manager/mobile/manager-more-screen.tsx` — branch summary, alerts, settings menu

**Files Changed:**
- `src/app/(dashboard)/manager/page.tsx` — responsive wrapper (hidden md:block desktop / block md:hidden mobile); fetches schedule + staff data for mobile while preserving desktop props exactly

**Design Decisions:**
- Desktop workspace is completely untouched; same component tree, same props, same data flow.
- Mobile workspace reuses existing data queries and utility functions (computeKpiData, computeAlerts, getUrgencyScore, readRelation, etc.).
- Bottom nav uses Lucide icons with large tap targets and clear active states.
- All screens use card-based layouts, large text, and spa design tokens (--cs-*).
- Empty states are included on every list screen.
- Placeholder actions (Review/Resolve) are rendered with disabled state where full server action wiring does not yet exist.

**Build Status:** ✅ Passing | **Type-check:** ✅ Passing | **Lint:** ✅ Passing (0 errors, 0 warnings)

---

### 2026-05-12 — Kimi (ONBOARD-001 — Eliminate Legacy Invite Flow, Refine Public Onboarding)

**Task:** Remove the insecure legacy invite flow (`/onboard/[staffId]`) that created incomplete staff records. Refine the public `/staff-onboarding` page to be the single entry point for staff applications, with proper `staff_type` mapping from the applicant's selected role.

**Files Removed:**
- `src/app/onboard/[staffId]/page.tsx` — legacy invite claim page
- `src/app/onboard/[staffId]/onboard-form.tsx` — legacy invite claim form
- `src/lib/queries/staff.ts` — removed unused `getStaffForOnboard` query

**Files Created:**
- `src/app/onboard/page.tsx` — simple redirect to `/staff-onboarding`

**Files Changed:**
- `src/app/(dashboard)/owner/staff/actions.ts`
  - Removed `generateInviteAction` — no longer creates incomplete "Pending Invitation" staff rows.
  - Removed `onboardStaffAction` — eliminated the unauthenticated auth-user creation security hole.
- `src/app/(dashboard)/owner/staff/invite/page.tsx`
  - Rewritten as a read-only info page. Passes `onboardingUrl` and `accessCode` to the form.
- `src/app/(dashboard)/owner/staff/invite/invite-form.tsx`
  - Rewritten to display the public onboarding URL and access code with copy buttons.
  - Removed `generateInviteAction` dependency.
  - Added link to Onboarding Requests page.
- `src/app/staff-onboarding/actions.ts`
  - Added `mapPreferredRoleToStaffType()` helper: `therapist`→`therapist`, `csr`→`csr`, `driver`→`driver`, `utility`→`utility`, `other`→`therapist`.
  - `submitStaffOnboardingAction`: now sets `staff_type` on the created inactive staff row.
  - `submitStaffOnboardingAction`: fixed `requested_branch_id` to use the resolved `branchId` (fallback to first branch) instead of potentially-null `preferredBranchId`.
  - `approveOnboardingAction`: now derives and sets `staff_type` from the request's `preferred_role` when activating the staff record.
- `docs/MVP_SYSTEM_SCORE_REPORT.md`
  - Marked C5 (`onboardStaffAction` security) and H4 (`generateInviteAction` validation) as ✅ FIXED.
  - Updated RBAC score from 6→7 and risks table.

**Behavior:**
- All staff onboarding now goes through `/staff-onboarding` (protected by `STAFF_ONBOARDING_ACCESS_CODE`).
- Applicants select their intended role during onboarding; the inactive staff record captures the matching `staff_type`.
- Owner/manager reviews applications in `/owner/staff/onboarding` or `/manager/staff/onboarding`.
- On approval, the staff record is activated with the reviewer-assigned `system_role`, `tier`, `branch_id`, and the applicant's `staff_type`.
- No more incomplete "Pending Invitation" staff rows polluting the database.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 76 app routes.

---

### 2026-05-12 — Kimi (ONBOARD-002 — CRM Staff Applications Review)

**Task:** Enable authorized CSR (front-desk) users to review and approve normal operational staff applications directly from the CRM workspace. This avoids the need for full Manager workspace access during MVP.

**Files Created:**
- `docs/MVP_TEMPORARY_PERMISSIONS.md` — documented temporary MVP permission rules
- `src/components/features/staff-onboarding/onboarding-review-list.tsx` — reusable review component extracted from owner dashboard
- `src/app/(dashboard)/crm/staff-applications/page.tsx` — new CRM staff application review page

**Files Removed:**
- `src/app/(dashboard)/owner/staff/onboarding/review-list.tsx` — replaced by the reusable component

**Files Changed:**
- `src/lib/staff/approval-permissions.ts`
  - Updated CSR/CRM assignable roles to include `csr_staff`, `driver`, `utility`, and `staff`.
  - Enforced sensitive role restriction (CSR cannot approve managers/admins).
- `src/components/features/dashboard/nav-config.ts`
  - Added "Staff Applications" to CRM, CSR Head, and CSR Staff navigation.
- `src/app/(dashboard)/owner/staff/onboarding/page.tsx`
- `src/app/(dashboard)/manager/staff/onboarding/page.tsx`
  - Refactored to use the new reusable `OnboardingReviewList` component.

**Behavior:**
- CSR users see "Staff Applications" in their sidebar.
- CSRs can review applicants for their assigned branch.
- CSRs can approve only operational roles; management roles show "Owner/Manager required" and have the Approve button disabled.
- Fixed role mapping: CSR applicants now default to `system_role: csr_staff` when reviewed, ensuring they land in the correct workspace.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 77 app routes.

---

### 2026-05-13 — Kimi (BRANCH-SOT-001 — Public Branch Address Source of Truth)

**Task:** Unify public branch/contact data into a single database source of truth. Eliminate dual-sourcing between `branches` table and hardcoded `public-site-data.ts`.

**Files Created:**
- `supabase/migrations/20260516000001_branch_public_fields.sql` — adds `opening_hours`, `secondary_phone`, `sort_order` to `branches`

**Files Changed:**
- `src/types/supabase.ts` — added `opening_hours`, `secondary_phone`, `sort_order` to `branches` Row/Insert/Update types
- `src/lib/queries/branches.ts` — added `getPublicBranches()` helper (active branches ordered by `sort_order`, then `name`)
- `src/lib/public/public-site-data.ts` — marked `publicPhones` and `publicBranches` as `@deprecated` with explanation
- `src/app/(public)/layout.tsx` — now async; fetches `getPublicBranches()` and passes `primaryPhone` to `SiteHeader`, `branches` to `SiteFooter`
- `src/app/page.tsx` — now async; fetches `getPublicBranches()`, passes to `SiteHeader`, `SiteFooter`, `PublicMobileHome`, `HomePageSections`; FAQ answers now dynamically list branch names from DB
- `src/app/(public)/contact/page.tsx` — uses branch data for primary/secondary phones, opening hours, branch name/address cards, and CTA call button
- `src/app/(public)/branches/page.tsx` — switched to `getPublicBranches()`; per-branch `opening_hours` replaces hardcoded "Daily · 9:00 AM – 9:00 PM"
- `src/components/public/site-header.tsx` — accepts `primaryPhone` prop instead of importing hardcoded `publicPhones`
- `src/components/public/site-footer.tsx` — accepts `branches` prop; derives hours text from first branch `opening_hours`
- `src/components/public/home-page-sections.tsx` — accepts `branches` prop; contact section phones, branch cards, and CTA buttons now use branch data
- `src/components/public/mobile/public-mobile-home.tsx` — accepts `branches` prop; FAQ branch answer is now dynamic
- `src/components/public/mobile/public-mobile-contact.tsx` — `primaryPhoneHref()` now uses first branch phone; opening hours uses branch `opening_hours`
- `src/components/public/mobile/public-mobile-branches.tsx` — uses `branch.opening_hours` instead of hardcoded fallback text

**Design Decisions:**
- Marketing narrative (hero copy, proof points, trust points) remains in `public-site-data.ts` and `public_site_sections` table. Only operational contact/address/hours data was migrated.
- All components keep safe fallbacks when branch data is missing: "Contact info updating", "Branch details are being updated", etc.
- `getPublicBranches()` orders by `sort_order` then `name`, giving owners control over display order without code changes.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 77 app routes.

---

### 2026-05-13 — Kimi (PAYMENT-001 — Manual Payment Recording Capability)

**Task:** Wire PaymentActionMenu into all workspace contexts, create booking_payment_logs audit table, and ensure all payment changes are logged with old→new values.

**Files Created:**
- `supabase/migrations/20260517000001_booking_payment_logs.sql` — append-only audit table for payment changes
- `supabase/migrations/20260517000002_update_daily_schedule_payment_fields.sql` — adds payment fields to `get_daily_schedule` RPC

**Files Changed:**
- `src/types/supabase.ts` — added `booking_payment_logs` table type
- `src/lib/validations/booking.ts` — extended `updateBookingPaymentSchema` with optional `reason` field
- `src/components/features/dashboard/payment-action-menu.tsx` — added `reason` state, `confirmUnpaid` view, significant-change guard (requires reason for voids/refunds/corrections)
- `src/app/(dashboard)/owner/bookings/actions.ts` — `ownerUpdateBookingPaymentAction` now reads old values, inserts audit log, then updates
- `src/app/(dashboard)/manager/bookings/actions.ts` — `updateBookingPaymentAction` now reads old values, inserts audit log, then updates
- `src/components/features/schedule/schedule-details-panel.tsx` — fixed hardcoded payment values, now passes actual booking payment state
- `src/lib/queries/schedule.ts` — `DailyScheduleBooking` type extended with payment fields
- `src/app/(dashboard)/manager/bookings/page.tsx` — wired `updateBookingPaymentAction`
- `src/app/(dashboard)/manager/schedule/page.tsx` — wired `updateBookingPaymentAction`
- `src/app/(dashboard)/crm/bookings/page.tsx` — wired `updateBookingPaymentAction`
- `src/app/(dashboard)/crm/schedule/page.tsx` — wired `updateBookingPaymentAction`
- `src/app/(dashboard)/crm/today/page.tsx` — computes `price_paid` from metadata, passes `paymentAction` to queue panel
- `src/components/features/crm/today/crm-booking-queue-panel.tsx` — added inline `PaymentActionMenu` on each card with event propagation stop

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 77 app routes.

---

### 2026-05-13 — Kimi (CONTROL-001 — Booking Control Console MVP)

**Task:** Create a professional operational control page for manager and CRM users showing today's bookings with KPIs, progress status, payment actions, and home-service warnings.

**Files Created:**
- `src/components/features/control-console/types.ts` — `ControlBooking` and `ControlTab` types
- `src/components/features/control-console/control-kpi-strip.tsx` — 7 KPI cards (Total, Active, In Progress, Completed, Unpaid, Home Service, Issues)
- `src/components/features/control-console/control-booking-card.tsx` — Enhanced booking card with progress mini-stepper, payment badge, status badge, home-service warnings, and inline action buttons
- `src/components/features/control-console/control-queue.tsx` — Filterable queue with tabs: All, Active, Home, In Spa, Unpaid, Issues
- `src/components/features/control-console/control-console-page.tsx` — Main layout with KPIs, queue, and operational summary side rail
- `src/app/(dashboard)/manager/control/page.tsx` — Manager control console route (branch-scoped)
- `src/app/(dashboard)/crm/control/page.tsx` — CRM control console route (branch-scoped)

**Files Changed:**
- `src/lib/queries/bookings.ts` — added `booking_progress_status` and timestamp fields to `TODAY_SCHEDULE_SELECT` variants; added `MaybeProgressFields` to `TodayScheduleRow`
- `src/components/features/dashboard/nav-config.ts` — added "Control" to Manager, CRM, CSR Head, and CSR Staff navigation

**Design Decisions:**
- Reuses `getTodaysSchedule` and existing server actions (`updateBookingPaymentAction`, `updateBookingStatusAction`).
- No new external APIs, no live maps, no GPS tracking.
- Cards show progress as a compact dot stepper rather than full timeline.
- Home service warnings (dispatch_warning, needs_location_review) are shown as red banners at the top of affected cards.
- Issues tab surfaces: dispatch warnings, location review needs, missing room assignments, and unassigned staff.
- Staff availability diagnostic is a placeholder linking to Schedule/Staff settings pages.
- Owner control console is documented as a Phase 3.1 follow-up (requires cross-branch today's schedule query).

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 79 app routes.

**Follow-up:**
- Phase 3.1: Owner cross-branch control console.
- Phase 4: Booking Delivery Type Cleanup (`in_spa` as first-class type).

---

### 2026-05-13 — Kimi (MGR-STAFF-001 — Manager Staff Parity)

**Task:** Give Manager workspace the same staff-management capabilities as Owner, safely branch-scoped, without redesigning staff management.

**Files Created:**
- `docs/MANAGER_STAFF_PARITY_AUDIT.md` — full audit of Owner vs Manager staff capabilities, gaps, safe parity plan, and implementation summary
- `src/components/features/staff/staff-edit-form.tsx` — shared reusable staff edit form extracted from Owner route
- `src/app/(dashboard)/manager/staff/[staffId]/page.tsx` — Manager staff detail/edit page (branch-scoped)

**Files Changed:**
- `src/app/(dashboard)/owner/staff/[staffId]/page.tsx` — refactored to use shared `StaffEditForm`
- `src/app/(dashboard)/owner/staff/[staffId]/staff-edit-form.tsx` — DELETED (replaced by shared component)
- `src/app/(dashboard)/owner/staff/actions.ts` — hardened `updateStaffAction` with sensitive-role guards, manager-safe role enforcement, branch-change validation, and revalidation of both owner and manager paths
- `src/components/features/staff/staff-preview-panel.tsx` — Manager now sees "Change Role" and "Deactivate Staff" quick actions; "Assign Branch" remains Owner-only
- `src/components/features/manager/mobile/manager-staff-screen.tsx` — Staff cards are now clickable `Link` elements to detail pages
- `src/components/features/control-console/control-console-page.tsx` — fixed pre-existing `<a>` → `<Link>` lint error

**Behavior:**
- Manager can now edit staff profiles, update roles (manager-safe only), change tier/level, assign service capabilities, activate/deactivate, and toggle department head — all for staff in their branch.
- Branch field is locked to manager's branch.
- Protected accounts (owner, manager, assistant_manager, store_manager, super_admin, platform_admin) show "This action requires owner approval." and cannot be modified by manager.
- Owner staff management is untouched and continues to work with full controls.
- Mobile manager staff tab now links to detail edit pages.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 80 app routes.

**Follow-up:**
- Manager direct-invite (`/manager/staff/new`) if business wants managers to create staff directly.
- Staff delete/soft-delete if needed (currently only deactivate).

---

### 2026-05-13 - Codex (STAFF-ORG-001 - Staff Edit Organization & Access Model)

**Task:** Fix Staff Edit so it mirrors the full organizational model from owner-level access through operational staff, while keeping workspace access, job function, and supervisor status distinct.

**Files Created:**
- `src/constants/staff-roles.ts` - shared typed source for supported `system_role`, `staff_type`, service staff types, labels, options, sensitive role policy, and assignable role policy.

**Files Changed:**
- `src/constants/staff.ts` - compatibility re-export from the shared catalog.
- `src/lib/validations/staff.ts` - staff create/update schemas now accept every DB-supported system role and existing staff type.
- `src/app/(dashboard)/owner/staff/actions.ts` - manager-safe role assignment and protected-role checks now use shared policy; non-service staff clear service mappings server-side.
- `src/components/features/staff/staff-edit-form.tsx` - added Organization & Access section, full role/function options, leadership toggle help text, active status help text, and service fields only for service staff functions.
- `src/app/(dashboard)/owner/staff/new/staff-invite-form.tsx` - direct invite now uses the same role/function source and conditional service capability logic.
- `src/components/features/staff/staff-branch-section.tsx`, `staff-table-row.tsx`, `staff-preview-panel.tsx`, `staff-management-utils.ts`, `staff-filter-bar.tsx`, `staff-management-workspace.tsx` - display now separates Workspace Access from Staff Function and shows Head / Supervisor as distinct metadata.
- `src/lib/staff/approval-permissions.ts` - onboarding approval role lists now reuse shared assignable role arrays.
- `src/app/(auth)/login/actions.ts` - login redirect now uses shared role routing for driver, utility, service, and manager variant roles.
- `src/types/index.ts` - re-exports shared system roles and broadens staff tier typing to current schema values.
- `eslint.config.mjs` - ignores generated `.claude/**` worktree output so lint does not scan build artifacts.

**Behavior:**
- Driver, utility, CSR/front-desk, managerial, salon head, therapist, nail tech, and aesthetician functions are available in edit/direct invite.
- Owner can assign all DB-supported access roles; manager can assign only operational roles.
- Managers cannot edit protected owner/manager-level records or assign forbidden high-level access.
- Service assignment appears only for therapist, nail tech, aesthetician, and salon head.
- Saving driver/utility/CSR/managerial functions clears `staff_services` mappings even if stale client data is submitted.
- Defensive admin-like role names remain protected but are not exposed because current DB constraints do not support them.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in staff onboarding form)
- `pnpm build`: ✅ Passing, 79 app routes.

**Hotfix:**
- Added `public/sw.js` as a self-unregistering service worker cleanup script and no-store `/sw.js` headers in `next.config.ts`.
- Reason: browser logs showed stale `/sw.js` activity and stale client chunks still requiring the old `@base-ui/react/button` module after the Button component moved to Radix Slot.
- Verification after hotfix: `pnpm type-check`, `pnpm lint`, and `pnpm build` still pass.

---

### 2026-05-14 - Codex (PHASE-10.1 - Compact Precise Home-Service Location Input)

**Task:** Refine the existing public booking wizard home-service location step into a compact Google-Maps-style precise location input.

**Files Changed:**
- `src/components/public/places-autocomplete.tsx` - extended the shared Places wrapper to return formatted address, place ID, lat/lng, address components, map URL, and load/error status without exposing the server Maps key.
- `src/components/public/booking-wizard.tsx` - public home-service location step now shows one Google Places search field, a compact selected-location confirmation card with Change, and one merged Delivery notes textarea.
- `src/lib/validations/booking.ts` - public multi-service booking validation now requires a selected Google place for home-service bookings while leaving in-spa unaffected.
- `src/lib/actions/online-booking.ts` - server action now enforces precise home-service place data and saves `formatted_address`, `place_id`, `lat`, `lng`, `address_components`, `map_url`, `source: "google_places"`, and `delivery_notes` while preserving legacy address/notes/zone keys.

**Behavior:**
- Public home-service customers must select a Google suggestion before continuing; typed text alone is rejected.
- Customer-facing zone, house/unit, landmark, and separate driver-note fields were removed/merged into a single Delivery notes field.
- Metadata keeps `zone: "unknown"` when customers are not asked to choose a zone, while precise lat/lng remain available for dispatch/ETA systems.
- In-spa booking flow is unchanged.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in staff onboarding form)
- `pnpm build`: ✅ Passing, 79 app routes.

---

### 2026-05-14 — Claude Sonnet 4.6 (SCHED-LAYOUT-001 — Full-Width Schedule Timeline)

**Task:** Improve the Manager/Owner/CRM Schedule workspace so the daily timeline uses the full available content width instead of being cramped by the permanent 340px Booking Details side panel.

**Files Created:**
- `src/components/features/schedule/schedule-booking-hover-card.tsx` — Lightweight floating hover preview card for booking blocks (fixed-positioned, shows ID, status/type badges, customer, time, duration, service, staff, room/payment, View Details button)

**Files Changed:**
- `src/components/features/schedule/schedule-workspace.tsx` — Removed permanent two-column grid layout (`minmax(0,1fr) 340px`); schedule board now expands to full width. Added controlled Sheet (right drawer) for full booking details on click. Added `ScheduleBookingHoverCard` floating preview on hover. Added `hoveredPreview` state, `isSheetOpen` state, and `closeTimerRef` for safe hover-card interaction with 200ms close delay.
- `src/components/features/schedule/schedule-board-panel.tsx` — Threaded `onHoverEnter` / `onHoverLeave` optional callback props to `DailyScheduleBoard`.
- `src/components/features/schedule/daily-schedule-board.tsx` — Threaded `onHoverEnter` / `onHoverLeave` optional callback props to `ScheduleStaffRow`.
- `src/components/features/schedule/schedule-staff-row.tsx` — Threaded `onHoverEnter` / `onHoverLeave` optional callback props to `ScheduleBookingBlock`.
- `src/components/features/schedule/schedule-booking-block.tsx` — Added `onHoverEnter` and `onHoverLeave` optional props; calls them from existing `onMouseEnter`/`onMouseLeave` handlers with `booking.id` and cursor coordinates.

**Design Decisions:**
- Booking details panel (`ScheduleDetailsPanel`) moved from permanent right-column to a Sheet (right-side drawer). All existing actions are preserved: Change Status, Take Payment, Cancel Booking, Room/Bed Assignment.
- Hover card shows a lightweight preview only; full actions remain in the Sheet to avoid complexity in the hover card.
- Hover card uses a 200ms close delay via `closeTimerRef` so the pointer can move from the booking block into the card without flickering.
- On touch/mobile/tablet, the Sheet opens on booking click — no hover dependency.
- Hover callbacks are plain functions (not `useCallback`) so they always close over current `filteredRows` and `date` without ref-mutation lint violations.
- Change benefits all three schedule workspaces (Owner, Manager, CRM) that share `ScheduleWorkspace`.
- No auth, RBAC, Supabase schema, or database changes.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in staff onboarding form)
- `pnpm build`: ✅ Passing, 88 app routes.

---

### 2026-05-14 — Claude (SCHED-RULES-001 — Rule-Based Scheduling Engine)

**Task:** Implement a deterministic rule-based automatic scheduling/blocking system. No AI. Full manager approval workflow with staff notifications after apply/reject.

**Files Created:**
- `supabase/migrations/20260520000001_scheduling_rules_foundation.sql` — 4 new tables: scheduling_rules, staff_scheduling_preferences, schedule_suggestions, schedule_health_checks. RLS, indexes, updated_at triggers.
- `src/lib/scheduling/types.ts` — TypeScript domain types (SchedulingRules, StaffSchedulingPreferences, ScheduleSuggestion, ScheduleHealthCheck, etc.)
- `src/lib/scheduling/schemas.ts` — Zod schemas for all server actions.
- `src/lib/scheduling/rules/get-scheduling-rules.ts` — fetches branch rules with safe defaults fallback.
- `src/lib/scheduling/rules/evaluate-schedule-health.ts` — pure function producing HealthEvaluationResult with issues and recommendations.
- `src/lib/scheduling/rules/generate-routine-blocks.ts` — break/travel/room-reset buffer suggestion helpers.
- `src/lib/scheduling/rules/generate-schedule-suggestions.ts` — loads daily snapshot, generates and persists deduplicated suggestions.
- `src/lib/scheduling/rules/apply-approved-suggestion.ts` — applies approved suggestions as schedule_overrides or blocked_times rows.
- `src/lib/scheduling/rules/notify-affected-staff.ts` — fires workspace_notifications after approve/reject/apply.
- `src/lib/scheduling/rules/explain-suggestion.ts` — returns human-readable headline + detail for any suggestion type.
- `src/app/(dashboard)/manager/scheduling/actions.ts` — server actions: upsertSchedulingRulesAction, generateSuggestionsAction, listPendingSuggestionsAction, approveSuggestionAction, rejectSuggestionAction.
- `src/components/features/scheduling/scheduling-rules-form.tsx` — client form for coverage, day-off, break, auto-blocking, and approval flow settings.
- `src/components/features/scheduling/schedule-health-panel.tsx` — daily health status panel with count grid, issues list, recommendations, and Generate button.
- `src/components/features/scheduling/suggestions-review-panel.tsx` — suggestion cards with Approve and Apply / Reject actions.

**Files Changed:**
- `src/types/supabase.ts` — Row/Insert/Update types for all 4 new tables.
- `src/lib/notifications/types.ts` — added schedule_suggestion_approved, schedule_suggestion_rejected, schedule_block_applied.
- `src/app/(dashboard)/manager/page.tsx` — health panel and suggestions review panel added below ManagerTodayWorkspace on desktop.
- `src/app/(dashboard)/manager/settings/page.tsx` — SchedulingRulesForm added below existing booking rules section.
- `src/app/(dashboard)/manager/operations/page.tsx` — Staff Workload Balancing moved from Coming Soon to Available as Schedule Automation.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in staff onboarding form)
- `pnpm build`: ✅ Passing
