-- STAGE: inter-branch staff assistance / request-and-approval only.
-- LOCAL/TEST review first. DO NOT replay historic migrations, push, or execute on production
-- without a separate schema review, authorized release and explicit owner approval.
--
-- No therapist is made bookable or attendance-authorized by these records.
-- Existing staff.branch_id remains the only permanent staff home branch.
BEGIN;

CREATE TABLE public.branch_assistance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  lending_branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  staff_type text NOT NULL CHECK (staff_type IN ('therapist','nail_tech','aesthetician')),
  staff_count smallint NOT NULL CHECK (staff_count BETWEEN 1 AND 12),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted_pending_activation','declined','cancelled')),
  requested_by_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_by_auth_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_at timestamptz,
  decision_note text CHECK (decision_note IS NULL OR length(decision_note) <= 500),
  selected_staff_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistance_different_branches CHECK (requesting_branch_id <> lending_branch_id),
  CONSTRAINT assistance_valid_window CHECK (
    starts_at < ends_at AND ends_at - starts_at <= interval '16 hours'
  ),
  CONSTRAINT assistance_decision_consistency CHECK (
    (status = 'requested' AND decided_by_auth_user_id IS NULL AND decided_at IS NULL
      AND cardinality(selected_staff_ids) = 0)
    OR
    (status = 'cancelled' AND cardinality(selected_staff_ids) = 0)
    OR
    (status = 'declined' AND decided_by_auth_user_id IS NOT NULL AND decided_at IS NOT NULL
      AND cardinality(selected_staff_ids) = 0)
    OR
    (status = 'accepted_pending_activation' AND decided_by_auth_user_id IS NOT NULL
      AND decided_at IS NOT NULL AND cardinality(selected_staff_ids) = staff_count)
  )
);
CREATE INDEX branch_assistance_request_receiver_idx
  ON public.branch_assistance_requests (requesting_branch_id, created_at DESC);
CREATE INDEX branch_assistance_request_lender_idx
  ON public.branch_assistance_requests (lending_branch_id, status, created_at DESC);
CREATE INDEX branch_assistance_request_window_idx
  ON public.branch_assistance_requests (starts_at, ends_at);

-- Audit records are immutable under the app's server writer.
CREATE TABLE public.branch_assistance_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.branch_assistance_requests(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('requested','accepted_pending_activation','declined','cancelled')),
  actor_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  previous_status text,
  new_status text NOT NULL,
  selected_staff_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX branch_assistance_event_request_idx
  ON public.branch_assistance_request_events (request_id, created_at);

CREATE SCHEMA IF NOT EXISTS assistance_private;
REVOKE ALL ON SCHEMA assistance_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA assistance_private TO service_role;

CREATE FUNCTION assistance_private.record_assistance_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.branch_assistance_request_events
      (request_id, event_type, actor_auth_user_id, previous_status, new_status, note)
    VALUES (NEW.id, 'requested', NEW.requested_by_auth_user_id, NULL, NEW.status, NEW.reason);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.branch_assistance_request_events
      (request_id, event_type, actor_auth_user_id, previous_status, new_status,
       selected_staff_ids, note)
    VALUES (
      NEW.id, NEW.status,
      CASE WHEN NEW.status = 'cancelled' THEN NEW.decided_by_auth_user_id
        ELSE NEW.decided_by_auth_user_id END,
      OLD.status, NEW.status, NEW.selected_staff_ids, NEW.decision_note
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION assistance_private.record_assistance_event()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER branch_assistance_create_audit
AFTER INSERT ON public.branch_assistance_requests FOR EACH ROW
EXECUTE FUNCTION assistance_private.record_assistance_event();

CREATE TRIGGER branch_assistance_change_audit
AFTER UPDATE ON public.branch_assistance_requests FOR EACH ROW
EXECUTE FUNCTION assistance_private.record_assistance_event();

ALTER TABLE public.branch_assistance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_assistance_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_assistance_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.branch_assistance_request_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.branch_assistance_requests TO service_role;
GRANT SELECT ON public.branch_assistance_request_events TO service_role;

COMMENT ON TABLE public.branch_assistance_requests IS
  'Manager-acknowledged staff assistance requests. Not active booking/attendance transfer authorization.';
COMMENT ON COLUMN public.branch_assistance_requests.selected_staff_ids IS
  'Manager-designated staff for later validated activation; does not change staff.branch_id.';

COMMIT;
