-- =============================================================================
-- CradleHub - Marketing Studio Foundation
-- =============================================================================
-- Adds a dedicated digital_marketer access role and draft-first marketing
-- persistence without granting non-owners direct write access to the live
-- public_site_sections/public_site_assets tables.
-- =============================================================================

-- 1. Role compatibility -------------------------------------------------------

alter table public.staff
  drop constraint if exists staff_system_role_check;

alter table public.staff
  add constraint staff_system_role_check
  check (
    system_role in (
      'owner',
      'manager',
      'assistant_manager',
      'store_manager',
      'crm',
      'staff',
      'service_head',
      'service_staff',
      'digital_marketer',
      'driver',
      'utility'
    )
  );

comment on column public.staff.system_role is
  'Canonical access role. Front Desk users are stored as crm; digital marketers use the protected Marketing workspace.';

do $$
begin
  if to_regclass('public.role_definitions') is not null then
    insert into public.role_definitions (
      system_role,
      display_name,
      description,
      workspace,
      can_book,
      can_manage
    )
    values (
      'digital_marketer',
      'Digital Marketer',
      'Protected Marketing workspace access for public-site drafts and media preparation.',
      'marketing',
      false,
      false
    )
    on conflict (system_role) do update
      set display_name = excluded.display_name,
          description = excluded.description,
          workspace = excluded.workspace,
          can_book = excluded.can_book,
          can_manage = excluded.can_manage,
          is_active = true;
  end if;
end $$;

-- 2. Draft/revision/content tables -------------------------------------------

create table if not exists public.marketing_content_drafts (
  id uuid primary key default gen_random_uuid(),
  content_type text not null default 'section',
  content_key text not null,
  title text,
  subtitle text,
  body text,
  cta_label text,
  cta_href text,
  image_url text,
  secondary_image_url text,
  alt_text text,
  link_href text,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  scheduled_for timestamptz,
  source_section_id uuid references public.public_site_sections(id) on delete set null,
  source_asset_id uuid references public.public_site_assets(id) on delete set null,
  created_by uuid references public.staff(id) on delete set null,
  updated_by uuid references public.staff(id) on delete set null,
  submitted_by uuid references public.staff(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  published_by uuid references public.staff(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_content_drafts_content_type_check
    check (content_type in ('section', 'asset', 'brand', 'seo', 'service')),
  constraint marketing_content_drafts_content_key_format
    check (content_key ~ '^[a-z0-9_:/.-]+$'),
  constraint marketing_content_drafts_status_check
    check (status in (
      'draft',
      'submitted',
      'changes_requested',
      'approved',
      'scheduled',
      'published',
      'archived'
    )),
  constraint marketing_content_drafts_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists marketing_content_drafts_active_key_idx
  on public.marketing_content_drafts (content_type, content_key)
  where status in ('draft', 'submitted', 'changes_requested', 'approved', 'scheduled');

create index if not exists marketing_content_drafts_status_updated_idx
  on public.marketing_content_drafts (status, updated_at desc);

create index if not exists marketing_content_drafts_scheduled_idx
  on public.marketing_content_drafts (scheduled_for)
  where status = 'scheduled';

create table if not exists public.marketing_content_revisions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.marketing_content_drafts(id) on delete cascade,
  revision_no integer not null,
  action text not null,
  snapshot jsonb not null,
  note text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint marketing_content_revisions_action_check
    check (action in (
      'created',
      'saved',
      'submitted',
      'changes_requested',
      'approved',
      'scheduled',
      'published',
      'rolled_back',
      'archived'
    )),
  constraint marketing_content_revisions_snapshot_object
    check (jsonb_typeof(snapshot) = 'object'),
  constraint marketing_content_revisions_revision_no_positive
    check (revision_no > 0),
  unique (draft_id, revision_no)
);

create index if not exists marketing_content_revisions_draft_created_idx
  on public.marketing_content_revisions (draft_id, created_at desc);

create table if not exists public.marketing_media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_path text not null unique,
  public_url text,
  title text,
  alt_text text not null,
  section_key text,
  content_key text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.staff(id) on delete set null,
  updated_by uuid references public.staff(id) on delete set null,
  reviewed_by uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_media_assets_bucket_path_format
    check (bucket_path ~ '^[a-z0-9][a-z0-9_./-]*$'),
  constraint marketing_media_assets_alt_text_required
    check (length(trim(alt_text)) >= 3),
  constraint marketing_media_assets_status_check
    check (status in ('draft', 'submitted', 'approved', 'published', 'archived')),
  constraint marketing_media_assets_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists marketing_media_assets_status_updated_idx
  on public.marketing_media_assets (status, updated_at desc);

create table if not exists public.marketing_brand_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  label text not null,
  value jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  updated_by uuid references public.staff(id) on delete set null,
  reviewed_by uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_brand_settings_key_format
    check (setting_key ~ '^[a-z0-9_:-]+$'),
  constraint marketing_brand_settings_value_object
    check (jsonb_typeof(value) = 'object'),
  constraint marketing_brand_settings_status_check
    check (status in ('draft', 'submitted', 'approved', 'published', 'archived'))
);

create table if not exists public.marketing_seo_settings (
  id uuid primary key default gen_random_uuid(),
  route_path text not null unique,
  title text,
  description text,
  og_image_url text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  updated_by uuid references public.staff(id) on delete set null,
  reviewed_by uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_seo_settings_route_path_format
    check (route_path ~ '^/[a-z0-9_./-]*$'),
  constraint marketing_seo_settings_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint marketing_seo_settings_status_check
    check (status in ('draft', 'submitted', 'approved', 'published', 'archived'))
);

-- 3. Storage foundation -------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('public-site-media', 'public-site-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public_site_media_public_read" on storage.objects;
create policy "public_site_media_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'public-site-media');

drop policy if exists "public_site_media_marketing_insert" on storage.objects;
create policy "public_site_media_marketing_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public-site-media'
    and public.get_auth_role() in ('owner', 'digital_marketer')
  );

drop policy if exists "public_site_media_marketing_update" on storage.objects;
create policy "public_site_media_marketing_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'public-site-media'
    and public.get_auth_role() in ('owner', 'digital_marketer')
  )
  with check (
    bucket_id = 'public-site-media'
    and public.get_auth_role() in ('owner', 'digital_marketer')
  );

