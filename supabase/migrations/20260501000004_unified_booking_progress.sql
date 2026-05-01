-- =============================================================================
-- MIGRATION: Unified Booking Progress Tracking
-- =============================================================================
-- Replaces home-service-only tracking with a unified progress model that
-- supports home_service, walkin (in-spa), and online booking types.
--
-- Old columns (home_service_tracking_status, completed_at) are preserved
-- but no longer written by new code. They serve as a backstop until a
-- future cleanup migration removes them.
-- =============================================================================

-- ─── 1. New unified columns ─────────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_progress_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS checked_in_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_completed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_at              TIMESTAMPTZ;

COMMENT ON COLUMN bookings.booking_progress_status IS 'Unified progress: not_started | checked_in | travel_started | arrived | session_started | completed | no_show';
COMMENT ON COLUMN bookings.checked_in_at           IS 'Timestamp when customer checked in (in-spa / walk-in)';
COMMENT ON COLUMN bookings.session_completed_at    IS 'Timestamp when the session/appointment was completed';
COMMENT ON COLUMN bookings.no_show_at              IS 'Timestamp when appointment was marked no-show';

-- ─── 2. CHECK constraint on unified progress status ─────────────────────────
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_progress_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_progress_status_check
  CHECK (
    booking_progress_status IN (
      'not_started',
      'checked_in',
      'travel_started',
      'arrived',
      'session_started',
      'completed',
      'no_show'
    )
  );

-- ─── 3. Backfill from old home-service tracking status ──────────────────────
-- If home_service_tracking_status exists and has non-default values,
-- copy them into the new unified column.
UPDATE bookings
   SET booking_progress_status = home_service_tracking_status
 WHERE home_service_tracking_status IS NOT NULL
   AND home_service_tracking_status <> 'not_started';

-- ─── 4. Backfill session_completed_at from completed_at ─────────────────────
UPDATE bookings
   SET session_completed_at = completed_at
 WHERE completed_at IS NOT NULL
   AND session_completed_at IS NULL;

-- ─── 5. Drop old CHECK so the column can drift (no longer managed) ─────────
-- We keep the column for safety but remove the constraint so future
-- code that still references it accidentally won't fail.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_home_service_tracking_status_check;

-- ─── 6. Update RPC: unified booking progress ────────────────────────────────
-- Replaces update_home_service_tracking with a type-aware version that
-- handles home_service, walkin, and online flows.
-- SECURITY DEFINER is still required because staff do not have UPDATE on bookings.
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
  v_booking_type       TEXT;
  v_current_progress   TEXT;
  v_staff_id           UUID;
BEGIN
  -- Lock row and read current state
  SELECT type,
         booking_progress_status,
         staff_id
    INTO v_booking_type,
         v_current_progress,
         v_staff_id
    FROM bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- ── Validate transition by booking type ──
  IF v_booking_type = 'home_service' THEN
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'travel_started') OR
      (v_current_progress = 'travel_started'  AND p_next_status = 'arrived') OR
      (v_current_progress = 'arrived'         AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for home service: % -> %', v_current_progress, p_next_status;
    END IF;

  ELSIF v_booking_type = 'walkin' THEN
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'checked_in') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed') OR
      (v_current_progress = 'not_started'     AND p_next_status = 'no_show') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'no_show')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for walk-in: % -> %', v_current_progress, p_next_status;
    END IF;

  ELSIF v_booking_type = 'online' THEN
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for online: % -> %', v_current_progress, p_next_status;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unsupported booking type for progress tracking: %', v_booking_type;
  END IF;

  -- ── Apply update ──
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
  'Unified progress update for bookings. Type-aware transitions for home_service, walkin, and online. '
  'SECURITY DEFINER — only callable via trusted server actions.';
