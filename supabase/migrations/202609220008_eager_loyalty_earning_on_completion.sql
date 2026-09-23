-- Eagerly materialize authenticated loyalty cycles when an order enters
-- completed. The helper is internal: it is not executable by API roles.
create or replace function public.reconcile_customer_loyalty_rewards(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_orders integer;
  v_earned_target integer;
begin
  if p_customer_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text, 0));

  select count(*)::integer into v_completed_orders
  from public.orders
  where customer_id = p_customer_id
    and order_status = 'completed';

  v_earned_target := floor(v_completed_orders / 2.0)::integer;

  insert into public.customer_loyalty_rewards (customer_id, cycle_number, status, earned_at)
  select p_customer_id, required_cycles.cycle_number, 'available', pair_order.created_at
  from generate_series(1, v_earned_target) as required_cycles(cycle_number)
  join lateral (
    select o.created_at
    from public.orders o
    where o.customer_id = p_customer_id
      and o.order_status = 'completed'
    order by o.created_at asc, o.id asc
    offset (required_cycles.cycle_number * 2 - 1)
    limit 1
  ) pair_order on true
  on conflict (customer_id, cycle_number) do nothing;
end;
$$;

revoke all on function public.reconcile_customer_loyalty_rewards(uuid) from public, anon, authenticated;

create or replace function public.issue_loyalty_reward_on_order_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_status = 'completed'
     and old.order_status is distinct from 'completed'
     and new.customer_id is not null then
    perform public.reconcile_customer_loyalty_rewards(new.customer_id);
  end if;
  return new;
end;
$$;

revoke all on function public.issue_loyalty_reward_on_order_completion() from public, anon, authenticated;

drop trigger if exists issue_loyalty_reward_on_order_completion on public.orders;
create trigger issue_loyalty_reward_on_order_completion
after update of order_status on public.orders
for each row
execute function public.issue_loyalty_reward_on_order_completion();

-- Keep the customer read/reconciliation endpoint defensive, while sharing the
-- exact same cycle-targeting helper used by completion-time earning.
create or replace function public.get_customer_loyalty_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_completed_orders integer;
begin
  if v_customer_id is null then
    raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 0));

  select count(*)::integer into v_completed_orders
  from public.orders
  where customer_id = v_customer_id and order_status = 'completed';

  perform public.reconcile_customer_loyalty_rewards(v_customer_id);

  update public.customer_loyalty_rewards r
     set status = 'available', reserved_at = null,
         reservation_expires_at = null, reserved_order_id = null
   where r.customer_id = v_customer_id and r.status = 'reserved'
     and r.reservation_expires_at <= now()
     and not exists (
       select 1 from public.orders o
       where o.id = r.reserved_order_id
         and o.payment_status = 'paid' and o.amount_paid > 0
     );

  return jsonb_build_object(
    'completed_orders', v_completed_orders, 'threshold', 2,
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
