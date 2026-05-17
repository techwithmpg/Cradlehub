-- =============================================================================
-- CradleHub — Update branch contact phone numbers
-- =============================================================================

UPDATE public.branches
SET
  phone           = '09173009173',
  secondary_phone = '461-7426'
WHERE id = 'c1000000-0000-0000-0000-000000000001';

UPDATE public.branches
SET
  phone           = '09636204376',
  secondary_phone = '213-3552'
WHERE id = 'c1000000-0000-0000-0000-000000000002';
