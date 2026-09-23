-- Phase 7: preserve exact-session identity across same-order retries and
-- clear it whenever Phase 3 fallback cleanup releases a reservation.

create or replace function public.get_customer_loyalty_reservation(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_reward record;
begin
  if v_customer_id is null then
    raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED';
  end if;
  select r.* into v_reward
  from public.customer_loyalty_rewards r
  where r.customer_id = v_customer_id
    and r.reserved_order_id = p_order_id
    and r.status = 'reserved'
    and r.reservation_expires_at > now()
  for update;
  if not found then
    return jsonb_build_object('reserved', false, 'order_id', p_order_id);
  end if;
  return jsonb_build_object(
    'reserved', true,
    'reward_id', v_reward.id,
    'cycle_number', v_reward.cycle_number,
    'session_id', v_reward.xendit_payment_session_id,
    'reservation_expires_at', v_reward.reservation_expires_at
  );
end;
$$;

revoke all on function public.get_customer_loyalty_reservation(uuid) from public, anon, authenticated;
grant execute on function public.get_customer_loyalty_reservation(uuid) to authenticated;
