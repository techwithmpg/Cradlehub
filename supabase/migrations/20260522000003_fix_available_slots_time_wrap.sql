-- =============================================================================
-- CradleHub — Fix availability slot generation time wrap
-- =============================================================================
-- PostgreSQL TIME + INTERVAL wraps after 24h. The old get_available_slots()
-- generated up to 288 candidate starts and compared wrapped TIME values, which
-- duplicated each staff member's day and could hit PostgREST's 1,000-row cap
-- before later staff appeared in the public booking flow.
--
-- This version generates slots using minute offsets inside the working window,
-- then converts valid minute values back to TIME.
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
  WITH
  staff_pool AS (
    SELECT
      s.id        AS staff_id,
      s.full_name AS staff_name,
      s.tier      AS staff_tier
    FROM staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),
  working_hours AS (
    SELECT
      sp.staff_id,
      sp.staff_name,
      sp.staff_tier,
      CASE
        WHEN so.is_day_off = TRUE                            THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL THEN so.start_time
        WHEN ss.id IS NOT NULL                               THEN ss.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE                          THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL THEN so.end_time
        WHEN ss.id IS NOT NULL                             THEN ss.end_time
        ELSE NULL
      END AS work_end
    FROM staff_pool sp
    LEFT JOIN schedule_overrides so
      ON  so.staff_id      = sp.staff_id
      AND so.override_date = p_date
    LEFT JOIN staff_schedules ss
      ON  ss.staff_id    = sp.staff_id
      AND ss.day_of_week = v_day_of_week
      AND ss.is_active   = TRUE
  ),
  active_hours AS (
    SELECT
      wh.*,
      (EXTRACT(HOUR FROM wh.work_start)::INT * 60
        + EXTRACT(MINUTE FROM wh.work_start)::INT) AS work_start_min,
      (EXTRACT(HOUR FROM wh.work_end)::INT * 60
        + EXTRACT(MINUTE FROM wh.work_end)::INT) AS work_end_min
    FROM working_hours wh
    WHERE wh.work_start IS NOT NULL
      AND wh.work_end   IS NOT NULL
      AND wh.work_end   > wh.work_start
  ),
  slot_grid AS (
    SELECT
      ah.staff_id,
      ah.staff_name,
      ah.staff_tier,
      make_time(
        ((ah.work_start_min + (gs.n * v_slot_interval_mins)) / 60)::INT,
        ((ah.work_start_min + (gs.n * v_slot_interval_mins)) % 60)::INT,
        0
      ) AS slot_time,
      make_time(
        ((ah.work_start_min + (gs.n * v_slot_interval_mins) + v_total_block_minutes) / 60)::INT,
        ((ah.work_start_min + (gs.n * v_slot_interval_mins) + v_total_block_minutes) % 60)::INT,
        0
      ) AS slot_end
    FROM active_hours ah
    CROSS JOIN LATERAL generate_series(
      0,
      ((ah.work_end_min - ah.work_start_min - v_total_block_minutes) / v_slot_interval_mins)::INT
    ) AS gs(n)
    WHERE ah.work_end_min - ah.work_start_min >= v_total_block_minutes
  ),
  busy_from_bookings AS (
    SELECT
      b.staff_id,
      b.start_time AS busy_start,
      b.end_time   AS busy_end
    FROM bookings b
    WHERE b.booking_date = p_date
      AND b.staff_id     IN (SELECT ah.staff_id FROM active_hours ah)
      AND b.status NOT IN ('cancelled', 'no_show')
  ),
  busy_from_blocks AS (
    SELECT
      bt.staff_id,
      bt.start_time AS busy_start,
      bt.end_time   AS busy_end
    FROM blocked_times bt
    WHERE bt.block_date = p_date
      AND bt.staff_id   IN (SELECT ah.staff_id FROM active_hours ah)
  )
  SELECT
    sg.staff_id,
    sg.staff_name,
    sg.staff_tier,
    sg.slot_time,
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.staff_id = sg.staff_id
          AND sg.slot_time < bb.busy_end
          AND sg.slot_end  > bb.busy_start
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.staff_id = sg.staff_id
          AND sg.slot_time < bk.busy_end
          AND sg.slot_end  > bk.busy_start
      )
    ) AS available
  FROM slot_grid sg
  ORDER BY sg.staff_name, sg.slot_time;
END;
$$;

COMMENT ON FUNCTION get_available_slots IS
  'Core availability engine. Returns in-window time slots for a branch+service+date. Generates candidate slots with minute arithmetic to avoid TIME wrap duplicates.';
