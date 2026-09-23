-- Phase 2: deterministic historical loyalty reward backfill.
-- Qualifying earning orders are authenticated orders with order_status
-- = 'completed'. Guests never earn rewards.
--
-- earned_at is reconstructed from the second, fourth, sixth, ... qualifying
-- order in chronological order. used_at is also reconstructed from the
-- historical rewarded order's created_at because orders has no dedicated
-- payment-success timestamp; it is not an exact payment-success time.

with qualifying_orders as (
  select
    o.customer_id,
    o.created_at,
    o.id,
    row_number() over (
      partition by o.customer_id
      order by o.created_at asc, o.id asc
    ) as order_sequence
  from public.orders o
  where o.customer_id is not null
    and o.order_status = 'completed'
),
customer_targets as (
  select
    qo.customer_id,
    floor(count(*) / 2)::integer as earned_target
  from qualifying_orders qo
  group by qo.customer_id
  having floor(count(*) / 2) > 0
),
cycles as (
  select
    ct.customer_id,
    cycle_number,
    qo.created_at as earned_at
  from customer_targets ct
  cross join lateral generate_series(1, ct.earned_target) as cycle_number
  join qualifying_orders qo
    on qo.customer_id = ct.customer_id
   and qo.order_sequence = cycle_number * 2
),
successful_historical_uses as (
  select
    o.customer_id,
    o.id as used_order_id,
    o.created_at as used_at,
    row_number() over (
      partition by o.customer_id
      order by o.created_at asc, o.id asc
    ) as use_sequence
  from public.orders o
  where o.customer_id is not null
    and o.loyalty_reward_applied is true
    and o.payment_status = 'paid'
    and o.amount_paid > 0
    and o.loyalty_discount_percent = 20
    and round(o.loyalty_discount_amount, 2) = round(o.required_down_payment * 0.20, 2)
    and round(o.payment_amount_due, 2) = round(o.required_down_payment - o.loyalty_discount_amount, 2)
),
backfill_rows as (
  select
    c.customer_id,
    c.cycle_number,
    c.earned_at,
    case when u.used_order_id is null then 'available' else 'used' end as status,
    u.used_order_id,
    u.used_at
  from cycles c
  left join successful_historical_uses u
    on u.customer_id = c.customer_id
   and u.use_sequence = c.cycle_number
)
insert into public.customer_loyalty_rewards (
  customer_id,
  cycle_number,
  status,
  earned_at,
  used_at,
  used_order_id
)
select
  customer_id,
  cycle_number,
  status,
  earned_at,
  used_at,
  used_order_id
from backfill_rows
on conflict (customer_id, cycle_number) do nothing;
