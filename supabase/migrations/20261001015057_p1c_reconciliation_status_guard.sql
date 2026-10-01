-- P1-C: keep the existing daily_cash_reconciliations table as finalization
-- authority even when an authenticated caller writes through the Data API.
-- This forward guard does not rewrite or backfill any reconciliation.

BEGIN;

CREATE OR REPLACE FUNCTION public.p1c_guard_reconciliation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $p1c$
DECLARE
  v_actor_role TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'RECONCILIATION_APPROVED_LOCKED: Approved reconciliation cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' THEN
      RAISE EXCEPTION 'RECONCILIATION_APPROVAL_REQUIRES_SUBMISSION: A new reconciliation cannot be approved';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'RECONCILIATION_APPROVED_LOCKED: Approved reconciliation cannot be edited';
  END IF;
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id
     OR NEW.reconciliation_date IS DISTINCT FROM OLD.reconciliation_date THEN
    RAISE EXCEPTION 'RECONCILIATION_IDENTITY_LOCKED: Branch and business date cannot be changed';
  END IF;

  IF NEW.status = 'approved' THEN
    IF OLD.status IS DISTINCT FROM 'submitted' THEN
      RAISE EXCEPTION 'RECONCILIATION_APPROVAL_REQUIRES_SUBMISSION: Submit before approval';
    END IF;
    SELECT s.system_role INTO v_actor_role
    FROM public.staff s
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active
    LIMIT 1;
    IF v_actor_role IS DISTINCT FROM 'owner'
       AND v_actor_role IS DISTINCT FROM 'manager' THEN
      RAISE EXCEPTION 'RECONCILIATION_APPROVAL_UNAUTHORIZED: Owner or manager required';
    END IF;
  END IF;

  RETURN NEW;
END;
$p1c$;

REVOKE ALL ON FUNCTION public.p1c_guard_reconciliation_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_p1c_guard_reconciliation_state
ON public.daily_cash_reconciliations;

CREATE TRIGGER trg_p1c_guard_reconciliation_state
BEFORE INSERT OR UPDATE OR DELETE
ON public.daily_cash_reconciliations
FOR EACH ROW
EXECUTE FUNCTION public.p1c_guard_reconciliation_state();

COMMIT;
