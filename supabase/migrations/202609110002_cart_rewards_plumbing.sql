-- Cart reward plumbing: catalog + secure listing endpoint for the checkout.
-- No cart discount rule exists yet; the catalog is intentionally empty.
-- Publishing a reward is a business decision done by inserting a row here.
-- Applying a discount to an order remains blocked until the payment path
-- (create_order_safe + create-cart-xendit-payment) validates it server-side.
create table if not exists public.cart_rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10, 2) not null default 0,
  discount_percent numeric(5, 2) not null default 0,
  min_completed_orders integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cart_rewards enable row level security;

-- No direct grants: customers reach the catalog only through this function,
-- which returns only the rewards the authenticated customer qualifies for.
create or replace function public.get_available_cart_rewards()
returns setof public.cart_rewards
language sql
security definer
set search_path = public
stable
as $$
  select r.*
  from public.cart_rewards r
  where r.is_active = true
    and r.min_completed_orders <= (
      select count(*)::integer
      from public.orders
      where customer_id = auth.uid()
        and order_status = 'completed'
    );
$$;

revoke all on function public.get_available_cart_rewards() from public;
grant execute on function public.get_available_cart_rewards() to authenticated;

notify pgrst, 'reload schema';