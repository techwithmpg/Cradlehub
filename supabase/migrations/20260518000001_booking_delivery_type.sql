-- =============================================================================
-- MIGRATION: Booking Delivery Type
-- =============================================================================
-- Adds `delivery_type` as a first-class operational field (in_spa | home_service)
-- while preserving the existing `type` channel field (online | walkin | home_service).
--
-- This separates "how the customer booked" (channel) from "where service is
-- delivered" (operational), enabling future flows like online-booked home service.
-- =============================================================================

-- ─── 1. Add delivery_type column ──────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'in_spa';

COMMENT ON COLUMN bookings.delivery_type IS
  'Operational discriminator: in_spa = customer comes to branch, home_service = staff travels to customer.';

-- ─── 2. CHECK constraint on delivery_type ─────────────────────────────────────
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_delivery_type_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_delivery_type_check
  CHECK (delivery_type IN ('in_spa', 'home_service'));

-- ─── 3. Backfill from existing type ───────────────────────────────────────────
UPDATE bookings
   SET delivery_type = 'home_service'
 WHERE type = 'home_service';

-- All others remain 'in_spa' (the default).

-- ─── 4. Update travel_buffer CHECK to use delivery_type ───────────────────────
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_travel_buffer_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_travel_buffer_check
  CHECK (
    delivery_type = 'home_service' OR travel_buffer_mins IS NULL
  );

-- ─── 5. Index for control console and dispatch queries ────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_delivery_type_date
  ON bookings (delivery_type, booking_date)
  WHERE delivery_type = 'home_service';

-- ─── 6. Update RPC: get_daily_schedule ────────────────────────────────────────
-- Include delivery_type in the JSONB booking list so UI tabs can filter correctly.
-- =============================================================================
drop function if exists public.get_daily_schedule(uuid, date);

create function public.get_daily_schedule(
  p_branch_id uuid,
  p_date date
)
returns table (
  staff_id uuid,
  staff_name text,
  staff_tier text,
  work_start time,
  work_end time,
  bookings jsonb,
  blocks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dow int := extract(dow from p_date);
begin
  return query
  with active_staff as (
    select
      s.id as sid,
      s.full_name as sname,
      s.tier as stier
    from public.staff s
    where s.branch_id = p_branch_id
      and s.is_active = true
    order by s.tier, s.full_name
  ),
  work_hours as (
    select
      ast.sid,
      case
        when so.is_day_off then null
        when so.start_time is not null and so.end_time is not null then so.start_time
        when ss.start_time is not null then ss.start_time
        else null
      end as wh_start,
      case
        when so.is_day_off then null
        when so.start_time is not null and so.end_time is not null then so.end_time
        when ss.end_time is not null then ss.end_time
        else null
      end as wh_end
    from active_staff ast
    left join public.schedule_overrides so
      on so.staff_id = ast.sid
      and so.override_date = p_date
    left join public.staff_schedules ss
      on ss.staff_id = ast.sid
      and ss.day_of_week = v_dow
      and ss.is_active = true
  ),
  staff_bookings as (
    select
      b.staff_id as sid,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'start_time', b.start_time,
            'end_time', b.end_time,
            'service', coalesce(srv.name, 'Service'),
            'customer', coalesce(c.full_name, '—'),
            'status', b.status,
            'type', b.type,
            'delivery_type', b.delivery_type,
            'resource_id', b.resource_id,
            'resource_name', res.name
          )
          order by b.start_time
        )
        filter (where b.id is not null),
        '[]'::jsonb
      ) as booking_list
    from public.bookings b
    left join public.services srv on srv.id = b.service_id
    left join public.customers c on c.id = b.customer_id
    left join public.branch_resources res on res.id = b.resource_id
    where b.branch_id = p_branch_id
      and b.booking_date = p_date
      and b.status not in ('cancelled', 'no_show')
    group by b.staff_id
  ),
  staff_blocks as (
    select
      bt.staff_id as sid,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'start_time', bt.start_time,
            'end_time', bt.end_time,
            'reason', bt.reason
          )
          order by bt.start_time
        )
        filter (where bt.id is not null),
        '[]'::jsonb
      ) as block_list
    from public.blocked_times bt
    where bt.block_date = p_date
    group by bt.staff_id
  )
  select
    ast.sid::uuid as staff_id,
    ast.sname::text as staff_name,
    ast.stier::text as staff_tier,
    wh.wh_start as work_start,
    wh.wh_end as work_end,
    coalesce(sb.booking_list, '[]'::jsonb) as bookings,
    coalesce(stb.block_list, '[]'::jsonb) as blocks
  from active_staff ast
  left join work_hours wh on wh.sid = ast.sid
  left join staff_bookings sb on sb.sid = ast.sid
  left join staff_blocks stb on stb.sid = ast.sid
  order by ast.stier, ast.sname;
end;
$$;

-- ─── 7. Update RPC: update_booking_progress ───────────────────────────────────
-- Use delivery_type instead of type to determine the correct transition set.
-- This ensures a walkin/online booking with delivery_type='home_service' follows
-- the home-service flow, and vice versa.
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
  v_delivery_type      TEXT;
  v_current_progress   TEXT;
  v_staff_id           UUID;
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

  -- ── Validate transition by delivery type ──
  IF v_delivery_type = 'home_service' THEN
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'travel_started') OR
      (v_current_progress = 'travel_started'  AND p_next_status = 'arrived') OR
      (v_current_progress = 'arrived'         AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for home service: % -> %', v_current_progress, p_next_status;
    END IF;

  ELSIF v_delivery_type = 'in_spa' THEN
    -- In-spa bookings share walkin and online transitions.
    -- checked_in is available for all in-spa bookings.
    IF NOT (
      (v_current_progress = 'not_started'     AND p_next_status = 'checked_in') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'session_started') OR
      (v_current_progress = 'session_started' AND p_next_status = 'completed') OR
      (v_current_progress = 'not_started'     AND p_next_status = 'no_show') OR
      (v_current_progress = 'checked_in'      AND p_next_status = 'no_show')
    ) THEN
      RAISE EXCEPTION 'Invalid progress transition for in-spa: % -> %', v_current_progress, p_next_status;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unsupported delivery type for progress tracking: %', v_delivery_type;
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
  'Unified progress update for bookings. Delivery-type-aware transitions for home_service and in_spa. '
  'SECURITY DEFINER — only callable via trusted server actions.';
