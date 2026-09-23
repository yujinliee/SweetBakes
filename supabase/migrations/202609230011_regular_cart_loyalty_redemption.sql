-- Phase 11: extend the existing customer loyalty lifecycle to authenticated
-- regular-cart payments. The customer_loyalty_rewards ledger remains canonical.

create or replace function public.reserve_customer_loyalty_reward(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid(); v_order record; v_reward record;
  v_completed_orders integer; v_target integer; v_original numeric(10,2);
  v_discount numeric(10,2); v_final numeric(10,2);
  v_is_custom boolean; v_provisional_expiry timestamptz := now() + interval '5 minutes';
begin
  if v_customer_id is null then raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_customer_id::text, 0));
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.customer_id is distinct from v_customer_id then raise exception 'ORDER_NOT_FOUND_OR_NOT_OWNED'; end if;
  v_is_custom := v_order.order_status = 'confirmed' and v_order.payment_status = 'pending';
  if not v_is_custom and not (v_order.order_status = 'pending' and v_order.payment_status in ('unpaid','pending')) then
    raise exception 'ORDER_NOT_ELIGIBLE_FOR_LOYALTY_PAYMENT';
  end if;
  if v_is_custom then
    v_original := round(coalesce(v_order.required_down_payment, 0), 2);
    if v_original <= 0 then raise exception 'INVALID_REQUIRED_DOWN_PAYMENT'; end if;
  else
    if round(coalesce(v_order.subtotal, 0), 2) <= 0 then raise exception 'INVALID_MERCHANDISE_SUBTOTAL'; end if;
    v_original := round(coalesce(v_order.total, 0), 2);
    if v_original <= 0 then raise exception 'INVALID_ORDER_TOTAL'; end if;
  end if;
  select count(*)::integer into v_completed_orders from public.orders where customer_id = v_customer_id and order_status = 'completed';
  v_target := floor(v_completed_orders / 2.0)::integer;
  insert into public.customer_loyalty_rewards (customer_id, cycle_number, status, earned_at)
  select v_customer_id, required_cycles.cycle_number, 'available', pair_order.created_at
  from generate_series(1, v_target) as required_cycles(cycle_number)
  join lateral (select o.created_at from public.orders o where o.customer_id = v_customer_id and o.order_status = 'completed' order by o.created_at asc, o.id asc offset (required_cycles.cycle_number * 2 - 1) limit 1) pair_order on true
  on conflict (customer_id, cycle_number) do nothing;
  update public.customer_loyalty_rewards r set status='available', reserved_at=null, reservation_expires_at=null, reserved_order_id=null, xendit_payment_session_id=null
  where r.customer_id=v_customer_id and r.status='reserved' and r.reservation_expires_at <= now()
    and not exists (select 1 from public.orders o where o.id=r.reserved_order_id and o.payment_status='paid' and o.amount_paid>0);
  select * into v_reward from public.customer_loyalty_rewards r where r.customer_id=v_customer_id and r.reserved_order_id=p_order_id and r.status='reserved' and r.reservation_expires_at>now() for update;
  if not found then
    select * into v_reward from public.customer_loyalty_rewards r where r.customer_id=v_customer_id and r.status='available' order by r.cycle_number asc limit 1 for update skip locked;
    if found then
      update public.customer_loyalty_rewards set status='reserved', reserved_order_id=p_order_id, reserved_at=now(), reservation_expires_at=v_provisional_expiry, xendit_payment_session_id=null where id=v_reward.id returning * into v_reward;
    end if;
  end if;
  if v_reward.id is null then
    update public.orders set payment_amount_due=v_original, loyalty_reward_applied=false, loyalty_discount_percent=0, loyalty_discount_amount=0 where id=p_order_id;
    return jsonb_build_object('order_id',p_order_id,'reward_reserved',false,'reward_id',null,'original_amount',v_original,'original_down_payment',case when v_is_custom then v_original else null end,'discount_percent',0,'discount_amount',0,'final_amount',v_original,'reservation_expires_at',null);
  end if;
  v_discount := round((case when v_is_custom then v_original else coalesce(v_order.subtotal,0) end) * 0.20, 2);
  v_final := round(v_original - v_discount, 2);
  if v_final <= 0 then raise exception 'INVALID_DISCOUNTED_PAYMENT_AMOUNT'; end if;
  update public.orders set payment_amount_due=v_final, loyalty_reward_applied=true, loyalty_discount_percent=20, loyalty_discount_amount=v_discount where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'reward_reserved',true,'reward_id',v_reward.id,'cycle_number',v_reward.cycle_number,'original_amount',v_original,'original_down_payment',case when v_is_custom then v_original else null end,'discount_percent',20,'discount_amount',v_discount,'final_amount',v_final,'reservation_expires_at',v_reward.reservation_expires_at);
