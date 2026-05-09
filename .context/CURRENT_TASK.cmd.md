# CURRENT TASK: BK-WS-002 - Shared Bookings Workspace Polish (Complete)

## Overview
Polished the current shared `BookingsWorkspace` implementation to better match the approved simplified bookings mockup while preserving the shared Owner/Manager/CRM layout, existing booking actions, payment actions, auth, RBAC, booking engine logic, payment rules, and public booking flow.

## Exact Files Changed
- `src/components/features/bookings/bookings-workspace.tsx`
- `src/components/features/bookings/bookings-table.tsx`
- `src/components/features/dashboard/booking-action-menu.tsx`
- `src/components/features/dashboard/payment-action-menu.tsx`

## Completed
- Kept Owner, Manager, and CRM on the same shared `BookingsWorkspace`.
- Removed the table footer count from the workspace shell and moved count/pagination into the table card.
- Updated `BookingsTable` to paginate client-side after the current server filters and search filter.
- Defaulted visible rows to 8 per page, with 8/10/20 row options.
- Added bottom pagination with "Showing X to Y of Z bookings", previous/next, page buttons, and rows-per-page selector.
- Removed the table Branch column so visible columns are: Booking ID, Customer, Type, Time, Service, Status, Payment, Amount, Actions.
- Tightened table sizing with fixed layout, compact cells, truncation/tooltips for long customer/service text, and a narrow Actions column.
- Replaced per-row `Actions` + `Pay` buttons with one compact three-dot booking action trigger.
- Simplified the details panel action area:
  - Disabled `Edit Booking` primary button because no edit panel/route is currently wired in this shared component.
  - `Change Status` uses the existing booking status action menu with cancel removed from that dropdown.
  - `Take Payment` uses the existing payment action menu with a clean panel trigger.
  - `Cancel Booking` appears separately as a full-width subtle red action only when the existing cancel transition is available.
- Kept the details panel content-height/sticky behavior and avoided empty vertical stretching.
- Extended the existing booking/payment action menu components with typed trigger variants instead of creating role-specific layouts.

## Verification
- `pnpm type-check`: Passing
- `pnpm lint`: Passing
- `pnpm build`: Passing, 68 app routes

## Status
Complete. Ready to commit as `fix(bookings): simplify actions and add compact pagination`.
