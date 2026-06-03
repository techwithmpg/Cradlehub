# HANDOFF - Driver Staff Portal Mobile UI: COMPLETE

## Status

Build verified. 96 routes. Driver Staff Portal mobile UI complete.

## What changed

**New driver server actions** in `actions.ts`:
- `getMyDriverJobsAction(date)` — today's dispatch jobs via `getDispatchData(role="driver")`
- `getMyDriverAllJobsAction()` — last 30 days of jobs for the "All" tab (direct `driver_id` query)
- `getMyDriverJobByIdAction(bookingId)` — single job with driver safety check (`driver_id === me.id`)
- `getMyDriverStatsAction(year, month)` — monthly stats queried by `driver_id`

**18 new driver components** in `src/components/features/staff-portal/driver/`:
- `driver-mobile-bottom-nav.tsx` — Home, Dispatch, Map, Jobs, More
- `driver-header.tsx` — logo, "STAFF · DRIVER", bell, avatar
- `driver-greeting-card.tsx` — greeting + On Route / Arrived / In Progress / On Duty / Off Duty status
- `driver-today-overview-card.tsx` — route status, job count strip, View Route button
- `driver-next-stop-card.tsx` — next active stop with countdown badge, address, service, time
- `driver-quick-actions.tsx` — Map View, Jobs, Update Status, My Stats
- `driver-mobile-home.tsx` — assembles all home cards
- `driver-dispatch-card.tsx` — individual dispatch item card with status badge
- `driver-dispatch-page.tsx` — client: Upcoming / History tabs
- `driver-route-map-page.tsx` — route overview list + map placeholder + Google Maps navigation links
- `driver-job-status-stepper.tsx` — Assigned → On Way → Arrived → In Progress → Completed
- `driver-job-details-page.tsx` — full job detail with stepper, Start Travel / Mark Arrived actions (reuses `updateBookingProgressAction`)
- `driver-job-timeline.tsx` — timestamped progress timeline
- `driver-active-job-page.tsx` — active job with elapsed timer (reuses `TrackingTimer`)
- `driver-job-card.tsx` — compact job card for list
- `driver-jobs-list-page.tsx` — Today / All tabs with summary strip
- `driver-stats-page.tsx` — driver stats by driver_id (completed, total, rate)
- `driver-more-menu.tsx` — Account + Work (Jobs, Map, Dispatch History) + Support with server logout

**New routes (4)**:
- `/staff-portal/map` — DriverRouteMapPage
- `/staff-portal/jobs` — DriverJobsListPage
- `/staff-portal/jobs/active` — DriverActiveJobPage
- `/staff-portal/jobs/[bookingId]` — DriverJobDetailsPage

**Updated pages**:
- `page.tsx` (home): driver mode → `DriverMobileHome`
- `dispatch/page.tsx`: driver mode → `DriverDispatchPage` on mobile; `HomeServiceDispatchWorkspace` on desktop (unchanged)
- `stats/page.tsx`: driver mode → `DriverStatsPage`
- `more/page.tsx`: driver mode → `DriverMoreMenu`

**Key design decisions**:
- `updateBookingProgressAction` reused for Start Travel (travel_started) and Mark Arrived (arrived) — no duplicate progress system
- `TrackingTimer` reused in active job page for elapsed time
- `getDispatchData(role="driver")` reused with `driver_id` filter — no new dispatch table
- Map page uses Google Maps links (lat/lng or address) — no new map library
- Dispatch page detects driver via `system_role === "driver"` OR `staff_type === "driver"`
- Therapist Portal, Basic Staff Portal, CRM dispatch completely untouched

## Verification

- tsc: PASS, lint: PASS (0 errors, 2 pre-existing warnings), build: PASS (96 routes)
- Zero TypeScript `any` in new files
- Authenticated visual check needs valid local driver session

---

# HANDOFF - Therapist Staff Portal Mobile UI: COMPLETE

## Status

Build verified. 93 routes. Therapist Staff Portal mobile UI complete.

