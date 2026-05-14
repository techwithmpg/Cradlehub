# HANDOFF — BOOKING-WIZARD-UX-10.2 Public Booking Wizard Optimization

## Date
2026-05-14

## What Changed
- `/book` still renders `BookingWizard` directly and its home-service location step uses `PlacesAutocomplete` from `src/components/public/places-autocomplete.tsx`.
- `PlacesAutocomplete` loads Google Maps JS without `libraries=places`, then calls `google.maps.importLibrary("places")` and instantiates `PlaceAutocompleteElement`.
- The selected place payload includes formatted address, place ID, lat/lng, address components, map URL, and `source: "google_places"`.
- `GoogleMapsProvider` no longer requests the legacy Places library and now standardizes on `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.

## Service Selection
- `BookingServicePicker` in `src/components/public/booking-service-picker.tsx` groups services by category.
- `src/components/public/booking-wizard.tsx` keeps the existing selected-services state and passes it into the picker.
- Mobile shows horizontal category chips.
- Desktop shows a compact category rail and one service list.
- Only the active category is expanded; the full catalog is no longer shown at once.
- Multi-service state, total duration, total price, and existing submission payload are preserved.

## Staff Eligibility
- New helper: `src/lib/staff/service-providers.ts`.
- `src/app/api/public/booking-context/route.ts` returns:
  - service category metadata
  - filtered service-provider staff
  - per-staff service IDs
  - per-service mapping presence
- `src/lib/engine/availability.ts` now strips non-service staff from availability and auto-assignment results.
- Drivers and utility staff are hard-excluded by system role.
- CSR/front-desk/admin/manager-only staff are excluded unless they are explicitly modeled as service staff by `staff_type`.
- If `staff_services` mappings exist for a selected service, specific providers must be mapped to that service.
- For multi-service bookings, selected specific staff must satisfy all mapped selected services.

## Preserved
- No payment changes.
- No tracking, live map, driver tracking, payroll, auth, middleware, RLS, or booking-engine rewrite.
- No database migration and no new packages.
- In-spa and home-service payload shape remains backward-compatible.

## Verification
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing.
- `/book` smoke test: existing localhost server on port 3000 returned `200 OK`.

## Notes
- Browser console verification for Google Places warnings was not possible from this toolset. Source search confirms no active legacy Places Autocomplete usage under `src`.
- A temporary dev-server launch on port 3012 could not start because another Next dev server was already running for this repo on port 3000; the existing server was used for the `/book` smoke test.
