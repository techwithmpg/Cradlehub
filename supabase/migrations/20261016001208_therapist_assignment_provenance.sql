-- Current therapist assignment and a customer's explicit request are separate facts.
-- Existing bookings retain the default unknown source and no requested therapist.
ALTER TABLE public.bookings
  ADD COLUMN requested_staff_id uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN therapist_selection_source text NOT NULL DEFAULT 'legacy_unknown',
  ADD CONSTRAINT bookings_therapist_selection_source_check
    CHECK (therapist_selection_source IN (
      'customer_selected', 'system_assigned', 'front_desk_selected', 'legacy_unknown'
    )),
  ADD CONSTRAINT bookings_customer_selection_matches_assignee_check
    CHECK (therapist_selection_source <> 'customer_selected' OR
      (requested_staff_id IS NOT NULL AND requested_staff_id = staff_id));

-- The existing atomic order RPC accepts JSONB service lines and inserts their
-- metadata into bookings. Consume server-authored transport fields in the same
-- INSERT, then remove them so the dedicated columns are the only stored source.
CREATE FUNCTION public.set_booking_therapist_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source text;
  v_requested uuid;
  v_reset_source boolean := false;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.metadata ? '_therapist_provenance' THEN
    v_source := NEW.metadata #>> '{_therapist_provenance,therapist_selection_source}';
    v_requested := NULLIF(NEW.metadata #>> '{_therapist_provenance,requested_staff_id}', '')::uuid;
    NEW.metadata := NEW.metadata - '_therapist_provenance';
    NEW.therapist_selection_source := v_source;
    NEW.requested_staff_id := v_requested;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id
      AND NEW.therapist_selection_source IS NOT DISTINCT FROM OLD.therapist_selection_source
      AND (OLD.therapist_selection_source = 'customer_selected' OR current_user <> 'service_role') THEN
      -- Uninstrumented assignment changes must not leave an asserted source.
      NEW.therapist_selection_source := 'legacy_unknown';
      v_reset_source := true;
    END IF;
  END IF;

  IF NEW.therapist_selection_source = 'customer_selected'
    AND (NEW.requested_staff_id IS NULL OR NEW.requested_staff_id IS DISTINCT FROM NEW.staff_id) THEN
    RAISE EXCEPTION 'Customer-selected therapist must match the current assignment'
      USING ERRCODE = '23514';
  END IF;
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' AND
      (NEW.requested_staff_id IS NOT NULL OR NEW.therapist_selection_source <> 'legacy_unknown') THEN
      RAISE EXCEPTION 'Customer therapist request requires an authorized server operation'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.requested_staff_id IS DISTINCT FROM OLD.requested_staff_id OR
        (NOT v_reset_source AND NEW.therapist_selection_source IS DISTINCT FROM OLD.therapist_selection_source) THEN
        RAISE EXCEPTION 'Customer therapist request requires an authorized server operation'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_therapist_provenance_guard
BEFORE INSERT OR UPDATE OF staff_id, requested_staff_id, therapist_selection_source ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_booking_therapist_provenance();

REVOKE ALL ON FUNCTION public.set_booking_therapist_provenance() FROM PUBLIC, anon, authenticated;
COMMENT ON COLUMN public.bookings.requested_staff_id IS
  'Therapist explicitly requested by the customer, preserved across reassignment.';
COMMENT ON COLUMN public.bookings.therapist_selection_source IS
  'How the current staff_id assignment was made; historical rows are legacy_unknown.';
