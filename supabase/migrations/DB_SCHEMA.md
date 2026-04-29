# CradleHub — Database Schema Reference

## Design Philosophy

**Additive-only from here forward.** These tables are designed to absorb future requirements through:
1. **JSONB `metadata` on `bookings`** — add new fields without migrations
2. **`TEXT + CHECK` instead of ENUM** — extend values by updating the CHECK constraint (no `ALTER TYPE`)
3. **`is_active` soft deletes everywhere** — never hard-delete business records
4. **Strict `ON DELETE RESTRICT` on bookings** — cannot lose a booking by deleting its parent

---

## Migration Order

| File | Purpose |
|------|---------|
| `001_core_tables.sql` | All 11 tables with constraints |
| `002_indexes.sql` | Performance indexes |
| `003_helper_functions.sql` | Auth helpers + business logic functions |
| `004_triggers.sql` | `updated_at`, booking events, customer stats |
| `005_rls_policies.sql` | Row Level Security |
| `006_availability_rpc.sql` | `get_available_slots()` + `create_online_booking()` |
| `007_seed_data.sql` | Initial branches, categories, services |

---

## Table Reference

### `branches`
Physical spa locations. Scheduling unit boundary.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | |
| `address` | TEXT | |
| `phone` | TEXT | |
| `email` | TEXT | |
| `maps_embed_url` | TEXT | Google Maps embed |
| `fb_page` | TEXT | Facebook page URL |
| `messenger_link` | TEXT | Facebook Messenger (primary contact channel) |
| `slot_interval_minutes` | INT | 15, 30, or 60. Drives booking grid granularity |
| `is_active` | BOOLEAN | Soft delete |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-maintained by trigger |

---

### `staff`
All personnel with system access. `auth_user_id` links to Supabase Auth.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `branch_id` | UUID FK→branches | Primary assignment. Owner sees all branches regardless. |
| `auth_user_id` | UUID FK→auth.users | Unique. NULL = no login yet. |
| `full_name` | TEXT | |
| `phone` | TEXT | |
| `tier` | TEXT | `senior \| mid \| junior`. Label only, no access effect. |
| `system_role` | TEXT | `owner \| manager \| crm \| staff`. Controls workspace routing. |
| `is_active` | BOOLEAN | Soft delete |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

---

### `staff_schedules`
Recurring weekly schedule. One row per staff per day.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `staff_id` | UUID FK→staff | Cascades on delete |
| `day_of_week` | SMALLINT | 0=Sunday, 1=Monday, …, 6=Saturday |
| `start_time` | TIME | Shift start |
| `end_time` | TIME | Shift end. Must be > start_time. |
| `is_active` | BOOLEAN | Toggle individual days off without deleting |
| `created_at` | TIMESTAMPTZ | |

**Unique:** `(staff_id, day_of_week)` — one schedule row per day.

---

### `schedule_overrides`
Date-specific exceptions. **Takes full precedence over `staff_schedules` for that date.**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `staff_id` | UUID FK→staff | |
| `override_date` | DATE | The specific date this applies to |
| `start_time` | TIME | NULL when `is_day_off = TRUE` |
| `end_time` | TIME | NULL when `is_day_off = TRUE` |
| `is_day_off` | BOOLEAN | TRUE = no slots at all that day |
| `reason` | TEXT | Internal note |
| `created_by` | UUID FK→staff | Who created the override |
| `created_at` | TIMESTAMPTZ | |

**Unique:** `(staff_id, override_date)`.

---

### `service_categories`
Groups services for public display.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT UNIQUE | |
| `display_order` | INT | Lower = appears first |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

---

### `services`
Global service catalog. Prices can be overridden per branch.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `category_id` | UUID FK→service_categories | |
| `name` | TEXT | |
| `description` | TEXT | Public-facing |
| `duration_minutes` | INT | Visible to customer. Must be > 0. |
| `price` | NUMERIC(10,2) | Default price. Overridden by `branch_services.custom_price`. |
| `buffer_before` | INT | Hidden prep time. Blocks schedule but not shown to customer. |
| `buffer_after` | INT | Hidden cleanup time. Blocks schedule but not shown to customer. |
| `is_active` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Total block time = `buffer_before + duration_minutes + buffer_after`**

---

### `branch_services`
Junction: which services are offered at which branch, with optional price override.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `branch_id` | UUID FK→branches | |
| `service_id` | UUID FK→services | |
| `custom_price` | NUMERIC(10,2) | NULL = use `services.price` |
| `is_active` | BOOLEAN | Temporarily disable a service at one branch |
| `created_at` | TIMESTAMPTZ | |

**Unique:** `(branch_id, service_id)`.

---

### `customers`
Guest customers. No Supabase Auth account required. CRM data accumulates from bookings.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `full_name` | TEXT | |
| `phone` | TEXT UNIQUE | **Primary CRM identifier. Same phone = same record.** |
| `email` | TEXT | Optional |
| `preferred_staff_id` | UUID FK→staff | Customer preference captured during booking |
| `notes` | TEXT | Internal staff notes |
| `first_booking_date` | DATE | Auto-maintained by trigger. Set once, never overwritten. |
| `last_booking_date` | DATE | Auto-maintained by trigger on `status → completed` |
| `total_bookings` | INT | Auto-maintained by trigger |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Upsert pattern:** `INSERT ... ON CONFLICT (phone) DO UPDATE SET full_name = ...`

