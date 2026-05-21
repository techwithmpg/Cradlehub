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

### 2026-05-14 - Codex (NOTIF-001 - Premium Workflow Signal Foundation)

**Task:** Audit and replace the noisy staff onboarding notification fanout with a role-aware, deduplicated workflow signal foundation.

**Files Created:**
- `supabase/migrations/20260519000001_workflow_signal_foundation.sql` - adds `workspace_notifications.dedupe_key` and new `workflow_tasks` table with RLS.
- `src/lib/notifications/workflow-dedupe.ts` - shared dedupe key builder and signal href validation.
- `src/lib/notifications/workflow-notifications-store.ts` - create/update and resolve notification storage helpers.
- `src/lib/notifications/workflow-task-store.ts` - create/update and resolve workflow task storage helpers.
- `src/lib/notifications/workflow-signals.ts` - central `emitWorkflowEvent()` routing for staff onboarding.
- `src/lib/notifications/workflow-queries.ts` - RLS-safe open workflow task query.
- `src/components/features/notifications/workspace-attention-strip.tsx` - calm workspace attention strip.
- `src/components/features/notifications/inline-workflow-task-card.tsx` - inline workflow task card for module surfaces.
- `src/components/features/notifications/notification-priority-badge.tsx` - Low/Normal/High/Critical priority badge.
- `src/components/features/notifications/notification-section.tsx` - grouped notification list section.
- `src/components/features/notifications/notification-bell-dropdown.tsx` - bell dropdown alias around the grouped popover.

**Files Changed:**
- `src/app/staff-onboarding/actions.ts` - staff onboarding now emits workflow events instead of direct owner/manager notification fanout.
- `src/app/(dashboard)/manager/page.tsx` - manager dashboard surfaces open workflow tasks in a calm attention strip.
- `src/app/(dashboard)/manager/staff/onboarding/page.tsx` - manager onboarding page passes open workflow tasks to the review list.
- `src/components/features/staff-onboarding/onboarding-review-list.tsx` - shows inline workflow task context for manager review.
- `src/components/features/notifications/*` - bell/list grouping and visual tone adjusted toward quieter workflow signals.
- `src/lib/notifications/create.ts` - legacy `createNotification()` now routes through deduped create/update helper.
- `src/lib/notifications/queries.ts` - active notification reads include resolved items for grouped inbox compatibility.
- `src/lib/notifications/types.ts`, `src/types/supabase.ts` - added workflow task and dedupe types.

**Behavior:**
- `staff_onboarding.submitted` creates one manager workflow task and one applicant status update.
- Routine onboarding no longer creates an urgent owner notification.
- CRM receives no staff onboarding notification.
- Missing service selections are metadata on the same manager review task, not a second manager notification.
- Approval/rejection resolves the manager workflow task and old legacy onboarding notifications for that request.
- Applicant receives one deduped approval/rejection status update.
- Existing direct notification callers remain compatible but now use dedupe keys.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 80 app routes.

---

### 2026-05-14 — Claude (MOBILE-001 — Mobile-First Staff & Driver Portal)

**Task:** Add mobile-first UI to Staff Portal and Driver Portal without breaking existing desktop layouts.

**Files Created:**
- `src/components/features/staff-portal/mobile/staff-mobile-bottom-nav.tsx` — Fixed mobile bottom nav (5 items) with active state
- `src/components/features/staff-portal/mobile/staff-mobile-home.tsx` — Full service staff mobile home: greeting, next action card, today timeline, overview stats, home service alert, quick links
- `src/components/features/driver/driver-mobile-home.tsx` — Driver-focused mobile home: greeting, current trip card, trip overview stats, upcoming trips list, quick actions

**Files Modified:**
- `src/app/(dashboard)/staff-portal/page.tsx` — Added `hidden md:block` / `block md:hidden` split; desktop unchanged, mobile renders StaffMobileHome
- `src/app/(dashboard)/driver/page.tsx` — Added `hidden md:block` / `block md:hidden` split; desktop unchanged, mobile renders DriverMobileHome

**Also in this session (schedule task):**
- `src/lib/staff-portal/schedule.ts` — StaffScheduleEvent type + buildDayEvents/buildWeekEvents helpers
- `src/app/(dashboard)/staff-portal/schedule/page.tsx` — My Schedule server route
- `src/components/features/staff-portal/staff-schedule-page.tsx` — Schedule client component (week grid + mobile agenda + bottom nav)
- `src/components/features/staff-portal/staff-schedule-page.module.css` — Schedule CSS module
- `src/components/features/dashboard/nav-config.ts` — Added "My Schedule" to STAFF_NAV_ITEMS

**Build Status:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings only)
- `pnpm build`: Not run (build was 80 routes prior; new routes add /staff-portal/schedule)

---

### 2026-05-14 - Codex (BOOKING-WIZARD-UX-10.2 - Public Booking Wizard Optimization)

**Task:** Fix active public booking wizard Places usage, compact the service-selection UX, and restrict specific staff selection to real qualified service providers.

**Files Created:**
- `src/components/public/booking-service-picker.tsx` - extracted compact category-based booking service picker used by the wizard.
- `src/lib/staff/service-providers.ts` - shared guard for service-provider eligibility, hard-excluding driver/utility system roles and non-service job functions.

**Files Changed:**
- `src/components/public/booking-wizard.tsx` - delegates service selection to the compact picker; staff picker now keeps Any Available as default and hides unqualified providers.
- `src/components/public/places-autocomplete.tsx` - selected place result now carries `source: "google_places"` while continuing to use `google.maps.importLibrary("places")` and `PlaceAutocompleteElement`.
- `src/app/api/public/booking-context/route.ts` - public booking context now preserves service category metadata and returns staff service mappings for eligibility-aware filtering.
- `src/lib/engine/availability.ts` - availability results and auto-assignment now filter out driver, utility, CSR/front-desk, admin/owner/manager-only staff; selected staff must satisfy service capability constraints when mappings exist.
- `src/lib/actions/online-booking.ts` - multi-service specific staff submission now verifies eligibility against all selected services, not only the first.
- `src/features/maps/GoogleMapsProvider.tsx`, `src/features/maps/PlaceAutocompleteInput.tsx`, `src/features/maps/README.md` - browser map key usage now standardizes on `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`; the provider no longer requests legacy Places libraries.

**Behavior:**
- Active `/book` path has no legacy `google.maps.places.Autocomplete`, `AutocompleteService`, `PlacesService`, `libraries=places`, or `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` usage under `src`.
- Public home-service location remains a single Places API (New) search field, selected-location confirmation card, and optional delivery notes field.
- Service selection shows one category at a time instead of expanding the full catalog.
- Multi-service selection, total duration, and total price remain intact.
- Specific provider selection shows only active service-provider staff who are available for the selected slot and eligible for the selected service set; Any Available remains the default.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 80 app routes.
- `/book` smoke test: Existing localhost dev server at port 3000 returned `200 OK`.

---

### 2026-05-15 — Claude Code (Phase 0 Stabilization — Batch 2)

