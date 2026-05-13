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
