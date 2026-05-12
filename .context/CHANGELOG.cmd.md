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
