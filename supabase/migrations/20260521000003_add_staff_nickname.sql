-- Version reconciled on 2026-07-23: the original 20260521000001 prefix
-- collided with the earlier Data API grants migration. Production has the
-- column but no history row for either file, so this idempotent migration now
-- has its own unapplied version.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN public.staff.nickname IS
  'Optional familiar name used by clients to recognize staff during booking.';
