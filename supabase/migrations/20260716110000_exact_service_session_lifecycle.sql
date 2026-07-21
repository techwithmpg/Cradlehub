-- =============================================================================
-- Exact service-session lifecycle
--
-- Design goals:
--   * Planned booking slots may use 15/30/60-minute grids.
--   * Real service execution uses exact server timestamps without rounding.
--   * Reaching session_due_at NEVER completes a service.
--   * No per-minute cron and no database polling are required.
--   * Start, complete, and extend are idempotent row-locked transactions.
--   * Due/overtime is derived from session_due_at at read time.
-- =============================================================================

begin;

alter table public.bookings
  add column if not exists booking_buffer_before_minutes_snapshot integer,
  add column if not exists booking_buffer_after_minutes_snapshot integer,
  add column if not exists session_extension_minutes_total integer not null default 0,
  add column if not exists session_start_source text,
  add column if not exists session_started_by uuid references public.staff(id) on delete set null,
  add column if not exists session_completed_by uuid references public.staff(id) on delete set null;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_buffer_before_snapshot_check'
  ) then
    alter table public.bookings
      add constraint bookings_buffer_before_snapshot_check
      check (
        booking_buffer_before_minutes_snapshot is null
        or booking_buffer_before_minutes_snapshot between 0 and 240
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_buffer_after_snapshot_check'
  ) then
    alter table public.bookings
      add constraint bookings_buffer_after_snapshot_check
      check (
        booking_buffer_after_minutes_snapshot is null
        or booking_buffer_after_minutes_snapshot between 0 and 240
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_session_extension_total_check'
  ) then
    alter table public.bookings
      add constraint bookings_session_extension_total_check
      check (session_extension_minutes_total between 0 and 720);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_session_start_source_check'
  ) then
    alter table public.bookings
      add constraint bookings_session_start_source_check
      check (
        session_start_source is null
        or session_start_source in (
          'crm',
          'staff_portal',
          'room_qr',
          'manager',
          'system_recovery'
        )
      );
  end if;
end
$constraints$;

create or replace function public.prepare_booking_timing_snapshots()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_duration integer;
  v_buffer_before integer;
  v_buffer_after integer;
  v_refresh boolean;
begin
  v_refresh :=
    tg_op = 'INSERT'
    or (
      tg_op = 'UPDATE'
      and new.session_started_at is null
      and (
        new.service_id is distinct from old.service_id
        or new.branch_id is distinct from old.branch_id
      )
    );

  if v_refresh
     or new.session_duration_minutes_snapshot is null
     or new.session_duration_minutes_snapshot <= 0
     or new.booking_buffer_before_minutes_snapshot is null
     or new.booking_buffer_after_minutes_snapshot is null
  then
    select
      coalesce(
        nullif(branch_service.custom_duration_minutes, 0),
        nullif(service.duration_minutes, 0),
        60
      ),
      greatest(0, coalesce(service.buffer_before, 0)),
      greatest(0, coalesce(service.buffer_after, 0))
    into
      v_duration,
      v_buffer_before,
      v_buffer_after
    from public.services as service
    left join public.branch_services as branch_service
      on branch_service.branch_id = new.branch_id
     and branch_service.service_id = service.id
     and branch_service.is_active = true
    where service.id = new.service_id
    limit 1;

    if found then
      if v_refresh
         or new.session_duration_minutes_snapshot is null
         or new.session_duration_minutes_snapshot <= 0
      then
        new.session_duration_minutes_snapshot := v_duration;
      end if;

      if v_refresh or new.booking_buffer_before_minutes_snapshot is null then
        new.booking_buffer_before_minutes_snapshot := v_buffer_before;
      end if;

      if v_refresh or new.booking_buffer_after_minutes_snapshot is null then
        new.booking_buffer_after_minutes_snapshot := v_buffer_after;
      end if;
    end if;
  end if;

  new.session_extension_minutes_total :=
    greatest(0, coalesce(new.session_extension_minutes_total, 0));

  return new;
