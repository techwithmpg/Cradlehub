# CURRENT TASK: ONBOARD-001 — Eliminate Legacy Invite Flow, Refine Public Onboarding

## Overview
Removed the insecure legacy invite flow (`/onboard/[staffId]`) that created incomplete staff records and had no auth checks. The public `/staff-onboarding` page is now the single, secure entry point for all staff applications.

## What changed
1. **Deleted legacy invite claim flow:**
   - `/onboard/[staffId]` page and form removed
   - `/onboard` now redirects to `/staff-onboarding`
   - `onboardStaffAction` removed (was creating confirmed auth users without verifying caller)
   - `generateInviteAction` removed (was creating incomplete "Pending Invitation" staff rows)
   - `getStaffForOnboard` query removed (unused)

2. **Refined public onboarding:**
   - `submitStaffOnboardingAction` now sets `staff_type` based on the applicant's selected role (`therapist`, `csr`, `driver`, `utility`, `other`)
   - `requested_branch_id` now correctly falls back to the first available branch (fixes manager review visibility)
   - `approveOnboardingAction` now derives `staff_type` from the request's `preferred_role` on activation

3. **Updated owner invite page:**
   - `/owner/staff/invite` now displays the public onboarding URL and access code
   - No more per-staff invite links — owners/managers simply share the onboarding link + code

4. **Updated audit report:**
   - Marked C5 (`onboardStaffAction` security flaw) and H4 (`generateInviteAction` validation) as FIXED
   - RBAC score bumped from 6→7

## Files changed
- `src/app/onboard/[staffId]/page.tsx` — DELETED
- `src/app/onboard/[staffId]/onboard-form.tsx` — DELETED
- `src/app/onboard/page.tsx` — CREATED (redirect)
- `src/lib/queries/staff.ts` — removed `getStaffForOnboard`
- `src/app/(dashboard)/owner/staff/actions.ts` — removed `generateInviteAction` and `onboardStaffAction`
- `src/app/(dashboard)/owner/staff/invite/page.tsx` — rewritten as read-only info page
- `src/app/(dashboard)/owner/staff/invite/invite-form.tsx` — rewritten to show onboarding URL + code
- `src/app/staff-onboarding/actions.ts` — added `staff_type` mapping, fixed branch fallback
- `docs/MVP_SYSTEM_SCORE_REPORT.md` — updated scores and risk table

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing
- `pnpm build`: ✅ Passing (76 routes)
