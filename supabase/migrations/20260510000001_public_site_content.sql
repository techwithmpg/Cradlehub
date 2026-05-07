-- =============================================================================
-- CradleHub — Public Site Content Management
-- =============================================================================
-- Flexible content tables for Marketing Studio. These tables store only
-- public-facing copy and image URLs; no booking, CRM, payment, or staff-private
-- data is stored here.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.public_site_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT,
  subtitle TEXT,
  body TEXT,
  cta_label TEXT,
  cta_href TEXT,
  image_url TEXT,
  secondary_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT public_site_sections_section_key_format
    CHECK (section_key ~ '^[a-z0-9_:-]+$'),
  CONSTRAINT public_site_sections_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.public_site_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT,
  title TEXT,
  alt_text TEXT,
  image_url TEXT NOT NULL,
  link_href TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT public_site_assets_section_key_format
    CHECK (section_key IS NULL OR section_key ~ '^[a-z0-9_:-]+$'),
  CONSTRAINT public_site_assets_alt_text_required
    CHECK (length(trim(coalesce(alt_text, ''))) > 0),
  CONSTRAINT public_site_assets_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_public_site_sections_enabled_order
  ON public.public_site_sections (is_enabled, sort_order, section_key);

CREATE INDEX IF NOT EXISTS idx_public_site_assets_section_enabled_order
  ON public.public_site_assets (section_key, is_enabled, sort_order, created_at);

COMMENT ON TABLE public.public_site_sections IS
  'Marketing-managed public website sections and copy.';
COMMENT ON TABLE public.public_site_assets IS
  'Marketing-managed public website image/card assets.';

ALTER TABLE public.public_site_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_site_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_site_sections_public_read_enabled"
  ON public.public_site_sections;
CREATE POLICY "public_site_sections_public_read_enabled"
  ON public.public_site_sections FOR SELECT
  TO anon, authenticated
  USING (is_enabled = TRUE);

DROP POLICY IF EXISTS "public_site_assets_public_read_enabled"
  ON public.public_site_assets;
CREATE POLICY "public_site_assets_public_read_enabled"
  ON public.public_site_assets FOR SELECT
  TO anon, authenticated
  USING (is_enabled = TRUE);

DROP POLICY IF EXISTS "public_site_sections_owner_manage"
  ON public.public_site_sections;
CREATE POLICY "public_site_sections_owner_manage"
  ON public.public_site_sections FOR ALL
  TO authenticated
  USING (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

DROP POLICY IF EXISTS "public_site_assets_owner_manage"
  ON public.public_site_assets;
CREATE POLICY "public_site_assets_owner_manage"
  ON public.public_site_assets FOR ALL
  TO authenticated
  USING (get_auth_role() = 'owner')
  WITH CHECK (get_auth_role() = 'owner');

CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_site_sections_updated_at
  ON public.public_site_sections;
CREATE TRIGGER trg_public_site_sections_updated_at
  BEFORE UPDATE ON public.public_site_sections
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

DROP TRIGGER IF EXISTS trg_public_site_assets_updated_at
  ON public.public_site_assets;
CREATE TRIGGER trg_public_site_assets_updated_at
  BEFORE UPDATE ON public.public_site_assets
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();
