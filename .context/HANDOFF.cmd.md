# HANDOFF — BOOKING-MOBILE-SERVICE-GRID-001

## Date
2026-05-20

## What Changed

### Mobile service picker
**File:** `src/components/public/booking-service-picker.tsx`

- Mobile service cards now explicitly use `w-full min-w-0 max-w-full overflow-hidden` so they cannot behave like fixed-width carousel cards.
- Mobile card images remain image-top cards but use `aspect-[4/3]`, `h-full w-full object-cover`, and responsive `next/image` sizes:
  `(max-width: 390px) 50vw, (max-width: 520px) 33vw, 25vw`.
- Mobile card content remains compact: service name, duration, price, and compact selected state only.
- Selection indicators remain small (`h-5 w-5`) and do not crowd 3/4-column cells.
- Category chips remain horizontally scrollable inside their own `overflow-x-auto` row, with parent `overflow-hidden` wrappers.
- Loading skeletons now mirror the same bounded mobile grid/chip row behavior.
- Desktop service cards and category sidebar were preserved.

### Booking wizard shell
**File:** `src/components/public/booking-wizard.tsx`

- Public booking wrapper now includes `w-full max-w-full overflow-x-hidden`.
- Public inner containers now stay constrained on mobile and restore desktop max-width behavior at `md`.
- The content grid and main column now include `min-w-0`.
- Navigation, booking state, service filtering, provider/date/details logic, and the floating circular widget were not changed.

## Verification

- `pnpm type-check`: Passing.
- `pnpm lint`: Passing.
- `pnpm build`: Passing, 80 app routes.
- Browser smoke test on `/book`:
  - 360px: document overflow `0`, mobile service grid template has 2 columns.
  - 390px: document overflow `0`, mobile service grid template has 3 columns.
  - 430px: document overflow `0`, mobile service grid template has 3 columns.
  - 520px: document overflow `0`, mobile service grid template has 4 columns.
  - 768px and desktop: desktop layout active, document overflow `0`.
  - Category chips overflow only within their own row.

## Notes

- The active live Swedish Massage category currently has two service cards, so the visual row contains two cards, but browser measurements confirmed the 3/4-column grid templates at the requested breakpoints.
- Screenshot artifact saved at `.codex-artifacts/booking-service-mobile-390.png`.
