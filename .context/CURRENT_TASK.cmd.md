# CURRENT TASK: PHASE-10.1 - Compact Precise Home-Service Location Input

## Status
Completed on 2026-05-14.

## Scope
Enhanced only the existing public booking wizard home-service location step. This was a compact UI/UX refinement, not a new booking flow or booking wizard redesign.

## Completed
- Reused and extended `src/components/public/places-autocomplete.tsx`.
- Public home-service location step now uses one Google Places search field.
- Selected Google suggestion is required before continuing; typed text alone is rejected.
- Selected location confirmation card shows the formatted address and a small Change action.
- Customer-facing zone, house/unit, landmark, and separate driver-note fields were removed/merged into one optional Delivery notes textarea.
- Public booking metadata saves `formatted_address`, `place_id`, `lat`, `lng`, optional `address_components`, optional `map_url`, `source: "google_places"`, and `delivery_notes`.
- Legacy metadata keys are preserved where useful: `address`, `full_address`, `notes`, `parking_notes`, `customer_notes`, `zone`, `lat`, and `lng`.
- In-spa booking flow is unaffected.
- Browser code uses only `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.

## Out of Scope
- Payroll.
- Staff leaderboard or performance.
- Payment logic.
- Auth, proxy, middleware, or RLS.
- Driver workflow, live tracking, customer tracking pages, internal live maps, or route/ETA redesign.
- Routes API calls while typing.

## Verification
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing with 2 pre-existing warnings in `src/app/staff-onboarding/onboarding-form.tsx`.
- `pnpm build`: Passing, 79 app routes.
