# HANDOFF — PERF-PHASE2B-001 Phase 2B Query Pagination + Index Planning

## Date
2026-05-15

## What Changed

### A — Shared pagination utility
**New file:** `src/lib/queries/pagination.ts`

Exports:
- `PaginationParams` — `{ page?: number; pageSize?: number }`
- `PaginatedResult<T>` — `{ data: T[]; page: number; pageSize: number; total: number; pageCount: number }`
- `normalizePagination(params, defaults?)` — clamps page ≥ 1, pageSize within [1, maxPageSize], returns `{ page, pageSize, from, to }` for Supabase `.range(from, to)`
- `toPaginatedResult(args)` — wraps Supabase `{ data, count }` into `PaginatedResult`

### B — CRM customer paginated search
**Modified:** `src/lib/queries/customers.ts`
- Added `CustomerPageRow` exported type (previously was a local type in the page component)
- Added `getCustomersPage({ branchId?, search?, page?, pageSize? })` — branch scoping + ILIKE search (`%_` chars escaped) + server-side pagination with `count: "exact"`

**Modified:** `src/app/(dashboard)/crm/customers/page.tsx`
- Imports `getCustomersPage` + `CustomerPageRow` (dropped `getAllCustomers`)
- Accepts `?q=` search param alongside `?page=`
- Plain `<form method="GET" action="/crm/customers">` search bar — no client state needed
- Quick action cards hidden during active search
- `Prev`/`Next` pagination links preserve `q` param: `?page=N&q=${encodeURIComponent(search)}`
- `EmptyState` shows search-specific title/description when `search` is set

### C/D — Booking and staff list pages
**No changes.** Booking list pages (`/manager/bookings`, `/crm/bookings`, `/owner/bookings`) are already scoped to one day + one branch — naturally bounded. Staff pages use client-side filtering on safety-capped (500/200) results. Both documented in `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md`.

### E — Index gap identified
**New file:** `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md`

Key finding: `bookings(branch_id, customer_id)` index is missing. The `branchCustomerIds()` helper (called on every CRM page load that is branch-scoped) does:
```sql
SELECT customer_id FROM bookings WHERE branch_id = $1 AND customer_id IS NOT NULL
```
The existing `idx_bookings_branch_date` covers `(branch_id, booking_date)` but does NOT include `customer_id` — heap access is required. Recommended migration in the doc.

### F — Pre-existing type errors fixed
**Modified:** `src/app/(dashboard)/dev/page.tsx`
- After `if (process.env.NODE_ENV === "production") { notFound() }`, TypeScript narrows `NODE_ENV` to `"development" | "test"`. Subsequent comparisons to `"production"` triggered TS2367. Fixed by extracting `const nodeEnv = process.env.NODE_ENV as string` before the guard.

**Modified:** `src/lib/logger.ts`
- `LogContext` was `Record<string, string | number | boolean | null | undefined>`. Action files pass `{ error: unknown, ...context }` to `logError`. TypeScript TS2345 because `unknown` doesn't satisfy the index signature. Fixed by widening `LogContext` to `Record<string, unknown>`.

## Verification
- `pnpm type-check`: ✅ Passing (0 errors)
- `pnpm lint`: ✅ Passing (0 errors, 2 pre-existing warnings in `staff-onboarding/onboarding-form.tsx`)
- `pnpm build`: ✅ Passing, 79+ app routes compiled

## What's Next — Phase 3 (suggested)

### Selective Cache Invalidation
- Replace broad `revalidatePath("/crm/customers")` calls with `revalidateTag` where safe.
- Profile which pages are called frequently enough to benefit from caching.

### DB Index
Apply the `bookings(branch_id, customer_id)` covering index (see `docs/audits/QUERY_INDEX_RECOMMENDATIONS.md`):
```sql
CREATE INDEX IF NOT EXISTS idx_bookings_branch_customer
  ON bookings (branch_id, customer_id)
  WHERE customer_id IS NOT NULL;
```

### Stable Data Caching
- `unstable_cache` or Next.js 16 `"use cache"` for branches list, services list — read-heavy, rarely changes.

## Known Issues / Watch Points
- The `branchCustomerIds()` two-step query fetches ALL bookings for a branch (no date filter) to get distinct customer IDs. For a high-volume branch, this could return tens of thousands of rows. The missing covering index mitigates the I/O cost; longer term, consider a `DISTINCT customer_id` RPC or materialized view.
- `getCustomersPage()` with both `branchId` scoping AND `search` combines `.in("id", ids)` + `.or("phone.ilike...,full_name.ilike...")`. This is correct (AND semantics), but the `ids` array can be large for a busy branch — Supabase/PostgREST translates `.in()` to `WHERE id = ANY(...)` which is efficient with the existing `idx_customers_preferred_staff` index on `customers(id)` (the PK is always indexed).
- Worktree does not have `.env.local` — copy from `E:/cradlehub/.env.local` before running `pnpm build` in the worktree. (The `.env.local` was copied as a build-time workaround and is gitignored.)