---

### `bookings` ← Central Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `branch_id` | UUID FK→branches | ON DELETE RESTRICT |
| `service_id` | UUID FK→services | ON DELETE RESTRICT |
| `staff_id` | UUID FK→staff | ON DELETE RESTRICT |
| `customer_id` | UUID FK→customers | ON DELETE RESTRICT |
| `booking_date` | DATE | |
| `start_time` | TIME | Customer-visible start |
| `end_time` | TIME | **Stored denormalized.** = `start + buffer_before + duration + buffer_after` |
| `type` | TEXT | `online \| walkin \| home_service` |
| `status` | TEXT | `pending → confirmed → in_progress → completed` or `cancelled \| no_show` |
| `travel_buffer_mins` | INT | `home_service` only. Extra time blocked for travel. |
| `metadata` | JSONB | Extension point. Current keys: `customer_notes`. Future: `payment_ref`, `promo_code`, `rating` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Status flow:**
```
pending → confirmed → in_progress → completed
any status → cancelled
any status → no_show
```

---

### `booking_events` ← Audit Log
Append-only. Written **only by triggers**, never by application code.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `booking_id` | UUID FK→bookings | Cascades on delete |
| `from_status` | TEXT | NULL on initial creation |
| `to_status` | TEXT | |
| `changed_by` | UUID FK→staff | NULL when customer creates online |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Actor capture:** Set `SELECT set_config('app.current_staff_id', '<uuid>', TRUE)` before status updates. Trigger reads this to populate `changed_by`.

---

### `blocked_times`
Intra-day manual time blocks (breaks, training, etc.).
For a **full day off**, use `schedule_overrides.is_day_off = TRUE` instead.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `staff_id` | UUID FK→staff | Cascades on delete |
| `block_date` | DATE | |
| `start_time` | TIME | |
| `end_time` | TIME | Must be > start_time |
| `reason` | TEXT | `break \| leave \| training \| other` |
| `created_by` | UUID FK→staff | |
| `created_at` | TIMESTAMPTZ | |

---

## Key Functions

### `get_available_slots(p_branch_id, p_service_id, p_staff_id?, p_date?)`
The availability engine. Returns every slot with `available: boolean`.
- `p_staff_id = NULL` → returns all staff at branch
- Uses `SECURITY DEFINER` to see cross-branch bookings
- Checks `schedule_overrides` before `staff_schedules`

### `create_online_booking(p_branch_id, p_service_id, p_staff_id, p_date, p_start_time, p_full_name, p_phone, p_email?, p_notes?)`
Atomic booking creation with race condition protection.
Raises `SLOT_UNAVAILABLE` if slot was taken between availability check and INSERT.

### `upsert_customer(p_phone, p_full_name, p_email?)`
Creates or updates customer by phone. Returns `customer_id`.

### `compute_booking_end_time(p_start_time, p_service_id)`
Returns `end_time` for a booking. Call before INSERT.

### `get_effective_price(p_branch_id, p_service_id)`
Returns branch price or falls back to global service price.

### `get_auth_role()`, `get_auth_branch_id()`, `get_auth_staff_id()`
Auth context helpers used by RLS policies.

---

## RLS Access Matrix

| Table | Public | Staff (own) | Manager (branch) | CRM | Owner |
|-------|--------|------------|-----------------|-----|-------|
| branches | R | — | — | — | ALL |
| staff | — | R | R | — | ALL |
| staff_schedules | — | R | ALL | — | ALL |
| schedule_overrides | — | R | ALL | — | ALL |
| service_categories | R | — | — | — | ALL |
| services | R | — | — | — | ALL |
| branch_services | R | — | — | — | ALL |
| customers | — | — | R/W | R | ALL |
| bookings | — | R | ALL | R | ALL |
| booking_events | — | R | R | R | ALL |
| blocked_times | — | R | ALL | — | ALL |

---

## Critical Implementation Notes

1. **Override before schedule:** `get_available_slots` LEFT JOINs both `schedule_overrides` and `staff_schedules`. The CASE statement in `working_hours` CTE gives override absolute priority.

2. **Cross-branch availability:** The availability engine queries bookings for all staff in the pool across ALL branches (not filtered by branch). This is why the function uses `SECURITY DEFINER`.

3. **Race conditions:** `create_online_booking()` re-validates slot availability inside the transaction. Two simultaneous bookings for the same slot — the second one gets `SLOT_UNAVAILABLE`.

4. **changed_by attribution:** Before any staff-initiated status update: `SELECT set_config('app.current_staff_id', '<uuid>', TRUE)`. The trigger captures this. `TRUE` = transaction-local (resets on commit).

5. **end_time is stored:** Never compute it on the fly. Always use `compute_booking_end_time()` at INSERT time and store the result. Availability queries join on `end_time` — it must be in the table.

6. **Customer upsert:** Always use `upsert_customer()` or the `ON CONFLICT (phone) DO UPDATE` pattern. Never raw INSERT — you'll hit the unique constraint and lose data.

7. **Extending status values:** Update the CHECK constraint: `ALTER TABLE bookings DROP CONSTRAINT bookings_status_check; ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (..., 'new_status'));`. No ENUM migration required.
