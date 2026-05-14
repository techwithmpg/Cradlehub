# CURRENT TASK: SCHED-LAYOUT-001 — Full-Width Schedule Timeline

## Status
Completed on 2026-05-14.

## Scope
Improved the shared `ScheduleWorkspace` component used by Manager, Owner, and CRM schedule pages. The permanent 340px right-side Booking Details panel was removed from the default layout and replaced with a click-to-open Sheet drawer. A lightweight floating hover card was added for desktop booking preview.

## Completed
- Removed the two-column grid (`minmax(0,1fr) 340px`) from `schedule-workspace.tsx`. Schedule board now uses full width.
- Created `schedule-booking-hover-card.tsx`: fixed-positioned floating card that appears when the user hovers a booking block on desktop. Shows ID, status, type, customer, time, duration, service, staff, room/bed, payment status. Has a "View Details" button.
- Added 200ms close delay (via `closeTimerRef`) so the pointer can move from the booking block into the hover card without flickering.
- Added controlled Sheet (right-side drawer) that opens when user clicks/taps a booking block. Renders the existing `ScheduleDetailsPanel` with all its actions: Change Status, Take Payment, Cancel Booking, Room/Bed Assignment.
- Threaded `onHoverEnter` / `onHoverLeave` callbacks through the component chain: `ScheduleWorkspace` → `ScheduleBoardPanel` → `DailyScheduleBoard` → `ScheduleStaffRow` → `ScheduleBookingBlock`.
- All three schedule workspaces (Owner, Manager, CRM) benefit from the change.

## Out of Scope
- Auth, middleware, RBAC, RLS.
- Supabase schema or database changes.
- Owner, Manager, CRM sidebar/header/KPI system.
- Staff/week view hover card enhancement (hover only applies to the daily timeline view; click-to-sheet works in all view modes).
- Payroll, dispatch, or any other workspace.

## Verification
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 88 app routes.
