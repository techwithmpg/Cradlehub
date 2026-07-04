-- =============================================================================
-- CradleHub — Scheduling RPC group-key and overnight parity
-- =============================================================================
-- Repairs two confirmed gaps in the SQL scheduling surface:
--   1. staff_schedule_groups were matched with raw staff.staff_type only, while
--      TypeScript maps aliases such as salon_head -> nail_tech.
--   2. overnight schedule windows were filtered out by work_end > work_start.
--
-- The function signatures are intentionally unchanged for Data API callers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.schedule_group_key_for_staff_type(
  p_staff_type TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_staff_type IS NULL OR btrim(p_staff_type) = '' THEN NULL
    WHEN p_staff_type = 'csr' THEN 'csr'
    WHEN p_staff_type = 'driver' THEN 'driver'
    WHEN p_staff_type = 'utility' THEN 'utility'
    WHEN p_staff_type IN ('nail_tech', 'salon_head') THEN 'nail_tech'
    WHEN p_staff_type IN ('aesthetician', 'facialist') THEN 'aesthetician'
    WHEN p_staff_type = 'managerial' THEN 'managerial'
    ELSE 'therapist'
  END
$$;

COMMENT ON FUNCTION public.schedule_group_key_for_staff_type(TEXT) IS
  'Canonical schedule-group mapper shared by SQL RPCs. Mirrors getScheduleGroupKeyForStaffType in TypeScript.';

-- ── get_available_slots ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_available_slots(
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
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_total_block_minutes := v_buffer_before + v_duration_minutes + v_buffer_after;

  SELECT b.slot_interval_minutes
  INTO v_slot_interval_mins
  FROM public.branches b
  WHERE b.id = p_branch_id
    AND b.is_active = TRUE;

  IF NOT FOUND OR v_slot_interval_mins IS NULL OR v_slot_interval_mins <= 0 THEN
    RETURN;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::SMALLINT;

  RETURN QUERY
  WITH
  staff_pool AS (
    SELECT
      s.id AS staff_id,
      s.full_name AS staff_name,
      s.tier AS staff_tier,
      s.staff_type,
      public.schedule_group_key_for_staff_type(s.staff_type) AS staff_group_key
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),
  working_hours AS (
    SELECT DISTINCT
      sp.staff_id,
      sp.staff_name,
      sp.staff_tier,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN gr.is_day_off = TRUE AND ss.id IS NULL THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL THEN so.start_time
        WHEN ss.id IS NOT NULL THEN ss.start_time
        WHEN gr.id IS NOT NULL THEN gr.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN gr.is_day_off = TRUE AND ss.id IS NULL THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL THEN so.end_time
        WHEN ss.id IS NOT NULL THEN ss.end_time
        WHEN gr.id IS NOT NULL THEN gr.end_time
        ELSE NULL
      END AS work_end
    FROM staff_pool sp
    LEFT JOIN public.schedule_overrides so
      ON so.staff_id = sp.staff_id
     AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON ss.staff_id = sp.staff_id
     AND ss.day_of_week = v_day_of_week
     AND ss.is_active = TRUE
    LEFT JOIN public.staff_schedule_groups sg
      ON sg.branch_id = p_branch_id
     AND sg.is_active = TRUE
     AND (
       sg.group_key = sp.staff_group_key
       OR sg.group_key = sp.staff_type
     )
    LEFT JOIN public.staff_group_schedule_rules gr
      ON gr.group_id = sg.id
     AND gr.day_of_week = v_day_of_week
     AND gr.is_active = TRUE
  ),
  active_hours AS (
    SELECT
      wh.*,
      CASE
        WHEN work_end_raw_min <= work_start_raw_min THEN work_end_raw_min + 1440
        ELSE work_end_raw_min
      END AS work_end_min
    FROM (
      SELECT
        wh.*,
        (EXTRACT(HOUR FROM wh.work_start)::INT * 60
          + EXTRACT(MINUTE FROM wh.work_start)::INT) AS work_start_raw_min,
        (EXTRACT(HOUR FROM wh.work_end)::INT * 60
          + EXTRACT(MINUTE FROM wh.work_end)::INT) AS work_end_raw_min
      FROM working_hours wh
      WHERE wh.work_start IS NOT NULL
        AND wh.work_end IS NOT NULL
        AND wh.work_start <> wh.work_end
    ) wh
  ),
  slot_grid AS (
    SELECT
      ah.staff_id,
      ah.staff_name,
      ah.staff_tier,
      slot_abs.slot_start_min,
      slot_abs.slot_end_min,
      make_time(
        (((slot_abs.slot_start_min % 1440) / 60)::INT),
        ((slot_abs.slot_start_min % 1440) % 60)::INT,
        0
      ) AS slot_time
    FROM active_hours ah
    CROSS JOIN LATERAL generate_series(
      ah.work_start_raw_min,
      ah.work_end_min - v_total_block_minutes,
      v_slot_interval_mins
    ) AS gs(slot_start_min)
    CROSS JOIN LATERAL (
      SELECT
        gs.slot_start_min::INT AS slot_start_min,
        (gs.slot_start_min + v_total_block_minutes)::INT AS slot_end_min
    ) slot_abs
    WHERE ah.work_end_min - ah.work_start_raw_min >= v_total_block_minutes
  ),
  busy_from_bookings AS (
    SELECT
      b.staff_id,
      CASE
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_start_min + 1440
        ELSE busy_raw.busy_start_min
      END AS busy_start_min,
      CASE
        WHEN busy_raw.busy_end_min <= busy_raw.busy_start_min
          THEN busy_raw.busy_end_min + 1440
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_end_min + 1440
        ELSE busy_raw.busy_end_min
      END AS busy_end_min
    FROM public.bookings b
    JOIN active_hours ah ON ah.staff_id = b.staff_id
    CROSS JOIN LATERAL (
      SELECT
        (EXTRACT(HOUR FROM b.start_time)::INT * 60
          + EXTRACT(MINUTE FROM b.start_time)::INT) AS busy_start_min,
        (EXTRACT(HOUR FROM b.end_time)::INT * 60
          + EXTRACT(MINUTE FROM b.end_time)::INT) AS busy_end_min
    ) busy_raw
    WHERE b.booking_date = p_date
      AND (
        b.status IN ('pending', 'confirmed', 'in_progress', 'completed')
        OR (
          b.status IN ('pending_payment', 'pending_crm_confirmation')
          AND b.hold_expires_at > NOW()
        )
      )
  ),
  busy_from_blocks AS (
    SELECT
      bt.staff_id,
      CASE
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_start_min + 1440
        ELSE busy_raw.busy_start_min
      END AS busy_start_min,
      CASE
        WHEN busy_raw.busy_end_min <= busy_raw.busy_start_min
          THEN busy_raw.busy_end_min + 1440
        WHEN ah.work_end_min > 1440 AND busy_raw.busy_start_min < ah.work_start_raw_min
          THEN busy_raw.busy_end_min + 1440
        ELSE busy_raw.busy_end_min
      END AS busy_end_min
    FROM public.blocked_times bt
    JOIN active_hours ah ON ah.staff_id = bt.staff_id
    CROSS JOIN LATERAL (
      SELECT
        (EXTRACT(HOUR FROM bt.start_time)::INT * 60
          + EXTRACT(MINUTE FROM bt.start_time)::INT) AS busy_start_min,
        (EXTRACT(HOUR FROM bt.end_time)::INT * 60
          + EXTRACT(MINUTE FROM bt.end_time)::INT) AS busy_end_min
    ) busy_raw
    WHERE bt.block_date = p_date
  )
  SELECT DISTINCT
    sg.staff_id,
    sg.staff_name,
    sg.staff_tier,
    sg.slot_time,
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.staff_id = sg.staff_id
          AND sg.slot_start_min < bb.busy_end_min
          AND sg.slot_end_min > bb.busy_start_min
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.staff_id = sg.staff_id
          AND sg.slot_start_min < bk.busy_end_min
          AND sg.slot_end_min > bk.busy_start_min
      )
    ) AS available
  FROM slot_grid sg
  ORDER BY sg.staff_name, sg.slot_time;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE) IS
  'Availability engine with group-key alias parity, pending-payment hold support, and overnight schedule-window support. Precedence: override day-off/times > individual schedule > group rule.';

