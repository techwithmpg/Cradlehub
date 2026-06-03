-- =============================================================================
-- MIGRATION: Allow direct session start for in-spa bookings
-- =============================================================================
-- Enables assigned staff to start service without waiting for a CRM check-in.
-- Previously: not_started -> checked_in -> session_started (in_spa only)
-- Now:        not_started -> session_started  (direct start, in_spa)
--             not_started -> checked_in -> session_started  (still valid)
--
-- The existing home_service flow is unchanged.
-- CRM check-in remains a valid (optional) intermediate step for in-spa.
-- =============================================================================

CREATE OR REPLACE FUNCTION update_booking_progress(
  p_booking_id UUID,
  p_next_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_type    TEXT;
  v_current_progress TEXT;
  v_staff_id         UUID;
BEGIN
  -- Lock row and read current state
  SELECT delivery_type,
         booking_progress_status,
         staff_id
    INTO v_delivery_type,
         v_current_progress,
         v_staff_id
    FROM bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- ── Validate transition by delivery type ──────────────────────────────────

  IF v_delivery_type = 'home_service' THEN
    -- Home-service: full travel chain required
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'travel_started') OR
      (v_current_progress = 'travel_started'  AND p_next_status = 'arrived') OR
      (v_current_progress = 'arrived'         AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for home service: % -> %',
        v_current_progress, p_next_status;
    END IF;

  ELSIF v_delivery_type = 'in_spa' THEN
    -- In-spa: check-in optional; staff may go directly to session_started.
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'checked_in') OR
      (v_current_progress = 'not_started'     AND p_next_status = 'session_started') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed') OR
      (v_current_progress = 'not_started'     AND p_next_status = 'no_show') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'no_show')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for in-spa: % -> %',
        v_current_progress, p_next_status;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unsupported delivery type for progress tracking: %', v_delivery_type;
  END IF;

  -- ── Apply update ──────────────────────────────────────────────────────────

  IF p_next_status = 'checked_in' THEN
    UPDATE bookings
       SET booking_progress_status = 'checked_in',
           checked_in_at           = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'travel_started' THEN
    UPDATE bookings
       SET booking_progress_status = 'travel_started',
           travel_started_at       = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'arrived' THEN
    UPDATE bookings
       SET booking_progress_status = 'arrived',
           arrived_at              = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'session_started' THEN
    UPDATE bookings
       SET booking_progress_status = 'session_started',
           session_started_at      = NOW(),
           status                  = 'in_progress',
           updated_at              = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'completed' THEN
    UPDATE bookings
       SET booking_progress_status = 'completed',
           session_completed_at    = NOW(),
           status                  = 'completed',
           updated_at              = NOW()
     WHERE id = p_booking_id;

  ELSIF p_next_status = 'no_show' THEN
    UPDATE bookings
       SET booking_progress_status = 'no_show',
           no_show_at              = NOW(),
           status                  = 'no_show',
           updated_at              = NOW()
     WHERE id = p_booking_id;

  ELSE
    RAISE EXCEPTION 'Invalid progress status: %', p_next_status;
  END IF;
END;
$$;

COMMENT ON FUNCTION update_booking_progress IS
  'Unified progress update for bookings. '
  'Home-service: full travel chain. '
  'In-spa: check-in optional — staff may start session directly from not_started. '
  'SECURITY DEFINER — only callable via trusted server actions.';