**Task:** SECURITY-STAB-002 — Phase 0 security stabilization batch 2 (9 blockers)

**Files Changed:**
- `src/proxy.ts` — Removed unconditional userId+role log on every request; replaced with dev-only `console.debug`; also removed userId from the "no active staff record" path log.
- `src/app/(dashboard)/owner/staff/actions.ts` — Replaced full raw-input `console.log` and full Zod-issues `console.error` in `updateStaffAction` with dev-only `console.debug` using safe boolean metadata only. No PII or payload logged in production.
- `src/app/(dashboard)/owner/marketing/actions.ts` — Added `createClient`/`isDevAuthBypassEnabled` imports, `requireOwner()` helper, and owner auth guard to all four exported actions (saveMarketingSectionAction, createMarketingAssetAction, updateMarketingAssetAction, disableMarketingAssetAction). [Batch 1 — completed prior step]
- `src/lib/dev-bypass.ts` — Production guard already present (NODE_ENV !== "production"); no change required.
- `src/lib/logger.ts` — Created structured logger with `logError` and `logWarn`; stacks only in development; always emits JSON to stderr.
- `src/lib/actions/driver-actions.ts` — Replaced 2 silent `catch {}` blocks with `logError` calls (getBranchBookingDriverIds, getAvailableBranchDrivers).
- `src/lib/actions/eta-actions.ts` — Replaced 1 silent `catch {}` with `logError` (getNextBookingForStaff).
- `src/lib/actions/live-ops-actions.ts` — Replaced 1 silent `catch {}` with `logError` (getActiveTripsForOpsMap).
- `src/lib/actions/location-actions.ts` — Replaced 2 silent `catch {}` with `logError` (getLatestStaffLocationForBooking, getLatestLocationsForActiveHomeServiceTrips).
- `src/app/(dashboard)/dev/page.tsx` — Added `notFound()` guard in production; dev panel route now returns 404 in production.
- `src/app/(dashboard)/manager/operations/page.tsx` — Added `redirect("/manager")` in production; Coming Soon tiles are hidden from real managers in production.
- `src/app/(dashboard)/manager/bookings/actions.ts` — Added `.eq("branch_id", me.branch_id)` to the pre-confirmation booking fetch in `updateBookingStatusAction`; prevents cross-branch room-assignment probe.
- `next.config.ts` — Added baseline security headers (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy) for all routes.
- `.env.example` — Created with all 14 env vars found in `src/`; danger dev-bypass vars clearly marked.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with only the 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 80+ app routes compiled successfully.

---

### 2026-05-15 — Claude Code (Phase 1 Performance Quick Wins)

**Task:** PERF-PHASE1-001 — Phase 1 performance quick wins

**Files Changed:**
- `src/app/(dashboard)/layout.tsx` — Removed redundant `force-dynamic` export; layout is already dynamic because `createClient()` calls `cookies()` from next/headers. Now uses `getLayoutStaffContext()` from the new cached helper instead of inline auth+staff DB calls.
- `src/lib/queries/staff-context.ts` — Created. React `cache()`-wrapped helper for the dashboard layout's auth + staff fetch. Deduplicates within a single request render tree. Sets up the pattern for Phase 2 broader deduplication.
- `src/lib/queries/branches.ts` — Added `getPublicBranchesCached` (React `cache()` wrapper around `getPublicBranches`). Deduplicates branch fetches within a request when multiple components in the public layout render tree call it.
- `src/app/(public)/layout.tsx` — Switched from `getPublicBranches` to `getPublicBranchesCached`.
- `src/app/(dashboard)/manager/bookings/loading.tsx` — Created. Filter bar + booking row skeletons.
- `src/app/(dashboard)/manager/schedule/loading.tsx` — Created. Date nav + timeline grid skeleton.
- `src/app/(dashboard)/manager/settings/loading.tsx` — Created. Settings form section skeletons.
- `src/app/(dashboard)/crm/loading.tsx` — Created. Stats strip + two-column content skeleton.
- `src/app/(dashboard)/crm/bookings/loading.tsx` — Created. Search/filter bar + booking row skeletons.
- `src/app/(dashboard)/owner/staff/loading.tsx` — Created. Search bar + staff card grid skeleton.
- `src/app/(dashboard)/staff-portal/loading.tsx` — Created. Greeting + stats + appointment card skeletons.
- `src/app/(dashboard)/staff-portal/schedule/loading.tsx` — Created. Week nav + day columns + appointment block skeletons.
- `src/app/(dashboard)/manager/error.tsx` — Created. Manager workspace error boundary (client component with Try again reset).
- `src/app/(dashboard)/crm/error.tsx` — Created. CRM workspace error boundary.
- `src/app/(dashboard)/owner/error.tsx` — Created. Owner workspace error boundary.
- `src/app/(dashboard)/staff-portal/error.tsx` — Created. Staff portal error boundary.

**What was intentionally NOT done in this phase:**
- No service worker / offline mode (Phase 3)
- No tag-based revalidation migration (Phase 2)
- No new DB indexes (Phase 2)
- No booking engine changes
- Dynamic import for Dispatch workspace: dispatch is currently mock data UI; not a priority.
- Cross-request cache for branches: React cache() deduplicates within a request; `unstable_cache` / ISR considered but deferred pending Next.js 16 behavioral verification.
- Target H (local refresh): no obvious safe wins found without deeper investigation.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with only 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 80+ app routes compiled successfully.

---

### 2026-05-15 — Claude Code (Phase 2 Database Request Optimization)

**Task:** PERF-PHASE2-001 — Phase 2 database request optimization

**Files Created:**
- `src/lib/queries/crm-context.ts` — Shared `getCrmContext()` helper for CRM page server components. Returns `{ role, branchId }` with owner getting `branchId: null` (cross-branch) and CRM/CSR roles getting their own `branch_id`.

**Files Changed:**
- `src/lib/queries/customers.ts` — Added `branchCustomerIds()` private helper. Added optional `branchId?: string | null` parameter to `searchCustomers`, `getAllCustomers`, `getRepeatCustomers`, `getLapsedCustomers`, `getCrmStats`. When provided, each function first fetches distinct customer IDs from `bookings` for that branch, then filters customers via `.in("id", ids)`. Owners pass `null` and get unfiltered results. Also added a comment on `lookupCustomerByPhone` explaining it is intentionally not branch-scoped.
- `src/app/(dashboard)/crm/actions.ts` — `requireCrmAccess()` now returns `{ supabase, branchId: string | null } | null` (was `supabase | null`). Now fetches `branch_id` from staff record. Owner role maps to `branchId: null`. Updated all callers to destructure `ctx` and pass `ctx.branchId` to query functions.
- `src/app/(dashboard)/crm/customers/page.tsx` — Replaced local `getCsrContext()` + direct supabase calls with imported `getCrmContext()`. Passes `branchId` to `getAllCustomers(page, 25, branchId)`.
- `src/app/(dashboard)/crm/repeats/page.tsx` — Added `getCrmContext()` import and call. Passes `branchId` to `getRepeatCustomers(2, page, 25, branchId)`. (Also adds a missing auth check — this page had no auth before.)
- `src/app/(dashboard)/crm/lapsed/page.tsx` — Added `getCrmContext()` import and call. Passes `branchId` to `getLapsedCustomers(30, 50, branchId)`. (Also adds a missing auth check — this page had no auth before.)
- `src/app/api/customers/search/route.ts` — Now fetches `branch_id` from the staff record in addition to `system_role`. Derives `branchId` (null for owners, `me.branch_id` for others) and passes to `searchCustomers(q, branchId)`.
- `src/lib/queries/staff.ts` — Added `.limit(500)` to both primary and fallback queries in `getAllStaff()`. Added `.limit(200)` to both queries in `getPendingStaff()`. Safety caps for the owner's cross-branch staff lists.
- `src/lib/queries/bookings.ts` — Added `.limit(50)` to `getBookingsByCustomer()` (customer profile booking history). Added `.limit(500)` safety cap to `getAllBookings()` (owner day view) and `getAllBookingsOwner()` (owner cross-branch booking list).

