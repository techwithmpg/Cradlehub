# HANDOFF - PHASE-10.1 Compact Precise Home-Service Location Input

## Date
2026-05-14

## Agent
Codex

## Summary
The existing public booking wizard home-service location step now behaves like a compact Google Maps search: customers search for their home location, select a Google suggestion, see a confirmation card, and optionally add one Delivery notes field.

## Files Modified
- `src/components/public/places-autocomplete.tsx` - shared Google Places wrapper now returns precise place metadata (`formattedAddress`, `placeId`, `lat`, `lng`, `addressComponents`, `mapUrl`) and exposes load/error status.
- `src/components/public/booking-wizard.tsx` - public home-service location step now has one search field, selected-location card with Change, and one Delivery notes textarea; public zone/landmark/unit fields are no longer shown.
- `src/lib/validations/booking.ts` - public multi-service home-service bookings require selected Google place data.
- `src/lib/actions/online-booking.ts` - server action rejects missing precise home-service place data and saves the new metadata while preserving legacy keys.

## Behavior After Change
- Public home-service customers cannot continue without selecting a Google suggestion.
- Selected place data saved: `formatted_address`, `place_id`, `lat`, `lng`, optional `address_components`, optional `map_url`, and `source: "google_places"`.
- Delivery notes are saved as `delivery_notes` and mapped to legacy notes-style keys for compatibility.
- Customer-facing zone selection is removed; metadata keeps `zone: "unknown"` until operations refine it later.
- In-spa flow is unaffected.
- No server Maps key is exposed in browser code; the autocomplete wrapper reads only `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.
- No Routes API or ETA calls were added while typing.

## Verification
- `pnpm type-check`: Passing
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`
- `pnpm build`: Passing, 79 app routes

## Remaining Notes / Future Improvements
- Phase 11 Payroll remains untouched and can start after this phase.
- Optional future dispatch work can derive or assign zones from the selected address components, but this phase intentionally leaves customer zone selection removed.
