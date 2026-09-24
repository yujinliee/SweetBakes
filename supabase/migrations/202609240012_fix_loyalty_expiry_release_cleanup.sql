-- Corrective fix: route customer-state expiry cleanup through the canonical
-- session-bound release helper so reward and unpaid-order snapshots reconcile
-- atomically. Custom down payments continue to restore required_down_payment;
-- regular orders restore their persisted total.

create or replace function public.get_customer_loyalty_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_completed_orders integer;
  v_expired record;
begin
  if v_customer_id is null then
    raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 0));

  select count(*)::integer into v_completed_orders
  from public.orders
  where customer_id = v_customer_id and order_status = 'completed';

  perform public.reconcile_customer_loyalty_rewards(v_customer_id);

  for v_expired in
    select r.reserved_order_id, r.xendit_payment_session_id
    from public.customer_loyalty_rewards r
    where r.customer_id = v_customer_id
      and r.status = 'reserved'
      and r.reservation_expires_at <= now()
      and not exists (
        select 1 from public.orders o
        where o.id = r.reserved_order_id
          and o.payment_status = 'paid'
          and o.amount_paid > 0
      )
    for update
  loop
    perform public.release_customer_loyalty_reservation(
      v_expired.reserved_order_id,
      v_expired.xendit_payment_session_id
    );
  end loop;

  return jsonb_build_object(
    'completed_orders', v_completed_orders,
    'threshold', 2,
    'progress', mod(v_completed_orders, 2),
    'earned_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = v_customer_id),
    'available_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = v_customer_id and status = 'available'),
    'reserved_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = v_customer_id and status = 'reserved'),
    'used_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = v_customer_id and status = 'used'),
    'discount_percent', 20
  );
end;
$$;

revoke all on function public.get_customer_loyalty_state() from public, anon, authenticated;
grant execute on function public.get_customer_loyalty_state() to authenticated;