**What was intentionally NOT done in this phase:**
- `select("*")` wildcard replacement in branches and staff queries: The staff queries use a backward-compat fallback pattern that would be fragile to refactor. The branches table is small and `select("*")` is fine there. Deferred.
- Selective `revalidateTag` migration: Requires tagging all cached data and is a cross-cutting concern. The existing `revalidatePath` is correct. Deferred to Phase 3 if profiling shows stale-cache issues.
- DB index recommendations: No profiling data available. Adding indexes without evidence would be speculative. Deferred.
- `unstable_cache` / Next.js 16 `"use cache"` directive: Behavior in Next.js 16.2.4 was not verified. Deferred.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with only 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 80+ app routes compiled successfully.

---

### 2026-05-15 — Claude (PERF-PHASE2B-001 — Query Pagination + Index Planning)

**Task:** Phase 2B — Shared pagination utility, CRM customer paginated search, index audit.

**Files Changed:**
- `src/lib/queries/pagination.ts` (NEW) — Shared pagination helpers: `PaginationParams`, `PaginatedResult<T>`, `normalizePagination()`, `toPaginatedResult()`. Normalizes page/pageSize with safe bounds; wraps Supabase count responses.
- `src/lib/queries/customers.ts` — Added `CustomerPageRow` exported type and `getCustomersPage()` function combining branch scoping + ILIKE search (with `%_` escaping) + server-side pagination via `.range(from, to)` with `count: "exact"`.
- `src/app/(dashboard)/crm/customers/page.tsx` — Switched from `getAllCustomers` to `getCustomersPage`. Added `q` search param support. Added plain `<form method="GET">` search bar (no client state). Quick action cards hidden during active search. Pagination Prev/Next links now preserve `q` param via `encodeURIComponent`. EmptyState shows search-specific messaging.
- `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md` (NEW) — Full audit of existing indexes from `20260429000002_indexes.sql`, identified `bookings(branch_id, customer_id)` as the key missing index for `branchCustomerIds()`, documented all bounded/unbounded queries.
- `src/app/(dashboard)/dev/page.tsx` — Fixed pre-existing TS2367 errors (NODE_ENV type narrowing after `notFound()` guard). Extracted `nodeEnv` variable before the guard.
- `src/lib/logger.ts` — Fixed pre-existing TS2345 errors by widening `LogContext` from `Record<string, string | number | boolean | null | undefined>` to `Record<string, unknown>` so `error: unknown` in catch blocks passes without casts.

**Scope deliberately NOT changed:**
- Booking list pages (manager/CRM/owner): already date+branch scoped, naturally bounded — no pagination needed.
- Staff list pages: `StaffManagementWorkspace` uses client-side filtering on safety-capped (500/200) server results. Pagination would require UI redesign. Deferred.
- `public-site.ts` list queries: CMS tables with owner-defined content — small by design, no limit needed.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79+ app routes compiled successfully

---

### 2026-05-15 — Claude (PERF-PHASE3-001 — Selective Revalidation and Cache Tags)

**Task:** Phase 3 — Replace selected broad `revalidatePath()` usage with scoped cache tags using `unstable_cache` on stable read data.

**Files Created:**
- `src/lib/cache/cache-tags.ts` — Tag constants (`publicBranches`, `branchBookingRules(id)`, `branchServices(id)`) and `invalidateTag()` wrapper that handles Next.js 16's required second `profile` argument to `revalidateTag`.

**Files Modified:**
- `src/lib/queries/branches.ts` — Upgraded `getPublicBranchesCached` from `React.cache()` (per-request only) to `React.cache(unstable_cache(...))` (cross-request + per-request dedup). Added `getBranchServicesPublicCached(branchId)` using `createAdminClient()` + `unstable_cache`; tags `branch-services:{branchId}`, TTL 300s.
- `src/lib/queries/branch-booking-rules.ts` — Added `getBranchBookingRulesOrDefaultCached(branchId)` using `unstable_cache`; tags `branch-booking-rules:{branchId}`, TTL 3600s. `updateBranchBookingRules` now calls `invalidateTag` on commit.
- `src/app/(dashboard)/owner/branches/actions.ts` — All branch mutations (`createBranchAction`, `updateBranchAction`, `toggleBranchActiveAction`) now call `invalidateTag(cacheTags.publicBranches)`. All service mutations (`removeBranchServiceAction`, `addBranchServiceAction`, `updateBranchServiceEligibilityAction`, `updateBranchServicePriceAction`, `updateBranchServiceVisibilityAction`) now call `invalidateTag(cacheTags.branchServices(branchId))`.
- `src/app/(dashboard)/owner/services/actions.ts` — `setBranchServiceAction` now calls `invalidateTag(cacheTags.branchServices(d.branchId))`.
- `src/app/api/public/booking-context/route.ts` — Hot path now uses `getBranchServicesPublicCached` (when `publicOnly=true`) and `getBranchBookingRulesOrDefaultCached`. Inhouse context (publicOnly=false) keeps uncached `getBranchServices`.
- `src/app/api/public/dispatch-slots/route.ts` — Now uses `getBranchBookingRulesOrDefaultCached`.

**Domains cached:**
1. Public branches (`public-branches` tag, 1h TTL)
2. Branch booking rules per branch (`branch-booking-rules:{id}` tag, 1h TTL)
3. Branch services — public-only (`branch-services:{id}` tag, 5min TTL)

