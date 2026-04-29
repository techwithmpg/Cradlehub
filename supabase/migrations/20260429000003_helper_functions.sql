-- =============================================================================
-- CradleHub — Migration 003: Helper Functions
-- =============================================================================
-- These functions are called by RLS policies on every row evaluation.
-- Using (SELECT auth.uid()) instead of auth.uid() directly is a Supabase
-- performance optimization — it evaluates the subquery once per query, not
-- once per row. Critical when scanning large tables with RLS active.
-- All are SECURITY DEFINER so they can query the staff table freely.
-- All set search_path explicitly to prevent search path injection attacks.
-- =============================================================================


-- ─── AUTH CONTEXT HELPERS ────────────────────────────────────────────────────

-- Returns the system_role of the currently logged-in staff member.
-- Used by RLS to determine which policies apply.
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT system_role
  FROM staff
  WHERE auth_user_id = (SELECT auth.uid())
    AND is_active = TRUE
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_auth_role IS
  'Returns system_role of the authenticated user. Called by RLS policies. '
  'Returns NULL for unauthenticated requests (public booking flow).';


-- Returns the branch_id of the currently logged-in staff member.
-- Used by manager-scoped RLS policies to filter to own branch.
CREATE OR REPLACE FUNCTION get_auth_branch_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id
  FROM staff
  WHERE auth_user_id = (SELECT auth.uid())
    AND is_active = TRUE
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_auth_branch_id IS
  'Returns branch_id of the authenticated user. Used by manager-scoped RLS policies.';


-- Returns the staff.id (not auth.uid) of the currently logged-in user.
-- Used by staff-scoped RLS to match their own bookings / schedule.
CREATE OR REPLACE FUNCTION get_auth_staff_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM staff
  WHERE auth_user_id = (SELECT auth.uid())
    AND is_active = TRUE
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_auth_staff_id IS
  'Returns staff.id (not auth.uid) of the authenticated user. '
  'Used by staff-scoped RLS to filter own bookings and schedules.';


-- ─── BUSINESS LOGIC HELPERS ──────────────────────────────────────────────────

-- Computes the stored end_time for a booking.
-- Application must call this and store the result in bookings.end_time.
-- Storing end_time denormalized avoids joins in the hot availability path.
-- If service buffers change after booking, existing end_times are NOT updated
-- (intentional — the booking was made under the original service definition).
CREATE OR REPLACE FUNCTION compute_booking_end_time(
  p_start_time TIME,
  p_service_id UUID
)
RETURNS TIME
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT (
    p_start_time
    + ((s.buffer_before + s.duration_minutes + s.buffer_after) * INTERVAL '1 minute')
  )::TIME
  FROM services s
  WHERE s.id = p_service_id;
$$;

COMMENT ON FUNCTION compute_booking_end_time IS
  'Computes bookings.end_time from service definition. '
  'Call before INSERT to populate the stored end_time column. '
  'Formula: start_time + buffer_before + duration_minutes + buffer_after.';


-- Upsert a customer by phone number and return their ID.
-- This is the canonical entry point for creating/updating customer records.
-- Called by: online booking flow, walk-in entry.
-- Same phone = same customer = CRM continuity.
CREATE OR REPLACE FUNCTION upsert_customer(
  p_phone     TEXT,
  p_full_name TEXT,
  p_email     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  INSERT INTO customers (full_name, phone, email)
  VALUES (p_full_name, p_phone, p_email)
  ON CONFLICT (phone) DO UPDATE
    SET
      full_name  = EXCLUDED.full_name,
      email      = COALESCE(EXCLUDED.email, customers.email),
      updated_at = NOW()
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;

COMMENT ON FUNCTION upsert_customer IS
  'Canonical customer entry point. Upserts by phone — same phone = same CRM record. '
  'Returns customer ID for use in booking creation. SECURITY DEFINER for public booking flow.';


-- Returns the effective price for a service at a specific branch.
-- Resolves: branch custom price if set, otherwise global service price.
CREATE OR REPLACE FUNCTION get_effective_price(
  p_branch_id  UUID,
  p_service_id UUID
)
RETURNS NUMERIC
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(bs.custom_price, s.price)
  FROM services s
  JOIN branch_services bs ON bs.service_id = s.id AND bs.branch_id = p_branch_id
  WHERE s.id = p_service_id
    AND s.is_active = TRUE
    AND bs.is_active = TRUE;
$$;

COMMENT ON FUNCTION get_effective_price IS
  'Returns branch-specific price or falls back to global service price. '
  'Use when displaying pricing in the booking flow.';