-- ── get_daily_schedule ──────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_daily_schedule(UUID, DATE);

CREATE FUNCTION public.get_daily_schedule(
  p_branch_id UUID,
  p_date      DATE
)
RETURNS TABLE (
  staff_id   UUID,
  staff_name TEXT,
  staff_tier TEXT,
  work_start TIME,
  work_end   TIME,
  bookings   JSONB,
  blocks     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow INT := EXTRACT(DOW FROM p_date);
BEGIN
  RETURN QUERY
  WITH active_staff AS (
    SELECT
      s.id AS sid,
      s.full_name AS sname,
      s.tier AS stier,
      s.staff_type AS stype,
      public.schedule_group_key_for_staff_type(s.staff_type) AS group_key
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
  ),
  work_window_rows AS (
    SELECT DISTINCT
      ast.sid,
      so.is_day_off AS override_day_off,
      ss.id AS individual_schedule_id,
      gr.is_day_off AS group_day_off,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN gr.is_day_off = TRUE AND ss.id IS NULL THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL THEN so.start_time
        WHEN ss.id IS NOT NULL THEN ss.start_time
        WHEN gr.id IS NOT NULL THEN gr.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE THEN NULL
        WHEN gr.is_day_off = TRUE AND ss.id IS NULL THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL THEN so.end_time
        WHEN ss.id IS NOT NULL THEN ss.end_time
        WHEN gr.id IS NOT NULL THEN gr.end_time
        ELSE NULL
      END AS work_end
    FROM active_staff ast
    LEFT JOIN public.schedule_overrides so
      ON so.staff_id = ast.sid
     AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON ss.staff_id = ast.sid
     AND ss.day_of_week = v_dow
     AND ss.is_active = TRUE
    LEFT JOIN public.staff_schedule_groups sg
      ON sg.branch_id = p_branch_id
     AND sg.is_active = TRUE
     AND (
       sg.group_key = ast.group_key
       OR sg.group_key = ast.stype
     )
    LEFT JOIN public.staff_group_schedule_rules gr
      ON gr.group_id = sg.id
     AND gr.day_of_week = v_dow
     AND gr.is_active = TRUE
  ),
  work_window_minutes AS (
    SELECT
      wwr.*,
      CASE
        WHEN work_end_raw_min <= work_start_raw_min THEN work_end_raw_min + 1440
        ELSE work_end_raw_min
      END AS work_end_min
    FROM (
      SELECT
        wwr.*,
        (EXTRACT(HOUR FROM wwr.work_start)::INT * 60
          + EXTRACT(MINUTE FROM wwr.work_start)::INT) AS work_start_raw_min,
        (EXTRACT(HOUR FROM wwr.work_end)::INT * 60
          + EXTRACT(MINUTE FROM wwr.work_end)::INT) AS work_end_raw_min
      FROM work_window_rows wwr
      WHERE wwr.work_start IS NOT NULL
        AND wwr.work_end IS NOT NULL
        AND wwr.work_start <> wwr.work_end
    ) wwr
  ),
  work_hours AS (
    SELECT
      ast.sid,
      CASE
        WHEN COALESCE(BOOL_OR(wwr.override_day_off), FALSE) THEN NULL
        WHEN BOOL_AND(wwr.individual_schedule_id IS NULL)
         AND COALESCE(BOOL_OR(wwr.group_day_off), FALSE) THEN NULL
        WHEN MIN(wwm.work_start_raw_min) IS NULL THEN NULL
        ELSE make_time(
          (((MIN(wwm.work_start_raw_min) % 1440) / 60)::INT),
          ((MIN(wwm.work_start_raw_min) % 1440) % 60)::INT,
          0
        )
      END AS wh_start,
      CASE
        WHEN COALESCE(BOOL_OR(wwr.override_day_off), FALSE) THEN NULL
        WHEN BOOL_AND(wwr.individual_schedule_id IS NULL)
         AND COALESCE(BOOL_OR(wwr.group_day_off), FALSE) THEN NULL
        WHEN MAX(wwm.work_end_min) IS NULL THEN NULL
        ELSE make_time(
          (((MAX(wwm.work_end_min) % 1440) / 60)::INT),
          ((MAX(wwm.work_end_min) % 1440) % 60)::INT,
          0
        )
      END AS wh_end
    FROM active_staff ast
    LEFT JOIN work_window_rows wwr ON wwr.sid = ast.sid
    LEFT JOIN work_window_minutes wwm ON wwm.sid = ast.sid
    GROUP BY ast.sid
  ),
  staff_bookings AS (
    SELECT
      b.staff_id AS sid,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id',            b.id,
            'start_time',    b.start_time,
            'end_time',      b.end_time,
            'service',       COALESCE(srv.name, 'Service'),
            'customer',      COALESCE(c.full_name, '—'),
            'status',        b.status,
            'type',          b.type,
            'resource_id',   b.resource_id,
            'resource_name', res.name
          )
          ORDER BY b.start_time
        )
        FILTER (WHERE b.id IS NOT NULL),
        '[]'::JSONB
      ) AS booking_list
    FROM public.bookings b
    LEFT JOIN public.services srv ON srv.id = b.service_id
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.branch_resources res ON res.id = b.resource_id
    WHERE b.branch_id = p_branch_id
      AND b.booking_date = p_date
      AND (
        b.status IN ('pending', 'confirmed', 'in_progress', 'completed')
        OR (
          b.status IN ('pending_payment', 'pending_crm_confirmation')
          AND b.hold_expires_at > NOW()
        )
      )
    GROUP BY b.staff_id
  ),
  staff_blocks AS (
    SELECT
      bt.staff_id AS sid,
      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'start_time', bt.start_time,
            'end_time',   bt.end_time,
            'reason',     bt.reason
          )
          ORDER BY bt.start_time
        )
        FILTER (WHERE bt.id IS NOT NULL),
        '[]'::JSONB
      ) AS block_list
    FROM public.blocked_times bt
    WHERE bt.block_date = p_date
    GROUP BY bt.staff_id
  )
  SELECT
    ast.sid::UUID AS staff_id,
    ast.sname::TEXT AS staff_name,
    ast.stier::TEXT AS staff_tier,
    wh.wh_start AS work_start,
    wh.wh_end AS work_end,
    COALESCE(sb.booking_list, '[]'::JSONB) AS bookings,
    COALESCE(stb.block_list, '[]'::JSONB) AS blocks
  FROM active_staff ast
  LEFT JOIN work_hours wh ON wh.sid = ast.sid
  LEFT JOIN staff_bookings sb ON sb.sid = ast.sid
  LEFT JOIN staff_blocks stb ON stb.sid = ast.sid
  ORDER BY ast.stier, ast.sname;
END;
$$;

COMMENT ON FUNCTION public.get_daily_schedule(UUID, DATE) IS
  'Daily board data with group-key alias parity and overnight schedule-window support. Work span is min start and max absolute end across resolved windows.';

GRANT EXECUTE ON FUNCTION public.schedule_group_key_for_staff_type(TEXT)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_daily_schedule(UUID, DATE)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE)
  TO authenticated, service_role;
