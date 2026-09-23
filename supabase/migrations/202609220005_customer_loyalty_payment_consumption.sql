-- Phase 6: atomically record a successful custom down payment and consume
-- only the reservation bound to the exact Xendit payment session.

create or replace function public.complete_customer_loyalty_payment(
  p_order_id uuid,
  p_session_id text,
  p_amount numeric,
  p_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_reward record;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_amount numeric(10,2) := round(p_amount, 2);
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 or v_amount <= 0 then
    raise exception 'INVALID_PAYMENT_COMPLETION';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.payment_status = 'paid' then
    select * into v_reward
    from public.customer_loyalty_rewards
    where used_order_id = p_order_id and status = 'used'
    order by used_at asc
    limit 1;
    return jsonb_build_object('result', 'already_processed', 'order_id', p_order_id,
                              'reward_consumed', v_reward.id is not null);
  end if;

  if v_order.order_status <> 'confirmed' or v_order.payment_status <> 'pending' then
    return jsonb_build_object('result', 'ignored_order_state', 'order_id', p_order_id);
  end if;

  select * into v_reward
  from public.customer_loyalty_rewards r
  where r.reserved_order_id = p_order_id and r.status = 'reserved'
  for update;

  if found and v_reward.xendit_payment_session_id is distinct from p_session_id then
    return jsonb_build_object('result', 'stale_session', 'order_id', p_order_id,
                              'reward_consumed', false);
  end if;

  if round(coalesce(v_order.payment_amount_due, v_order.required_down_payment), 2) <> v_amount then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  update public.orders
     set payment_status = 'paid', amount_paid = v_amount, updated_at = now()
   where id = p_order_id and order_status = 'confirmed' and payment_status = 'pending';

  if found and v_reward.id is not null then
    update public.customer_loyalty_rewards
       set status = 'used', used_order_id = p_order_id, used_at = v_paid_at,
           reserved_order_id = null, reserved_at = null,
           reservation_expires_at = null, xendit_payment_session_id = null
     where id = v_reward.id and status = 'reserved'
       and reserved_order_id = p_order_id
       and xendit_payment_session_id = p_session_id;
  end if;

  return jsonb_build_object('result', 'payment_verified', 'order_id', p_order_id,
                            'reward_consumed', v_reward.id is not null);
end;
$$;

revoke all on function public.complete_customer_loyalty_payment(uuid, text, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_customer_loyalty_payment(uuid, text, numeric, timestamptz) to service_role;