**Intentionally NOT cached:**
- `getBranchesOverview` — includes live stats (today's bookings, active staff count)
- `getBranchWithFullDetail` — owner edit page; includes live staff list
- All booking/dispatch/schedule data
- Inhouse context service list (user-facing, may differ by role)
- Notification, payroll, reconciliation data

**Revalidation paths kept:**
- All existing `revalidatePath()` calls preserved alongside the new `invalidateTag()` calls. The path invalidation clears Next.js route cache; the tag invalidation clears the `unstable_cache` function result. Both are needed.

**Next.js 16 compatibility note:**
- `revalidateTag` in Next.js 16 requires a second `profile` argument. The `invalidateTag(tag)` wrapper in `cache-tags.ts` passes `{}` (empty `CacheLifeConfig`) as the profile, which works for `unstable_cache` entries.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79+ app routes compiled

---

### 2026-05-15 — Claude (PERF-PHASE4-001 — Offline / Poor Connectivity Resilience)

**Task:** Phase 4 — Protect all write-path flows from silent failures when the device has no connectivity.

**Files Created:**
- `src/hooks/use-network-status.ts` — `useNetworkStatus()` hook using `useSyncExternalStore` (React 18) to subscribe to `navigator.onLine` / `online` / `offline` events. Returns `{ isOnline, isOffline, wasOffline, lastChangedAt }`. Server snapshot returns `true` (assume online). No hydration mismatch.
- `src/components/shared/offline-banner.tsx` — `"use client"` fixed-position banner (`z-index: 9999`). Two states: offline (dark charcoal, `WifiOff` icon, `aria-live="assertive"`) and back-online (dark green, `aria-live="polite"`). Renders nothing when connectivity never changed.
- `docs/audits/OFFLINE_RESILIENCE_PLAN.md` — Full implementation plan documenting each target, what was protected, what was intentionally excluded, and next steps.

**Files Modified:**
- `src/app/(dashboard)/layout.tsx` — Imports and renders `<OfflineBanner />` inside the outer flex container (renders before Sidebar + Header).
- `src/app/(public)/layout.tsx` — Imports and renders `<OfflineBanner />` before `<SiteHeader>`.
- `src/components/public/booking-wizard.tsx` — Added `useNetworkStatus()`. `handleSubmit` early-returns with "You're offline. Check your connection and try again." when `isOffline`. "Confirm Booking" button `disabled={!canProceed || submitting || isOffline}`. Network-error server responses show retry-friendly message.
- `src/components/features/dashboard/booking-action-menu.tsx` — Added `useNetworkStatus()`. `handleAction` short-circuits when `isOffline`, sets inline feedback with retry message. Trigger button disabled when offline. Action failure copy includes "Check your connection and try again."
- `src/components/features/staff-portal/booking-progress-actions.tsx` — Added `useNetworkStatus()`. `handleAdvance` early-returns when `isPending || isOffline`. Both action buttons (advance + no-show) disabled when offline. Cursor/opacity styles updated.

**Components NOT changed (low priority, covered by banner):**
- `staff-weekly-hours-editor.tsx`, `branch-services-panel.tsx`, `reconciliation-form.tsx`, `waitlist-queue.tsx`, `onboarding-form.tsx`

**`public/sw.js`:** Confirmed self-unregistering — no changes made.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79 routes

---

### 2026-05-18 — Claude (UI-STAFF-EDIT-001)

**Task:** Manager Staff Approval Page — compact redesign with Sheet-based service picker

**Problem solved:** The previous staff edit page rendered all service chips at once (CradleHub has 50–100+ services across categories). This caused visual overload and made the page feel like a raw admin form.

**Solution:** Two-phase UX — main page shows a summary, detailed editing opens in a Sheet.

**Files Created:**
- `src/components/features/staff/staff-service-editor-sheet.tsx` — Sheet-based service capability editor. Collapsible category rows (accordion, one open at a time). Each category shows "N selected / M total". Expanded rows: selected chips first, then unselected, max 8 per category with "Show more". Search mode: bypass accordion, show all matching grouped. Filter chips: "All services" / "Selected (N)". Quick actions per category: Select all, Clear. `aria-pressed` on service chips for accessibility.
- (rewrite) `src/components/features/staff/staff-approval-workspace.tsx` — Orchestrator + focused sub-components in one file: `PageHeader` (back link, avatar, name, status badge, dirty indicator), `DraftRestoreBanner` (localStorage restore offer), `StaffInformationCard` (3-col compact grid: name spans full width, others pair up), `ServiceSummaryCard` (count + up to 6 preview chips + "+X more" + "Edit services" button), `ApprovalSummaryPanel` (sticky right: branch/role/job/tier/status/services rows with change markers, service message green/orange, internal tier note, Approve & Activate / Save / Discard actions). Draft includes `isActive`. Lazy `useState` initializers read localStorage without `setState-in-effect`.

**Files Modified:**
- `src/app/(dashboard)/manager/staff/[staffId]/page.tsx` — maxWidth 760→1100, removed PageHeader+StaffEditForm, uses StaffApprovalWorkspace

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

### 2026-05-20 - Codex (BOOKING-HOME-SERVICES-001 - Public Home Service Availability)

**Task:** Fixed public booking home-service availability mismatch.

**Files Changed:**
- `src/lib/queries/branches.ts` - corrected the public booking branch-service query to read the same Home/Public branch-service source of truth used by admin service management, while preserving legacy fallbacks.
- `src/app/api/public/booking-context/route.ts` - preserved branch-specific custom duration in public booking service payloads.
- `src/app/(dashboard)/owner/branches/actions.ts` - updated service visibility writes to use current `visibility` first, with a legacy `booking_visibility` fallback.
- `src/lib/cache/cache-tags.ts` - changed branch-service cache invalidation to expire immediately after service setting changes.
- `src/types/supabase.ts` - synced local `branch_services` metadata fields with the live schema used by booking/admin queries.
- `eslint.config.mjs`, `.gitignore` - ignored Codex artifact output so temporary verification files do not get linted or shown as untracked source.
- `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `.context/ERRORS.cmd.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md` - updated project context and handoff notes.

**Notes:**
- Public booking now shows Home-enabled Public services for the selected branch.
- In-spa filtering, active-service filtering, branch scope, public visibility, branch price, branch duration, provider/date/payment/confirmation flow, and UI layout were preserved.
- No dummy services or hardcoded service names were added.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing.
- `pnpm build`: Passing, 80 routes.
- Public API smoke confirmed 6 Home-eligible public services and 3 non-Home services for the Cradle branch.
- Public `/book` smoke returned HTTP 200 OK.

---

### 2026-05-20 — Codex (BOOKING-MOBILE-SERVICE-GRID-001 — Mobile Booking Service Grid Patch)

**Task:** Patch the public booking wizard service selection UI so mobile service cards remain in a compact responsive grid with no page-level horizontal overflow.

**Files Changed:**
- `src/components/public/booking-service-picker.tsx`
  - Added stricter mobile card/grid containment (`w-full`, `min-w-0`, `max-w-full`, `overflow-hidden`).
  - Kept the compact image-top mobile card with `aspect-[4/3]`, responsive `next/image` sizes, and meaningful service alt text.
  - Constrained mobile category chip and loading skeleton rows so only the chip row scrolls horizontally.
  - Preserved live service data, category filtering, selected service state, and desktop card layout.
- `src/components/public/booking-wizard.tsx`
  - Added public mobile `w-full max-w-full overflow-x-hidden` wrappers.
  - Added `min-w-0` to the wizard content grid/main column to avoid layout-induced horizontal scroll.
  - Preserved booking flow logic, sticky/fixed action controls, desktop layout, and the floating circular widget.

**Verification:**
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing.
- `pnpm build`: Passing, 80 routes.
- Browser smoke test on `/book`: 360px -> 2-column grid, 390px/430px -> 3-column grid, 520px -> 4-column grid, 768px/desktop -> desktop layout, all with document-level horizontal overflow `0`.

---

### 2026-05-18 — Claude (BOOKING-PROVIDER-001 — Smart Provider Selection)

**Task:** Improve booking wizard provider selection so staff are filtered by service, shown as a premium photo grid, and auto-assigned when only one qualified provider is available.

**Problem solved:** The provider step always showed a 2-column initials-avatar grid regardless of how many (or few) providers were qualified. Services with only one qualified provider forced customers to make a trivial "choice." No photos were shown even though staff have `avatar_url` on record.

**Logic (3-case):**
1. **0 providers**: "Any available provider" card + dashed fallback note.
2. **1 provider**: Auto-assigned. Booking card shows provider name, photo, "Available and assigned for you." Customer can tap "Use any available provider instead" (sets `"prefer-auto"` sentinel) to opt out.
3. **2+ providers**: "Any available provider" (Recommended) card on top, then 4-column (2-column mobile) photo grid below. First provider gets a "Recommended" ribbon.

**State model (no useEffect):**
- `selectedStaff: "auto" | "prefer-auto" | staffId` — three semantic values
- `selectedStaffForBooking` useMemo resolves: `"prefer-auto"` → `"auto"`, specific id → validate still available, default `"auto"` + single provider → provider id
- No `setState` inside effects; no cascading renders.

**Files Modified:**
- `src/app/api/public/booking-context/route.ts` — Added `nickname` and `avatar_url` to primary select string and response mapping; extended `isMissingStaffOrgColumnsError` guard; added `nickname: null` / `avatar_url: null` to legacy fallback map.
- `src/components/public/booking-wizard.tsx` — `BookingContextStaff`, `StaffLookup`, `StaffOption` types updated with `avatarUrl`; `staffAtSlot()` prefers `nickname` over `name` as display; lookup build populates `avatarUrl`; `selectedStaffForBooking` handles 3-case auto-select logic; removed unused `STAFF_TYPE_LABELS` / `StaffType` imports; new `ProviderPhotoCard` component (photo/initials, recommended ribbon, selection ring); `StepTherapist` redesigned with 3 distinct cases; booking summary label updated to "Any available provider".

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

### 2026-05-18 — Claude (UI-WARNING-FRAMEWORK-001 — System-Wide Actionable Warning Framework)

**Task:** Create a reusable warning system so every warning in CradleHub is clickable and answers: what is wrong / why it matters / where to fix it / what happens on click.

**Problem solved:** Ad-hoc inline warning divs scattered across the app were non-interactive, had inconsistent styling, and gave no guidance on how to fix the issue. Managers had to navigate manually after seeing a warning.

**Architecture:**
- Type-discriminated `WarningActionType` drives a unified click handler: `scroll` → DOM smooth-scroll, `focus` → DOM focus+scroll, `navigate` → `router.push`, `open-panel`/`modal`/`custom` → `onAction(warning)` callback.
- Severity palette (danger/warning/success/info) matches all existing inline divs exactly — visual parity guaranteed.
- `warningTargets` factory pattern: pre-built targets for every known context (staff, scheduling, branches, services, bookings, dispatch, notifications, settings). Import only what you need; tree-shaking removes the rest.
- `compact` mode: collapses icon + description + impact to just title + action button for dense list contexts.

**Files Created:**
- `src/types/warnings.ts` — Core types: `WarningSeverity`, `WarningActionType`, `ActionableWarningTarget` (discriminated union of 6 types), `ActionableWarning`
- `src/lib/warnings/scroll-to-target.ts` — DOM helpers: `scrollToElement(id)`, `focusElement(id)`, `buildHref(href, tab?, query?)` (SSR-safe with `typeof window === "undefined"` guards)
- `src/lib/warnings/action-targets.ts` — `warningTargets` const object: 25+ factory functions covering all known CradleHub contexts (staff workspace, scheduling, branches, services, bookings, dispatch, notifications, settings, generic scroll/focus/custom)
- `src/components/shared/actionable-warning.tsx` — `ActionableWarning` card component. Severity-themed. Lucide icon wrapped in `<span>` (type-safe). `→` chevron on navigate targets. `aria-label` on action button, `role="alert|status"` on container.
- `src/components/shared/actionable-warning-list.tsx` — `ActionableWarningList` vertical stack. Renders nothing when empty.

**Files Modified:**
- `src/components/features/staff/staff-approval-workspace.tsx` — Reference integration: replaced 7 inline warning divs with `ActionableWarning` (protected-account danger, zero-services warning, missing-services info in ServiceSummaryCard; awaiting-approval, services warning/success, draft-saved success, save-result in ApprovalSummaryPanel). Added `id="approval-actions"` for scroll target. Added `onAction` prop to `ApprovalSummaryPanel` and wired `panelId === "service-editor"` → `setIsSheetOpen(true)`.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

### 2026-05-18 — Claude (BOOKING-SERVICES-001 — Premium Image-Card Services Step)

**Task:** Replace the text-card service list in the public booking wizard with portrait image cards grouped by category.

**Problem solved:** The services step rendered each service as a flat horizontal text row — functional but low-premium. The new design uses 4/5-aspect-ratio portrait photo cards with spa imagery, dark gradient overlays, and a +/✓ selection indicator — consistent with the ProviderPhotoCard aesthetic from BOOKING-PROVIDER-001.

**Design:**
- **Card**: `button` with `aspectRatio: "4/5"`, `next/image fill`, `object-cover`, `group-hover:scale-105`
- **Gradient**: `from-black/80 via-black/20 to-black/10` (bottom-heavy for text legibility)
- **Selection ring**: golden (`ring-[#C8A96B]`) when selected, neutral when not; +/✓ indicator top-right
- **Text panel** pinned to bottom: service name (line-clamp-2), duration faded left, price in gold right
- **Images**: category-name keyword mapping to `SPA_IMAGES` constants (no per-service DB column)

**Architecture:**
- `CATEGORY_IMAGE_KEYWORDS` array — ordered keyword list maps category name substrings to `SPA_IMAGES` paths
- `getCategoryImage(categoryName)` — pure function, first-match wins, falls back to `SPA_IMAGES.booking`
- `ServiceImageCard` — self-contained sub-component, receives pre-resolved `categoryImage`
- All grouping, category sidebar, selection toggle, totals, visit-type filtering: unchanged
- Loading skeleton updated to `grid grid-cols-2` with `aspect-ratio: 4/5` skeletons

**Files Modified:**
- `src/components/public/booking-service-picker.tsx` — full rewrite of card rendering; logic layer untouched

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors)
- `pnpm build`: ✅ Passing, 80 routes

---

### 2026-05-20 — Claude (STAFF-MOTION-001 — Premium Micro-Animations for Staff Portal Booking Progress Actions)

**Task:** Add tiny premium interaction feedback to the existing staff portal booking progress actions without changing the booking lifecycle, business logic, or UI layout.

**Files Created:**
- `src/components/shared/motion/premium-action-overlay.tsx` — reusable full-screen cream translucent overlay with forest-green spinner and short action title/description; shown while a server action is in-flight.
- `src/components/shared/motion/premium-success-toast.tsx` — fixed bottom-center slide-up toast for success (green), warning (amber, used for no-show), and error (red) feedback; auto-dismissed by parent via setTimeout.
- `src/components/shared/motion/premium-inline-spinner.tsx` — 13px circular spinner with white borders for use inside the green primary action button.
- `src/components/shared/motion/live-pulse-indicator.tsx` — small animated pulse dot + label; used when booking is in `travel_started` (green) or `session_started` (gold) states.
- `src/components/shared/motion/motion-status-dot.tsx` — animated status dot replacing the plain colored span in the compact stepper: done=green, active=gold pulse, pending=muted, warning=amber.

**Files Modified:**
- `src/components/features/staff-portal/booking-progress-actions.tsx` — added `actionFeedback` state, `getProgressFeedback()` helper, `PremiumActionOverlay` during server action, `PremiumSuccessToast`/error toast replacing `alert()`, inline spinner in buttons, `active:scale-[0.98]` press effect, `MotionStatusDot` in stepper, `LivePulseIndicator` next to timers for active travel/session states.
- `src/app/globals.css` — appended four named keyframes: `cradle-premium-pulse` (pulse ring for active dots), `cradle-soft-slide-up` (toast entrance), `cradle-check-pop` (icon pop-in), `cradle-card-glow` (ambient glow, available for future use).

**Notes:**
- No booking lifecycle logic was changed. `progress.ts` and `actions.ts` are untouched.
- No UI redesign: card layouts, desktop/mobile split, and booking card structure unchanged.
- No new npm packages installed. Animations use Tailwind `animate-spin` and custom CSS keyframes only.
- Existing staff portal flow (home-service and in-spa lifecycles, no-show) remains intact.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors, 0 warnings)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 80 app routes

