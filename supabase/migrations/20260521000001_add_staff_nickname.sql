ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN public.staff.nickname IS
  'Optional familiar name used by clients to recognize staff during booking.';
