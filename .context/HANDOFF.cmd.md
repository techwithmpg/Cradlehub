# HANDOFF — CONTROL-001 Booking Control Console MVP

## Date
2026-05-13

## Agent
Kimi

## Summary
Created a Booking Control Console MVP at `/manager/control` and `/crm/control`. This is a professional operational page showing today's bookings with KPIs, progress tracking, payment actions, and home-service warnings. It serves as the base for future tracking, dispatch, and conflict handling features.

## Files Created

### New Components:
- `src/components/features/control-console/types.ts` — `ControlBooking`, `ControlTab` types
- `src/components/features/control-console/control-kpi-strip.tsx` — 7 KPI cards
- `src/components/features/control-console/control-booking-card.tsx` — Enhanced booking card with progress, payment, warnings, actions
- `src/components/features/control-console/control-queue.tsx` — Tabbed queue with 6 filters
- `src/components/features/control-console/control-console-page.tsx` — Main layout component

### New Routes:
- `src/app/(dashboard)/manager/control/page.tsx` — Manager control console
- `src/app/(dashboard)/crm/control/page.tsx` — CRM control console

## Files Modified
- `src/lib/queries/bookings.ts` — Added `booking_progress_status` and timestamps to select variants; `MaybeProgressFields` on `TodayScheduleRow`
- `src/components/features/dashboard/nav-config.ts` — Added "Control" to Manager, CRM, CSR Head, CSR Staff navs

## Behavior After Change
- Manager and CRM users see a "Control" item in their sidebar.
- The control console shows today's bookings with:
  - KPI strip: Total, Active, In Progress, Completed, Unpaid, Home Service, Issues
  - Queue tabs: All, Active, Home, In Spa, Unpaid, Issues
  - Each card shows: time, customer, service, staff, room, status badge, type badge, payment badge, progress mini-stepper
  - Home service warnings displayed as red banners (dispatch_warning, needs_location_review)
  - Inline PaymentActionMenu and BookingActionMenu on each card
- Right rail shows operational summary and staff availability placeholder.
- Role scoping: Manager sees their branch only; CRM/CSR sees their branch only.
- No live maps, no GPS tracking, no external APIs used.

## Verification
- `pnpm type-check`: ✅ Passing
- `pnpm lint`: ✅ Passing (0 errors, 4 pre-existing warnings)
- `pnpm build`: ✅ Passing, 79 app routes.

## Remaining Notes / Future Improvements
- **Owner cross-branch control console:** The existing `getTodaysSchedule` requires a `branchId`. For owner control, we'd need a cross-branch variant or loop over branches. Documented as Phase 3.1.
- **Realtime updates:** Currently server-rendered. Supabase Realtime could push booking status changes to the console in a future phase.
- **Staff availability integration:** The side rail has a placeholder. Real staff availability panel could be embedded from `ManagerTodayWorkspace` components.
- **Conflict visualization:** The "Issues" tab flags basic problems. A dedicated conflict timeline or resource grid view could be added later.
- **Delivery type cleanup:** `in_spa` is not a database type yet. Currently `online` and `walkin` both map to in-spa delivery. Phase 4 should add a `delivery_type` column.