## What changed

**New action:** `getMyServiceProgressAction(date)` in `actions.ts` — fetches all non-cancelled today's bookings split into `active` / `completed` arrays.

**13 new therapist components** in `src/components/features/staff-portal/therapist/`:
- `therapist-mobile-bottom-nav.tsx` — Home, Schedule, **Service Progress**, Stats, More
- `therapist-header.tsx` — sticky logo + role + bell + avatar
- `therapist-greeting-card.tsx` — greeting + service-aware status (In Service / Traveling / On Duty / Day Off / No Shift)
- `therapist-shift-card.tsx` — My Shift Today card
- `therapist-next-service-card.tsx` — Next Service with countdown badge + room/home-service context
- `therapist-quick-actions.tsx` — My Schedule, Service Progress, Dispatch, My Stats
- `therapist-mobile-home.tsx` — assembles all home cards
- `therapist-service-progress-card.tsx` — service card reusing `BookingProgressActions`
- `therapist-service-progress-page.tsx` — client: Active / Completed tabs
- `therapist-schedule-list.tsx` — compact day cards with appointment chips
- `therapist-week-detail.tsx` — day picker + timeline with appointments
- `therapist-stats.tsx` — booking-based stat cards (completed, revenue, rate)
- `therapist-more-menu.tsx` — Account + Work + Support sections with inline logout

**New route:** `/staff-portal/service-progress` — service progress tabs for therapists.

**Updated pages:** home, schedule, week, stats, more — all now route therapist mode to therapist components.

**Key reuse decisions:**
- `BookingProgressActions` unchanged and embedded in service progress cards (no duplicate progress system)
- `TrackingTimer` already used inside `BookingProgressActions`
- Dispatch page at `/staff-portal/dispatch` unchanged (therapist home links there)
- Basic Staff Portal (`basic/` components) untouched
- Driver Portal untouched

## Verification

- tsc: PASS, lint: PASS, build: PASS (93 routes)
- Zero TypeScript `any` in new files
- Authenticated visual check needs valid local therapist session

---

# HANDOFF - Basic Staff Portal Mobile UI: COMPLETE

## Status

Build verified. CradleHub now has a complete Basic Staff Portal mobile UI for non-therapist, non-driver staff.

## What changed

### Staff portal mode helper

Added `src/lib/staff/get-staff-portal-mode.ts`.

- Exports `StaffPortalMode = "basic" | "therapist" | "driver" | "crm_staff"`.
- `getStaffPortalMode(staff)` checks `system_role` and `staff_type` to determine mode.
- `isBasicStaffMode(mode)` returns true for `"basic"` and `"crm_staff"`.

### New server actions

Added to `src/app/(dashboard)/staff-portal/actions.ts`:
- `getMyTodayScheduleAction(date)` — fetches today's shift schedule row and override for the home page.
- `getMyMonthlyScheduleStatsAction(year, month)` — computes working days, days off, hours scheduled from `staff_schedules` + `schedule_overrides`.

### Updated week types

`src/lib/staff-portal/week.ts`: `WeekResult.staff` now includes `nickname`, `staff_type`, `avatar_url`, `avatar_path` in its type, reflecting what `getMyWeekAction` already returns at runtime.

### Basic staff components (10 new files)

All in `src/components/features/staff-portal/basic/`:
- `basic-staff-header.tsx` — sticky top bar with logo, role, bell, avatar
- `basic-staff-greeting-card.tsx` — greeting + On Duty / Day Off / No Shift status badge
- `basic-staff-shift-card.tsx` — "My Shift Today" with time range, shift type, View Full Schedule
- `basic-staff-assignment-card.tsx` — "Next Assignment" without service progress controls; empty state
- `basic-staff-quick-actions.tsx` — 2×2 quick action grid (Schedule, Week, Stats, Profile)
- `basic-staff-mobile-home.tsx` — assembles cards + StaffMobileBottomNav
- `basic-staff-mobile-schedule.tsx` — client: compact day cards + filter chips (All/On Duty/Day Off/Booked/Blocked)
- `basic-staff-week-detail.tsx` — client: horizontal day picker + selected day detail + timeline + notes
- `basic-staff-stats.tsx` — schedule-based stat cards (working days, days off, hours, avg daily hours)
- `basic-staff-more-menu.tsx` — More menu with Account + Support sections; inline "use server" logout action

