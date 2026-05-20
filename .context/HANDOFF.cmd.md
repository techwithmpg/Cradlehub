# HANDOFF - BOOKING-HOME-SERVICES-001

## Date
2026-05-20

## What Changed

### Public booking branch-service query
**File:** `src/lib/queries/branches.ts`

- `getBranchServicesPublicCached()` now starts with the current branch-service row shape used by admin service management.
- The public query now preserves `available_in_spa`, `available_home_service`, `visibility`, branch sort order, public text metadata, branch custom price, and branch custom duration.
- The query filters public visibility after normalizing `visibility` and legacy `booking_visibility`, so current and older schema shapes remain supported.
- The public API drops rows whose embedded base service is inactive, keeping branch and base service enablement aligned.
- The last-resort minimal fallback remains only for older databases that do not have the service eligibility columns.

### Public booking API mapping
**File:** `src/app/api/public/booking-context/route.ts`

- Service duration now uses `branch_services.custom_duration_minutes` when present, then falls back to the base service duration.
- Existing branch custom price behavior was preserved.

### Admin visibility and cache invalidation
**Files:** `src/app/(dashboard)/owner/branches/actions.ts`, `src/lib/cache/cache-tags.ts`

- Visibility updates now write to `branch_services.visibility` first, with a fallback to legacy `booking_visibility`.
- Service/settings cache tag invalidation now uses `{ expire: 0 }` so the next public booking request sees updated branch-service settings instead of serving stale cache.

### Local types
**File:** `src/types/supabase.ts`

- Local `branch_services` generated type shape now includes the live metadata columns used by admin and public booking queries.

### Verification hygiene
**Files:** `eslint.config.mjs`, `.gitignore`

- `.codex-artifacts/**` is ignored by ESLint so temporary browser/debug artifacts are not scanned as application source.
- `.codex-artifacts/` is ignored by Git so local verification artifacts do not remain as untracked noise.

## Verification

- `pnpm type-check`: Passing.
- `pnpm lint`: Passing.
- `pnpm build`: Passing, 80 app routes.
- Public API smoke for branch `c1000000-0000-0000-0000-000000000001`: 6 services with `availableHomeService=true`, 3 with `availableHomeService=false`.
- Public `/book` smoke: HTTP 200 OK.

## Notes

- Root `PROJECT_CONTEXT.md`, `ROADMAP.md`, and `AGENT_RULES.md` are still absent; current project docs live under `docs/`.
- No UI redesign, booking step order, provider/date/payment/confirmation behavior, floating widget, hardcoded services, or dummy service data was introduced.
