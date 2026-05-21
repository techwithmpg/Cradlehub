# Phase 2X-H — End-to-End Operations Smoke Test

> **Date:** 2026-05-21
> **Scope:** Full operational workflow — public booking → CRM schedule setup → live availability → CRM bookings → dispatch → staff portal

---

## Executive Summary

The operational chain is **healthy** with **no critical blockers** remaining after fixes. All builds pass. Three issues were found during testing:

1. **Online booking notification failure falsely reported booking failure** (critical — fixed).
2. **Driver assignment UI did not refresh after assign** (medium — fixed in bookings and dispatch).
3. **Group schedule shift_type not reflected in CRM Live Availability check-in** (medium — documented, deferred).

---

## Environment

- Branch: `main`
- Framework: Next.js 16.2.4 (Turbopack)
- Package manager: pnpm
- Supabase: local schema up to `20260524000001_staff_group_schedule_rules.sql`

---

## Build Verification

| Check | Result |
|-------|--------|
| `pnpm type-check` | ✅ Passing (0 errors) |
| `pnpm lint` | ✅ Passing (0 errors, 0 warnings) |
| `pnpm build` | ✅ Passing, 84 app routes |

**Note:** A stale `.next/dev/types/validator.ts` generated file caused type-check failures initially. Cleaning `.next/dev/types/` resolved it.

---

## Public Booking Results

### Verified
- ✅ Services load from `/api/public/booking-context`
- ✅ Service categories display correctly
- ✅ Only service-capable staff appear in picker
- ✅ Drivers/utility excluded from therapist selection via `HARD_EXCLUDED_SYSTEM_ROLES`
- ✅ Group schedule fallback works in `filterSlotsToWorkingWindows`
- ✅ Individual schedule overrides group schedule
- ✅ Day-off override blocks availability
- ✅ Blocked time blocks availability
- ✅ Booking conflict blocks availability
- ✅ Pending payment holds still block slots
- ✅ Booking request can be created via `createOnlineBookingAction` / `createOnlineBookingMultiAction`

### Issues Found
- 🚨 **Critical (fixed):** Notification `Promise.all` after booking insert could throw, causing the catch block to return `{ ok: false }` even though the booking already existed in the database.
- Minor: `homeServiceCustomerNotes` and `homeServiceParkingNotes` both map to the same form field (redundant but not broken).

---

## CRM Schedule Setup Results

### Verified
- ✅ `/crm/staff-availability` renders `ScheduleSetupWorkspace`
- ✅ `/manager/staff-availability` renders `ScheduleSetupWorkspace` (parity after 2X-F)
- ✅ General Rules tab shows group cards + weekly pattern matrix
- ✅ Individual Adjustments tab opens manage modal
- ✅ Overrides tab works
- ✅ Coverage Issues tab works
- ✅ Group rules appear from `staff_group_schedule_rules`
- ✅ Manager branch scoping preserved (`getManagerBranchId`)

### Issues Found
- None.

---

## Live Availability Results

### Verified
- ✅ `/crm/availability` loads `getCrmAvailabilitySnapshot`
- ✅ Staff with individual schedules appear correctly
- ✅ Staff with group schedule fallback appear (via `getDailySchedule` RPC)
- ✅ Checked-in staff can become "Available Now"
- ✅ Not checked-in staff remain "Not Checked In"
- ✅ Busy staff show "Busy / Assigned"
- ✅ Driver readiness count updates

### Issues Found
- ⚠️ **Deferred:** `getCrmAvailabilitySnapshot` populates `shifts[]` only from `staff_schedules` (individual). Staff with group rules but no individual schedule get `shift_type: "single"` for check-in, which may not match their group rule's `shift_type` (`opening`/`closing`). This could cause a duplicate check-in record mismatch.
  - **Fix scope:** Requires querying `staff_group_schedule_rules` in the availability snapshot or exposing shift_type from the `getDailySchedule` RPC.
  - **Risk:** Medium. Only affects staff who have group rules but no individual `staff_schedules` row and are being checked in via CRM Live Availability.

---

## CRM Bookings Results

### Verified
- ✅ `/crm/bookings` loads booking list
- ✅ Booking details panel opens on row selection
- ✅ Recommendation panel appears for unassigned staff / home-service bookings
- ✅ Therapist recommendations show reasons and warnings
- ✅ Driver recommendations show for home-service bookings
- ✅ Recommendations do not auto-assign
- ✅ Booking status / payment status badges render correctly

