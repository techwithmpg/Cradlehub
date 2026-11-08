-- Forward-only install. Safe by default: NO branch enabled and NO scheduler.
-- Never replay old local/review-only migrations to activate this workflow.
begin;

create table if not exists public.service_auto_completion_policy (
  branch_id uuid primary key references public.branches(id) on delete restrict,
  enabled boolean not null default false,
  eligible_started_after timestamptz,
  activated_at timestamptz,
  activated_by uuid references public.staff(id) on delete set null,
  check (not enabled or (eligible_started_after is not null and activated_at is not null
    and eligible_started_after >= activated_at))
);
alter table public.service_auto_completion_policy enable row level security;
revoke all on public.service_auto_completion_policy from public, anon, authenticated;
grant select on public.service_auto_completion_policy to service_role;

-- Physical release gate; separate acceptance/activation required.
alter table public.service_auto_completion_policy
  add constraint service_auto_completion_release_gate check (not enabled);

create index if not exists bookings_future_auto_due_idx on public.bookings
  (branch_id, session_due_at, id)
  where status='in_progress' and booking_progress_status='session_started'
    and session_started_at is not null and session_completed_at is null;

create or replace function public.complete_due_service_sessions(p_limit integer default 100)
returns table (booking_id uuid, branch_id uuid, completed_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $auto$
declare
  v_booking public.bookings%rowtype;
  v_now timestamptz;
  v_recipient text;
  v_service text;
  v_room text;
  v_event_id text;
  v_body text;
  v_metadata jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'SERVICE_AUTO_COMPLETION_LIMIT_INVALID' using errcode='22023';
  end if;
  -- The server-owned due timestamp is authoritative; a browser countdown is not.
  -- Activation fence excludes existing overdue sessions by their start timestamp.
  for v_booking in
    select b.* from public.bookings b
    join public.service_auto_completion_policy policy
      on policy.branch_id=b.branch_id and policy.enabled=true
      and policy.eligible_started_after is not null and policy.activated_at is not null
    where b.status='in_progress'
      and b.booking_progress_status='session_started'
      and b.session_started_at is not null and b.session_completed_at is null
      and b.session_due_at > b.session_started_at
      and b.session_due_at <= clock_timestamp()
      and b.session_started_at >= policy.eligible_started_after
      and b.session_started_at >= policy.activated_at
      and b.delivery_type='in_spa'
      and b.order_id is not null and b.resource_id is not null and b.staff_id is not null
      and b.session_start_source in ('crm','staff_portal','room_qr','manager')
      and b.booking_date=(b.session_started_at at time zone 'Asia/Manila')::date
      and b.session_duration_minutes_snapshot is not null
      and b.session_duration_minutes_snapshot > 0
      and coalesce(b.session_extension_minutes_total,0) >= 0
      and b.session_due_at = b.session_started_at + make_interval(mins =>
        b.session_duration_minutes_snapshot + coalesce(b.session_extension_minutes_total,0))
      and exists (select 1 from public.branch_resources r where r.id=b.resource_id
        and r.branch_id=b.branch_id and r.is_active)
      and exists (select 1 from public.booking_orders o where o.id=b.order_id
        and o.branch_id=b.branch_id)
    order by b.session_due_at,b.id limit p_limit for update of b skip locked
  loop
    v_now := clock_timestamp();
    update public.bookings set
      status='completed', booking_progress_status='completed',
      session_completed_at=v_now, completed_at=coalesce(completed_at,v_now),
      session_auto_completed_at=v_now, session_completion_source='auto_due',
      session_completed_by=null, updated_at=v_now
    where id=v_booking.id and branch_id=v_booking.branch_id
      and status='in_progress' and booking_progress_status='session_started'
      and session_completed_at is null and session_due_at<=v_now;
    if not found then continue; end if;

    select coalesce(nullif(btrim(a.display_name),''),nullif(btrim(c.full_name),''),'Guest'),
      coalesce(nullif(btrim(s.name),''),'Service'),coalesce(nullif(btrim(r.name),''),'Room')
    into v_recipient,v_service,v_room
    from public.bookings b
    left join public.booking_attendees a on a.id=b.attendee_id
    left join public.customers c on c.id=b.customer_id
    left join public.services s on s.id=b.service_id
    left join public.branch_resources r on r.id=b.resource_id
    where b.id=v_booking.id;

    -- Preserve utility workflow. Active task unique key prevents duplicate work;
    -- historical completed tasks remain untouched and in-progress tasks stay active.
    insert into public.workflow_tasks(
      branch_id,workspace_scope,assigned_to_role,task_type,title,body,
      entity_type,entity_id,action_href,priority,status,dedupe_key,metadata)
    values(v_booking.branch_id,'utility','utility','room_turnover',
      'Turnover: '||v_room, v_service||' completed. Room requires turnover cleaning.',
      'branch_resource',v_booking.resource_id,null,'normal','open',
      'room_turnover:'||v_booking.branch_id::text||':'||v_booking.resource_id::text,
      jsonb_build_object('booking_id',v_booking.id,'resource_id',v_booking.resource_id,
        'room_name',v_room,'service_id',v_booking.service_id,'service_name',v_service,
        'completed_at',v_now,'triggered_by_staff_id',null))
    on conflict do nothing;

    v_event_id := 'service_completed:'||v_booking.id::text||':'||
      to_char(v_now at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_metadata := jsonb_build_object(
      'service_transition','completed','service_transition_event_id',v_event_id,
      'service_transition_at',v_now,'service_completion_source','auto_due');
    v_body := v_recipient||' - '||v_service||' - '||
      to_char(v_now at time zone 'Asia/Manila','HH12:MI AM');

    -- Same transaction as canonical status update, so CRM sees only a true completion.
    insert into public.workspace_notifications(
      branch_id,target_workspace,type,title,body,entity_type,entity_id,
      action_href,priority,status,requires_action,dedupe_key,metadata)
    values
      (v_booking.branch_id,'crm','booking_status_changed',
       'Service Completed Automatically',v_body,'booking',v_booking.id,
       '/crm/bookings','normal','unread',false,
       v_event_id||':crm:'||v_booking.branch_id::text,v_metadata),
      (v_booking.branch_id,'manager','booking_status_changed',
       'Service Completed Automatically',v_body,'booking',v_booking.id,
       '/manager/bookings','normal','unread',false,
       v_event_id||':manager:'||v_booking.branch_id::text,v_metadata)
    on conflict do nothing;

    insert into public.workspace_notifications(
      branch_id,target_workspace,recipient_staff_id,type,title,body,
      entity_type,entity_id,action_href,priority,status,requires_action,
      dedupe_key,metadata)
    values(v_booking.branch_id,'staff',v_booking.staff_id,
      'booking_status_changed','Service Completed Automatically',v_body,
      'booking',v_booking.id,'/staff-portal/today','normal','unread',false,
      v_event_id||':staff:'||v_booking.staff_id::text,v_metadata)
    on conflict do nothing;

    booking_id := v_booking.id; branch_id := v_booking.branch_id;
    completed_at := v_now; return next;
  end loop;
end
$auto$;

revoke all on function public.complete_due_service_sessions(integer)
  from public, anon, authenticated;
grant execute on function public.complete_due_service_sessions(integer) to service_role;
comment on function public.complete_due_service_sessions(integer) is
  'Guarded due-service auto completion. Inactive until separate reviewed branch activation and pg_cron setup.';
commit;
