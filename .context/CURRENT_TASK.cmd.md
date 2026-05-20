# CURRENT TASK: BOOKING-MOBILE-SERVICE-GRID-001 — Mobile Booking Service Grid Patch

## Status
Completed on 2026-05-20.

## Summary
Patched the public booking wizard service selection step so mobile service cards stay inside a compact responsive grid instead of risking horizontal overflow.

## Files Modified
- `src/components/public/booking-service-picker.tsx`
  - Tightened the mobile service card with `w-full min-w-0 max-w-full overflow-hidden`.
  - Kept the image-top card style with `aspect-[4/3]`, responsive `next/image` sizes, and meaningful service alt text.
  - Boxed category chip rows and loading skeleton rows in `w-full max-w-full overflow-hidden`.
  - Preserved category filtering and live service data.
- `src/components/public/booking-wizard.tsx`
  - Added public mobile `w-full max-w-full overflow-x-hidden` wrappers.
  - Added `min-w-0` to the wizard content grid/main column.
  - Preserved desktop layout and booking flow logic.

## Verification
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing.
- `pnpm build`: Passing, 80 app routes.
- Browser smoke test on `/book`: 360px -> 2 columns, 390px/430px -> 3 columns, 520px -> 4 columns, 768px/desktop -> desktop layout; document horizontal overflow remained `0`.

## Notes
- The current live Cradle Massage branch data has two services in the active Swedish Massage category, so the browser check verified the CSS grid template column counts even though only two cards populated the selected category.
- The floating circular widget was not changed.
