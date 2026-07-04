-- CradleHub service metadata field.
-- Public catalog code reads this JSONB for labels, badges, package details,
-- consultation flags, and other forward-compatible service presentation data.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.services.metadata IS
  'Forward-compatible service presentation metadata for public catalog and booking surfaces.';
