-- CRM-ONSITE-BOOKING-RULES-001
-- Prevent concurrent CRM/public booking writes from assigning the same therapist
-- or exhausting the same room capacity for an overlapping time window.

BEGIN;

CREATE OR REPLACE FUNCTION public.crm_booking_row_blocks_availability(
  p_status text,
  p_hold_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_status IN ('pending', 'confirmed', 'in_progress', 'completed') THEN true
    WHEN p_status IN ('pending_payment', 'pending_crm_confirmation')
      THEN p_hold_expires_at IS NOT NULL AND p_hold_expires_at > now()
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.guard_booking_assignment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conflict_id uuid;
  v_resource_capacity integer;
  v_resource_branch_id uuid;
  v_resource_active boolean;
  v_resource_occupancy integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.branch_services bs
      WHERE bs.branch_id = NEW.branch_id
        AND bs.service_id = NEW.service_id
        AND bs.is_active = true
        AND CASE
          WHEN NEW.delivery_type = 'home_service' THEN bs.available_home_service
          ELSE bs.available_in_spa
        END = true
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'BOOKING_SERVICE_NOT_AVAILABLE_AT_BRANCH';
    END IF;
  END IF;

  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION USING
      ERRCODE = '22007',
      MESSAGE = 'BOOKING_END_TIME_MUST_BE_AFTER_START_TIME';
  END IF;

  IF NOT public.crm_booking_row_blocks_availability(NEW.status, NEW.hold_expires_at) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('booking-staff:' || NEW.staff_id::text || ':' || NEW.booking_date::text)::bigint
  );

  SELECT b.id
  INTO v_conflict_id
  FROM public.bookings b
  WHERE b.id IS DISTINCT FROM NEW.id
    AND b.staff_id = NEW.staff_id
    AND b.booking_date = NEW.booking_date
    AND public.crm_booking_row_blocks_availability(b.status, b.hold_expires_at)
    AND NEW.start_time < b.end_time
    AND NEW.end_time > b.start_time
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'BOOKING_STAFF_TIME_CONFLICT',
      DETAIL = v_conflict_id::text;
  END IF;

  IF NEW.resource_id IS NOT NULL THEN
    SELECT br.capacity, br.branch_id, br.is_active
    INTO v_resource_capacity, v_resource_branch_id, v_resource_active
    FROM public.branch_resources br
    WHERE br.id = NEW.resource_id;

    IF v_resource_capacity IS NULL
      OR v_resource_branch_id IS DISTINCT FROM NEW.branch_id
      OR v_resource_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'BOOKING_RESOURCE_INVALID_FOR_BRANCH';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtext('booking-resource:' || NEW.resource_id::text || ':' || NEW.booking_date::text)::bigint
    );

    SELECT count(*)::integer
    INTO v_resource_occupancy
    FROM public.bookings b
    WHERE b.id IS DISTINCT FROM NEW.id
      AND b.resource_id = NEW.resource_id
      AND b.booking_date = NEW.booking_date
      AND public.crm_booking_row_blocks_availability(b.status, b.hold_expires_at)
      AND NEW.start_time < b.end_time
      AND NEW.end_time > b.start_time;

    IF v_resource_occupancy >= v_resource_capacity THEN
      RAISE EXCEPTION USING
        ERRCODE = '23P01',
        MESSAGE = 'BOOKING_RESOURCE_TIME_CONFLICT';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_assignment_overlap ON public.bookings;
CREATE TRIGGER trg_guard_booking_assignment_overlap
BEFORE INSERT OR UPDATE OF
  branch_id,
  service_id,
  staff_id,
  resource_id,
  booking_date,
  start_time,
  end_time,
  delivery_type,
  status,
  hold_expires_at
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.guard_booking_assignment_overlap();

REVOKE ALL ON FUNCTION public.crm_booking_row_blocks_availability(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_booking_assignment_overlap() FROM PUBLIC;

COMMIT;