end;
$$;

drop trigger if exists trg_prepare_booking_timing_snapshots
  on public.bookings;

create trigger trg_prepare_booking_timing_snapshots
before insert or update of
  branch_id,
  service_id,
  session_duration_minutes_snapshot,
  booking_buffer_before_minutes_snapshot,
  booking_buffer_after_minutes_snapshot,
  session_extension_minutes_total
on public.bookings
for each row
execute function public.prepare_booking_timing_snapshots();

-- One-time targeted backfill: only open/future/active operational rows.
-- Historical closed rows remain untouched to avoid unnecessary writes.
with timing as (
  select
    booking.id,
    coalesce(
      nullif(branch_service.custom_duration_minutes, 0),
      nullif(service.duration_minutes, 0),
      60
    ) as duration_minutes,
    greatest(0, coalesce(service.buffer_before, 0)) as buffer_before,
    greatest(0, coalesce(service.buffer_after, 0)) as buffer_after
  from public.bookings as booking
  join public.services as service
    on service.id = booking.service_id
  left join public.branch_services as branch_service
    on branch_service.branch_id = booking.branch_id
   and branch_service.service_id = booking.service_id
   and branch_service.is_active = true
  where booking.status not in ('completed', 'cancelled', 'no_show')
    and (
      booking.session_duration_minutes_snapshot is null
      or booking.session_duration_minutes_snapshot <= 0
      or booking.booking_buffer_before_minutes_snapshot is null
      or booking.booking_buffer_after_minutes_snapshot is null
    )
)
update public.bookings as booking
set
  session_duration_minutes_snapshot = coalesce(
    nullif(booking.session_duration_minutes_snapshot, 0),
    timing.duration_minutes
  ),
  booking_buffer_before_minutes_snapshot = coalesce(
    booking.booking_buffer_before_minutes_snapshot,
    timing.buffer_before
  ),
  booking_buffer_after_minutes_snapshot = coalesce(
    booking.booking_buffer_after_minutes_snapshot,
    timing.buffer_after
  ),
  session_extension_minutes_total = greatest(
    0,
    coalesce(booking.session_extension_minutes_total, 0)
  )
from timing
where booking.id = timing.id;

