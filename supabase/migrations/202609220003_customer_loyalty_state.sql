-- Phase 3: server-authoritative loyalty state and idempotent cycle issuance.
-- Issuance is monotonic: existing available, reserved, and used cycles are
-- never deleted or downgraded if the completed-order count later decreases.

create or replace function public.get_customer_loyalty_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_completed_orders integer;
  v_earned_target integer;
begin
  if v_customer_id is null then
    raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED';
  end if;

  -- Serialize issuance and release for this customer only.
  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 0));

  select count(*)::integer
    into v_completed_orders
  from public.orders
  where customer_id = v_customer_id
    and order_status = 'completed';

  v_earned_target := floor(v_completed_orders / 2.0)::integer;

  -- Release only unpaid/unsuccessful expired reservations. A paid order is
  -- intentionally retained as reserved until a later payment-consumption
  -- phase can finalize it safely.
  update public.customer_loyalty_rewards r
     set status = 'available',
         reserved_at = null,
         reservation_expires_at = null,
         reserved_order_id = null
   where r.customer_id = v_customer_id
     and r.status = 'reserved'
     and r.reservation_expires_at <= now()
     and not exists (
       select 1
       from public.orders o
       where o.id = r.reserved_order_id
         and o.payment_status = 'paid'
         and o.amount_paid > 0
     );

  -- The completed-order target, not MAX(cycle_number), is authoritative.
  -- Existing lifecycle rows are preserved by ON CONFLICT DO NOTHING.
  insert into public.customer_loyalty_rewards (
    customer_id,
    cycle_number,
    status,
    earned_at
  )
  select
    v_customer_id,
    cycle_number,
    'available',
    pair_order.created_at
  from generate_series(1, v_earned_target) as required_cycles(cycle_number)
  join lateral (
    select o.created_at
    from public.orders o
    where o.customer_id = v_customer_id
      and o.order_status = 'completed'
    order by o.created_at asc, o.id asc
    offset (required_cycles.cycle_number * 2 - 1)
    limit 1
  ) pair_order on true
  on conflict (customer_id, cycle_number) do nothing;

  return jsonb_build_object(
    'completed_orders', v_completed_orders,
    'threshold', 2,
    'progress', mod(v_completed_orders, 2),
    'earned_rewards', (
      select count(*) from public.customer_loyalty_rewards
      where customer_id = v_customer_id
    ),
    'available_rewards', (
      select count(*) from public.customer_loyalty_rewards
      where customer_id = v_customer_id and status = 'available'
    ),
    'reserved_rewards', (
      select count(*) from public.customer_loyalty_rewards
      where customer_id = v_customer_id and status = 'reserved'
    ),
    'used_rewards', (
      select count(*) from public.customer_loyalty_rewards
      where customer_id = v_customer_id and status = 'used'
    ),
    'discount_percent', 20
  );
end;
$$;

revoke all on function public.get_customer_loyalty_state() from public, anon, authenticated;
grant execute on function public.get_customer_loyalty_state() to authenticated;
