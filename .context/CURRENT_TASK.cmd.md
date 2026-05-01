# 🎯 CURRENT TASK

| Field | Value |
|-------|-------|
| **Task ID** | `SCHED-002` |
| **Description** | `Redesign daily schedule as row-based resource timeline board + fix CRM booking errors` |
| **Agent** | `Kimi DevCoder` |
| **Status** | `COMPLETE` |

## Changes Summary

### Schedule Timeline Board Redesign
- Replaced column-based `StaffScheduleGrid` with row-based `DailyScheduleBoard`
- Staff rendered as vertical rows with sticky left info column
- Time rendered as horizontal axis with 30-min slots (96px each)
- Booking blocks span horizontally from start_time to end_time
- Off-duty hours shaded; fully off staff show "OFF TODAY" label
- Blocked times rendered as beige striped blocks with dashed borders
- Current-time indicator shown on today's date (gold vertical line + "Now" label)
- Realtime subscription preserved (refreshes on booking changes)
- Booking blocks clickable → Dialog with full details

### CRM Booking Bug Fix
- `createInhouseBookingMultiAction` now returns typed `{ ok, code, message }` results
- Added structured logging with `[CRM_BOOKING_CREATE_FAILED]` context
- Replaced raw error passthrough with categorized error codes:
  - `VALIDATION_ERROR`, `UNAUTHORIZED`, `BRANCH_MISSING`, `SLOT_UNAVAILABLE`
  - `CUSTOMER_ERROR`, `SERVICES_LOAD_ERROR`, `SERVICE_UNAVAILABLE`
  - `PRICING_LOAD_ERROR`, `TIME_TOO_LATE`, `BOOKING_INSERT_FAILED`
  - `REFERENCE_ERROR`, `DUPLICATE_ERROR`, `UNKNOWN_ERROR`
- `createOnlineBookingAction` and `createOnlineBookingMultiAction` updated to match
- BookingWizard updated to consume new `{ ok, message }` shape

### New In-House Booking Page Simplified
- Removed redundant labels ("CRM Booking Wizard", "Use the same wizard logic...")
- Clean header: "New In-House Booking" + single description line

## Files Changed
- `src/lib/utils/schedule-timeline.ts` (new)
- `src/components/features/schedule/daily-schedule-board.tsx` (new)
- `src/components/features/schedule/schedule-time-header.tsx` (new)
- `src/components/features/schedule/schedule-staff-cell.tsx` (new)
- `src/components/features/schedule/schedule-staff-row.tsx` (new)
- `src/components/features/schedule/schedule-booking-block.tsx` (new)
- `src/components/features/schedule/schedule-blocked-time-block.tsx` (new)
- `src/components/features/schedule/schedule-current-time-indicator.tsx` (new)
- `src/app/(dashboard)/manager/schedule/page.tsx` (updated)
- `src/app/(dashboard)/owner/schedule/page.tsx` (updated)
- `src/lib/actions/inhouse-booking.ts` (updated)
- `src/lib/actions/online-booking.ts` (updated)
- `src/components/public/booking-wizard.tsx` (updated)
- `src/app/(dashboard)/crm/bookings/new/page.tsx` (updated)

## Build Status
- `pnpm type-check`: ✅ Passing
- `pnpm build`: ✅ Passing (46 routes)
- `pnpm lint`: ⚠️ 5 pre-existing errors (not introduced by this task)
