# CURRENT TASK: PERF-PHASE2B-001 — Query Pagination + Index Planning

## Status
Completed on 2026-05-15.

## Completed Scope

### A — Shared pagination utility
- `src/lib/queries/pagination.ts` created with `PaginationParams`, `PaginatedResult<T>`, `normalizePagination()`, `toPaginatedResult()`.

### B — CRM customer paginated search
- `getCustomersPage()` added to `src/lib/queries/customers.ts` — combines branch scoping + ILIKE search (with `%_` escaping) + server-side pagination.
- `crm/customers/page.tsx` updated: `q` search param, HTML search form, paginated results, search-aware Prev/Next links.

### C — Booking list pagination
- **No changes needed.** All booking list queries are already scoped to `branch_id + booking_date` (one day's data). Naturally bounded; `.limit(500)` safety caps from Phase 2 are sufficient.

### D — Staff list pagination
- **No changes needed.** `StaffManagementWorkspace` handles filtering client-side on safety-capped (500/200) results. Server-side pagination would require UI redesign. Deferred.

### E — Index recommendations
- `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md` created with full audit of existing indexes and gap analysis.
- Key gap identified: `bookings(branch_id, customer_id)` index missing — needed for `branchCustomerIds()` two-step query on every CRM page load.

### F — Remaining unbounded queries
- All list queries audited. `public-site.ts` section/asset lists are unbounded but are small CMS tables — acceptable.
- All other lists are either date-scoped, branch-scoped, or have `.limit()` safety caps from Phase 2.

### Pre-existing type errors fixed (unrelated to Phase 2B scope)
- `dev/page.tsx`: NODE_ENV narrowing after `notFound()` guard — fixed by extracting `nodeEnv` variable.
- `logger.ts` + action files: `LogContext` index signature incompatible with `error: unknown` — fixed by widening `LogContext` to `Record<string, unknown>`.

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79+ app routes compiled

## Next Phase
**Phase 3 — Selective Revalidation and Cache Tags**
- Replace broad `revalidatePath("/crm/customers")` calls with `revalidateTag` where safe.
- Adopt `unstable_cache` or Next.js 16 `"use cache"` for stable public data (branches, services) once behavior is confirmed.
- Apply `bookings(branch_id, customer_id)` index migration (see `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md`).
