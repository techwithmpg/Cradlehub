-- =============================================================================
-- CradleHub - Unified Service Catalogue Repair
-- =============================================================================
-- Purpose:
--   1. Synchronize the SM branch with Main's active in-spa catalogue without
--      copying staff capabilities or overwriting existing SM overrides.
--   2. Keep SM Home Service disabled at both branch-rules and branch-service
--      levels.
--   3. Centralize staff capability eligibility in a database helper and align
--      replace_staff_service_capabilities with the TypeScript canonical rules.
--   4. Prevent future global service inserts from drifting away from branch
--      overlays.
--
-- Idempotency:
--   - Safe to run repeatedly.
--   - Uses ON CONFLICT DO NOTHING for new SM branch-service rows.
--   - Does not delete services, bookings, staff, or staff_services rows.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.branch_service_booking_visibility_from_visibility(
  p_visibility text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_visibility
    WHEN 'internal' THEN 'csr_only'
    WHEN 'hidden' THEN 'vip'
    ELSE 'public'
  END;
$$;

COMMENT ON FUNCTION public.branch_service_booking_visibility_from_visibility(text) IS
  'Maps canonical branch_services.visibility values to legacy booking_visibility values while both columns are supported.';

CREATE OR REPLACE FUNCTION public.is_branch_service_assignable(
  p_branch_id uuid,
  p_service_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.services service
    JOIN public.branch_services branch_service
      ON branch_service.service_id = service.id
     AND branch_service.branch_id = p_branch_id
    LEFT JOIN public.branch_booking_rules booking_rules
      ON booking_rules.branch_id = branch_service.branch_id
    WHERE service.id = p_service_id
      AND service.is_active = true
      AND branch_service.is_active = true
      AND (
        branch_service.available_in_spa = true
        OR (
          coalesce(booking_rules.home_service_enabled, false) = true
          AND branch_service.available_home_service = true
        )
      )
  );
$$;

COMMENT ON FUNCTION public.is_branch_service_assignable(uuid, uuid) IS
  'Canonical SQL mirror of TypeScript staff-assignment eligibility: active global service, active branch overlay, and at least one branch-enabled delivery mode.';

REVOKE ALL ON FUNCTION public.is_branch_service_assignable(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_branch_service_assignable(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_branch_service_assignable(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_branch_service_assignable(uuid, uuid) TO service_role;

-- Keep CRM operational direct writes branch-scoped and aligned with the same
-- assignable-service rule as the RPC. Owner/service_role policies are preserved.
DROP POLICY IF EXISTS "staff_services_operational_insert_branch" ON public.staff_services;
DROP POLICY IF EXISTS "staff_services_operational_update_branch" ON public.staff_services;

CREATE POLICY "staff_services_operational_insert_branch"
  ON public.staff_services FOR INSERT
  TO authenticated
  WITH CHECK (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    AND EXISTS (
      SELECT 1
      FROM public.staff target_staff
      WHERE target_staff.id = staff_services.staff_id
        AND target_staff.is_active = true
        AND target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
        AND target_staff.branch_id = (select public.get_auth_branch_id())
        AND public.is_branch_service_assignable(target_staff.branch_id, staff_services.service_id)
    )
  );

CREATE POLICY "staff_services_operational_update_branch"
  ON public.staff_services FOR UPDATE
  TO authenticated
  USING (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    AND EXISTS (
      SELECT 1
      FROM public.staff target_staff
      WHERE target_staff.id = staff_services.staff_id
        AND target_staff.branch_id = (select public.get_auth_branch_id())
        AND target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
    )
  )
  WITH CHECK (
    (select public.get_auth_role()) = any (
      array['manager', 'assistant_manager', 'store_manager', 'crm', 'csr_head', 'csr_staff', 'csr']
    )
    AND EXISTS (
      SELECT 1
      FROM public.staff target_staff
      WHERE target_staff.id = staff_services.staff_id
        AND target_staff.is_active = true
        AND target_staff.system_role <> all (
          array['owner', 'manager', 'assistant_manager', 'store_manager']
        )
        AND target_staff.branch_id = (select public.get_auth_branch_id())
        AND public.is_branch_service_assignable(target_staff.branch_id, staff_services.service_id)
    )
  );

CREATE OR REPLACE FUNCTION public.replace_staff_service_capabilities(
  p_target_staff_id uuid,
  p_service_ids uuid[] default '{}'::uuid[]
)
RETURNS TABLE(service_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_auth_id uuid := (select auth.uid());
  v_request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '')
  );
  v_actor_staff_id uuid;
  v_actor_role text;
  v_actor_branch_id uuid;
  v_target_branch_id uuid;
  v_target_role text;
  v_target_is_active boolean;
  v_requested_service_ids uuid[] := '{}'::uuid[];
  v_invalid_service_ids uuid[] := '{}'::uuid[];
BEGIN
  IF v_actor_auth_id IS NULL THEN
    IF v_request_role <> 'service_role' THEN
      RAISE EXCEPTION 'crm_staff_services_not_authenticated'
        USING errcode = '28000';
    END IF;

    v_actor_role := 'owner';
  ELSE
    SELECT
      actor.id,
      CASE
        WHEN actor.system_role IN ('csr', 'csr_head', 'csr_staff') THEN 'crm'
        ELSE actor.system_role
      END,
      actor.branch_id
    INTO v_actor_staff_id, v_actor_role, v_actor_branch_id
    FROM public.staff actor
    WHERE actor.auth_user_id = v_actor_auth_id
      AND actor.is_active = true
    LIMIT 1;

    IF v_actor_staff_id IS NULL THEN
      RAISE EXCEPTION 'crm_staff_services_not_authenticated'
        USING errcode = '28000';
    END IF;
  END IF;

  IF v_actor_role NOT IN (
    'owner',
    'manager',
    'assistant_manager',
    'store_manager',
    'crm'
  ) THEN
    RAISE EXCEPTION 'crm_staff_services_not_authorized'
      USING errcode = '42501';
  END IF;

  SELECT
    target_staff.branch_id,
    CASE
      WHEN target_staff.system_role IN ('csr', 'csr_head', 'csr_staff') THEN 'crm'
      ELSE target_staff.system_role
    END,
    target_staff.is_active
  INTO v_target_branch_id, v_target_role, v_target_is_active
  FROM public.staff target_staff
  WHERE target_staff.id = p_target_staff_id;

  IF v_target_branch_id IS NULL THEN
    RAISE EXCEPTION 'crm_staff_services_target_not_found'
      USING errcode = 'P0002';
  END IF;

  IF NOT v_target_is_active THEN
    RAISE EXCEPTION 'crm_staff_services_target_inactive'
      USING errcode = 'P0001';
  END IF;

  IF v_actor_role <> 'owner' THEN
    IF v_actor_branch_id IS NULL OR v_actor_branch_id <> v_target_branch_id THEN
      RAISE EXCEPTION 'crm_staff_services_branch_mismatch'
        USING errcode = '42501';
    END IF;

    IF v_target_role IN ('owner', 'manager', 'assistant_manager', 'store_manager') THEN
      RAISE EXCEPTION 'crm_staff_services_privileged_target'
        USING errcode = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_service_ids, '{}'::uuid[])) requested(service_id)
    WHERE requested.service_id IS NULL
  ) THEN
    RAISE EXCEPTION 'crm_staff_services_invalid_service'
      USING errcode = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT requested.service_id), '{}'::uuid[])
  INTO v_requested_service_ids
  FROM unnest(coalesce(p_service_ids, '{}'::uuid[])) requested(service_id);

  SELECT coalesce(array_agg(requested.service_id), '{}'::uuid[])
  INTO v_invalid_service_ids
  FROM unnest(v_requested_service_ids) requested(service_id)
  WHERE NOT public.is_branch_service_assignable(
    v_target_branch_id,
    requested.service_id
  );

  IF cardinality(v_invalid_service_ids) > 0 THEN
    RAISE EXCEPTION 'crm_staff_services_invalid_service'
      USING errcode = '22023';
  END IF;

  DELETE FROM public.staff_services existing_assignment
  WHERE existing_assignment.staff_id = p_target_staff_id
    AND NOT (
      cardinality(v_requested_service_ids) > 0
      AND existing_assignment.service_id = any (v_requested_service_ids)
    );

  INSERT INTO public.staff_services (staff_id, service_id)
  SELECT p_target_staff_id, requested.service_id
  FROM unnest(v_requested_service_ids) requested(service_id)
  ON CONFLICT ON CONSTRAINT staff_services_staff_id_service_id_key DO NOTHING;

  RETURN QUERY
  SELECT final_assignment.service_id
  FROM public.staff_services final_assignment
  WHERE final_assignment.staff_id = p_target_staff_id
  ORDER BY final_assignment.service_id;
