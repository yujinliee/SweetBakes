-- Read-only admin support contract. This deliberately does not call the
-- customer reconciliation RPC and never inserts or updates ledger rows.
create or replace function public.get_admin_customer_loyalty_state(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_orders integer;
begin
  if auth.uid() is null then
    raise exception 'ADMIN_AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  select count(*)::integer into v_completed_orders
  from public.orders
  where customer_id = p_customer_id
    and order_status = 'completed';

  return jsonb_build_object(
    'customer_id', p_customer_id,
    'completed_orders', v_completed_orders,
    'threshold', 2,
    'progress', mod(v_completed_orders, 2),
    'earned_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = p_customer_id),
    'available_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = p_customer_id and status = 'available'),
    'reserved_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = p_customer_id and status = 'reserved'),
    'used_rewards', (select count(*) from public.customer_loyalty_rewards where customer_id = p_customer_id and status = 'used'),
    'discount_percent', 20,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cycle_number', r.cycle_number,
        'status', r.status,
        'earned_at', r.earned_at,
        'reserved_at', r.reserved_at,
        'used_at', r.used_at,
        'related_order_number', coalesce(used_order.order_number, reserved_order.order_number)
      ) order by r.cycle_number asc)
      from public.customer_loyalty_rewards r
      left join public.orders used_order on used_order.id = r.used_order_id
      left join public.orders reserved_order on reserved_order.id = r.reserved_order_id
      where r.customer_id = p_customer_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_customer_loyalty_state(uuid) from public, anon, authenticated;
grant execute on function public.get_admin_customer_loyalty_state(uuid) to authenticated;
