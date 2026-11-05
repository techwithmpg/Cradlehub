-- Stage B: Request / branch-CSR decision records ONLY.
-- Review-only migration. DO NOT apply until local tests, independent review,
-- owner approval, and production migration state are reconciled.
-- NO changes to staff.branch_id, booking availability, attendance or payroll.

create table public.staff_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_branch_id uuid not null references public.branches(id) on delete restrict,
  lending_branch_id uuid not null references public.branches(id) on delete restrict,
  requested_role text not null check (requested_role in ('therapist','nail_tech','aesthetician')),
  quantity integer not null check (quantity between 1 and 20),
  visit_type text not null default 'in_spa' check (visit_type in ('in_spa','home_service')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text not null default '' check (char_length(notes) <= 200),
  status text not null default 'requested'
    check (status in ('requested','approved_pending_arrival','declined','cancelled')),
  -- Provisional approval list. NOT booking authorization or attendance permission.
  selected_staff_ids uuid[] not null default '{}'::uuid[],
  requested_by_auth_user_id uuid not null,
  reviewed_by_auth_user_id uuid,
  decision_note text not null default '' check (char_length(decision_note) <= 200),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistance_different_branches check (requesting_branch_id <> lending_branch_id),
  constraint assistance_window_bounded check (
    end_at > start_at and end_at <= start_at + interval '24 hours'
  ),
  constraint assistance_approved_count check (
    status <> 'approved_pending_arrival' or cardinality(selected_staff_ids) = quantity
  ),
  constraint assistance_pending_empty check (
    status <> 'requested' or cardinality(selected_staff_ids) = 0
  )
);

create index staff_assistance_requesting_idx on public.staff_assistance_requests
  (requesting_branch_id, created_at desc);
create index staff_assistance_lending_idx on public.staff_assistance_requests
  (lending_branch_id, created_at desc);
create index staff_assistance_status_idx on public.staff_assistance_requests
  (status, start_at);

create table public.staff_assistance_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.staff_assistance_requests(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_auth_user_id uuid,
  selected_staff_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);
create index staff_assistance_events_request_idx on public.staff_assistance_events
  (request_id, created_at desc);

-- Every state transition, including initial request, is recorded atomically
-- with its parent write so audit evidence cannot be lost on a notification error.
create function public.audit_staff_assistance_request()
returns trigger language plpgsql security invoker
set search_path = ''
as $
declare
  v_staff_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.requesting_branch_id is distinct from old.requesting_branch_id or
       new.lending_branch_id is distinct from old.lending_branch_id or
       new.requested_role is distinct from old.requested_role or
       new.quantity is distinct from old.quantity or
       new.visit_type is distinct from old.visit_type or
       new.start_at is distinct from old.start_at or
       new.end_at is distinct from old.end_at or
       new.requested_by_auth_user_id is distinct from old.requested_by_auth_user_id then
      raise exception 'Assistance request identity and scope are immutable';
    end if;
    if new.status = old.status then
      raise exception 'Assistance update requires a valid state change';
    end if;
    if old.status <> 'requested' or
       new.status not in ('approved_pending_arrival','declined','cancelled') then
      raise exception 'Invalid assistance status transition';
    end if;

    if new.status = 'approved_pending_arrival' then
      -- Defend against duplicate IDs, wrong home branches, or stale staff roles.
      if cardinality(new.selected_staff_ids) <>
         (select count(distinct selected.id) from unnest(new.selected_staff_ids) as selected(id)) then
        raise exception 'Selected staff must be unique';
      end if;
      if exists (
        select 1
        from unnest(new.selected_staff_ids) as selected(id)
        left join public.staff s on s.id = selected.id
        where s.id is null or s.branch_id is distinct from new.lending_branch_id
           or s.staff_type is distinct from new.requested_role
           or s.is_active is distinct from true
           or s.archived_at is not null or s.merged_into_staff_id is not null
      ) then
        raise exception 'Selected staff do not belong to the active lending branch roster';
      end if;

      -- Transaction-scoped locks for each selected staff member serialize
      -- simultaneous approvals of *different* requests with overlapping windows.
      for v_staff_id in
        select distinct selected.id
        from unnest(new.selected_staff_ids) as selected(id)
        order by selected.id
      loop
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(v_staff_id::text, 20261105)
        );
      end loop;
      if exists (
        select 1 from public.staff_assistance_requests other
        where other.id <> new.id
          and other.status = 'approved_pending_arrival'
          and other.start_at < new.end_at and other.end_at > new.start_at
          and other.selected_staff_ids && new.selected_staff_ids
      ) then
        raise exception 'Selected staff already have overlapping assistance approval';
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_staff_assistance_before
before insert or update on public.staff_assistance_requests
for each row execute function public.audit_staff_assistance_request();

create function public.insert_staff_assistance_audit()
returns trigger language plpgsql security invoker
set search_path = ''
as $$
begin
  insert into public.staff_assistance_events (
    request_id, from_status, to_status, actor_auth_user_id, selected_staff_ids
  ) values (
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    case when tg_op = 'INSERT' then new.requested_by_auth_user_id else new.reviewed_by_auth_user_id end,
    new.selected_staff_ids
  );
  return null;
end;
$$;
create trigger trg_staff_assistance_after
after insert or update on public.staff_assistance_requests
for each row execute function public.insert_staff_assistance_audit();

alter table public.staff_assistance_requests enable row level security;
alter table public.staff_assistance_events enable row level security;

-- Frontend clients can READ relevant branch requests. All WRITES are
-- server-side only, using verified actor identities and a restricted backend key.
revoke all on public.staff_assistance_requests from public, anon, authenticated, service_role;
revoke all on public.staff_assistance_events from public, anon, authenticated, service_role;
grant select on public.staff_assistance_requests to authenticated;
grant select on public.staff_assistance_events to authenticated;
grant select, insert, update on public.staff_assistance_requests to service_role;
grant select, insert on public.staff_assistance_events to service_role;

-- Trigger functions are not client APIs. Do not leave accidental function
-- EXECUTE grants for anon or authenticated roles.
revoke execute on function public.audit_staff_assistance_request()
  from public, anon, authenticated;
revoke execute on function public.insert_staff_assistance_audit()
  from public, anon, authenticated;
grant execute on function public.audit_staff_assistance_request() to service_role;
grant execute on function public.insert_staff_assistance_audit() to service_role;

create policy "assistance_branch_read" on public.staff_assistance_requests
for select to authenticated
using (
  (select public.get_auth_role()) = 'owner'
  or (
    (select public.get_auth_role()) in ('manager','assistant_manager','store_manager','crm','csr','csr_head','csr_staff')
    and (
      requesting_branch_id = (select public.get_auth_branch_id())
      or lending_branch_id = (select public.get_auth_branch_id())
    )
  )
);

create policy "assistance_events_branch_read" on public.staff_assistance_events
for select to authenticated
using (
  exists (
    select 1 from public.staff_assistance_requests r
    where r.id = request_id
  )
);

comment on table public.staff_assistance_requests is
  'Stage B only: human requests and provisional branch CSR decisions. Not staff availability or attendance authorization.';
comment on column public.staff_assistance_requests.selected_staff_ids is
  'Provisional decision evidence only; must NOT be used by booking, dispatch, scheduling, or attendance eligibility.';