### New route

`src/app/(dashboard)/staff-portal/more/page.tsx` — `/staff-portal/more` route renders `BasicStaffMoreMenu`.

### Updated pages

- `page.tsx` (home) — detects mode; basic → `BasicStaffMobileHome`, therapist/driver → existing `StaffMobileHome`
- `schedule/page.tsx` — basic on mobile → `BasicStaffMobileSchedule`; others → existing `StaffSchedulePage`
- `week/page.tsx` — basic on mobile → `BasicStaffWeekDetail`; others → existing `MyWeekPage`
- `stats/page.tsx` — basic → `BasicStaffStats` (schedule stats); others → existing booking stats

### Bottom nav

`staff-mobile-bottom-nav.tsx` — "More" now links to `/staff-portal/more` (was `/staff-portal/profile`); active detection covers `/staff-portal/more`, `/staff-portal/profile`, `/staff-portal/notifications`, `/staff-portal/settings`.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `pnpm lint`: PASS (0 errors, 2 pre-existing warnings in scripts/)
- `pnpm build`: PASS, 92 routes (+1 `/staff-portal/more`)
- Zero TypeScript `any` in new/modified files
- Therapist portal flows (StaffMobileHome, StaffSchedulePage, MyWeekPage) not modified
- Driver portal flows not modified
- Profile page locked fields (role/type/tier) preserved — existing server action only updates full_name and nickname

## Browser note

Authenticated visual check still needs a valid local staff session. Login as a utility/CSR/front-desk staff user (not therapist, not driver) and open `/staff-portal` on mobile viewport to see the Basic Staff Portal mobile UI.

---

# HANDOFF - Multi-workspace switching: COMPLETE

## Status

Build verified. CradleHub now has a shared workspace-access resolver, `/select-workspace`, an account setup fallback, and a premium setup-center-style switching overlay.

## What changed

### Workspace access model

Added `src/lib/auth/workspace-access.ts`.

- Defines `WorkspaceKey`, `WorkspaceAccess`, and typed profile input.
- Builds workspace access from the active staff profile without creating duplicate accounts or separate logins.
- Returns CRM for operational/admin roles, Owner for owners, Manager for manager roles, Staff Portal for active non-driver/non-utility staff, Driver Portal for `system_role` or `staff_type` driver, and Utility Portal to preserve the existing utility workspace.
- Provides `getWorkspaceSwitchDestination()` for login/proxy redirects.

Added `src/lib/auth/get-user-workspace-access.ts`.

- Loads current user workspace access from Supabase.
- Preserves super-admin and local dev-bypass behavior.

### Login and route guard

Changed `src/app/(auth)/login/actions.ts`.

- After successful login, calls `getUserWorkspaceAccess(user.id)`.
- Redirects zero-workspace users to `/account/setup`.
- Redirects single-workspace users directly to that workspace.
- Redirects multi-workspace users to `/select-workspace`.

Changed `src/proxy.ts`.

- Replaced single-role workspace redirects with workspace-access checks.
- Allows multi-access users into every entitled workspace.
- Blocks unauthorized manual visits server-side and redirects to `/select-workspace` when multiple authorized options exist.
- Removes the old owner/manager forced-to-CRM behavior.

### Selector and setup fallback

Added `src/app/(dashboard)/select-workspace/page.tsx`.

- Premium centered workspace selector.
- Shows only authorized workspace cards with icon, label, description, branch chip, and Open Workspace action.
- Single-workspace users are redirected out of the selector.

Added `src/app/account/setup/page.tsx`.

- Authenticated fallback for users with login access but no usable workspace.
- Shows pending/rejected/no-profile messaging from onboarding status where available.

