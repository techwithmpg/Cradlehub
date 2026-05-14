# HANDOFF — PERF-PHASE3-001 Phase 3 Selective Revalidation and Cache Tags

## Date
2026-05-15

## What Changed

### Cache tag infrastructure
**New file:** `src/lib/cache/cache-tags.ts`

```ts
export const cacheTags = {
  publicBranches: "public-branches",
  branchBookingRules: (branchId: string) => `branch-booking-rules:${branchId}`,
  branchServices: (branchId: string) => `branch-services:${branchId}`,
};

// Wrapper: Next.js 16 revalidateTag() requires second profile arg.
// Pass {} (empty CacheLifeConfig) — works for both unstable_cache and "use cache" entries.
export function invalidateTag(tag: string): void {
  revalidateTag(tag, {});
}
```

### Domain 1 — Public branches
**Modified:** `src/lib/queries/branches.ts`
- `getPublicBranchesCached` upgraded from `cache(getPublicBranches)` (per-request React dedup only) to `cache(unstable_cache(...))` (cross-request data cache + per-request dedup).
- The `unstable_cache` wrapper uses `createAdminClient()` internally — no cookie dependency, safe for cross-request caching.
- Tag: `public-branches`, TTL: 3600s.
- **New:** `getBranchServicesPublicCached(branchId)` — `unstable_cache` with `createAdminClient()`, queries `branch_services` with `is_active=true AND booking_visibility='public'`. Tag: `branch-services:{branchId}`, TTL: 300s.

### Domain 2 — Branch booking rules
**Modified:** `src/lib/queries/branch-booking-rules.ts`
- **New:** `getBranchBookingRulesOrDefaultCached(branchId)` — wraps existing function with `unstable_cache`. The underlying query already uses `createAdminClient()`. Tag: `branch-booking-rules:{branchId}`, TTL: 3600s.
- `updateBranchBookingRules` (the mutation) now calls `invalidateTag(cacheTags.branchBookingRules(branchId))` before the existing `revalidatePath` calls.

### Hot paths updated
- `src/app/api/public/booking-context/route.ts` — Uses `getBranchServicesPublicCached` when `publicOnly=true`, `getBranchBookingRulesOrDefaultCached` always. Inhouse mode keeps uncached `getBranchServices`.
- `src/app/api/public/dispatch-slots/route.ts` — Uses `getBranchBookingRulesOrDefaultCached`.

### Mutations updated (tag invalidation added)
- `src/app/(dashboard)/owner/branches/actions.ts` — All 8 mutations now call `invalidateTag` for either `publicBranches` (branch CRUD) or `branchServices(branchId)` (service toggles/prices/visibility).
- `src/app/(dashboard)/owner/services/actions.ts` — `setBranchServiceAction` now calls `invalidateTag(cacheTags.branchServices(d.branchId))`.

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79+ routes

## What Was Intentionally NOT Changed

| Excluded | Reason |
|---|---|
| `getBranchesOverview` | Live stats (today's bookings, active staff) — must be fresh every request |
| `getBranchWithFullDetail` | Owner edit page; includes live staff list |
| All booking list queries | Live operational data; wrong to cache |
| Dispatch, schedule, ETA, location | High-frequency live data |
| Manager/CRM service list (inhouse) | Role-dependent; not safe to cache globally |
| Notification, payroll, reconciliation | Never appropriate to cache |

## Stale Data Windows

| Data | Max stale window | Trigger for fresh data |
|---|---|---|
| Public branches | 3600s (1h) or until `invalidateTag("public-branches")` | Any branch create/update/toggle |
| Booking rules | 3600s or until `invalidateTag("branch-booking-rules:{id}")` | Save booking rules action |
| Public services | 300s (5min) or until `invalidateTag("branch-services:{id}")` | Add/remove/toggle/price/visibility service action |

These windows are acceptable: booking rules and branch settings change rarely (owner-initiated), not continuously.

## Next Phase Options

### Phase 4 — Offline / Poor Connectivity Resilience
- Service Worker strategy for the staff portal and booking wizard
- Background sync for failed booking submissions
- Optimistic UI for status updates

### Phase 3B — Revalidation Follow-up (if needed)
If manual testing shows stale data issues:
- Consider reducing TTL for branch services (currently 300s)
- Consider adding `invalidateTag(cacheTags.branchServices(branchId))` to any other place that modifies `branch_services`

## Known Watch Points
- `resources-actions.ts` — manages `branch_resources` (not services). Currently revalidates `/owner/branches` and `/owner/branches/${branchId}` but does NOT call `invalidateTag(cacheTags.branchServices)` because branch resources are not cached. This is correct — branch resources are not part of the cached service list.
- `_getPublicBranchesUncached` is exported as a private symbol (prefixed `_`). It is the raw `unstable_cache` result. Public callers should use `getPublicBranchesCached` (React.cache wrapped).
- The `getBranchServicesPublicCached` cached function only caches `publicOnly: true`. If CRM/manager service selection ever switches to using this function instead of the uncached `getBranchServices`, recheck the query — it must remain public-only.
