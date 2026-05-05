-- =============================================================================
-- CradleHub — Migration: Staff Avatars
-- =============================================================================

-- ── 1. Add avatar fields to staff table ─────────────────────────────────────
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

COMMENT ON COLUMN public.staff.avatar_url IS 'Publicly accessible URL of the staff profile photo.';
COMMENT ON COLUMN public.staff.avatar_path IS 'Storage path of the staff profile photo within the staff-pictures bucket.';


-- ── 2. Storage Bucket Setup ──────────────────────────────────────────────────
-- We assume 'staff-pictures' exists, but we ensure it is public for easy viewing.
-- If it's private, we would only use avatar_path and generate signed URLs.
-- Given next.config.ts allows /storage/**, we'll aim for public or path-based access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-pictures', 'staff-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ── 3. Storage Policies ──────────────────────────────────────────────────────

-- 3.1. Public Read Access
CREATE POLICY "staff_pictures_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'staff-pictures');

-- 3.2. Staff: Upload/Update own photo
-- Pattern: staff-avatars/{staffId}/profile.{ext}
CREATE POLICY "staff_pictures_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-pictures'
    AND (storage.foldername(name))[1] = 'staff-avatars'
    AND (storage.foldername(name))[2] = (SELECT id::text FROM public.staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "staff_pictures_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'staff-pictures'
    AND (storage.foldername(name))[1] = 'staff-avatars'
    AND (storage.foldername(name))[2] = (SELECT id::text FROM public.staff WHERE auth_user_id = auth.uid())
  );

-- 3.3. Staff: Delete own photo
CREATE POLICY "staff_pictures_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-pictures'
    AND (storage.foldername(name))[1] = 'staff-avatars'
    AND (storage.foldername(name))[2] = (SELECT id::text FROM public.staff WHERE auth_user_id = auth.uid())
  );

-- 3.4. Owner/Manager: Read all (already covered by public read, but for clarity)
-- 3.5. Owner/Manager: Manage all (optional, but good for admin)
CREATE POLICY "staff_pictures_admin_all"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'staff-pictures'
    AND (SELECT system_role FROM public.staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  )
  WITH CHECK (
    bucket_id = 'staff-pictures'
    AND (SELECT system_role FROM public.staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );
