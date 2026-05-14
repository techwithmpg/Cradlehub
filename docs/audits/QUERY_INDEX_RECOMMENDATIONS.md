# Query Index Recommendations — Phase 2B Audit

**Date:** 2026-05-15
**Scope:** All Supabase query files under `src/lib/queries/` and `src/lib/notifications/`

---

## Existing Indexes (`supabase/migrations/20260429000002_indexes.sql`)

| Index Name | Table | Columns | Notes |
|---|---|---|---|
| `idx_branches_active` | `branches` | `(id) WHERE is_active = TRUE` | Partial — active-only ops |
| `idx_staff_branch_id` | `staff` | `(branch_id)` | Manager RLS scoping |
| `idx_staff_auth_user_id` | `staff` | `(auth_user_id) WHERE NOT NULL` | Per-request auth lookup |
| `idx_staff_role_active` | `staff` | `(system_role) WHERE is_active` | Middleware routing |
| `idx_staff_schedules_lookup` | `staff_schedules` | `(staff_id, day_of_week) WHERE is_active` | Availability engine |
| `idx_schedule_overrides_staff_date` | `schedule_overrides` | `(staff_id, override_date)` | Override check before schedule |
| `idx_services_category_active` | `services` | `(category_id) WHERE is_active` | Public booking flow |
| `idx_branch_services_branch_active` | `branch_services` | `(branch_id, service_id) WHERE is_active` | Services by branch |
| `idx_branch_services_service` | `branch_services` | `(service_id)` | Reverse lookup |
| `idx_customers_full_name` | `customers` | `(full_name)` | CRM name search |
| `idx_customers_preferred_staff` | `customers` | `(preferred_staff_id) WHERE NOT NULL` | Preferred therapist lookup |
| `idx_customers_last_booking_date` | `customers` | `(last_booking_date DESC) WHERE NOT NULL` | CRM recency sort |
| `idx_bookings_availability` | `bookings` | `(staff_id, booking_date, status)` | Availability engine |
| `idx_bookings_active` | `bookings` | `(staff_id, booking_date) WHERE NOT cancelled/no_show` | Hot path — partial |
| `idx_bookings_branch_date` | `bookings` | `(branch_id, booking_date)` | Manager daily schedule |
| `idx_bookings_customer` | `bookings` | `(customer_id, booking_date DESC)` | CRM customer history |
| `idx_bookings_date` | `bookings` | `(booking_date DESC)` | Owner overview |
| `idx_bookings_status_date` | `bookings` | `(status, booking_date) WHERE pending/confirmed/in_progress` | Status board |
| `idx_bookings_type_date` | `bookings` | `(type, booking_date) WHERE home_service` | Home service routing |
| `idx_booking_events_booking` | `booking_events` | `(booking_id, created_at)` | Audit trail per booking |
| `idx_booking_events_created_at` | `booking_events` | `(created_at DESC)` | Analytics |
| `idx_blocked_times_staff_date` | `blocked_times` | `(staff_id, block_date)` | Availability engine |

---

## Gap: Missing Index

### `bookings(branch_id, customer_id)` — HIGH PRIORITY

**Used by:** `branchCustomerIds()` in `src/lib/queries/customers.ts:7`

**Query pattern:**
```sql
SELECT DISTINCT customer_id
FROM bookings
WHERE branch_id = $1
  AND customer_id IS NOT NULL;
```

**Why it matters:** This helper runs on every CRM page load that is branch-scoped (customers list, lapsed list, repeat list, stats). The existing `idx_bookings_branch_date` covers `(branch_id, booking_date)` but does not include `customer_id` as a covering column — the planner must visit the heap to retrieve `customer_id`, and then deduplicate.

**Recommended migration:**
```sql
-- covering index: branch → distinct customer IDs
-- eliminates heap fetches for branchCustomerIds() two-step query
CREATE INDEX IF NOT EXISTS idx_bookings_branch_customer
  ON bookings (branch_id, customer_id)
  WHERE customer_id IS NOT NULL;
```

**Risk:** Low — additive, no data changes, no downtime on small tables.

---

## Queries with No `.limit()` — Audit

### Acceptable (bounded by design)

| Query | File | Why acceptable |
|---|---|---|
| `getPublicSiteSections()` | `public-site.ts:64` | CMS table — owner-defined, typically 5–20 rows |
| `getPublicSiteAssets(sectionKey)` | `public-site.ts:112` | Scoped to one section key; small asset galleries |
| `getTodaysSchedule()` / booking day views | `bookings.ts` | Always scoped to `branch_id + booking_date` — one day's data |
| Services list queries | `services.ts` | Branch-scoped; service catalogs are small |
| `getCustomerById()` | `customers.ts:47` | Single-row `.single()` — not a list |
| `lookupCustomerByPhone()` | `customers.ts:265` | `.maybeSingle()` — not a list |

### Bounded by safety limits added in Phase 2

| Query | File | Limit |
|---|---|---|
| `getAllStaff()` | `staff.ts` | `.limit(500)` |
| `getPendingStaff()` | `staff.ts` | `.limit(200)` |
| `getBookingsByCustomer()` | `bookings.ts` | `.limit(50)` |
| `getAllBookings()` | `bookings.ts` | `.limit(500)` |
| `getAllBookingsOwner()` | `bookings.ts` | `.limit(500)` |
| Notification queries | `notifications/queries.ts` | All have `.limit()` |

### Paginated (Phase 2B)

| Query | File | Pagination |
|---|---|---|
| `getCustomersPage()` | `customers.ts:221` | `normalizePagination()` + `.range(from, to)` + `count: "exact"` |

---

## Not Recommended for Pagination

**Booking list pages** (`/manager/bookings`, `/crm/bookings`, `/owner/bookings`) — all queries are already scoped to a single `branch_id + booking_date`. The result set for one day at one branch is naturally bounded. Adding pagination here would degrade usability with no correctness benefit.

**Staff list pages** (`/owner/staff`, `/manager/staff`) — uses `StaffManagementWorkspace` (client component) with client-side search filtering. Safety limits cap the fetch at 500 rows. Server-side pagination would require a significant UI redesign and is deferred.

---

## Future Recommendations (post-Phase 2B)

1. **`pg_trgm` GIN index on `customers.full_name`** — `ILIKE '%term%'` (substring search) cannot use a standard B-tree index. For > 10k customers, add `CREATE EXTENSION IF NOT EXISTS pg_trgm` and `CREATE INDEX idx_customers_full_name_trgm ON customers USING GIN (full_name gin_trgm_ops)`. Current prefix search (`ILIKE 'term%'`) does benefit from the B-tree index.

2. **`bookings(branch_id, customer_id)` covering index** — documented above as the immediate gap.

3. **Analytics queries** — date-bounded but potentially wide date ranges for owner reports. Profile before indexing; `idx_bookings_date` already exists.
