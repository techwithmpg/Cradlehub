-- CradleHub service image fields.
-- Enables public service cards and the booking flow to read per-service imagery from the catalog.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_alt TEXT;

COMMENT ON COLUMN public.services.image_url IS 'Public image URL for this service, usually /images/services/<filename>.webp.';
COMMENT ON COLUMN public.services.image_alt IS 'Accessible alt text for this service image.';
