-- CradleHub Web P1 pending-booking reminder claim ledger.
-- REVIEW ONLY. NOT IN supabase/migrations. DO NOT APPLY TO PRODUCTION.
-- Only after owner approval, isolated TEST migration + privilege/concurrency review.
-- Bookings remains the source of truth; this table NEVER changes booking status.
BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_pending_booking_push_state (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  next_due_at timestamptz NOT NULL DEFAULT '-infinity'::timestamptz,
  lease_token uuid,
  leased_until timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_pending_count integer NOT NULL DEFAULT 0 CHECK (last_pending_count >= 0),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0)
);

ALTER TABLE public.crm_pending_booking_push_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crm_pending_booking_push_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_pending_booking_push_state TO service_role;

CREATE OR REPLACE FUNCTION public.claim_crm_pending_booking_push(
  p_branch_id uuid,
  p_token uuid,
  p_now timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  claimed_token uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_branch_id IS NULL OR p_token IS NULL OR p_now IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.crm_pending_booking_push_state AS s (
    branch_id, lease_token, leased_until
  )
  VALUES (p_branch_id, p_token, p_now + interval '2 minutes')
  ON CONFLICT (branch_id) DO UPDATE SET
    lease_token = EXCLUDED.lease_token,
    leased_until = EXCLUDED.leased_until
  WHERE s.next_due_at <= p_now
    AND (s.leased_until IS NULL OR s.leased_until <= p_now)
  RETURNING lease_token INTO claimed_token;

  RETURN claimed_token = p_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finish_crm_pending_booking_push(
  p_branch_id uuid,
  p_token uuid,
  p_now timestamptz,
  p_next_due_at timestamptz,
  p_success boolean,
  p_pending_count integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_next_due_at IS NULL OR p_now IS NULL OR p_pending_count < 0 THEN
    RETURN false;
  END IF;
  UPDATE public.crm_pending_booking_push_state
  SET next_due_at = GREATEST(p_now, p_next_due_at),
      lease_token = NULL,
      leased_until = NULL,
      last_attempt_at = p_now,
      last_success_at = CASE WHEN p_success THEN p_now ELSE last_success_at END,
      last_pending_count = p_pending_count,
      failed_attempts = CASE WHEN p_success THEN 0 ELSE failed_attempts + 1 END
  WHERE branch_id = p_branch_id AND lease_token = p_token;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_crm_pending_booking_push(
  p_branch_id uuid,
  p_now timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  -- If the queue empties, the next request may be alerted on the next tick,
  -- but never release a live lease held by another scheduler invocation.
  UPDATE public.crm_pending_booking_push_state
  SET next_due_at = '-infinity'::timestamptz,
      last_pending_count = 0
  WHERE branch_id = p_branch_id
    AND (leased_until IS NULL OR leased_until <= p_now);
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_crm_pending_booking_push(uuid,uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_crm_pending_booking_push(uuid,uuid,timestamptz,timestamptz,boolean,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_crm_pending_booking_push(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_crm_pending_booking_push(uuid,uuid,timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_crm_pending_booking_push(uuid,uuid,timestamptz,timestamptz,boolean,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_crm_pending_booking_push(uuid,timestamptz)
  TO service_role;
COMMIT;
