-- =============================================================================
-- CradleHub — Shared Staff Onboarding Requests
-- =============================================================================
-- Supports the /staff-onboarding shared link flow.
-- When a new hire submits via the shared onboarding page:
--   1. A Supabase Auth user is created (server-side, admin client)
--   2. A staff row is inserted with is_active = false
--   3. A staff_onboarding_requests row is inserted here
-- Owner/manager reviews and approves or rejects. On approval:
--   - staff.is_active set to true
--   - staff.branch_id / system_role / tier finalised
--   - this row's status set to 'approved'
-- =============================================================================

CREATE TABLE public.staff_onboarding_requests (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                 text         NOT NULL,
  email                     text         NOT NULL,
  phone                     text,
  address                   text,
  emergency_contact_name    text,
  emergency_contact_phone   text,
  experience_notes          text,
  preferred_role            text,
  requested_branch_id       uuid         REFERENCES public.branches(id) ON DELETE SET NULL,
  auth_user_id              uuid         REFERENCES auth.users(id)       ON DELETE SET NULL,
  staff_id                  uuid         REFERENCES public.staff(id)     ON DELETE SET NULL,
  status                    text         NOT NULL DEFAULT 'submitted',
  reviewed_by_staff_id      uuid         REFERENCES public.staff(id)     ON DELETE SET NULL,
  reviewed_at               timestamptz,
  rejection_reason          text,
  metadata                  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now(),
  updated_at                timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT staff_onboarding_requests_status_check
    CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled'))
);

COMMENT ON TABLE public.staff_onboarding_requests IS
  'Submissions from the shared /staff-onboarding link. Reviewed by owner/manager before the staff account is activated.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX staff_onboarding_requests_status_idx
  ON public.staff_onboarding_requests (status);

CREATE INDEX staff_onboarding_requests_branch_idx
  ON public.staff_onboarding_requests (requested_branch_id);

CREATE INDEX staff_onboarding_requests_auth_user_idx
  ON public.staff_onboarding_requests (auth_user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS staff_onboarding_requests_updated_at ON public.staff_onboarding_requests;
CREATE TRIGGER staff_onboarding_requests_updated_at
  BEFORE UPDATE ON public.staff_onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.staff_onboarding_requests ENABLE ROW LEVEL SECURITY;

-- Owner: full access to all requests
DROP POLICY IF EXISTS "onboarding_owner_all" ON public.staff_onboarding_requests;
CREATE POLICY "onboarding_owner_all"
  ON public.staff_onboarding_requests FOR ALL
  TO authenticated
  USING  (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

-- Manager: access only to requests targeting their own branch
DROP POLICY IF EXISTS "onboarding_manager_branch" ON public.staff_onboarding_requests;
CREATE POLICY "onboarding_manager_branch"
  ON public.staff_onboarding_requests FOR ALL
  TO authenticated
  USING  (get_auth_role() = 'manager' AND requested_branch_id = get_auth_branch_id())
  WITH CHECK (get_auth_role() = 'manager' AND requested_branch_id = get_auth_branch_id());

-- Authenticated user can read their own submission (used for login pending message)
DROP POLICY IF EXISTS "onboarding_own_read" ON public.staff_onboarding_requests;
CREATE POLICY "onboarding_own_read"
  ON public.staff_onboarding_requests FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- No public (anon) access at all.
-- Insertion happens exclusively via the service-role admin client in the server action.