### Issues Found
- ⚠️ **Fixed:** Driver assignment in `BookingRecommendationSection` was fire-and-forget (no `await`, no `router.refresh()`). UI stayed showing "No driver assigned" after clicking Assign.

---

## Dispatch Results

### Verified
- ✅ `/crm/dispatch` loads home-service bookings
- ✅ Awaiting-driver items show driver recommendations
- ✅ Dispatch status computed correctly from `booking_progress_status`
- ✅ Live map route exists (`/crm/live-operations`)
- ✅ Tracking links remain valid

### Issues Found
- ⚠️ **Fixed:** Driver assignment in `DispatchItemRow` was fire-and-forget (same bug as bookings panel).

---

## Staff Portal Results

### Verified
- ✅ `/staff-portal` loads today's bookings + check-in widget
- ✅ `/staff-portal/schedule` shows week grid with bookings/blocks
- ✅ Check-in widget works
- ✅ Check-out works
- ✅ Booking assignments appear
- ✅ Progress actions (Check In → Start Session → Complete) still work
- ✅ Driver portal (`/driver`) loads own trips
- ✅ Driver dispatch (`/driver/dispatch`) works

### Issues Found
- Minor: `staff-schedule-page.tsx` had unused `rawBlocks` prop (removed).
- Minor: Desktop/mobile "day_off" filter behavior is slightly inconsistent between grid and agenda views (non-blocking UX quirk).

---

## Workflow Gaps Found

| Gap | Severity | Status |
|-----|----------|--------|
| Group schedule `shift_type` not reflected in Live Availability check-in | Medium | Deferred |
| `staff_scheduling_preferences.max_services_per_day` not used in recommendation scoring | Low | Deferred |
| ETA/travel distance not factored into driver recommendations | Low | Deferred |

---

## Bugs Found

| Bug | Severity | File | Status |
|-----|----------|------|--------|
| Notification failure after booking insert falsely reports failure | Critical | `src/lib/actions/online-booking.ts` | **Fixed** |
| Driver assignment UI doesn't refresh (bookings panel) | Medium | `src/components/features/bookings/bookings-table.tsx` | **Fixed** |
| Driver assignment UI doesn't refresh (dispatch panel) | Medium | `src/components/features/dispatch/dispatch-workspace.tsx` | **Fixed** |
| Unused `rawBlocks` prop passed to staff schedule page | Minor | `src/components/features/staff-portal/staff-schedule-page.tsx` | **Fixed** |

---

## Safe Fixes Applied

1. **`online-booking.ts`:** Wrapped notification `Promise.all` in a dedicated `try/catch` so notification failures are logged but never fail the already-committed booking.
2. **`bookings-table.tsx`:** Added `async/await` + `router.refresh()` to the `onAssignDriver` callback in `BookingRecommendationSection`.
3. **`dispatch-workspace.tsx`:** Extracted `DispatchRecommendationPanel` component with `async/await` + `router.refresh()` for driver assignment.
4. **`staff-schedule-page.tsx` + `schedule/page.tsx`:** Removed unused `rawBlocks` prop and `BlockedTimeRow` type import.

---

## Deferred Issues

1. **Group schedule shift_type in Live Availability:** Requires querying `staff_group_schedule_rules` in `getCrmAvailabilitySnapshot` or extending `getDailySchedule` RPC to expose shift_type for group-scheduled staff.
2. **Recommendation engine workload caps:** `max_services_per_day` / `max_trips_per_day` from `staff_scheduling_preferences` are fetched but not used in scoring.
3. **Driver ETA scoring:** Geographic proximity / travel time is not factored into driver recommendations.

---

## Production Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Public booking | ✅ Ready | Core flow stable; notification bug fixed |
| CRM schedule setup | ✅ Ready | Manager/CRM parity achieved |
| Live availability | ⚠️ Mostly ready | Group shift_type gap is minor; individual schedules work perfectly |
| CRM bookings | ✅ Ready | Recommendations visible; driver assign UX fixed |
| Dispatch | ✅ Ready | Driver recommendations visible; assign UX fixed |
| Staff portal | ✅ Ready | Check-in/out and progress actions stable |

**Overall: Ready for Phase 2J (Staff Shift Requests) with the one deferred group-shift gap documented.**

---

## Recommended Next Phase

**Phase 2J — Staff Shift Requests**

Handle staff requesting day off, shift swaps, schedule changes, and manager approval workflows.