---

### 2026-05-20 — Claude (CRM-NAV-001 — CRM Services Access + Nav Fixes)

**Task:** CRM and CSR Head roles were missing the Services page in their workspace. Fixed role guards, created the CRM services route, expanded branch-action authorization, and corrected a duplicate nav item.

**Files Created:**
- `src/app/(dashboard)/crm/services/page.tsx` — CRM-scoped services page using same `ServicesOfferedTab` component as manager, but with `CRM_SERVICE_ROLES` set (owner, manager, assistant_manager, store_manager, crm, csr_head); redirects to `/crm` on unauthorized.

**Files Modified:**
- `src/app/(dashboard)/owner/branches/actions.ts` — `requireOwnerOrBranchManager()` now includes `crm` and `csr_head` roles; added `revalidatePath("/manager/services")` and `revalidatePath("/crm/services")` to `removeBranchServiceAction`, `addBranchServiceAction`, and `updateBranchServiceEligibilityAction`.
- `src/components/features/dashboard/nav-config.ts` — added `{ label: "Services", href: "/crm/services", icon: "Sparkles" }` to `CRM_NAV_ITEMS` and `CSR_HEAD_NAV_ITEMS`; removed duplicate "My Schedule" from `STAFF_NAV_ITEMS`.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 81 app routes

