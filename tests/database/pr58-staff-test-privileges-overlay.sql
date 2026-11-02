-- LOCAL-ONLY proposal for a future standalone attendance TEST project.
-- Apply after the recovered public.staff contract, never to production under
-- this authorization. Preserve RLS policies, owner, indexes and triggers.
-- Production mirror grants arwdDxtm to anon/authenticated/service_role.
-- Proposed TEST grants: anon none; authenticated and service_role arwd.

revoke all on table public.staff from public, anon, authenticated, service_role;
revoke update (branch_id, full_name, phone, tier, system_role,
               is_active, staff_type, is_head, nickname)
  on table public.staff from authenticated;
grant select, insert, update, delete on table public.staff
  to authenticated, service_role;
