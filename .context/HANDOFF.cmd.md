# HANDOFF - BK-WS-002 Shared Bookings Workspace Polish

## Date
2026-05-10

## Agent
Codex

## Summary
Polished the shared bookings workspace to match the simplified mockup more closely. The Owner, Manager, and CRM booking routes still use the same shared component tree; changes are limited to layout, pagination, table density, and trigger presentation for existing actions.

## Files Changed

- `src/components/features/bookings/bookings-workspace.tsx`
  - Removed the old centered footer count below the table.
  - Keeps shared KPI/filter/header shell unchanged.
  - Continues passing shared action overrides into `BookingsTable`.

- `src/components/features/bookings/bookings-table.tsx`
  - Client-side pagination added after search filtering.
  - Default rows per page is 8 with 8/10/20 options.
  - Bottom pagination row includes result range, previous/next, page buttons, and rows-per-page selector.
  - Table columns are now exactly: Booking ID, Customer, Type, Time, Service, Status, Payment, Amount, Actions.
  - Branch is removed from visible table rows; branch remains visible in the details panel.
  - Rows use compact fixed-layout cells and truncate long customer/service/staff/resource text.
  - Row actions are one compact MoreHorizontal/kebab trigger only.
  - Selected booking is derived from the current visible page; if the selected booking falls off the page/filter, the first visible booking is shown.
  - Details panel uses a simplified action layout:
    - disabled `Edit Booking` placeholder because no edit UI is wired here yet
    - `Change Status`
    - `Take Payment`
    - optional separate `Cancel Booking`

- `src/components/features/dashboard/booking-action-menu.tsx`
  - Added typed trigger variants for default, compact icon, panel secondary, and panel danger buttons.
  - Added action scopes for all actions, non-cancel status actions, and cancel-only action.
  - Added optional disabled fallback for unavailable status actions.
  - Preserves the existing status action logic and owner override prop.

- `src/components/features/dashboard/payment-action-menu.tsx`
  - Added typed trigger label/variant/full-width props.
  - Preserves existing quick-pay, mark-unpaid, and edit-payment-details behavior.
  - Preserves optional payment action override for owner workspace.

## Verification

- `pnpm type-check`: Passing
- `pnpm lint`: Passing
- `pnpm build`: Passing, 68 app routes

## Remaining Notes

- `Edit Booking` is intentionally disabled in the right panel because the shared bookings workspace does not currently have an edit booking UI or route wired. Existing edit server action remains untouched.
- Existing unrelated working tree changes left untouched: `.claude/settings.json`, `supabase/migrations/20260513000002_real_staff_rbac_seed.sql`, `docs/design-references/`, `next-smoke.err.log`, `next-smoke.log`.
- Commit message: `fix(bookings): simplify actions and add compact pagination`