### Switching transition

Added `src/components/shared/workspace-switching-loader.tsx`.

- Uses the existing setup-center `CrmPremiumLoader`.
- Renders centered blurred/dimmed overlay with CradleHub mark and warm card styling.

Added `src/components/shared/workspace-switch-link.tsx`.

- Client wrapper for workspace navigation.
- Prevents repeated clicks, shows loader immediately, uses `router.push()`, has a fail-safe timeout, and shows a Sonner error if push throws.

### Header and driver compatibility

Changed `src/components/features/dashboard/header.tsx`.

- Adds a profile dropdown with My Profile, Switch Workspace, Settings, Help & Support, and Logout.
- Shows Switch Workspace only when the user has more than one workspace.

Changed `src/app/(dashboard)/layout.tsx`.

- Fetches workspace access and passes it into the header.

Changed `src/app/(dashboard)/driver/page.tsx` and `src/app/(dashboard)/driver/dispatch/page.tsx`.

- Driver portal now allows staff with `staff_type = driver`, not only `system_role = driver`.

## Verification

- `npx tsc --noEmit --pretty false`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS, with 2 pre-existing warnings in `scripts/generate-service-image-assets.mjs`
- `pnpm build`: PASS, 91 routes
- Focused scan for `any`, `@ts-ignore`, and direct `console.` in touched files: PASS
- In-app browser reached `http://localhost:3000/select-workspace` and correctly redirected unauthenticated traffic to `/login`.

## Browser note

Authenticated click-through still needs local test sessions for CRM-only, Staff-only, CRM+Staff, Driver, Owner/Admin, and no-workspace users. Code-level checks and unauthenticated proxy behavior are verified.

## Follow-up fix: Staff Portal shell nav

After user screenshot review, fixed `src/components/features/dashboard/sidebar.tsx` so path-derived workspace identity wins over role-derived CRM/CSR identity. Multi-access users visiting `/staff-portal/*` now get `NAV_CONFIG.staff` and Staff Portal sidebar metadata instead of CSR/CRM navigation. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; in-app browser reached `/staff-portal/profile` but redirected unauthenticated traffic to `/login`.

## Follow-up fix: Staff Portal self-edit profile

Added `src/components/features/staff-portal/staff-profile-details-form.tsx` and `updateMyProfileDetailsAction` in `src/app/(dashboard)/staff-portal/actions.ts`. Staff users can edit only `full_name` and `nickname` on their own staff row. `system_role`, `staff_type`, and `tier` are displayed as locked read-only fields and remain controlled by owner/manager/CRM staff management flows. The server action validates the authenticated user, updates only the linked staff row via the server admin client, and hard-codes the allowed update payload. Also fixed the staff portal profile lookup to load real `staff_type`, `avatar_url`, and `avatar_path` fields instead of forcing them to null. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; authenticated save click-through still needs a local staff session.

## Follow-up fix: Staff Portal role dropdowns

Per latest user request, updated the Staff Portal profile form so `system_role` and `staff_type` are editable dropdowns sourced from `SYSTEM_ROLE_OPTIONS` and `STAFF_TYPE_OPTIONS`. `updateMyProfileDetailsAction` now validates those values against `SYSTEM_ROLES` and `STAFF_TYPES`, then updates `full_name`, `nickname`, `system_role`, and `staff_type` on the authenticated user's own staff row. Tier remains read-only. Save button keeps the `Loader2` in-button spinner while pending. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; browser route check redirected unauthenticated traffic to `/login`.

## Follow-up fix: Staff Portal visible save button

Moved the Staff Portal profile `Save Changes` button into the `Account Details` card header so staff can see it immediately. The button now uses a dedicated submit component with React DOM `useFormStatus()` so the inline `Loader2` spinner and `Saving` label reflect the active form submission. Verified with `npx tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`; local route reachability still redirects unauthenticated traffic to `/login`, so final visual save confirmation needs a logged-in staff session.
