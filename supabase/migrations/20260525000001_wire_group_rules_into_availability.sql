-- =============================================================================
-- CradleHub Phase 2X-E — Wire group schedule rules into availability engine
-- =============================================================================
-- Context:
--   staff_schedule_groups and staff_group_schedule_rules (Phase 2H) define
--   universal weekly schedule defaults per branch/staff-type. Until this
--   migration, they had zero operational effect — the booking engine and daily
--   schedule only read individual staff_schedules rows.
--
-- This migration adds a group-schedule fallback to both RPCs:
--
--   Priority order (highest first):
--     1. schedule_overrides.is_day_off = TRUE            → staff off, no slots
--     2. schedule_overrides with explicit start/end time → use override window
--     3. staff_schedules row for that day                → use individual schedule
--     4. staff_group_schedule_rules for that day          → use group default  ← NEW
--     5. no rule at all                                  → no schedule / no slots
--     6. blocked_times still apply on top (unchanged)
--     7. booking conflicts still apply on top (unchanged)
--
-- Changes:
--   get_available_slots: add staff_type to staff_pool; add LEFT JOINs to
--     staff_schedule_groups + staff_group_schedule_rules in working_hours CTE;
--     add group fallback CASE tier.
--
--   get_daily_schedule: add staff_type to active_staff; add same LEFT JOINs in
--     work_hours CTE; add group fallback into MIN/MAX aggregation.
--
-- Safety:
--   ✦ All staff with existing individual schedules are unaffected.
--   ✦ Group rule only fires for the ELSE NULL branch (no individual schedule).
--   ✦ Override day-off still wins over group rule.
--   ✦ Individual schedule still wins over group rule (per-day granularity).
--   ✦ SECURITY DEFINER already bypasses RLS on all tables in these functions.
-- =============================================================================


-- ── get_available_slots ───────────────────────────────────────────────────────

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

  -- Include staff_type so we can join to group schedule rules below.
  staff_pool AS (
    SELECT
      s.id         AS staff_id,
      s.full_name  AS staff_name,
      s.tier       AS staff_tier,
      s.staff_type AS staff_type
    FROM staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
  ),

  -- ── Effective working hours ────────────────────────────────────────────────
  -- Priority (high → low):
  --   1. schedule_overrides.is_day_off = TRUE            → NULL (staff off)
  --   2. group rule is_day_off = TRUE AND no indiv. row  → NULL (staff off)
  --   3. schedule_overrides with explicit times           → override window
  --   4. staff_schedules row exists                       → individual window
  --   5. staff_group_schedule_rules row exists            → group default window
  --   6. ELSE NULL                                        → no schedule
  --
  -- With multiple shift_type rows (opening + closing) per staff, each row
  -- produces its own output row. SELECT DISTINCT collapses duplicates when an
  -- override makes all shift rows identical.
  working_hours AS (
    SELECT DISTINCT
      sp.staff_id,
      sp.staff_name,
      sp.staff_tier,
      CASE
        WHEN so.is_day_off = TRUE                              THEN NULL
        WHEN gr.is_day_off = TRUE AND ss.id IS NULL            THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL   THEN so.start_time
        WHEN ss.id IS NOT NULL                                 THEN ss.start_time
        WHEN gr.id IS NOT NULL                                 THEN gr.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE                              THEN NULL
        WHEN gr.is_day_off = TRUE AND ss.id IS NULL            THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL     THEN so.end_time
        WHEN ss.id IS NOT NULL                                 THEN ss.end_time
        WHEN gr.id IS NOT NULL                                 THEN gr.end_time
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
    LEFT JOIN staff_schedule_groups sg
      ON  sg.branch_id = p_branch_id
      AND sg.group_key = sp.staff_type
      AND sg.is_active = TRUE
    LEFT JOIN staff_group_schedule_rules gr
      ON  gr.group_id    = sg.id
      AND gr.day_of_week = v_day_of_week
      AND gr.is_active   = TRUE
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

  SELECT DISTINCT
    sg2.staff_id,
    sg2.staff_name,
    sg2.staff_tier,
    sg2.slot_time,
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.staff_id = sg2.staff_id
          AND sg2.slot_time < bb.busy_end
          AND sg2.slot_end  > bb.busy_start
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.staff_id = sg2.staff_id
          AND sg2.slot_time < bk.busy_end
          AND sg2.slot_end  > bk.busy_start
      )
    ) AS available
  FROM slot_grid sg2
  ORDER BY sg2.staff_name, sg2.slot_time;
