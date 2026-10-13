-- The Staff PWA's non-session progress operations authorize the actor against
-- the booking under row locks. This replaces the unapplied Driver-only source
-- migration at the same version. The existing progress RPC remains the writer.
CREATE FUNCTION public.advance_staff_booking_progress(
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
  v_group text;
BEGIN
  IF p_next_status IS NULL OR p_next_status NOT IN
     ('travel_started', 'arrived', 'checked_in', 'no_show') THEN
    RAISE EXCEPTION 'STAFF_PROGRESS_TRANSITION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor
    FROM public.staff
   WHERE id = p_actor_staff_id AND is_active = true
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_STAFF_REQUIRED' USING ERRCODE = '42501';
  END IF;

  v_role := lower(coalesce(v_actor.system_role::text, ''));
  v_type := lower(coalesce(v_actor.staff_type::text, ''));

  -- Match operational-group precedence in workspace-access.ts. Management
  -- is retained for the shared desktop action, but is not a Staff PWA group.
  IF v_role IN ('owner', 'manager', 'assistant_manager', 'store_manager') THEN
    v_group := 'management';
  ELSIF v_role = 'digital_marketer' OR v_type = 'managerial' THEN
    RAISE EXCEPTION 'STAFF_PROGRESS_ROLE_FORBIDDEN' USING ERRCODE = '42501';
  ELSIF v_role = 'driver' OR v_type = 'driver' THEN
    v_group := 'driver';
  ELSIF v_role = 'utility' OR v_type = 'utility' THEN
    RAISE EXCEPTION 'STAFF_PROGRESS_ROLE_FORBIDDEN' USING ERRCODE = '42501';
  ELSIF v_role IN ('service_head', 'service_staff')
     OR v_type IN ('therapist', 'nail_tech', 'aesthetician', 'facialist', 'salon_head') THEN
    v_group := 'provider';
  ELSIF v_role IN ('crm', 'csr', 'csr_head', 'csr_staff') THEN
    v_group := 'crm';
  ELSE
    RAISE EXCEPTION 'STAFF_PROGRESS_ROLE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  -- Owner oversight is cross-branch in the existing shared action. Every
  -- other role is branch-scoped, including branch CRM and management.
  IF (v_role <> 'owner' AND
      (v_actor.branch_id IS NULL OR
       v_booking.branch_id IS DISTINCT FROM v_actor.branch_id))
     OR v_booking.status IS NULL
     OR v_booking.status NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'STAFF_PROGRESS_SCOPE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_next_status IN ('travel_started', 'arrived') THEN
    IF v_booking.delivery_type IS DISTINCT FROM 'home_service'
       OR NOT (
         v_group = 'management'
         OR (v_group = 'driver' AND v_booking.driver_id IS NOT DISTINCT FROM v_actor.id)
         OR (v_group = 'provider' AND v_booking.staff_id IS NOT DISTINCT FROM v_actor.id)
       ) THEN
      RAISE EXCEPTION 'STAFF_TRAVEL_ASSIGNMENT_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT COALESCE((
      (v_booking.booking_progress_status = 'not_started' AND p_next_status = 'travel_started')
      OR (v_booking.booking_progress_status = 'travel_started' AND p_next_status = 'arrived')
    ), false) THEN
      RAISE EXCEPTION 'STAFF_PROGRESS_CONFLICT';
    END IF;
  ELSE
    IF v_booking.delivery_type IS DISTINCT FROM 'in_spa'
       OR NOT (
         v_group = 'management'
         OR v_group = 'crm'
         OR (v_group = 'provider' AND v_booking.staff_id IS NOT DISTINCT FROM v_actor.id)
       ) THEN
      RAISE EXCEPTION 'STAFF_CHECKIN_ASSIGNMENT_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT COALESCE((
      (v_booking.booking_progress_status = 'not_started' AND p_next_status = 'checked_in')
      OR (v_booking.booking_progress_status = 'not_started' AND p_next_status = 'no_show')
      OR (v_booking.booking_progress_status = 'checked_in' AND p_next_status = 'no_show')
    ), false) THEN
      RAISE EXCEPTION 'STAFF_PROGRESS_CONFLICT';
    END IF;
  END IF;

  -- The existing writer repeats lifecycle, travel-readiness and state checks,
  -- then writes status and timestamps while this transaction still holds locks.
  PERFORM public.update_booking_progress(p_booking_id, p_next_status);
END;
$$;

REVOKE ALL ON FUNCTION public.advance_staff_booking_progress(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_staff_booking_progress(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.advance_staff_booking_progress(uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.advance_staff_booking_progress(uuid, text, uuid) TO service_role;
