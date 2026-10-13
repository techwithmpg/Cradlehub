-- Staff PWA Driver travel transitions must recheck actor, assignment, branch,
-- booking type and current state while holding the booking row lock. The
-- existing progress RPC remains the sole state/timestamp writer.
CREATE FUNCTION public.advance_staff_driver_trip(
  p_booking_id uuid,
  p_next_status text,
  p_actor_staff_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor public.staff%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_role text;
  v_type text;
BEGIN
  IF p_next_status NOT IN ('travel_started', 'arrived') THEN
    RAISE EXCEPTION 'DRIVER_TRANSITION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor
    FROM public.staff
   WHERE id = p_actor_staff_id AND is_active = true
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_DRIVER_REQUIRED' USING ERRCODE = '42501';
  END IF;

  v_role := lower(coalesce(v_actor.system_role::text, ''));
  v_type := lower(coalesce(v_actor.staff_type::text, ''));
  IF v_role IN ('owner', 'manager', 'assistant_manager', 'store_manager', 'digital_marketer')
     OR v_type = 'managerial'
     OR NOT (v_role = 'driver' OR v_type = 'driver') THEN
    RAISE EXCEPTION 'DRIVER_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF v_actor.branch_id IS NULL
     OR v_booking.branch_id IS DISTINCT FROM v_actor.branch_id
     OR v_booking.driver_id IS DISTINCT FROM v_actor.id
     OR v_booking.delivery_type IS DISTINCT FROM 'home_service'
     OR v_booking.status NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'DRIVER_ASSIGNMENT_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (v_booking.booking_progress_status = 'not_started' AND p_next_status = 'travel_started')
    OR (v_booking.booking_progress_status = 'travel_started' AND p_next_status = 'arrived')
  ) THEN
    RAISE EXCEPTION 'DRIVER_PROGRESS_CONFLICT';
  END IF;

  PERFORM public.update_booking_progress(p_booking_id, p_next_status);
END;
$$;

REVOKE ALL ON FUNCTION public.advance_staff_driver_trip(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_staff_driver_trip(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.advance_staff_driver_trip(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.advance_staff_driver_trip(uuid, text, uuid) TO service_role;