---

### 2026-05-20 — Claude (MANAGER-STAFF-AVAILABILITY-001 — Manager Staff Availability Setup Page)

**Task:** Create a production-ready manager page for setting weekly working hours, day overrides, day off, and blocked time per staff member. The booking engine already respects `staff_schedules`, `schedule_overrides`, and `blocked_times` — this page exposes management of those tables to the manager.

**Route:** `/manager/staff-availability`

**Files Created:**
- `src/app/(dashboard)/manager/staff-availability/page.tsx` — Server component. Uses `getManagerBranchId()` for auth, `getStaffWithAvailability(branchId)` for data, renders `PageHeader` + `StaffSchedulePageClient`. Shows `Alert` on load error.

**Files Modified:**
- `src/lib/queries/staff.ts` — added `StaffAvailabilityItem` type, `buildAvailabilityItems()` helper (parallel fetch of schedules/overrides/blocked_times for all branch staff), and `getStaffWithAvailability(branchId)` export. Includes graceful fallback for older DB schemas missing `staff_type`/`is_head`/`nickname` columns. Fetches overrides and blocked times scoped to next 90 days.
- `src/components/features/staff-schedule/staff-weekly-hours-editor.tsx` — added optional `onSave?: () => void` prop; called after successful schedule save.
- `src/components/features/staff-schedule/staff-day-overrides-editor.tsx` — added optional `onSave?: () => void` prop; called after successful override save.
- `src/components/features/staff-schedule/staff-block-time-editor.tsx` — added optional `onSave?: () => void` prop; called after successful blocked-time save.
- `src/components/features/staff-schedule/staff-schedule-detail-panel.tsx` — added `onSave?: () => void` prop; threaded down to each editor tab.
- `src/components/features/staff-schedule/staff-schedule-page-client.tsx` — wired `PremiumSuccessToast` (from existing motion library) to fire when any editor tab saves; toast shows staff member's name and auto-dismisses after 3.5 s. Added `useCallback` for `handleSave`.
- `src/components/features/dashboard/nav-config.ts` — added `{ label: "Availability", href: "/manager/staff-availability", icon: "CalendarClock" }` to `MANAGER_NAV_ITEMS` (after "Staff").
- `src/app/(dashboard)/manager/staff/actions.ts` — all four server actions (`setStaffScheduleAction`, `createScheduleOverrideAction`, `deleteBlockedTimeAction`, `deleteScheduleOverrideAction`) now also call `revalidatePath("/manager/staff-availability")`.

**Design decisions:**
- Route at `/manager/staff-availability` (not `/manager/staff/schedule`) to avoid route conflict with `/manager/staff/[staffId]` dynamic segment.
- All staff in branch visible (active and inactive) so manager can set availability before re-activating staff.
- Editors keep existing inline inline-banner feedback for immediate response; `PremiumSuccessToast` adds a global confirmation at the page level.
- No DB schema changes. No new npm packages. Booking lifecycle logic untouched.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 82 app routes

---

### 2026-05-20 — Codex (SCHEDULE-ADJUSTMENT-001 — Manual Staff Schedule Adjustment)

**Task:** Added a compact manual staff schedule adjustment control to the existing Manager/CRM schedule workflow.

**Files Created:**
- `src/lib/actions/staff-schedule-adjustments.ts` — shared `adjustStaffScheduleAction` with RBAC, branch scope, date override/block CRUD, and schedule/bookings/booking-page revalidation.
- `src/components/features/schedule/manual-staff-schedule-adjustment.tsx` — compact staff-mode adjustment UI for custom hours, day off, block time, clear override, and remove block.

