-- =============================================================================
-- CradleHub — Hotfix: get_available_slots staff_id ambiguity
-- =============================================================================
-- Fixes runtime error:
--   "Availability query failed: column reference \"staff_id\" is ambiguous"
--
-- Cause:
--   In PL/pgSQL RETURNS TABLE functions, output column names behave like
--   variables. Unqualified references such as `SELECT staff_id FROM ...` can
--   conflict with relation columns and become ambiguous.
--
-- Approach:
--   Recreate get_available_slots with fully qualified internal aliases
--   (v_staff_id, etc.) and only map to output names in the final SELECT.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_slots(
  p_branch_id  UUID,
  p_service_id UUID,
  p_staff_id   UUID  DEFAULT NULL,
  p_date       DATE  DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  staff_id   UUID,
  staff_name TEXT,
  staff_tier TEXT,
  slot_time  TIME,
  available  BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buffer_before       INT;
  v_duration_minutes    INT;
  v_buffer_after        INT;
  v_total_block_minutes INT;
  v_slot_interval_mins  INT;
  v_day_of_week         SMALLINT;
BEGIN
  SELECT
    s.buffer_before,
    s.duration_minutes,
    s.buffer_after
  INTO
    v_buffer_before,
    v_duration_minutes,
    v_buffer_after
  FROM services s
  WHERE s.id = p_service_id
    AND s.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_total_block_minutes := v_buffer_before + v_duration_minutes + v_buffer_after;

  SELECT b.slot_interval_minutes
  INTO v_slot_interval_mins
  FROM branches b
  WHERE b.id = p_branch_id
    AND b.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::SMALLINT;

  RETURN QUERY
  WITH staff_pool AS (
    SELECT
      s.id        AS v_staff_id,
      s.full_name AS v_staff_name,
      s.tier      AS v_staff_tier
    FROM staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),
  working_hours AS (
    SELECT
      sp.v_staff_id,
      sp.v_staff_name,
      sp.v_staff_tier,
      CASE
        WHEN so.is_day_off = TRUE                             THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL  THEN so.start_time
        WHEN ss.id IS NOT NULL                                THEN ss.start_time
        ELSE NULL
      END AS v_work_start,
      CASE
        WHEN so.is_day_off = TRUE                           THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL  THEN so.end_time
        WHEN ss.id IS NOT NULL                              THEN ss.end_time
        ELSE NULL
      END AS v_work_end
    FROM staff_pool sp
    LEFT JOIN schedule_overrides so
      ON  so.staff_id      = sp.v_staff_id
      AND so.override_date = p_date
    LEFT JOIN staff_schedules ss
      ON  ss.staff_id      = sp.v_staff_id
      AND ss.day_of_week   = v_day_of_week
      AND ss.is_active     = TRUE
  ),
  active_hours AS (
    SELECT *
    FROM working_hours wh
    WHERE wh.v_work_start IS NOT NULL
      AND wh.v_work_end   IS NOT NULL
      AND wh.v_work_end   > wh.v_work_start
  ),
  slot_grid AS (
    SELECT
      ah.v_staff_id,
      ah.v_staff_name,
      ah.v_staff_tier,
      (
        ah.v_work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
      )::TIME AS v_slot_time,
      (
        ah.v_work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
        + (v_total_block_minutes * INTERVAL '1 minute')
      )::TIME AS v_slot_end
    FROM active_hours ah
    CROSS JOIN generate_series(0, 287) AS gs(n)
    WHERE
      (ah.v_work_start + (gs.n * v_slot_interval_mins * INTERVAL '1 minute'))
        < ah.v_work_end
      AND (
        ah.v_work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
        + (v_total_block_minutes * INTERVAL '1 minute')
      ) <= ah.v_work_end
  ),
  busy_from_bookings AS (
    SELECT
      b.staff_id   AS v_staff_id,
      b.start_time AS v_busy_start,
      b.end_time   AS v_busy_end
    FROM bookings b
    WHERE b.booking_date = p_date
      AND b.staff_id IN (
        SELECT ah.v_staff_id
        FROM active_hours ah
      )
      AND b.status NOT IN ('cancelled', 'no_show')
  ),
  busy_from_blocks AS (
    SELECT
      bt.staff_id   AS v_staff_id,
      bt.start_time AS v_busy_start,
      bt.end_time   AS v_busy_end
    FROM blocked_times bt
    WHERE bt.block_date = p_date
      AND bt.staff_id IN (
        SELECT ah.v_staff_id
        FROM active_hours ah
      )
  )
  SELECT
    sg.v_staff_id   AS staff_id,
    sg.v_staff_name AS staff_name,
    sg.v_staff_tier AS staff_tier,
    sg.v_slot_time  AS slot_time,
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.v_staff_id  = sg.v_staff_id
          AND sg.v_slot_time < bb.v_busy_end
          AND sg.v_slot_end  > bb.v_busy_start
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.v_staff_id  = sg.v_staff_id
          AND sg.v_slot_time < bk.v_busy_end
          AND sg.v_slot_end  > bk.v_busy_start
      )
    ) AS available
  FROM slot_grid sg
  ORDER BY sg.v_staff_name, sg.v_slot_time;
END;
$$;

COMMENT ON FUNCTION get_available_slots IS
  'Hotfix version: removes ambiguous staff_id references by using explicit internal aliases.';

