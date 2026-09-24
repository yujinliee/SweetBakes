-- One-time incident recovery primitive for SB-20260924-0067.
-- Provider identity and amount are fixed in the server-side recovery function.
create or replace function public.recover_order_0067_payment_a()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_reward record;
begin
  select * into v_order
    from public.orders
   where order_number = 'SB-20260924-0067'
     and id = 'd76f2c26-4f88-4c01-9a1f-bbab6c1ea173'::uuid
   for update;
  if not found then return jsonb_build_object('result', 'conflict', 'reason', 'ORDER_NOT_FOUND'); end if;

  if v_order.payment_status = 'paid' then
    select * into v_reward from public.customer_loyalty_rewards
     where id = '49dcbb9e-27a2-41b5-86ee-1c3abb59b2ec'::uuid;
    if v_order.amount_paid = 144 and v_reward.status = 'used'
       and v_reward.used_order_id = v_order.id
       and v_reward.xendit_payment_session_id = 'ps-6ab4bc8d7d8203d8fc085ee0' then
      return jsonb_build_object('result', 'already_recovered', 'order_number', v_order.order_number);
    end if;
    return jsonb_build_object('result', 'conflict', 'reason', 'ORDER_ALREADY_PAID_DIFFERENT_STATE');
  end if;

  if v_order.payment_status <> 'unpaid' or v_order.order_status <> 'pending'
     or round(coalesce(v_order.total, 0), 2) <> 180
     or v_order.customer_id is null then
    return jsonb_build_object('result', 'conflict', 'reason', 'ORDER_STATE_CHANGED');
  end if;

  select * into v_reward from public.customer_loyalty_rewards
   where id = '49dcbb9e-27a2-41b5-86ee-1c3abb59b2ec'::uuid
   for update;
  if not found or v_reward.customer_id is distinct from v_order.customer_id
     or v_reward.status <> 'available'
     or v_reward.reserved_order_id is not null
     or v_reward.used_order_id is not null
     or v_reward.xendit_payment_session_id is not null then
    return jsonb_build_object('result', 'conflict', 'reason', 'REWARD_STATE_CHANGED');
  end if;

  update public.orders
     set loyalty_reward_applied = true,
         loyalty_discount_percent = 20,
         loyalty_discount_amount = 36,
         payment_amount_due = 144,
         payment_status = 'paid',
         amount_paid = 144,
         updated_at = now()
   where id = v_order.id;

  update public.customer_loyalty_rewards
     set status = 'used',
         used_order_id = v_order.id,
         used_at = now(),
         xendit_payment_session_id = 'ps-6ab4bc8d7d8203d8fc085ee0'
   where id = v_reward.id and status = 'available';

  if not found then
    raise exception 'RECOVERY_REWARD_UPDATE_FAILED';
  end if;
  return jsonb_build_object('result', 'recovered', 'order_number', v_order.order_number, 'amount_paid', 144);
end;
$$;

revoke all on function public.recover_order_0067_payment() from public, anon, authenticated;
grant execute on function public.recover_order_0067_payment() to service_role;
