-- Loyalty reward + custom order down payment persistence.
--
-- Canonical amount semantics:
--   required_down_payment       = original required down payment (50% of final price). Never overwritten.
--   payment_amount_due          = authoritative amount the customer owes NOW for the current payment step
--                                 (required_down_payment minus loyalty discount when eligible).
--   loyalty_reward_applied      = true only after the server verifies >= 2 completed orders for auth.uid().
--   loyalty_discount_percent    = 20 (percent applied to required_down_payment).
--   loyalty_discount_amount     = required_down_payment * 20%.
--   amount_paid                 = actual cash received from Xendit (never faked to the full required DP).
-- Remaining balance is derived and never stored: round(total - amount_paid, 2).

alter table public.orders
  add column if not exists amount_paid numeric(10, 2) not null default 0,
  add column if not exists loyalty_reward_applied boolean not null default false,
  add column if not exists loyalty_discount_percent numeric(5, 2) not null default 0,
  add column if not exists loyalty_discount_amount numeric(10, 2) not null default 0,
  add column if not exists payment_amount_due numeric(10, 2);

comment on column public.orders.amount_paid is
  'Actual Xendit amount received for this order. Never inflated beyond real receipts.';
comment on column public.orders.payment_amount_due is
  'Authoritative amount the customer owes in the current payment step after any verified loyalty discount.';

-- Canonical completed-order eligibility for loyalty rewards.
-- auth.uid() -> customer's completed orders -> count.
-- Security definer so RLS on orders does not block the count for logged-in customers.
create or replace function public.get_customer_completed_order_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.orders
  where customer_id = auth.uid()
    and order_status = 'completed';
$$;

revoke all on function public.get_customer_completed_order_count() from public;
grant execute on function public.get_customer_completed_order_count() to authenticated;

notify pgrst, 'reload schema';