END;
$$;

COMMENT ON FUNCTION get_available_slots IS
  'Core availability engine. Returns in-window time slots for a branch+service+date.
   Supports multiple shift windows per staff per day (opening + closing).
   Fallback priority: schedule_override > individual staff_schedule > group schedule rule.
   Staff with no individual schedule but a group rule will now appear in slot results.
   SECURITY DEFINER bypasses RLS to see cross-branch bookings (home service safety).
   Updated in Phase 2X-E to wire universal group schedule rules as fallback.';


-- ── get_daily_schedule ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_daily_schedule(uuid, date);

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
      s.id         AS sid,
      s.full_name  AS sname,
      s.tier       AS stier,
      s.staff_type AS stype
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
    ORDER BY s.tier, s.full_name
  ),

  -- Aggregate all shift windows per staff to the full working span.
  -- Priority: override > individual schedule > group rule.
  -- is_day_off check: override day-off always wins; group day-off only applies
  -- when the staff member has no individual schedule for the day.
  work_hours AS (
    SELECT
      ast.sid,
      CASE
        WHEN COALESCE(BOOL_OR(so.is_day_off), FALSE) THEN NULL
        WHEN BOOL_AND(ss.id IS NULL)
         AND COALESCE(BOOL_OR(gr.is_day_off), FALSE) THEN NULL
        ELSE MIN(
          CASE
            WHEN so.start_time IS NOT NULL THEN so.start_time
            WHEN ss.start_time IS NOT NULL THEN ss.start_time
            ELSE gr.start_time
          END
        )
      END AS wh_start,
      CASE
        WHEN COALESCE(BOOL_OR(so.is_day_off), FALSE) THEN NULL
        WHEN BOOL_AND(ss.id IS NULL)
         AND COALESCE(BOOL_OR(gr.is_day_off), FALSE) THEN NULL
        ELSE MAX(
          CASE
            WHEN so.end_time IS NOT NULL THEN so.end_time
            WHEN ss.end_time IS NOT NULL THEN ss.end_time
            ELSE gr.end_time
          END
        )
      END AS wh_end
    FROM active_staff ast
    LEFT JOIN public.schedule_overrides so
      ON  so.staff_id      = ast.sid
      AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON  ss.staff_id    = ast.sid
      AND ss.day_of_week = v_dow
      AND ss.is_active   = TRUE
    LEFT JOIN public.staff_schedule_groups sg
      ON  sg.branch_id = p_branch_id
      AND sg.group_key = ast.stype
      AND sg.is_active = TRUE
    LEFT JOIN public.staff_group_schedule_rules gr
      ON  gr.group_id    = sg.id
      AND gr.day_of_week = v_dow
      AND gr.is_active   = TRUE
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
    LEFT JOIN public.customers c  ON c.id   = b.customer_id
    LEFT JOIN public.branch_resources res ON res.id = b.resource_id
    WHERE b.branch_id    = p_branch_id
      AND b.booking_date = p_date
      AND b.status NOT IN ('cancelled', 'no_show')
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
    ast.sid::UUID   AS staff_id,
    ast.sname::TEXT AS staff_name,
    ast.stier::TEXT AS staff_tier,
    wh.wh_start     AS work_start,
    wh.wh_end       AS work_end,
    COALESCE(sb.booking_list,  '[]'::JSONB) AS bookings,
    COALESCE(stb.block_list,   '[]'::JSONB) AS blocks
  FROM active_staff ast
  LEFT JOIN work_hours wh  ON wh.sid  = ast.sid
  LEFT JOIN staff_bookings sb  ON sb.sid  = ast.sid
  LEFT JOIN staff_blocks   stb ON stb.sid = ast.sid
  ORDER BY ast.stier, ast.sname;
END;
$$;

COMMENT ON FUNCTION get_daily_schedule IS
  'Daily board data: returns one row per staff with aggregated work span and bookings.
   For staff with opening + closing shifts, work_start = min(start), work_end = max(end).
   Fallback priority: schedule_override > individual staff_schedule > group schedule rule.
   Staff with no individual schedule but a group rule will now appear on the daily board.
   Day-off overrides still produce NULL work_start/work_end.
   Updated in Phase 2X-E to wire universal group schedule rules as fallback.';
