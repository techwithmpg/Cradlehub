# CURRENT TASK: BOOKING-HOME-SERVICES-001

## Status
Completed on 2026-05-20.

## Summary
Fixed the public booking home-service availability mismatch by aligning the public booking branch-service query with the admin service settings source of truth.

## Files Modified
- `src/lib/queries/branches.ts`
  - Public booking now reads the modern `branch_services` shape used by admin (`visibility`, `available_in_spa`, `available_home_service`, branch price/duration metadata) and falls back safely for older schemas.
  - Public filtering still requires branch-scoped active rows, active base services, and `public` visibility.
- `src/app/api/public/booking-context/route.ts`
  - Public service cards now preserve branch-specific duration overrides when present.
- `src/app/(dashboard)/owner/branches/actions.ts`
  - Visibility updates write to the current `visibility` column, with a legacy `booking_visibility` fallback.
- `src/lib/cache/cache-tags.ts`
  - Branch-service cache invalidation now expires matching entries immediately after admin service changes.
- `src/types/supabase.ts`
  - Synced local branch-service types with the live branch-service metadata fields needed by booking/admin queries.
- `eslint.config.mjs`
  - Ignored `.codex-artifacts/**` so temporary verification artifacts do not get linted as source.
- `.gitignore`
  - Ignored local Codex artifact output so temporary verification files stay out of Git status.

## Verification
- `pnpm type-check`: Passing.
- `pnpm lint`: Passing.
- `pnpm build`: Passing, 80 app routes.
- Public API smoke: Cradle branch booking context returns 6 Home-eligible public services and 3 non-Home services.
- Public `/book` smoke: HTTP 200 OK.

## Notes
- No booking wizard UI, step order, provider selection, date/time selection, payment logic, confirmation logic, floating widget, or dummy service data was changed.