drop policy if exists "public_site_media_marketing_delete" on storage.objects;
create policy "public_site_media_marketing_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public-site-media'
    and public.get_auth_role() in ('owner', 'digital_marketer')
  );

-- 4. RLS, explicit grants, and update triggers -------------------------------

grant select, insert, update, delete on table public.marketing_content_drafts to authenticated;
grant select, insert, update, delete on table public.marketing_content_drafts to service_role;
revoke all on table public.marketing_content_drafts from anon;

grant select, insert on table public.marketing_content_revisions to authenticated;
grant select, insert, update, delete on table public.marketing_content_revisions to service_role;
revoke all on table public.marketing_content_revisions from anon;

grant select, insert, update, delete on table public.marketing_media_assets to authenticated;
grant select, insert, update, delete on table public.marketing_media_assets to service_role;
revoke all on table public.marketing_media_assets from anon;

grant select, insert, update, delete on table public.marketing_brand_settings to authenticated;
grant select, insert, update, delete on table public.marketing_brand_settings to service_role;
revoke all on table public.marketing_brand_settings from anon;

grant select, insert, update, delete on table public.marketing_seo_settings to authenticated;
grant select, insert, update, delete on table public.marketing_seo_settings to service_role;
revoke all on table public.marketing_seo_settings from anon;

alter table public.marketing_content_drafts enable row level security;
alter table public.marketing_content_revisions enable row level security;
alter table public.marketing_media_assets enable row level security;
alter table public.marketing_brand_settings enable row level security;
alter table public.marketing_seo_settings enable row level security;

drop policy if exists "marketing_content_drafts_owner_all" on public.marketing_content_drafts;
create policy "marketing_content_drafts_owner_all"
  on public.marketing_content_drafts for all
  to authenticated
  using (public.get_auth_role() = 'owner')
  with check (public.get_auth_role() = 'owner');

drop policy if exists "marketing_content_drafts_marketer_select" on public.marketing_content_drafts;
create policy "marketing_content_drafts_marketer_select"
  on public.marketing_content_drafts for select
  to authenticated
  using (public.get_auth_role() = 'digital_marketer');

drop policy if exists "marketing_content_drafts_marketer_insert" on public.marketing_content_drafts;
create policy "marketing_content_drafts_marketer_insert"
  on public.marketing_content_drafts for insert
  to authenticated
  with check (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted', 'changes_requested')
    and created_by is not distinct from public.get_auth_staff_id()
    and updated_by is not distinct from public.get_auth_staff_id()
  );

drop policy if exists "marketing_content_drafts_marketer_update" on public.marketing_content_drafts;
create policy "marketing_content_drafts_marketer_update"
  on public.marketing_content_drafts for update
  to authenticated
  using (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted', 'changes_requested')
  )
  with check (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted', 'changes_requested')
    and updated_by is not distinct from public.get_auth_staff_id()
    and reviewed_by is null
    and reviewed_at is null
    and published_by is null
    and published_at is null
  );

drop policy if exists "marketing_content_drafts_marketer_delete" on public.marketing_content_drafts;
create policy "marketing_content_drafts_marketer_delete"
  on public.marketing_content_drafts for delete
  to authenticated
  using (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'changes_requested')
  );