create or replace function public.resolve_service_session_actor(
  p_actor_staff_id uuid default null
)
returns table (
  actor_staff_id uuid,
  actor_role text,
  actor_branch_id uuid,
  is_service_role boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_claim_role text :=
    coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_claim_role = 'service_role' then
    return query
    select
      case
        when exists (
          select 1
          from public.staff as actor_staff
          where actor_staff.id = p_actor_staff_id
        ) then p_actor_staff_id
        else null::uuid
      end,
      'service_role'::text,
      null::uuid,
      true;
    return;
  end if;

  return query
  select
    staff.id,
    staff.system_role,
    staff.branch_id,
    false
  from public.staff as staff
  where staff.auth_user_id = auth.uid()
    and staff.is_active = true
    and staff.archived_at is null
    and staff.merged_into_staff_id is null
  limit 1;
end;
$$;

create or replace function public.service_session_actor_allowed(
  p_booking_staff_id uuid,
  p_booking_branch_id uuid,
  p_actor_staff_id uuid
)
returns table (
  actor_staff_id uuid,
  allowed boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor record;
begin
  select *
  into v_actor
  from public.resolve_service_session_actor(p_actor_staff_id);

  if not found then
    return query select null::uuid, false;
    return;
  end if;

  return query
  select
    v_actor.actor_staff_id,
    case
      when v_actor.is_service_role then true
      when v_actor.actor_staff_id = p_booking_staff_id then true
      when v_actor.actor_role = 'owner' then true
      when v_actor.actor_role in (
        'manager',
        'assistant_manager',
        'store_manager',
        'crm',
        'csr',
        'csr_head',
        'csr_staff'
      ) and v_actor.actor_branch_id = p_booking_branch_id then true
      else false
    end;
end;
$$;

create or replace function public.start_booking_service_session(
  p_booking_id uuid,
  p_source text default 'staff_portal',
  p_actor_staff_id uuid default null,
  p_resource_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_actor record;
  v_now timestamptz := clock_timestamp();
  v_started_at timestamptz;
  v_due_at timestamptz;
  v_duration integer;
  v_extension integer;
  v_buffer_before integer;
  v_buffer_after integer;
  v_resource_id uuid;
  v_requires_write boolean;
begin
  if p_source not in (
    'crm',
    'staff_portal',
    'room_qr',
    'manager',
    'system_recovery'
  ) then
    raise exception using
      errcode = '22023',
      message = 'SERVICE_SESSION_START_SOURCE_INVALID';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SERVICE_SESSION_BOOKING_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.service_session_actor_allowed(
    v_booking.staff_id,
    v_booking.branch_id,
    p_actor_staff_id
  );

  if not coalesce(v_actor.allowed, false) then
    raise exception using
      errcode = '42501',
      message = 'SERVICE_SESSION_START_NOT_AUTHORIZED';
  end if;

  if v_booking.status in ('completed', 'cancelled', 'no_show')
     or v_booking.booking_progress_status in ('completed', 'no_show')
  then
    raise exception using
      errcode = 'P0001',
      message = 'SERVICE_SESSION_BOOKING_CLOSED';
  end if;

  if p_resource_id is not null
     and v_booking.resource_id is not null
     and v_booking.resource_id is distinct from p_resource_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'SERVICE_SESSION_RESOURCE_CONFLICT';
  end if;

  if p_resource_id is not null
     and not exists (
       select 1
       from public.branch_resources as resource
       where resource.id = p_resource_id
         and resource.branch_id = v_booking.branch_id
         and resource.is_active = true
     )
  then
    raise exception using
      errcode = '23503',
      message = 'SERVICE_SESSION_RESOURCE_INVALID';
  end if;

  select
    coalesce(
      nullif(v_booking.session_duration_minutes_snapshot, 0),
      nullif(branch_service.custom_duration_minutes, 0),
      nullif(service.duration_minutes, 0),
      60
    ),
    coalesce(
      v_booking.booking_buffer_before_minutes_snapshot,
      greatest(0, coalesce(service.buffer_before, 0))
    ),
    coalesce(
      v_booking.booking_buffer_after_minutes_snapshot,
      greatest(0, coalesce(service.buffer_after, 0))
    )
  into
    v_duration,
    v_buffer_before,
    v_buffer_after
  from public.services as service
  left join public.branch_services as branch_service
    on branch_service.branch_id = v_booking.branch_id
   and branch_service.service_id = service.id
   and branch_service.is_active = true
  where service.id = v_booking.service_id
  limit 1;

  v_duration := greatest(1, coalesce(v_duration, 60));
  v_extension := greatest(
    0,
    coalesce(v_booking.session_extension_minutes_total, 0)
  );
  v_started_at := coalesce(v_booking.session_started_at, v_now);
  v_due_at := v_started_at
    + make_interval(mins => v_duration + v_extension);
  v_resource_id := coalesce(v_booking.resource_id, p_resource_id);

  v_requires_write :=
    v_booking.session_started_at is null
    or v_booking.session_due_at is distinct from v_due_at
    or v_booking.session_duration_minutes_snapshot is distinct from v_duration
    or v_booking.booking_buffer_before_minutes_snapshot is distinct from v_buffer_before
    or v_booking.booking_buffer_after_minutes_snapshot is distinct from v_buffer_after
    or v_booking.status is distinct from 'in_progress'
    or v_booking.booking_progress_status is distinct from 'session_started'
    or v_booking.resource_id is distinct from v_resource_id
    or v_booking.session_start_source is null;

  if v_requires_write then
    update public.bookings
    set
      resource_id = v_resource_id,
      status = 'in_progress',
      booking_progress_status = 'session_started',
      session_started_at = v_started_at,
      session_duration_minutes_snapshot = v_duration,
      booking_buffer_before_minutes_snapshot = v_buffer_before,
      booking_buffer_after_minutes_snapshot = v_buffer_after,
      session_extension_minutes_total = v_extension,
      session_due_at = v_due_at,
      session_start_source = coalesce(session_start_source, p_source),
      session_started_by = coalesce(
        session_started_by,
        v_actor.actor_staff_id
      ),
      session_completed_at = null,
      session_auto_completed_at = null,
      session_completion_source = null,
      updated_at = v_now
    where id = p_booking_id;
  end if;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'started_at', v_started_at,
    'due_at', v_due_at,
    'duration_minutes', v_duration,
    'extension_minutes', v_extension,
    'buffer_before_minutes', v_buffer_before,
    'buffer_after_minutes', v_buffer_after,
    'resource_id', v_resource_id,
    'server_now', v_now,
    'already_started', v_booking.session_started_at is not null
  );
end;
$$;

create or replace function public.complete_booking_service_session(
  p_booking_id uuid,
  p_completion_source text default 'staff_manual',
  p_actor_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_actor record;
  v_now timestamptz := clock_timestamp();
begin
  if p_completion_source not in (
    'crm_manual',
    'staff_manual',
    'manager_manual',
    'room_release',
    'recovery'
  ) then
    raise exception using
      errcode = '22023',
      message = 'SERVICE_SESSION_COMPLETION_SOURCE_INVALID';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SERVICE_SESSION_BOOKING_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.service_session_actor_allowed(
    v_booking.staff_id,
    v_booking.branch_id,
    p_actor_staff_id
  );

  if not coalesce(v_actor.allowed, false) then
    raise exception using
      errcode = '42501',
      message = 'SERVICE_SESSION_COMPLETE_NOT_AUTHORIZED';
  end if;

  if v_booking.status in ('cancelled', 'no_show')
     or v_booking.booking_progress_status = 'no_show'
  then
    raise exception using
      errcode = 'P0001',
      message = 'SERVICE_SESSION_BOOKING_CLOSED';
  end if;

  if v_booking.session_completed_at is not null
     or v_booking.status = 'completed'
     or v_booking.booking_progress_status = 'completed'
  then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'started_at', v_booking.session_started_at,
      'completed_at', coalesce(
        v_booking.session_completed_at,
        v_booking.completed_at
      ),
      'actual_duration_seconds',
        case
          when v_booking.session_started_at is null then null
          else greatest(
            0,
            floor(
              extract(
                epoch from (
                  coalesce(
                    v_booking.session_completed_at,
                    v_booking.completed_at,
                    v_now
                  ) - v_booking.session_started_at
                )
              )
            )::bigint
          )
        end,
      'server_now', v_now,
      'already_completed', true
    );
  end if;

  if v_booking.session_started_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'SERVICE_SESSION_NOT_STARTED';
  end if;

  update public.bookings
  set
    status = 'completed',
    booking_progress_status = 'completed',
    session_completed_at = v_now,
    completed_at = coalesce(completed_at, v_now),
    session_completion_source = p_completion_source,
    session_completed_by = v_actor.actor_staff_id,
    session_auto_completed_at = null,
    updated_at = v_now
  where id = p_booking_id;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'started_at', v_booking.session_started_at,
    'completed_at', v_now,
    'actual_duration_seconds',
      greatest(
        0,
        floor(
          extract(epoch from (v_now - v_booking.session_started_at))
        )::bigint
      ),
    'server_now', v_now,
    'already_completed', false
  );
end;
$$;

create or replace function public.extend_booking_service_session(
  p_booking_id uuid,
  p_minutes integer,
  p_reason text,
  p_actor_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_actor record;
  v_now timestamptz := clock_timestamp();
  v_extension_total integer;
  v_due_at timestamptz;
begin
  if p_minutes is null or p_minutes < 1 or p_minutes > 180 then
    raise exception using
      errcode = '22023',
      message = 'SERVICE_SESSION_EXTENSION_MINUTES_INVALID';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'SERVICE_SESSION_EXTENSION_REASON_REQUIRED';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'SERVICE_SESSION_BOOKING_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.service_session_actor_allowed(
    v_booking.staff_id,
    v_booking.branch_id,
    p_actor_staff_id
  );

  if not coalesce(v_actor.allowed, false) then
    raise exception using
      errcode = '42501',
      message = 'SERVICE_SESSION_EXTEND_NOT_AUTHORIZED';
  end if;

  if v_booking.session_started_at is null
     or v_booking.session_completed_at is not null
     or v_booking.status <> 'in_progress'
     or v_booking.booking_progress_status <> 'session_started'
  then
    raise exception using
      errcode = 'P0001',
      message = 'SERVICE_SESSION_NOT_ACTIVE';
  end if;

  v_extension_total :=
    greatest(0, coalesce(v_booking.session_extension_minutes_total, 0))
    + p_minutes;

  if v_extension_total > 720 then
    raise exception using
      errcode = '22023',
      message = 'SERVICE_SESSION_EXTENSION_TOTAL_TOO_LARGE';
  end if;

  v_due_at :=
    v_booking.session_started_at
    + make_interval(
        mins =>
          greatest(
            1,
            coalesce(v_booking.session_duration_minutes_snapshot, 60)
          )
          + v_extension_total
      );

  update public.bookings
  set
    session_extension_minutes_total = v_extension_total,
    session_due_at = v_due_at,
    session_extension_reason = trim(p_reason),
    session_extended_by = v_actor.actor_staff_id,
    session_extended_at = v_now,
    updated_at = v_now
  where id = p_booking_id;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'due_at', v_due_at,
    'extension_minutes', v_extension_total,
    'server_now', v_now
  );
