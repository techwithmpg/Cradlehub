\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'service_lifecycle_group_integration'
    or inet_server_addr() is distinct from '127.0.0.1'::inet
    or inet_server_port() is distinct from 55434 then
    raise exception 'LOCAL integration target guard failed';
  end if;
end $$;
-- Disposable LOCAL cross-branch denial, using synthetic identities only.
select b.id as booking_id from public.bookings b
  join public.booking_orders o on o.id=b.order_id
  where o.idempotency_key='lifecycle-group-local-20261104'
  order by b.line_sequence,b.id limit 1 \gset
select set_config('request.test.booking_id', :'booking_id', false);
insert into public.branches(id) values ('33333333-3333-4333-8333-333333333333');
update public.staff set branch_id='33333333-3333-4333-8333-333333333333',
  system_role='crm', auth_user_id='33333333-3333-4333-8333-333333333334'
  where id='00000000-0000-4000-8000-000000000099';
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333334',false);
set role authenticated;
do $$ declare v_error text; begin
  begin
    perform public.continue_booking_service_session(
      current_setting('request.test.booking_id')::uuid,30,'Cross-branch attempt',
      '33333333-3333-4333-8333-333333333335');
    raise exception 'Cross-branch actor was allowed';
  exception when insufficient_privilege then
    get stacked diagnostics v_error=message_text;
    if v_error <> 'SERVICE_CONTINUATION_NOT_AUTHORIZED' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.service_continuation_events
    where idempotency_key='33333333-3333-4333-8333-333333333335') then
    raise exception 'Denied continuation left an event';
  end if;
end $$;

