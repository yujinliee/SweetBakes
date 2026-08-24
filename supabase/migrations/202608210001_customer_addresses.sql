create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  province text not null,
  city_municipality text not null,
  barangay text not null,
  postal_code text not null,
  address text not null,
  apartment_unit text,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_id_idx
  on public.customer_addresses(user_id);

alter table public.customer_addresses enable row level security;

drop policy if exists "Customers can view own addresses" on public.customer_addresses;
create policy "Customers can view own addresses"
  on public.customer_addresses
  for select
  using (auth.uid() = user_id);

drop policy if exists "Customers can insert own addresses" on public.customer_addresses;
create policy "Customers can insert own addresses"
  on public.customer_addresses
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Customers can update own addresses" on public.customer_addresses;
create policy "Customers can update own addresses"
  on public.customer_addresses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers can delete own addresses" on public.customer_addresses;
create policy "Customers can delete own addresses"
  on public.customer_addresses
  for delete
  using (auth.uid() = user_id);
