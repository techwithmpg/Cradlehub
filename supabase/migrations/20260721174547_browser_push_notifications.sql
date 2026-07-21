-- =============================================================================
-- NOTIFICATIONS-001 — Browser push subscriptions and Owner delivery preference
-- =============================================================================
-- `workspace_notifications` remains the sole notification history. These tables
-- store delivery endpoints and user preference only.

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  workspace text not null,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  device_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0,

  constraint web_push_subscriptions_endpoint_key unique (endpoint),
  constraint web_push_subscriptions_workspace_check
    check (workspace in ('owner', 'crm', 'staff', 'driver', 'utility')),
  constraint web_push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 16 and 4096),
  constraint web_push_subscriptions_p256dh_length_check
    check (char_length(p256dh) between 16 and 512),
  constraint web_push_subscriptions_auth_secret_length_check
    check (char_length(auth_secret) between 8 and 256),
  constraint web_push_subscriptions_user_agent_length_check
    check (user_agent is null or char_length(user_agent) <= 1024),
  constraint web_push_subscriptions_device_label_length_check
    check (device_label is null or char_length(device_label) <= 100),
  constraint web_push_subscriptions_failure_count_check
    check (failure_count >= 0),
  constraint web_push_subscriptions_scope_check
    check (
      (workspace = 'owner' and branch_id is null)
      or (workspace <> 'owner' and branch_id is not null)
    )
);

comment on table public.web_push_subscriptions is
  'Per-device Web Push delivery endpoints. Contains no notification history or payload bodies.';
comment on column public.web_push_subscriptions.auth_secret is
  'Push encryption auth secret. Readable only by the owning user and server delivery role.';

create index web_push_subscriptions_user_active_idx
  on public.web_push_subscriptions (auth_user_id, is_active);

create index web_push_subscriptions_branch_workspace_active_idx
  on public.web_push_subscriptions (branch_id, workspace)
  where is_active = true;

create index web_push_subscriptions_staff_active_idx
  on public.web_push_subscriptions (staff_id)
  where is_active = true and staff_id is not null;

create trigger web_push_subscriptions_updated_at
  before update on public.web_push_subscriptions
  for each row execute function public.fn_update_updated_at();

alter table public.web_push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on public.web_push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy "push_subscriptions_insert_own_scope"
  on public.web_push_subscriptions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = auth_user_id
    and staff_id is not distinct from get_auth_staff_id()
    and (
      (workspace = 'owner' and get_auth_role() = 'owner' and branch_id is null)
      or (
        workspace = 'crm'
        and get_auth_role() in ('crm', 'csr', 'csr_head', 'csr_staff')
        and branch_id = get_auth_branch_id()
      )
      or (
        workspace = 'staff'
        and get_auth_role() = 'staff'
        and branch_id = get_auth_branch_id()
      )
      or (
        workspace = 'driver'
        and get_auth_role() = 'driver'
        and branch_id = get_auth_branch_id()
      )
      or (
        workspace = 'utility'
        and get_auth_role() = 'utility'
        and branch_id = get_auth_branch_id()
      )
    )
  );

create policy "push_subscriptions_update_own_scope"
  on public.web_push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check (
    (select auth.uid()) = auth_user_id
    and staff_id is not distinct from get_auth_staff_id()
    and (
      (workspace = 'owner' and get_auth_role() = 'owner' and branch_id is null)
      or (
        workspace = 'crm'
        and get_auth_role() in ('crm', 'csr', 'csr_head', 'csr_staff')
        and branch_id = get_auth_branch_id()
      )
      or (
        workspace = 'staff'
        and get_auth_role() = 'staff'
        and branch_id = get_auth_branch_id()
      )
      or (
        workspace = 'driver'
        and get_auth_role() = 'driver'
        and branch_id = get_auth_branch_id()
      )
      or (
        workspace = 'utility'
        and get_auth_role() = 'utility'
        and branch_id = get_auth_branch_id()
      )
    )
  );

revoke all on table public.web_push_subscriptions from anon;
grant select, insert, update on table public.web_push_subscriptions to authenticated;
grant all on table public.web_push_subscriptions to service_role;

create table public.notification_delivery_preferences (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  owner_booking_preference text not null default 'home_service_and_urgent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_delivery_preferences_auth_user_key unique (auth_user_id),
  constraint notification_delivery_preferences_owner_booking_check
    check (
      owner_booking_preference in (
        'all',
        'home_service_and_urgent',
        'urgent_only',
        'disabled'
      )
    )
);

comment on table public.notification_delivery_preferences is
  'Account-level notification delivery preferences; not a notification history table.';

create trigger notification_delivery_preferences_updated_at
  before update on public.notification_delivery_preferences
  for each row execute function public.fn_update_updated_at();

alter table public.notification_delivery_preferences enable row level security;

create policy "notification_delivery_preferences_select_own"
  on public.notification_delivery_preferences
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy "notification_delivery_preferences_insert_own"
  on public.notification_delivery_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = auth_user_id);

create policy "notification_delivery_preferences_update_own"
  on public.notification_delivery_preferences
  for update
  to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

revoke all on table public.notification_delivery_preferences from anon;
grant select, insert, update on table public.notification_delivery_preferences to authenticated;
grant all on table public.notification_delivery_preferences to service_role;

-- Postgres Changes remains RLS-authorized per subscriber. Add the existing
-- history table to the publication without assuming it is not already present.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_notifications'
  ) then
    alter publication supabase_realtime
      add table public.workspace_notifications;
  end if;
end
$$;

notify pgrst, 'reload schema';