END;
$$;

COMMENT ON FUNCTION public.replace_staff_service_capabilities(uuid, uuid[]) IS
  'Atomically replaces staff_services rows after authenticated actor or service_role server context, target-branch authorization, and canonical branch assignability validation.';

REVOKE ALL ON FUNCTION public.replace_staff_service_capabilities(uuid, uuid[]) FROM public;
REVOKE ALL ON FUNCTION public.replace_staff_service_capabilities(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_staff_service_capabilities(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_staff_service_capabilities(uuid, uuid[]) TO service_role;

-- Prevent future service-creation drift. New globally active services get a
-- safe in-spa-only mapping for active branches; branch managers can customize
-- or deactivate afterward. Home Service is never enabled by this trigger.
CREATE OR REPLACE FUNCTION public.ensure_branch_service_rows_for_new_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.branch_services (
    branch_id,
    service_id,
    custom_price,
    is_active,
    available_in_spa,
    available_home_service,
    visibility,
    booking_visibility
  )
  SELECT
    branch.id,
    NEW.id,
    NULL,
    true,
    true,
    false,
    'public',
    'public'
  FROM public.branches branch
  WHERE branch.is_active = true
  ON CONFLICT (branch_id, service_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_branch_service_rows_after_service_insert ON public.services;
CREATE TRIGGER ensure_branch_service_rows_after_service_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_branch_service_rows_for_new_service();

COMMENT ON FUNCTION public.ensure_branch_service_rows_for_new_service() IS
  'Creates safe default branch_services rows for newly inserted active global services.';

DO $$
DECLARE
  v_main_branch_id uuid := 'c1000000-0000-0000-0000-000000000001'::uuid;
  v_sm_branch_id uuid := 'c1000000-0000-0000-0000-000000000002'::uuid;
  v_main_count integer;
  v_sm_count integer;
BEGIN
  SELECT count(*) INTO v_main_count
  FROM public.branches
  WHERE id = v_main_branch_id
    AND is_active = true;

  SELECT count(*) INTO v_sm_count
  FROM public.branches
  WHERE id = v_sm_branch_id
    AND is_active = true;

  IF v_main_count <> 1 OR v_sm_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one active Main branch and one active SM branch for catalogue repair. Found Main %, SM %.',
      v_main_count,
      v_sm_count;
  END IF;

  INSERT INTO public.branch_booking_rules (
    branch_id,
    home_service_enabled
  )
  VALUES (
    v_sm_branch_id,
    false
  )
  ON CONFLICT (branch_id) DO UPDATE
  SET
    home_service_enabled = false,
    updated_at = now();

  UPDATE public.branch_services
  SET available_home_service = false
  WHERE branch_id = v_sm_branch_id
    AND available_home_service IS DISTINCT FROM false;

  INSERT INTO public.branch_services (
    branch_id,
    service_id,
    custom_price,
    is_active,
    available_in_spa,
    available_home_service,
    visibility,
    booking_visibility,
    customer_tier_required,
    requires_senior_staff,
    requires_special_setup,
    setup_notes,
    sort_order,
    public_title,
    public_description,
    custom_duration_minutes,
    custom_image_url,
    is_featured
  )
  SELECT
    v_sm_branch_id,
    main_branch_service.service_id,
    NULL,
    true,
    true,
    false,
    coalesce(main_branch_service.visibility, 'public'),
    public.branch_service_booking_visibility_from_visibility(
      coalesce(main_branch_service.visibility, 'public')
    ),
    coalesce(main_branch_service.customer_tier_required, 'any'),
    coalesce(main_branch_service.requires_senior_staff, false),
    coalesce(main_branch_service.requires_special_setup, false),
    main_branch_service.setup_notes,
    coalesce(main_branch_service.sort_order, 0),
    main_branch_service.public_title,
    main_branch_service.public_description,
    NULL,
    main_branch_service.custom_image_url,
    coalesce(main_branch_service.is_featured, false)
  FROM public.branch_services main_branch_service
  JOIN public.services service
    ON service.id = main_branch_service.service_id
   AND service.is_active = true
  WHERE main_branch_service.branch_id = v_main_branch_id
    AND main_branch_service.is_active = true
    AND main_branch_service.available_in_spa = true
  ON CONFLICT (branch_id, service_id) DO NOTHING;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
