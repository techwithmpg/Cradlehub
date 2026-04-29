-- =============================================================================
-- CradleHub — Migration 002: Performance Indexes
-- =============================================================================
-- Every index here has a documented query pattern it serves.
-- Partial indexes (WHERE clause) are used for common filtered queries —
-- smaller index size, faster scans on the hot path.
-- Composite indexes are ordered by selectivity (most selective column first).
-- =============================================================================


-- ─── BRANCHES ─────────────────────────────────────────────────────────────────
-- Only active branches are queried in normal operations
CREATE INDEX IF NOT EXISTS idx_branches_active
  ON branches (id) WHERE is_active = TRUE;


-- ─── STAFF ────────────────────────────────────────────────────────────────────
-- RLS policy: manager sees own branch staff
CREATE INDEX IF NOT EXISTS idx_staff_branch_id
  ON staff (branch_id);

-- Auth lookup: find staff record for logged-in user (called on every request via helper fn)
CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id
  ON staff (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Role-based routing: middleware redirects based on role
CREATE INDEX IF NOT EXISTS idx_staff_role_active
  ON staff (system_role) WHERE is_active = TRUE;


-- ─── STAFF SCHEDULES ──────────────────────────────────────────────────────────
-- Availability engine: get schedule for a specific staff + day
CREATE INDEX IF NOT EXISTS idx_staff_schedules_lookup
  ON staff_schedules (staff_id, day_of_week) WHERE is_active = TRUE;


-- ─── SCHEDULE OVERRIDES ───────────────────────────────────────────────────────
-- Availability engine: check if there's an override for a specific date
-- This is checked BEFORE the regular schedule — must be fast.
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_staff_date
  ON schedule_overrides (staff_id, override_date);


-- ─── SERVICES ────────────────────────────────────────────────────────────────
-- Public booking flow: list services by category
CREATE INDEX IF NOT EXISTS idx_services_category_active
  ON services (category_id) WHERE is_active = TRUE;


-- ─── BRANCH SERVICES ─────────────────────────────────────────────────────────
-- Booking flow step 2: list active services at a specific branch
CREATE INDEX IF NOT EXISTS idx_branch_services_branch_active
  ON branch_services (branch_id, service_id) WHERE is_active = TRUE;

-- Reverse lookup: which branches offer a specific service
CREATE INDEX IF NOT EXISTS idx_branch_services_service
  ON branch_services (service_id);


-- ─── CUSTOMERS ────────────────────────────────────────────────────────────────
-- phone has UNIQUE constraint (already indexed automatically)
-- CRM search: lookup by name (partial search via ILIKE needs pg_trgm for real perf,
-- but for ≤ a few thousand customers, a standard index works fine)
CREATE INDEX IF NOT EXISTS idx_customers_full_name
  ON customers (full_name);

-- CRM: find customers by preferred therapist
CREATE INDEX IF NOT EXISTS idx_customers_preferred_staff
  ON customers (preferred_staff_id) WHERE preferred_staff_id IS NOT NULL;

-- CRM: recent customers (sorted by last booking date)
CREATE INDEX IF NOT EXISTS idx_customers_last_booking_date
  ON customers (last_booking_date DESC) WHERE last_booking_date IS NOT NULL;


-- ─── BOOKINGS — the hottest table in the system ───────────────────────────────

-- ⭐ MOST CRITICAL: Availability engine query
-- get_available_slots checks: "what bookings exist for staff X on date Y
-- with a status that blocks availability?"
CREATE INDEX IF NOT EXISTS idx_bookings_availability
  ON bookings (staff_id, booking_date, status);

-- Partial version: only non-cancelled bookings (what the availability engine
-- actually needs — smaller index, faster scans)
CREATE INDEX IF NOT EXISTS idx_bookings_active
  ON bookings (staff_id, booking_date)
  WHERE status NOT IN ('cancelled', 'no_show');

-- Manager daily schedule view: all bookings at branch for a date
CREATE INDEX IF NOT EXISTS idx_bookings_branch_date
  ON bookings (branch_id, booking_date);

-- Customer history view (CRM)
CREATE INDEX IF NOT EXISTS idx_bookings_customer
  ON bookings (customer_id, booking_date DESC);

-- Owner overview: bookings by date across all branches
CREATE INDEX IF NOT EXISTS idx_bookings_date
  ON bookings (booking_date DESC);

-- Status board: filter by status (pending/confirmed queue)
CREATE INDEX IF NOT EXISTS idx_bookings_status_date
  ON bookings (status, booking_date)
  WHERE status IN ('pending', 'confirmed', 'in_progress');

-- Booking type filter (home service routing, etc.)
CREATE INDEX IF NOT EXISTS idx_bookings_type_date
  ON bookings (type, booking_date) WHERE type = 'home_service';


-- ─── BOOKING EVENTS ──────────────────────────────────────────────────────────
-- Audit trail per booking
CREATE INDEX IF NOT EXISTS idx_booking_events_booking
  ON booking_events (booking_id, created_at);

-- Future analytics: status transition history over time
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at
  ON booking_events (created_at DESC);


-- ─── BLOCKED TIMES ────────────────────────────────────────────────────────────
-- Availability engine: check manual blocks for staff on a date
-- Runs alongside the bookings check — must be equally fast
CREATE INDEX IF NOT EXISTS idx_blocked_times_staff_date
  ON blocked_times (staff_id, block_date);