end;
$$;

-- Disable the old per-minute auto-completion architecture.
-- Overtime is now a derived state; completion requires an explicit action.
do $disable_old_cron$
declare
  v_job record;
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    for v_job in
      select jobid
      from cron.job
      where jobname = 'cradlehub-complete-due-service-sessions'
    loop
      perform cron.unschedule(v_job.jobid);
    end loop;
  end if;
end
$disable_old_cron$;

create or replace function public.complete_due_service_sessions(
  p_limit integer default 100
)
returns table (
  booking_id uuid,
  branch_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Intentionally no-op. A due session is overtime, not completed.
  return;
end;
$$;

comment on function public.complete_due_service_sessions(integer) is
  'Deprecated no-op retained for compatibility. Service sessions require explicit completion.';

comment on function public.start_booking_service_session(uuid, text, uuid, uuid) is
  'Starts or repairs a service session with an exact server timestamp and immutable duration snapshot. Idempotent and row locked.';

comment on function public.complete_booking_service_session(uuid, text, uuid) is
  'Completes a service session manually using an exact server timestamp. Idempotent and row locked.';

comment on function public.extend_booking_service_session(uuid, integer, text, uuid) is
  'Extends an active service session and moves session_due_at without changing the booked duration snapshot.';

revoke all on function public.resolve_service_session_actor(uuid)
  from public, anon, authenticated;
revoke all on function public.service_session_actor_allowed(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.start_booking_service_session(uuid, text, uuid, uuid)
  from public, anon;
grant execute on function public.start_booking_service_session(uuid, text, uuid, uuid)
  to authenticated, service_role;

revoke all on function public.complete_booking_service_session(uuid, text, uuid)
  from public, anon;
grant execute on function public.complete_booking_service_session(uuid, text, uuid)
  to authenticated, service_role;

revoke all on function public.extend_booking_service_session(uuid, integer, text, uuid)
  from public, anon;
grant execute on function public.extend_booking_service_session(uuid, integer, text, uuid)
  to authenticated, service_role;

revoke all on function public.complete_due_service_sessions(integer)
  from public, anon, authenticated;
grant execute on function public.complete_due_service_sessions(integer)
  to service_role;

commit;

notify pgrst, 'reload schema';