drop policy if exists "marketing_content_revisions_owner_all" on public.marketing_content_revisions;
create policy "marketing_content_revisions_owner_all"
  on public.marketing_content_revisions for all
  to authenticated
  using (public.get_auth_role() = 'owner')
  with check (public.get_auth_role() = 'owner');

drop policy if exists "marketing_content_revisions_marketer_select" on public.marketing_content_revisions;
create policy "marketing_content_revisions_marketer_select"
  on public.marketing_content_revisions for select
  to authenticated
  using (public.get_auth_role() = 'digital_marketer');

drop policy if exists "marketing_content_revisions_marketer_insert" on public.marketing_content_revisions;
create policy "marketing_content_revisions_marketer_insert"
  on public.marketing_content_revisions for insert
  to authenticated
  with check (
    public.get_auth_role() = 'digital_marketer'
    and created_by is not distinct from public.get_auth_staff_id()
    and exists (
      select 1
      from public.marketing_content_drafts d
      where d.id = draft_id
        and d.status in ('draft', 'submitted', 'changes_requested')
    )
  );

drop policy if exists "marketing_media_assets_owner_all" on public.marketing_media_assets;
create policy "marketing_media_assets_owner_all"
  on public.marketing_media_assets for all
  to authenticated
  using (public.get_auth_role() = 'owner')
  with check (public.get_auth_role() = 'owner');

drop policy if exists "marketing_media_assets_marketer_select" on public.marketing_media_assets;
create policy "marketing_media_assets_marketer_select"
  on public.marketing_media_assets for select
  to authenticated
  using (public.get_auth_role() = 'digital_marketer');

drop policy if exists "marketing_media_assets_marketer_write" on public.marketing_media_assets;
create policy "marketing_media_assets_marketer_write"
  on public.marketing_media_assets for all
  to authenticated
  using (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted')
  )
  with check (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted')
    and updated_by is not distinct from public.get_auth_staff_id()
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists "marketing_brand_settings_owner_all" on public.marketing_brand_settings;
create policy "marketing_brand_settings_owner_all"
  on public.marketing_brand_settings for all
  to authenticated
  using (public.get_auth_role() = 'owner')
  with check (public.get_auth_role() = 'owner');

drop policy if exists "marketing_brand_settings_marketer_select" on public.marketing_brand_settings;
create policy "marketing_brand_settings_marketer_select"
  on public.marketing_brand_settings for select
  to authenticated
  using (public.get_auth_role() = 'digital_marketer');

drop policy if exists "marketing_brand_settings_marketer_write" on public.marketing_brand_settings;
create policy "marketing_brand_settings_marketer_write"
  on public.marketing_brand_settings for all
  to authenticated
  using (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted')
  )
  with check (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted')
    and updated_by is not distinct from public.get_auth_staff_id()
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists "marketing_seo_settings_owner_all" on public.marketing_seo_settings;
create policy "marketing_seo_settings_owner_all"
  on public.marketing_seo_settings for all
  to authenticated
  using (public.get_auth_role() = 'owner')
  with check (public.get_auth_role() = 'owner');

drop policy if exists "marketing_seo_settings_marketer_select" on public.marketing_seo_settings;
create policy "marketing_seo_settings_marketer_select"
  on public.marketing_seo_settings for select
  to authenticated
  using (public.get_auth_role() = 'digital_marketer');

drop policy if exists "marketing_seo_settings_marketer_write" on public.marketing_seo_settings;
create policy "marketing_seo_settings_marketer_write"
  on public.marketing_seo_settings for all
  to authenticated
  using (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted')
  )
  with check (
    public.get_auth_role() = 'digital_marketer'
    and status in ('draft', 'submitted')
    and updated_by is not distinct from public.get_auth_staff_id()
    and reviewed_by is null
    and reviewed_at is null
  );

drop trigger if exists trg_marketing_content_drafts_updated_at
  on public.marketing_content_drafts;
create trigger trg_marketing_content_drafts_updated_at
  before update on public.marketing_content_drafts
  for each row execute function public.fn_update_updated_at();

drop trigger if exists trg_marketing_media_assets_updated_at
  on public.marketing_media_assets;
create trigger trg_marketing_media_assets_updated_at
  before update on public.marketing_media_assets
  for each row execute function public.fn_update_updated_at();

drop trigger if exists trg_marketing_brand_settings_updated_at
  on public.marketing_brand_settings;
create trigger trg_marketing_brand_settings_updated_at
  before update on public.marketing_brand_settings
  for each row execute function public.fn_update_updated_at();

drop trigger if exists trg_marketing_seo_settings_updated_at
  on public.marketing_seo_settings;
create trigger trg_marketing_seo_settings_updated_at
  before update on public.marketing_seo_settings
  for each row execute function public.fn_update_updated_at();

notify pgrst, 'reload schema';
