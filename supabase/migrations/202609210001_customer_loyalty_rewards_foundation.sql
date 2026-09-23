-- Phase 1: additive foundation for the server-authoritative loyalty ledger.
-- This migration intentionally creates no reward rows and changes no runtime
-- earning, reservation, payment, webhook, or frontend behavior.

create table public.customer_loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'available',
  earned_at timestamptz not null default now(),
  reserved_at timestamptz,
  used_at timestamptz,
  reserved_order_id uuid references public.orders(id) on delete set null,
  used_order_id uuid references public.orders(id) on delete set null,
  reservation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_loyalty_rewards_status_check
    check (status in ('available', 'reserved', 'used')),
  constraint customer_loyalty_rewards_reserved_state_check
    check (
      status <> 'reserved'
      or (
        reserved_order_id is not null
        and reserved_at is not null
        and reservation_expires_at is not null
      )
    ),
  constraint customer_loyalty_rewards_used_state_check
    check (
      status <> 'used'
      or (
        used_order_id is not null
        and used_at is not null
      )
    )
);

comment on table public.customer_loyalty_rewards is
  'Server-authoritative lifecycle ledger for earned custom-order down-payment rewards.';

comment on column public.customer_loyalty_rewards.status is
  'Reward lifecycle: available -> reserved -> used.';

create index customer_loyalty_rewards_customer_status_idx
  on public.customer_loyalty_rewards(customer_id, status);

create index customer_loyalty_rewards_customer_created_idx
  on public.customer_loyalty_rewards(customer_id, created_at desc);

create index customer_loyalty_rewards_reserved_order_idx
  on public.customer_loyalty_rewards(reserved_order_id);

create index customer_loyalty_rewards_used_order_idx
  on public.customer_loyalty_rewards(used_order_id);

create unique index customer_loyalty_rewards_one_reserved_order_idx
  on public.customer_loyalty_rewards(reserved_order_id)
  where status = 'reserved';

create or replace function public.set_customer_loyalty_rewards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_loyalty_rewards_updated_at on public.customer_loyalty_rewards;
create trigger set_customer_loyalty_rewards_updated_at
  before update on public.customer_loyalty_rewards
  for each row execute function public.set_customer_loyalty_rewards_updated_at();

alter table public.customer_loyalty_rewards enable row level security;

revoke all on public.customer_loyalty_rewards from public, anon, authenticated;
grant select on public.customer_loyalty_rewards to authenticated;

create policy "Customers can view own loyalty rewards"
  on public.customer_loyalty_rewards
  for select to authenticated
  using (customer_id = (select auth.uid()));