end; $$;

create or replace function public.release_customer_loyalty_reservation(p_order_id uuid, p_session_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_count integer; v_order record;
begin
  update public.customer_loyalty_rewards set status='available', reserved_order_id=null, reserved_at=null, reservation_expires_at=null, xendit_payment_session_id=null
  where reserved_order_id=p_order_id and status='reserved' and (p_session_id is null or xendit_payment_session_id=p_session_id);
  get diagnostics v_count=row_count;
  if v_count>0 then
    select * into v_order from public.orders where id=p_order_id;
    update public.orders set payment_amount_due=case when v_order.order_status='confirmed' then required_down_payment else total end, loyalty_reward_applied=false, loyalty_discount_percent=0, loyalty_discount_amount=0 where id=p_order_id and payment_status<>'paid';
  end if;
  return jsonb_build_object('released',v_count>0,'order_id',p_order_id);
end; $$;

create or replace function public.complete_customer_loyalty_payment(p_order_id uuid, p_session_id text, p_amount numeric, p_paid_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order record; v_reward record; v_paid_at timestamptz:=coalesce(p_paid_at,now()); v_amount numeric(10,2):=round(p_amount,2); v_is_custom boolean;
begin
  if p_session_id is null or length(trim(p_session_id))=0 or v_amount<=0 then raise exception 'INVALID_PAYMENT_COMPLETION'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_status='paid' then select * into v_reward from public.customer_loyalty_rewards where used_order_id=p_order_id and status='used' order by used_at asc limit 1; return jsonb_build_object('result','already_processed','order_id',p_order_id,'reward_consumed',v_reward.id is not null); end if;
  v_is_custom := v_order.order_status='confirmed';
  if not ((v_is_custom and v_order.payment_status='pending') or (not v_is_custom and v_order.order_status='pending' and v_order.payment_status in ('unpaid','pending'))) then return jsonb_build_object('result','ignored_order_state','order_id',p_order_id); end if;
  select * into v_reward from public.customer_loyalty_rewards r where r.reserved_order_id=p_order_id and r.status='reserved' for update;
  if found and v_reward.xendit_payment_session_id is distinct from p_session_id then return jsonb_build_object('result','stale_session','order_id',p_order_id,'reward_consumed',false); end if;
  if round(coalesce(v_order.payment_amount_due,case when v_is_custom then v_order.required_down_payment else v_order.total end),2)<>v_amount then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
  update public.orders set payment_status='paid', amount_paid=v_amount, updated_at=now() where id=p_order_id and ((v_is_custom and order_status='confirmed' and payment_status='pending') or (not v_is_custom and order_status='pending' and payment_status in ('unpaid','pending')));
  if found and v_reward.id is not null then update public.customer_loyalty_rewards set status='used', used_order_id=p_order_id, used_at=v_paid_at, reserved_order_id=null, reserved_at=null, reservation_expires_at=null, xendit_payment_session_id=null where id=v_reward.id and status='reserved' and reserved_order_id=p_order_id and xendit_payment_session_id=p_session_id; end if;
  return jsonb_build_object('result','payment_verified','order_id',p_order_id,'reward_consumed',v_reward.id is not null);
end; $$;

revoke all on function public.reserve_customer_loyalty_reward(uuid) from public, anon, authenticated;
grant execute on function public.reserve_customer_loyalty_reward(uuid) to authenticated;
