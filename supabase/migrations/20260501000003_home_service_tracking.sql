-- =============================================================================
-- MIGRATION: Home Service Tracking Timestamps
-- =============================================================================
-- Adds timestamp columns to bookings for home-service appointment progress
-- tracking (travel → arrived → session → complete).
-- Also adds a secure RPC function that staff can call from their phone to
-- update tracking stages without gaining full UPDATE rights on bookings.
-- =============================================================================

-- ─── 1. New columns on bookings ─────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS travel_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ;

COMMENT ON COLUMN bookings.travel_started_at  IS 'Timestamp when staff started traveling to customer (home_service only)';
COMMENT ON COLUMN bookings.arrived_at         IS 'Timestamp when staff arrived at customer address (home_service only)';
COMMENT ON COLUMN bookings.session_started_at IS 'Timestamp when massage/session began (home_service only)';
COMMENT ON COLUMN bookings.completed_at       IS 'Timestamp when home service appointment finished';

-- ─── 2. RPC: Update home-service tracking stage ─────────────────────────────
-- Staff call this from the portal. It validates ownership, checks stage
-- progression, sets the appropriate timestamp, and updates status when needed.
-- SECURITY DEFINER is required because staff do not have UPDATE on bookings.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_home_service_tracking(
  p_booking_id UUID,
  p_stage      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id           UUID;
  v_booking_type       TEXT;
  v_travel_started_at  TIMESTAMPTZ;
  v_arrived_at         TIMESTAMPTZ;
  v_session_started_at TIMESTAMPTZ;
  v_completed_at       TIMESTAMPTZ;
BEGIN
  v_staff_id := get_auth_staff_id();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated as staff';
  END IF;

  -- Lock the row and verify ownership + type
  SELECT type,
         travel_started_at,
         arrived_at,
         session_started_at,
         completed_at
    INTO v_booking_type,
         v_travel_started_at,
         v_arrived_at,
         v_session_started_at,
         v_completed_at
    FROM bookings
   WHERE id = p_booking_id
     AND staff_id = v_staff_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not assigned to you';
  END IF;

  IF v_booking_type != 'home_service' THEN
    RAISE EXCEPTION 'Tracking only available for home service bookings';
  END IF;

  IF p_stage = 'travel_started' THEN
    IF v_travel_started_at IS NOT NULL THEN
      RAISE EXCEPTION 'Travel already started';
    END IF;
    UPDATE bookings
       SET travel_started_at = NOW()
     WHERE id = p_booking_id;

  ELSIF p_stage = 'arrived' THEN
    IF v_travel_started_at IS NULL THEN
      RAISE EXCEPTION 'Travel not started yet';
    END IF;
    IF v_arrived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Already arrived';
    END IF;
    UPDATE bookings
       SET arrived_at = NOW()
     WHERE id = p_booking_id;

  ELSIF p_stage = 'session_started' THEN
    IF v_arrived_at IS NULL THEN
      RAISE EXCEPTION 'Not arrived yet';
    END IF;
    IF v_session_started_at IS NOT NULL THEN
      RAISE EXCEPTION 'Session already started';
    END IF;
    UPDATE bookings
       SET session_started_at = NOW(),
           status             = 'in_progress',
           updated_at         = NOW()
     WHERE id = p_booking_id;

  ELSIF p_stage = 'completed' THEN
    IF v_session_started_at IS NULL THEN
      RAISE EXCEPTION 'Session not started yet';
    END IF;
    IF v_completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Already completed';
    END IF;
    UPDATE bookings
       SET completed_at = NOW(),
           status       = 'completed',
           updated_at   = NOW()
     WHERE id = p_booking_id;

  ELSE
    RAISE EXCEPTION 'Invalid tracking stage: %', p_stage;
  END IF;
END;
$$;

COMMENT ON FUNCTION update_home_service_tracking IS
  'Staff-facing RPC to progress a home-service booking through travel → arrived → session → complete. '
  'Validates ownership, enforces sequential progression, updates status on session_started and completed.';
