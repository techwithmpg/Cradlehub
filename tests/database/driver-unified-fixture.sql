-- SYNTHETIC LOCAL TEST ONLY. No remote target, real user, or production schema.
-- Roles must already exist on the identified disposable-test cluster.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;$$;
grant usage on schema auth,public to authenticated,service_role;
grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
create table public.branches(id uuid primary key,name text,latitude double precision,longitude double precision,is_active boolean default true);
create table public.staff(id uuid primary key,auth_user_id uuid,branch_id uuid,full_name text,system_role text,staff_type text,is_active boolean default true,archived_at timestamptz,merged_into_staff_id uuid);
create table public.customers(id uuid primary key,full_name text);
create table public.bookings(id uuid primary key,branch_id uuid,driver_id uuid,staff_id uuid,customer_id uuid,delivery_type text default 'home_service',status text default 'confirmed',booking_progress_status text default 'not_started',booking_date date default ((now() at time zone 'Asia/Manila')::date),start_time time default '12:00',metadata jsonb default '{}',session_started_at timestamptz,session_completed_at timestamptz,session_completion_source text,travel_started_at timestamptz,arrived_at timestamptz,checked_in_at timestamptz,completed_at timestamptz,no_show_at timestamptz,updated_at timestamptz default now());
create table public.staff_shift_checkins(id uuid primary key default gen_random_uuid(),staff_id uuid,branch_id uuid,status text default 'checked_in',checked_out_at timestamptz,is_test boolean default false);
create table public.staff_location_snapshots(id uuid primary key default gen_random_uuid(),staff_id uuid,branch_id uuid,booking_id uuid,lat double precision,lng double precision,accuracy_meters double precision,source text,recorded_at timestamptz default now());
create index fixture_location_lookup on public.staff_location_snapshots(staff_id,booking_id,recorded_at desc);
create table public.workspace_notifications(id uuid primary key default gen_random_uuid(),target_workspace text,recipient_staff_id uuid,entity_type text,entity_id uuid,type text);
revoke all on all tables in schema public,auth from public,anon,authenticated;
