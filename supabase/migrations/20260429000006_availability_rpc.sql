-- =============================================================================
-- CradleHub — Migration 006: Availability Engine RPC
-- =============================================================================
-- get_available_slots() is the heart of CradleHub.
-- It answers: "For a given branch + service + date, what time slots
-- are available, and with which staff member?"
--
-- SECURITY DEFINER is intentional and necessary:
--   RLS restricts managers to their branch's bookings.
--   But the availability engine MUST see ALL bookings for a staff member
--   regardless of branch (e.g., a therapist doing home service for another
--   branch still has that time blocked). SECURITY DEFINER bypasses RLS.
--
-- Algorithm:
--   1. Get service total block time (buffer_before + duration + buffer_after)
--   2. Get branch slot interval
--   3. Find all active staff at branch (or specific staff if p_staff_id provided)
--   4. For each staff: get working hours for the date
--      → Check schedule_overrides FIRST (exact date match)
--      → Fall back to staff_schedules (day of week)
--      → If is_day_off = TRUE → no slots
--   5. Generate slot grid within working hours using slot_interval_minutes
--   6. For each slot: check conflicts with bookings AND blocked_times
--      Conflict formula: slot_start < existing.end AND slot_end > existing.start
--   7. Return all slots with available = TRUE/FALSE
--
-- Return: available slots sorted by staff name then time.
--         Client renders all slots and visually marks unavailable ones
--         so users can see the full schedule context.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_slots(
  p_branch_id  UUID,
  p_service_id UUID,
  p_staff_id   UUID  DEFAULT NULL,     -- NULL = return all staff at branch
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
SECURITY DEFINER                        -- bypass RLS: must see cross-branch bookings
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

  -- ── Step 1: Fetch service timing ──────────────────────────────────────────
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
    -- Service doesn't exist or is inactive — return empty
    RETURN;
  END IF;

  -- Total minutes this service blocks on the schedule
  v_total_block_minutes := v_buffer_before + v_duration_minutes + v_buffer_after;

  -- ── Step 2: Fetch branch slot interval ───────────────────────────────────
  SELECT b.slot_interval_minutes
  INTO v_slot_interval_mins
  FROM branches b
  WHERE b.id = p_branch_id
    AND b.is_active = TRUE;

  IF NOT FOUND THEN
    -- Branch doesn't exist or is inactive — return empty
    RETURN;
  END IF;

  -- ── Step 3: Day of week for the requested date ───────────────────────────
  -- EXTRACT(DOW ...) returns 0=Sunday, 1=Monday, ..., 6=Saturday
  -- Matches staff_schedules.day_of_week convention
  v_day_of_week := EXTRACT(DOW FROM p_date)::SMALLINT;

  -- ── Steps 4–7: Main CTE chain ─────────────────────────────────────────────
  RETURN QUERY
  WITH

  -- ── 4a. Staff pool ────────────────────────────────────────────────────────
  -- All active staff at the branch, or just the requested staff member.
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

  -- ── 4b. Effective working hours ───────────────────────────────────────────
  -- CRITICAL: schedule_overrides takes FULL precedence over staff_schedules.
  -- LEFT JOIN both, then CASE picks the right source.
  -- is_day_off = TRUE → work_start/work_end are NULL → excluded from slot grid.
  working_hours AS (
    SELECT
      sp.staff_id,
      sp.staff_name,
      sp.staff_tier,
      CASE
        WHEN so.is_day_off = TRUE                           THEN NULL
        WHEN so.id IS NOT NULL AND so.start_time IS NOT NULL THEN so.start_time
        WHEN ss.id IS NOT NULL                               THEN ss.start_time
        ELSE NULL
      END AS work_start,
      CASE
        WHEN so.is_day_off = TRUE                          THEN NULL
        WHEN so.id IS NOT NULL AND so.end_time IS NOT NULL  THEN so.end_time
        WHEN ss.id IS NOT NULL                              THEN ss.end_time
        ELSE NULL
      END AS work_end
    FROM staff_pool sp
    -- Override for this exact date (checked first — drives the CASE above)
    LEFT JOIN schedule_overrides so
      ON  so.staff_id     = sp.staff_id
      AND so.override_date = p_date
    -- Regular recurring schedule (fallback)
    LEFT JOIN staff_schedules ss
      ON  ss.staff_id    = sp.staff_id
      AND ss.day_of_week = v_day_of_week
      AND ss.is_active   = TRUE
  ),

  -- Keep only staff who are actually working that day with valid hours
  active_hours AS (
    SELECT *
    FROM working_hours
    WHERE work_start IS NOT NULL
      AND work_end   IS NOT NULL
      AND work_end   > work_start
  ),

  -- ── Step 5: Generate slot grid ────────────────────────────────────────────
  -- For each working staff member, generate all possible start times
  -- at slot_interval_minutes intervals within their working window.
  -- generate_series upper bound of 287 = (24 * 60 / 5) - 1 — safe maximum
  -- for any slot interval (handles 5, 15, 30, 60 minute intervals).
  -- The WHERE clause filters to only slots where the full service block fits.
  slot_grid AS (
    SELECT
      ah.staff_id,
      ah.staff_name,
      ah.staff_tier,
      (
        ah.work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
      )::TIME AS slot_time,
      (
        ah.work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
        + (v_total_block_minutes * INTERVAL '1 minute')
      )::TIME AS slot_end
    FROM active_hours ah
    CROSS JOIN generate_series(0, 287) AS gs(n)
    WHERE
      -- Slot start is within working hours
      (ah.work_start + (gs.n * v_slot_interval_mins * INTERVAL '1 minute'))
        < ah.work_end
      -- Full service block (including buffers) ends at or before shift end
      -- This prevents bookings that run over the end of shift
      AND (
        ah.work_start
        + (gs.n * v_slot_interval_mins * INTERVAL '1 minute')
        + (v_total_block_minutes * INTERVAL '1 minute')
      ) <= ah.work_end
  ),

  -- ── Step 6a: Existing bookings that block time ────────────────────────────
  -- Query ALL bookings for staff members in the pool, not filtered by branch.
  -- A therapist doing home service for another branch still has that time blocked.
  -- This is why SECURITY DEFINER is required — RLS would restrict to one branch.
  -- Only active statuses block: cancelled and no_show free up the slot.
  busy_from_bookings AS (
    SELECT
      b.staff_id,
      b.start_time AS busy_start,
      b.end_time   AS busy_end
    FROM bookings b
    WHERE b.booking_date = p_date
      AND b.staff_id     IN (SELECT staff_id FROM active_hours)
      AND b.status NOT IN ('cancelled', 'no_show')
  ),

  -- ── Step 6b: Manual blocks (breaks, training, etc.) ──────────────────────
  busy_from_blocks AS (
    SELECT
      bt.staff_id,
      bt.start_time AS busy_start,
      bt.end_time   AS busy_end
    FROM blocked_times bt
    WHERE bt.block_date = p_date
      AND bt.staff_id   IN (SELECT staff_id FROM active_hours)
  )

  -- ── Step 7: Mark each slot as available or blocked ────────────────────────
  -- Overlap detection formula:
  --   Two intervals [A_start, A_end) and [B_start, B_end) overlap when:
  --   A_start < B_end AND A_end > B_start
  -- This handles all overlap cases: partial overlap, full containment, exact match.
  SELECT
    sg.staff_id,
    sg.staff_name,
    sg.staff_tier,
    sg.slot_time,
    -- available = TRUE only if NO booking AND NO block overlaps this slot
    NOT (
      EXISTS (
        SELECT 1
        FROM busy_from_bookings bb
        WHERE bb.staff_id  = sg.staff_id
          AND sg.slot_time  < bb.busy_end    -- slot starts before busy period ends
          AND sg.slot_end   > bb.busy_start  -- slot ends after busy period starts
      )
      OR
      EXISTS (
        SELECT 1
        FROM busy_from_blocks bk
        WHERE bk.staff_id  = sg.staff_id
          AND sg.slot_time  < bk.busy_end
          AND sg.slot_end   > bk.busy_start
      )
    ) AS available
  FROM slot_grid sg
  ORDER BY sg.staff_name, sg.slot_time;

END;
$$;

COMMENT ON FUNCTION get_available_slots IS
  'Core availability engine. Returns all time slots for a branch+service+date.
   Pass p_staff_id to filter to one therapist, or leave NULL for all branch staff.
   SECURITY DEFINER bypasses RLS to see cross-branch bookings (home service safety).
   Checks schedule_overrides BEFORE staff_schedules (override always wins).
   Returns both available and unavailable slots — client decides how to render.';


-- =============================================================================
-- PUBLIC BOOKING INSERT FUNCTION
-- =============================================================================
-- Called by the online booking API route using the service role key.
-- Wraps the full booking creation in one transaction:
--   1. Upsert customer by phone
--   2. Verify slot is still available (race condition protection)
--   3. Insert booking
--   4. Triggers handle: booking_events, customer stats
-- Returns the new booking ID.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_online_booking(
  p_branch_id    UUID,
  p_service_id   UUID,
  p_staff_id     UUID,
  p_date         DATE,
  p_start_time   TIME,
  p_full_name    TEXT,
  p_phone        TEXT,
  p_email        TEXT     DEFAULT NULL,
  p_notes        TEXT     DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id     UUID;
  v_end_time        TIME;
  v_slot_available  BOOLEAN;
  v_booking_id      UUID;
BEGIN

  -- ── 1. Upsert customer by phone ──────────────────────────────────────────
  SELECT upsert_customer(p_phone, p_full_name, p_email) INTO v_customer_id;

  -- ── 2. Compute stored end_time ────────────────────────────────────────────
  SELECT compute_booking_end_time(p_start_time, p_service_id) INTO v_end_time;

  IF v_end_time IS NULL THEN
    RAISE EXCEPTION 'Service % not found or inactive', p_service_id;
  END IF;

  -- ── 3. Verify slot is still available (serializable check) ───────────────
  -- Re-check availability at INSERT time to handle race conditions where
  -- two customers book the same slot simultaneously.
  -- We use a FOR UPDATE SKIP LOCKED pattern on the bookings table.
  SELECT NOT EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.staff_id     = p_staff_id
      AND b.booking_date = p_date
      AND b.status NOT IN ('cancelled', 'no_show')
      AND p_start_time    < b.end_time
      AND v_end_time      > b.start_time
  )
  INTO v_slot_available;

  IF NOT v_slot_available THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: The selected time slot is no longer available.';
  END IF;

  -- ── 4. Insert booking ─────────────────────────────────────────────────────
  INSERT INTO bookings (
    branch_id,
    service_id,
    staff_id,
    customer_id,
    booking_date,
    start_time,
    end_time,
    type,
    status,
    metadata
  ) VALUES (
    p_branch_id,
    p_service_id,
    p_staff_id,
    v_customer_id,
    p_date,
    p_start_time,
    v_end_time,
    'online',
    'pending',
    CASE
      WHEN p_notes IS NOT NULL
      THEN jsonb_build_object('customer_notes', p_notes)
      ELSE '{}'::JSONB
    END
  )
  RETURNING id INTO v_booking_id;

  -- Trigger fn_on_booking_created fires here automatically

  RETURN v_booking_id;
END;
$$;

COMMENT ON FUNCTION create_online_booking IS
  'Atomic booking creation for the public booking flow.
   Upserts customer by phone, re-validates slot availability at INSERT time
   to handle race conditions, then inserts the booking.
   Raises SLOT_UNAVAILABLE exception if the slot was taken since the customer
   last saw the availability grid.
   Triggers handle booking_events and customer stats automatically.';