**Files Changed:**
- `src/components/features/schedule/schedule-workspace.tsx` — added schedule-adjustment toast feedback and refresh after successful adjustments.
- `src/components/features/schedule/schedule-board-panel.tsx` — threaded adjustment feedback into staff view mode.
- `src/components/features/schedule/schedule-staff-mode.tsx` — added the manual adjustment section below the selected staff summary.
- `src/lib/queries/schedule.ts` — enriched daily schedule rows with current date override and real blocked-time IDs for safe removal.
- `src/lib/permissions.ts` — added `canAdjustStaffSchedule()` for owner/manager/assistant manager/store manager/CRM/CSR head schedule edits.
- `.context/CURRENT_TASK.cmd.md`, `.context/HANDOFF.cmd.md`, `.context/ERRORS.cmd.md`, `docs/PROJECT_CONTEXT.md` — updated agent context.

**Notes:**
- Manager/CRM can now adjust one staff member's availability from `/manager/schedule` and `/crm/schedule` staff mode.
- Weekly schedules remain intact; custom hours/day off are date-specific overrides.
- Booking availability and assignment continue to use the existing availability engine, which already prioritizes overrides/blocks before weekly schedules.
- No database schema changes, new packages, UI redesign, or scheduling engine rewrite.

**Verification:**
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing, 83 app routes

---

### 2026-05-21 — Claude Code

**Task:** CRM-OPS-001 — Exposed categorized CRM operations navbar and fixed CRM landing route

**Files Changed:**
- `src/components/features/dashboard/nav-config.ts` — Added `NavGroup` type; replaced flat `CRM_NAV_ITEMS`, `CSR_HEAD_NAV_ITEMS`, `CSR_STAFF_NAV_ITEMS` with grouped nav configs using 5 operational categories
- `src/components/features/dashboard/sidebar.tsx` — Extracted `NavLink` helper, added grouped nav rendering (renders category labels + items when `nav.groups` is set; falls back to flat `nav.items` for owner/manager/staff — no breaking changes), added `CalendarClock` to icon map
- `src/app/(dashboard)/crm/page.tsx` — Changed CRM landing redirect from `/crm/today` to `/crm/control`

**CRM Nav Categories Added:**
1. Main Operations — Control, Live Map, Dispatch, Bookings, Schedule, Availability
2. Customer Management — Customers, Repeats, Lapsed, Waitlist
3. Service & Resource Setup — Services, Spaces
4. Staff & Internal Work — Staff Applications, Notifications
5. Finance / End-of-day — Reconciliation

**Design Decisions:**
- Used existing route paths (`/crm/live-operations`, `/crm/staff-availability`, `/crm/spaces-rules`) with cleaner display labels to avoid unnecessary redirect pages
- Grouped nav only applies to CRM roles; owner/manager/staff remain flat (backward compatible)
- `NavGroup` type added to `WorkspaceNav`; `items` made optional so the type supports both flat and grouped configs

**Roadmap Items Completed:** Phase 1 CRM operations navigation stabilization

**Notes:** Worked directly on `main`; no branch/worktree created. All 15 required CRM pages already existed — no placeholder pages needed. No scheduling/dispatch business logic changed. No new packages installed. No database or RLS changes.

**Build Status:** ✅ Passing — 83 app routes

---

### 2026-05-21 — Claude Code

**Task:** CRM-OPS-002A — Audited shift-aware schedule and availability foundation

**Files Created:**
- `docs/phase-2-shift-aware-availability-audit.md` — Technical audit covering schedule model, availability engine, CRM pages, dispatch readiness, staff capability mapping, and Phase 2B–2D implementation plan

**Key Findings:**
- `staff_schedules` UNIQUE `(staff_id, day_of_week)` blocks opening+closing shift support
- `/crm/staff-availability` is a Schedule Setup editor mislabeled as "Availability"
- No staff check-in/check-out table exists
- `getAvailableBranchDrivers()` is not schedule-aware
- Real `/crm/availability` live view can be built from existing data (no new tables needed for Phase 2B)

**Roadmap Items Completed:** Phase 2A audit — shift-aware availability foundation

**Notes:** Audit only. No new tables, no migrations, no engine changes, no UI rewrites. All findings documented in audit doc.

**Build Status:** ✅ Passing — 83 app routes (no code changed)

---

### 2026-05-21 — Claude Code (CRM-OPS-002B — CRM Live Availability Dashboard)

**Task:** Create the `/crm/availability` live availability dashboard from existing data (no schema changes).

**Files Created:**
- `src/lib/queries/crm-availability.ts` — `getCrmAvailabilitySnapshot()` combining `getDailySchedule` + `getStaffByBranch`; builds `liveStatus`, `scheduleStatus`, `is_driver`, summary counts
- `src/app/(dashboard)/crm/availability/page.tsx` — Server component at `/crm/availability`
- `src/components/features/crm/availability/crm-availability-summary.tsx` — 6 stat cards (Scheduled / Available / Busy / Off / No Schedule / Drivers Ready)
- `src/components/features/crm/availability/crm-availability-board.tsx` — Staff availability grid rows
- `src/components/features/crm/availability/crm-availability-client.tsx` — Tabbed client: All Staff / Service Providers / Drivers / Schedule Issues

**Files Modified:**
- `src/components/features/dashboard/nav-config.ts` — CRM "Availability" → `/crm/availability`; added "Schedule Setup" → `/crm/staff-availability`
- `src/app/(dashboard)/crm/staff-availability/page.tsx` — Title changed "Staff Availability" → "Schedule Setup"

**Build Status:** ✅ Passing — 84 app routes | **Commit:** `6efd4fc` on main

---

### 2026-05-21 — Claude Code (CRM-OPS-002C — Shift-Aware Schedules + UI Redesign)

**Task:** Add `shift_type` to staff schedules, update booking engine RPCs, and redesign Schedule Setup + Live Availability UIs.

**Files Created:**
- `supabase/migrations/20260522000004_add_shift_type_to_staff_schedules.sql`
  - Adds `shift_type TEXT NOT NULL DEFAULT 'single'` with CHECK (`single | opening | closing`)
  - Replaces UNIQUE `(staff_id, day_of_week)` with `(staff_id, day_of_week, shift_type)`
  - Rewrites `get_available_slots` with `SELECT DISTINCT` in `working_hours` CTE + final SELECT
  - Rewrites `get_daily_schedule` with `GROUP BY sid` + `MIN`/`MAX` aggregation

