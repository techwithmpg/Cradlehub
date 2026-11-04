-- Review-only proposal. Do not activate a branch policy or schedule this function
-- until priced continuation and independent LOCAL/TEST acceptance have passed.
begin;

create table if not exists public.service_auto_completion_policy (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  enabled boolean not null default false,
  eligible_started_after timestamptz,
  activated_at timestamptz,
  activated_by uuid references public.staff(id) on delete set null,
  check (not enabled or (eligible_started_after is not null and activated_at is not null))
);

-- Physical release latch: a later, reviewed continuation migration must remove
-- this constraint before any branch can be enabled. Setting a flag is not enough.
alter table public.service_auto_completion_policy
  drop constraint if exists service_auto_completion_release_gate;
alter table public.service_auto_completion_policy
  add constraint service_auto_completion_release_gate check (not enabled);

comment on table public.service_auto_completion_policy is
  'Explicit per-branch release fence for service auto completion. No branch is enabled by this migration.';

alter table public.service_auto_completion_policy enable row level security;
revoke all on public.service_auto_completion_policy from public, anon, authenticated;
grant select on public.service_auto_completion_policy to service_role;

create index if not exists bookings_service_auto_due_candidate_idx
  on public.bookings (branch_id, session_due_at, id)
  where status = 'in_progress'
    and booking_progress_status = 'session_started'
    and session_completed_at is null
    and session_started_at is not null;

create or replace function public.complete_due_service_sessions(p_limit integer default 100)
returns table (booking_id uuid, branch_id uuid, completed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $complete_due$
declare
  v_booking public.bookings%rowtype;
  v_completed_at timestamptz;
  v_recipient text;
  v_service text;
  v_body text;
  v_event_id text;
  v_metadata jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'SERVICE_AUTO_COMPLETION_LIMIT_INVALID' using errcode = '22023';
  end if;

  -- Locked rows are rechecked by UPDATE. Manual completion and continuation
  -- use the same booking row lock; retries cannot complete a second time.
  for v_booking in
    select b.*
    from public.bookings b
    join public.service_auto_completion_policy policy
      on policy.branch_id = b.branch_id
     and policy.enabled
     and policy.eligible_started_after is not null
    where b.status = 'in_progress'
      and b.booking_progress_status = 'session_started'
      and b.session_started_at is not null
      and b.session_completed_at is null
      and b.session_due_at > b.session_started_at
      and b.session_due_at + interval '2 minutes' <= clock_timestamp()
      and b.session_started_at >= policy.eligible_started_after
      and b.session_started_at >= policy.activated_at
      and b.delivery_type = 'in_spa'
      -- A canonical parent order is required before any chargeable continuation
      -- can be safely reconciled. Legacy orphan lines require staff review.
      and b.order_id is not null
      and b.resource_id is not null
      and b.session_start_source in ('crm', 'staff_portal', 'room_qr', 'manager')
      and b.booking_date = (b.session_started_at at time zone 'Asia/Manila')::date
    order by b.session_due_at, b.id
    limit p_limit
    for update of b skip locked
  loop
    v_completed_at := clock_timestamp();
    update public.bookings b
    set status = 'completed',
        booking_progress_status = 'completed',
        session_completed_at = v_completed_at,
        completed_at = coalesce(b.completed_at, v_completed_at),
        session_completion_source = 'auto_due',
        session_completed_by = null,
        session_auto_completed_at = v_completed_at,
        updated_at = v_completed_at
    where b.id = v_booking.id
      and b.branch_id = v_booking.branch_id
      and b.status = 'in_progress'
      and b.booking_progress_status = 'session_started'
      and b.session_completed_at is null
      and b.session_due_at + interval '2 minutes' <= v_completed_at;
    if not found then
      continue;
    end if;

    select coalesce(nullif(trim(a.display_name), ''), nullif(trim(c.full_name), ''), 'Guest'),
           coalesce(nullif(trim(s.name), ''), 'Service')
    into v_recipient, v_service
    from public.bookings b
    left join public.booking_attendees a on a.id = b.attendee_id
    left join public.customers c on c.id = b.customer_id
    left join public.services s on s.id = b.service_id
    where b.id = v_booking.id;

    v_body := v_recipient || ' · ' || v_service || ' · ' ||
      to_char(v_completed_at at time zone 'Asia/Manila', 'HH12:MI AM');
    v_event_id := 'service_completed:' || v_booking.id::text || ':' ||
      to_char(v_completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_metadata := jsonb_build_object(
      'service_transition', 'completed',
      'service_transition_event_id', v_event_id,
      'service_transition_at', v_completed_at,
      'service_completion_source', 'auto_due'
    );

    insert into public.workspace_notifications (
      branch_id, target_workspace, type, title, body, entity_type, entity_id,
      action_href, priority, status, requires_action, dedupe_key, metadata
    ) values
      (v_booking.branch_id, 'crm', 'booking_status_changed',
       'Service Completed Automatically', v_body, 'booking', v_booking.id,
       '/crm/bookings', 'normal', 'unread', false,
       v_event_id || ':crm:' || v_booking.branch_id::text, v_metadata),
      (v_booking.branch_id, 'manager', 'booking_status_changed',
       'Service Completed Automatically', v_body, 'booking', v_booking.id,
       '/manager/bookings', 'normal', 'unread', false,
       v_event_id || ':manager:' || v_booking.branch_id::text, v_metadata);

    if v_booking.staff_id is not null then
      insert into public.workspace_notifications (
        branch_id, target_workspace, recipient_staff_id, type, title, body,
        entity_type, entity_id, action_href, priority, status, requires_action,
        dedupe_key, metadata
      ) values (
        v_booking.branch_id, 'staff', v_booking.staff_id,
        'booking_status_changed', 'Service Completed Automatically', v_body,
        'booking', v_booking.id, '/staff-portal/today', 'normal', 'unread', false,
        v_event_id || ':staff:' || v_booking.staff_id::text, v_metadata
      );
    end if;

    booking_id := v_booking.id;
    branch_id := v_booking.branch_id;
    completed_at := v_completed_at;
    return next;
  end loop;
end;
$complete_due$;

comment on function public.complete_due_service_sessions(integer) is
  'Guarded service-role completion at due plus two minutes, with atomic branch and therapist notifications. Disabled until a per-branch release fence is explicitly activated; no Cron is installed here.';

revoke all on function public.complete_due_service_sessions(integer)
  from public, anon, authenticated;
grant execute on function public.complete_due_service_sessions(integer) to service_role;

commit;
