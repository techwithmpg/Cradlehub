-- =============================================================================
-- CradleHub — Migration 004 (2026-05-22): Add shift_type to staff_schedules
-- =============================================================================
-- Phase 2C: The spa uses opening shifts, closing shifts, and a single/regular
-- shift pattern. This migration allows up to 3 schedule rows per staff per
-- day (one per shift_type), replacing the old one-row-per-day constraint.
--
-- Safe:
--   ✦ All existing rows default to 'single' — no data loss.
--   ✦ get_available_slots and get_daily_schedule updated to handle multiple
--     shift windows per staff per day without breaking existing behaviour.
-- =============================================================================


-- ── Step 1: Add shift_type column ────────────────────────────────────────────

ALTER TABLE public.staff_schedules
  ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'single';

ALTER TABLE public.staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_shift_type_check;

ALTER TABLE public.staff_schedules
  ADD CONSTRAINT staff_schedules_shift_type_check
  CHECK (shift_type IN ('single', 'opening', 'closing'));

COMMENT ON COLUMN public.staff_schedules.shift_type IS
  'Shift category: single (regular/default), opening, or closing. '
  'Supports opening/closing overlap for spa operations. '
  'Existing rows default to single.';


-- ── Step 2: Replace unique constraint ────────────────────────────────────────
-- Old: UNIQUE (staff_id, day_of_week)        → one row per staff per day
-- New: UNIQUE (staff_id, day_of_week, shift_type) → one row per shift per day

ALTER TABLE public.staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_day_of_week_key;

ALTER TABLE public.staff_schedules
  ADD CONSTRAINT staff_schedules_staff_day_shift_unique
  UNIQUE (staff_id, day_of_week, shift_type);


-- ── Step 3: Update get_available_slots ───────────────────────────────────────
-- The working_hours CTE now produces ONE ROW PER SHIFT WINDOW when a staff
-- member has multiple shift_type rows for a given day.
-- SELECT DISTINCT in working_hours deduplicates when an override is active
-- (override produces the same hours for all shift rows → collapse to one).
-- SELECT DISTINCT on the final output deduplicates slot_times that appear in
-- the overlap period between opening and closing windows.
-- Net result: a booking request can be satisfied by ANY of the staff's shift
-- windows, which is the correct semantics for opening/closing shifts.

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

  -- ── Effective working hours ────────────────────────────────────────────────
  -- CRITICAL: schedule_overrides takes FULL precedence over staff_schedules.
  -- With multiple shift_type rows per staff per day, the LEFT JOIN produces
  -- one output row per shift window (opening OR closing OR single).
  -- When an override exists: all shift rows produce the same override hours →
  -- SELECT DISTINCT collapses them to one window.
  -- When no override: each shift row produces its own window → multiple rows.
  working_hours AS (
    SELECT DISTINCT
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

  -- SELECT DISTINCT deduplicates slots that appear in the overlap period
  -- between an opening and closing shift window (same slot_time, same
  -- available value — the conflict check is window-independent).
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
  'Core availability engine. Returns in-window time slots for a branch+service+date.
   Supports multiple shift windows per staff per day (opening + closing).
   A booking fits inside any one valid shift window — overlap periods are deduplicated.
   SECURITY DEFINER bypasses RLS to see cross-branch bookings (home service safety).
   Checks schedule_overrides BEFORE staff_schedules (override always wins).';


-- ── Step 4: Update get_daily_schedule ────────────────────────────────────────
-- The work_hours CTE now aggregates across all shift windows per staff.
-- MIN(start_time) / MAX(end_time) produces the full working span for the day.
-- For a staff with both opening (09:00–17:00) and closing (14:00–22:30),
-- the board shows 09:00–22:30 — the full span they are on the premises.
-- Day-off override via bool_or(is_day_off) still produces NULL → excluded.

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
      s.id        AS sid,
      s.full_name AS sname,
      s.tier      AS stier
    FROM public.staff s
    WHERE s.branch_id = p_branch_id
      AND s.is_active = TRUE
    ORDER BY s.tier, s.full_name
  ),

  -- Aggregate all shift windows per staff to the full working span.
  -- Uses MIN(start) + MAX(end) so that opening(09–17) + closing(14–22:30)
  -- shows as 09:00–22:30 on the daily board.
  -- Day-off override (is_day_off = TRUE) collapses to NULL via CASE.
  work_hours AS (
    SELECT
      ast.sid,
      CASE
        WHEN COALESCE(BOOL_OR(so.is_day_off), FALSE) THEN NULL
        ELSE MIN(
          CASE
            WHEN so.start_time IS NOT NULL THEN so.start_time
            ELSE ss.start_time
          END
        )
      END AS wh_start,
      CASE
        WHEN COALESCE(BOOL_OR(so.is_day_off), FALSE) THEN NULL
        ELSE MAX(
          CASE
            WHEN so.end_time IS NOT NULL THEN so.end_time
            ELSE ss.end_time
          END
        )
      END AS wh_end
    FROM active_staff ast
    LEFT JOIN public.schedule_overrides so
      ON  so.staff_id     = ast.sid
      AND so.override_date = p_date
    LEFT JOIN public.staff_schedules ss
      ON  ss.staff_id    = ast.sid
      AND ss.day_of_week = v_dow
      AND ss.is_active   = TRUE
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
    WHERE b.branch_id   = p_branch_id
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
   Day-off overrides still produce NULL work_start/work_end.
   Updated in Phase 2C to aggregate multiple shift_type rows per staff per day.';