**Files Modified:**
- `src/types/supabase.ts` — Added `shift_type` to `staff_schedules` Row/Insert/Update (manual edit; `pnpm db:types` not run)
- `src/lib/validations/staff.ts` — `setScheduleSchema` includes `shiftType` enum field (default `'single'`)
- `src/app/(dashboard)/manager/staff/actions.ts` — Upsert includes `shift_type`; `onConflict` updated
- `src/lib/queries/staff.ts` — `StaffAvailabilityItem.schedules` typed with `shift_type`; queries include column
- `src/lib/utils/staff-schedule-summary.ts` — Added `ShiftType`, `SHIFT_LABELS`, `getPrimaryShiftForDay`; `summarizeWeeklyHours` handles multi-shift days
- `src/components/features/staff-schedule/staff-schedule-list.tsx` — Local `Schedule` type with `shift_type?`
- `src/components/features/staff-schedule/staff-schedule-row.tsx` — `ShiftBadge` component + `SHIFT_BADGE_COLORS`
- `src/components/features/staff-schedule/staff-weekly-hours-editor.tsx` — Day detection prefers `shift_type === 'single'` row
- `src/components/features/dashboard/schedule-manager.tsx` — Local `Schedule` type with `shift_type?`
- `src/lib/queries/crm-availability.ts` — Added `StaffShiftEntry`, `shifts[]`, `needsAttention`; third parallel query
- `src/components/features/crm/availability/crm-availability-summary.tsx` — Added Needs Attention card
- `src/components/features/crm/availability/crm-availability-board.tsx` — Full 4-column redesign per mockup
- `src/components/features/crm/availability/crm-availability-client.tsx` — New tabs: Live Board / Staff List / Schedule Issues / Driver Readiness
- `src/app/(dashboard)/crm/availability/page.tsx` — Updated description + schedule-based disclaimer banner
- `src/app/(dashboard)/crm/staff-availability/page.tsx` — Full redesign with ExplainerCards + ShiftPill legend
- `.context/CURRENT_TASK.cmd.md` — Marked DONE

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

**Notes:**
- `pnpm db:types` was NOT run — local Supabase unavailable. `src/types/supabase.ts` manually updated.
- Run `pnpm db:types` after applying the migration to a live DB.
- Existing single-shift schedules fully preserved (`shift_type = 'single'` default).
- Opening/closing split shifts are supported by engine and UI but not yet exposed in the weekly hours editor UI for creation.

---

### 2026-05-21 — Claude Code (CRM-OPS-002D — Staff Check-in / Check-out Truth)

**Task:** Add staff shift check-ins table and wire physical presence into CRM Live Availability.

**Files Created:**
- `supabase/migrations/20260523000001_staff_shift_checkins.sql` — `staff_shift_checkins` table, indexes, RLS, `fn_update_updated_at` trigger, data API grants
- `src/lib/actions/staff-checkins.ts` — `checkInStaffForShiftAction`, `checkOutStaffForShiftAction`, `getStaffCheckinForDate`, `getBranchCheckinsForDate`
- `src/components/features/staff-portal/staff-checkin-widget.tsx` — staff self-check-in/out widget for staff portal

**Files Modified:**
- `src/types/supabase.ts` — added `staff_shift_checkins` Row/Insert/Update (manual; run `pnpm db:types` after migration)
- `src/lib/queries/crm-availability.ts` — added `PresenceStatus` type, fourth parallel check-in query, updated `LiveStatus` enum, updated `liveStatus`/`presenceStatus` logic, drivers-ready requires checked-in status, `branchId` added to snapshot
- `src/components/features/crm/availability/crm-availability-summary.tsx` — new summary cards: Checked In, Not Checked In, updated Drivers Ready
- `src/components/features/crm/availability/crm-availability-board.tsx` — 5-column board (Available/Busy/Not Checked In/Off+Out/Needs Attention), `PresenceBadge`, check-in/out action buttons
- `src/components/features/crm/availability/crm-availability-client.tsx` — Staff List + Driver Readiness tabs with presence pills + check-in/out buttons; footer updated
- `src/app/(dashboard)/crm/availability/page.tsx` — banner updated to "check-in enabled"
- `src/app/(dashboard)/staff-portal/page.tsx` — fetches check-in status; renders `StaffCheckinWidget` on desktop + mobile

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

---

### 2026-05-21 — Claude Code (CRM-OPS-002E — Schedule Setup Universal Group UI)

**Task:** Redesign `/crm/staff-availability` into a professional Schedule Setup workspace with universal group schedules and individual adjustments.

**Files Created:**
- `src/components/features/staff-schedule/schedule-setup-workspace.tsx` — Main tabbed orchestrator (General Rules / Individual Adjustments / Overrides / Coverage Issues)
- `src/components/features/staff-schedule/schedule-setup-helper-bar.tsx` — Bottom "How it works" helper bar
- `src/components/features/staff-schedule/schedule-overrides-view.tsx` — Overrides tab content (day-off overrides + blocked times summaries)

**Files Modified:**
- `src/app/(dashboard)/crm/staff-availability/page.tsx` — Replaced inline explainer cards with `ScheduleSetupWorkspace`; added page actions (Coverage Overview / Publish Schedules placeholders)

**Pre-existing untracked components brought into the workspace:**
- `src/components/features/staff-schedule/schedule-group-cards.tsx` — Horizontal staff group cards with real computed counts
- `src/components/features/staff-schedule/group-schedule-rules-panel.tsx` — Universal rules panel with shift templates, weekly pattern matrix, schedule summary, overlap window
- `src/components/features/staff-schedule/schedule-setup-right-rail.tsx` — Group overview, coverage insight bars, quick actions
- `src/components/features/staff-schedule/schedule-coverage-issues.tsx` — Coverage issues list (no schedule, no opening, on leave)

**Design Decisions:**
- Existing individual schedule editing (`StaffSchedulePageClient`) preserved under the "Individual Adjustments" tab.
- No new database schema introduced — universal schedule persistence is UI-shell only with clear placeholder messaging.
- Real computed staff counts used in group cards and right rail; no fake data.
- Responsive: group cards scroll horizontally on mobile; right rail stacks below main content.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes

---

### 2026-05-21 — Claude Code (CRM-OPS-002E-A — Individual Adjustments UI Polish)

**Task:** Redesign the Individual Adjustments tab inside Schedule Setup for better scannability, cleaner filters, status chips, and summary stats.

**Files Modified:**
- `src/components/features/staff-schedule/staff-schedule-page-client.tsx` — Added horizontal stat strip (Total Staff, Scheduled, Not Scheduled, With Overrides, With Blocks, Inactive) computed from real data.
- `src/components/features/staff-schedule/staff-schedule-toolbar.tsx` — Replaced filter dropdown with filter pills/chips; improved search input focus ring; added custom select arrow; cleaner layout.
- `src/components/features/staff-schedule/staff-schedule-list.tsx` — Polished table header with warm background; better column proportions; centered override/block columns.
- `src/components/features/staff-schedule/staff-schedule-row.tsx` — Added colored avatars; `StatusChip` component (Scheduled/Off/Inactive as pill badges); `CountBadge` for overrides/blocks; `ShiftBadge` uses uppercase pill style; "Manage" button upgraded to `cs-btn-secondary`; hover states preserved.

**Design Decisions:**
- All stats are computed from real `items` prop — no fake data.
- Existing `StaffScheduleDetailPanel` sheet editor is untouched.
- Filter pills are clickable buttons with active/hover states matching CradleHub sand theme.
- Status chips use existing `--cs-success`, `--cs-neutral`, `--cs-error` tokens.
- Responsive: stat strip scrolls horizontally on mobile; filter pills wrap.

**Verification:**
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 0 warnings)
- `pnpm build`: ✅ Passing, 84 app routes
