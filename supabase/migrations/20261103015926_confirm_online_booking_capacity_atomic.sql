-- Public requests retain pending_crm_confirmation and therapist holds. At CRM
-- confirmation, assign real branch resources and revalidate provider eligibility
-- in the same transaction as the status transition. The existing overlap
-- trigger remains authoritative for staff and room concurrency.
CREATE OR REPLACE FUNCTION public.confirm_online_booking_order_atomic(
  p_booking_id uuid,
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
  v_pending_count integer;
  v_updated_count integer := 0;
  v_changed_ids jsonb := '[]'::jsonb;
  v_now_manila timestamp := now() AT TIME ZONE 'Asia/Manila';
  v_line record;
  v_resource record;
  v_scheduled boolean;
  v_assigned boolean;
  v_available_spaces integer;
  v_required_spaces integer;
BEGIN
  SELECT b.order_id INTO v_order_id
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.branch_id = p_branch_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Configuration writers do not participate in booking advisory locks.
  -- Hold a stable provider, schedule, service and room configuration snapshot
  -- until this short confirmation transaction commits or rolls back.
  LOCK TABLE public.staff, public.staff_services, public.staff_schedules,
    public.schedule_overrides, public.blocked_times, public.services,
    public.branch_services, public.branch_resources IN SHARE MODE;

  PERFORM 1 FROM public.booking_orders bo WHERE bo.id = v_order_id FOR UPDATE;
  PERFORM 1 FROM public.bookings b WHERE b.order_id = v_order_id ORDER BY b.id FOR UPDATE;

  SELECT count(*) INTO v_pending_count FROM public.bookings b
  WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation';

  IF v_pending_count = 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.order_id = v_order_id
        AND (b.branch_id <> p_branch_id OR b.type <> 'online'
             OR b.status NOT IN ('confirmed', 'in_progress', 'completed'))
    ) THEN
      RAISE EXCEPTION 'BOOKING_ORDER_STATE_CHANGED' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('ok', true, 'order_id', v_order_id,
      'changed_ids', '[]'::jsonb, 'idempotency_status', 'replayed');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.order_id = v_order_id
      AND (b.branch_id <> p_branch_id OR b.type <> 'online'
           OR b.status NOT IN ('pending_crm_confirmation', 'confirmed')
           OR b.booking_progress_status IS DISTINCT FROM 'not_started')
  ) THEN
    RAISE EXCEPTION 'BOOKING_ORDER_STATE_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation'
      AND (b.booking_date < v_now_manila::date
           OR (b.booking_date = v_now_manila::date AND b.start_time <= v_now_manila::time)
           OR (b.hold_expires_at IS NOT NULL AND b.hold_expires_at <= now()))
  ) THEN
    RAISE EXCEPTION 'BOOKING_REQUEST_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation'
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.branch_services bs
          JOIN public.services svc ON svc.id = bs.service_id
          WHERE bs.branch_id = b.branch_id AND bs.service_id = b.service_id
            AND bs.is_active = true
            AND svc.is_active = true
            AND CASE WHEN b.delivery_type = 'home_service'
              THEN bs.available_home_service ELSE bs.available_in_spa END = true
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = b.staff_id AND s.branch_id = b.branch_id
            AND public.staff_is_operational(s)
            AND s.system_role NOT IN ('digital_marketer', 'driver', 'utility')
        )
      )
  ) THEN
    RAISE EXCEPTION 'BOOKING_PROVIDER_OR_SERVICE_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  -- Confirmations for a branch/date choose rooms in a stable order. Other
  -- booking writers need not take this lock: the existing resource trigger
  -- catches their concurrent allocations and the retry below tries another.
  FOR v_line IN
    SELECT DISTINCT b.booking_date FROM public.bookings b
    WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation'
    ORDER BY b.booking_date
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtext('booking-room-confirm:' || p_branch_id::text || ':' || v_line.booking_date::text)::bigint
    );
  END LOOP;

  FOR v_line IN
    SELECT b.* FROM public.bookings b
    WHERE b.order_id = v_order_id AND b.status = 'pending_crm_confirmation'
    ORDER BY b.booking_date, b.start_time, b.attendee_id, b.line_sequence, b.id
  LOOP
    -- Public allocation requires an explicit service capability. It may have
    -- been removed after the original quote or pending request.
    IF NOT EXISTS (
      SELECT 1 FROM public.staff_services ss
      WHERE ss.staff_id = v_line.staff_id AND ss.service_id = v_line.service_id
    ) THEN
      RAISE EXCEPTION 'BOOKING_STAFF_NOT_QUALIFIED' USING ERRCODE = 'P0001';
    END IF;

    -- A date override replaces all recurring shifts. Otherwise ANY active
    -- opening, closing, or single shift can cover this service line.
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.schedule_overrides so
      WHERE so.staff_id = v_line.staff_id AND so.override_date = v_line.booking_date
    ) THEN EXISTS (
      SELECT 1 FROM public.schedule_overrides so
      WHERE so.staff_id = v_line.staff_id AND so.override_date = v_line.booking_date
        AND so.is_day_off = false
        AND (CASE WHEN so.end_time > so.start_time AND so.ends_next_day = false
          THEN v_line.start_time >= so.start_time AND v_line.end_time <= so.end_time
          ELSE so.end_time < so.start_time AND so.ends_next_day = true
            AND v_line.start_time >= so.start_time
        END)
    ) ELSE EXISTS (
      SELECT 1 FROM public.staff_schedules ss
      WHERE ss.staff_id = v_line.staff_id
        AND ss.day_of_week = extract(dow FROM v_line.booking_date)::smallint
        AND ss.is_active = true
        AND (CASE WHEN ss.end_time > ss.start_time AND ss.ends_next_day = false
          THEN v_line.start_time >= ss.start_time AND v_line.end_time <= ss.end_time
          ELSE ss.end_time < ss.start_time AND ss.ends_next_day = true
            AND v_line.start_time >= ss.start_time
        END)
    ) END INTO v_scheduled;

    IF NOT v_scheduled OR EXISTS (
        SELECT 1 FROM public.blocked_times bt
        WHERE bt.staff_id = v_line.staff_id AND bt.block_date = v_line.booking_date
          AND v_line.start_time < bt.end_time AND v_line.end_time > bt.start_time
      )
    THEN
      RAISE EXCEPTION 'BOOKING_STAFF_SCHEDULE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    IF v_line.delivery_type = 'home_service' THEN
      UPDATE public.bookings b
      SET status = 'confirmed', hold_expires_at = NULL
      WHERE b.id = v_line.id AND b.status = 'pending_crm_confirmation';
    ELSE
      v_assigned := false;
      FOR v_resource IN
        SELECT br.id FROM public.branch_resources br
        WHERE br.branch_id = p_branch_id AND br.is_active = true
          AND (v_line.resource_id IS NULL OR br.id = v_line.resource_id)
        ORDER BY br.sort_order, br.name, br.id
      LOOP
        BEGIN
          UPDATE public.bookings b
          SET resource_id = v_resource.id, status = 'confirmed', hold_expires_at = NULL
          WHERE b.id = v_line.id AND b.status = 'pending_crm_confirmation';
          v_assigned := true;
          EXIT;
        EXCEPTION WHEN exclusion_violation THEN
          IF SQLERRM <> 'BOOKING_RESOURCE_TIME_CONFLICT' THEN RAISE; END IF;
        END;
      END LOOP;

      IF NOT v_assigned THEN
        IF v_line.resource_id IS NOT NULL THEN
          IF NOT EXISTS (SELECT 1 FROM public.branch_resources br
            WHERE br.id = v_line.resource_id AND br.branch_id = p_branch_id
              AND br.is_active = true) THEN
            RAISE EXCEPTION 'BOOKING_RESOURCE_INVALID_FOR_BRANCH' USING ERRCODE = '23503';
          END IF;
          RAISE EXCEPTION 'BOOKING_RESOURCE_TIME_CONFLICT' USING ERRCODE = '23P01';
        END IF;
        SELECT coalesce(sum(greatest(br.capacity - (
          SELECT count(*)::integer FROM public.bookings occupied
          WHERE occupied.resource_id = br.id
            AND occupied.order_id IS DISTINCT FROM v_order_id
            AND occupied.booking_date = v_line.booking_date
            AND public.crm_booking_row_blocks_availability(occupied.status, occupied.hold_expires_at)
            AND v_line.start_time < occupied.end_time
            AND v_line.end_time > occupied.start_time
        ), 0)), 0)::integer INTO v_available_spaces
        FROM public.branch_resources br
        WHERE br.branch_id = p_branch_id AND br.is_active = true;
        SELECT count(DISTINCT b.attendee_id) INTO v_required_spaces
        FROM public.bookings b
        WHERE b.order_id = v_order_id AND b.delivery_type = 'in_spa'
          AND b.status IN ('pending_crm_confirmation', 'confirmed')
          AND b.booking_date = v_line.booking_date
          AND v_line.start_time < b.end_time AND v_line.end_time > b.start_time;
        RAISE EXCEPTION USING ERRCODE = 'P0001',
          MESSAGE = 'BOOKING_ROOM_CAPACITY_UNAVAILABLE',
          DETAIL = format('available=%s;required=%s', v_available_spaces, v_required_spaces);
      END IF;
    END IF;

    v_changed_ids := v_changed_ids || to_jsonb(v_line.id);
    v_updated_count := v_updated_count + 1;
  END LOOP;

  IF v_updated_count <> v_pending_count THEN
    RAISE EXCEPTION 'BOOKING_ORDER_STATE_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id,
    'changed_ids', v_changed_ids, 'idempotency_status', 'confirmed');
END;
$$;

COMMENT ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) IS
  'Server-only atomic CRM confirmation for online orders. Rechecks staff capability and schedule, assigns active branch rooms, and relies on booking overlap locks to prevent overbooking.';
REVOKE ALL ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_online_booking_order_atomic(uuid, uuid) TO service_role;
