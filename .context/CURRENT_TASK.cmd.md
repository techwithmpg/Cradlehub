# CURRENT TASK: PERF-PHASE3-001 — Selective Revalidation and Cache Tags

## Status
Completed on 2026-05-15.

## Completed Scope

### Cache infrastructure
- `src/lib/cache/cache-tags.ts` — tag constants + `invalidateTag()` wrapper for Next.js 16's `revalidateTag(tag, profile)` API.

### Cached queries (3 domains)
1. **Public branches** (`getPublicBranchesCached`) — upgraded from React.cache (per-request dedup only) to `React.cache(unstable_cache(...))`. Cross-request 1h TTL. Tag: `public-branches`.
2. **Branch booking rules** (`getBranchBookingRulesOrDefaultCached`) — new `unstable_cache` wrapper around the existing admin-client query. 1h TTL. Tag: `branch-booking-rules:{branchId}`.
3. **Branch services — public view** (`getBranchServicesPublicCached`) — new function using `createAdminClient()` inside `unstable_cache`. 5min TTL. Tag: `branch-services:{branchId}`.

### Hot paths using cached queries
- `/api/public/booking-context` — uses `getBranchServicesPublicCached` + `getBranchBookingRulesOrDefaultCached` for the public booking flow (publicOnly=true). Inhouse mode (publicOnly=false) keeps uncached path.
- `/api/public/dispatch-slots` — uses `getBranchBookingRulesOrDefaultCached`.

### Tag invalidation wired to all mutations
- Branch create/update/toggle → `invalidateTag(cacheTags.publicBranches)`
- Branch service add/remove/eligibility/price/visibility → `invalidateTag(cacheTags.branchServices(branchId))`
- Booking rules save → `invalidateTag(cacheTags.branchBookingRules(branchId))`
- `setBranchServiceAction` in services/actions.ts → `invalidateTag(cacheTags.branchServices(d.branchId))`

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79+ routes

## Next Phase
**Phase 4 — Offline / Poor Connectivity Resilience**
OR
**Phase 3B — Revalidation Follow-up** if cache behavior turns out to be unstable.

### Pre-Phase 4 checklist
- Manually verify: change booking rules → confirm manager settings + public booking wizard show updated rules.
- Manually verify: toggle branch service visibility → confirm public booking wizard service list updates.
- Apply the `bookings(branch_id, customer_id)` index from `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md` when ready.
