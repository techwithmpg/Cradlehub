-- =============================================================================
-- CradleHub — Staff Onboarding Schema Guard
-- =============================================================================
-- Fixes production/live schema drift where /staff-onboarding inserts into
-- staff.staff_type but the live staff table may not have that column yet.
--
-- Safe to run multiple times.
-- =============================================================================

-- Ensure staff_type exists for onboarding and scheduling specialization.
ALTER TABLE public.staff
  ADD COLUMN
IF NOT EXISTS staff_type TEXT NOT NULL DEFAULT 'therapist';

-- Ensure is_head exists for department head / supervisor tagging.
ALTER TABLE public.staff
  ADD COLUMN
IF NOT EXISTS is_head BOOLEAN NOT NULL DEFAULT false;

-- Ensure metadata exists for requested profile/service capability data.
ALTER TABLE public.staff
  ADD COLUMN
IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Optional but useful if profile photo upload is used by onboarding.
ALTER TABLE public.staff
  ADD COLUMN
IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.staff
  ADD COLUMN
IF NOT EXISTS avatar_path TEXT;

-- Ensure staff_type CHECK constraint supports current app values.
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_staff_type_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_staff_type_check
  CHECK (staff_type IN (
    'therapist',
    'nail_tech',
    'aesthetician',
    'csr',
    'driver',
    'utility',
    'salon_head',
    'managerial'
  ));

-- Ensure tier supports current app values.
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_tier_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_tier_check
  CHECK (tier IN ('senior', 'mid', 'junior', 'head', 'n/a'));

-- Ensure system_role supports current RBAC values.
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_system_role_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_system_role_check
  CHECK (system_role IN (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm',
    'csr',
    'csr_head',
    'csr_staff',
    'staff',
    'service_head',
    'service_staff',
    'driver',
    'utility'
  ));

-- Ensure staff_services exists for service capability mapping.
CREATE TABLE
IF NOT EXISTS public.staff_services
(
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid
(),
  staff_id   UUID NOT NULL REFERENCES public.staff
(id) ON
DELETE CASCADE,
  service_id UUID
NOT NULL REFERENCES public.services
(id) ON
DELETE CASCADE,
  created_at TIMESTAMPTZ
NOT NULL DEFAULT NOW
(),
  UNIQUE
(staff_id, service_id)
);

ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;

-- Reload Supabase/PostgREST schema cache so REST API sees the new columns.
NOTIFY pgrst, 'reload schema';
