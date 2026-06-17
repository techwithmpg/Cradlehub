BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_account_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  target_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  target_auth_user_id uuid,
  target_email text,
  event_type text NOT NULL CHECK (
    event_type IN (
      'self_password_reset_requested',
      'owner_password_recovery_sent',
      'owner_account_diagnostic_viewed',
      'password_updated'
    )
  ),
  outcome text NOT NULL CHECK (
    outcome IN ('success', 'error', 'rate_limited', 'not_available')
  ),
  ip_hash text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_account_access_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.staff_account_access_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.staff_account_access_events TO service_role;

CREATE INDEX IF NOT EXISTS staff_account_access_events_target_staff_idx
  ON public.staff_account_access_events (target_staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_account_access_events_target_email_idx
  ON public.staff_account_access_events (target_email, created_at DESC)
  WHERE target_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS staff_account_access_events_event_created_idx
  ON public.staff_account_access_events (event_type, created_at DESC);

COMMENT ON TABLE public.staff_account_access_events IS
  'Append-only audit trail for staff password recovery and Owner account-access diagnostics.';

COMMENT ON COLUMN public.staff_account_access_events.target_email IS
  'Normalized email used only for server-side support diagnostics and password recovery rate limiting.';

COMMIT;
