create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

drop policy if exists "Customers can view active product categories" on public.product_categories;
create policy "Customers can view active product categories"
  on public.product_categories
  for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can insert product categories" on public.product_categories;
create policy "Admins can insert product categories"
  on public.product_categories
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update product categories" on public.product_categories;
create policy "Admins can update product categories"
  on public.product_categories
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete product categories" on public.product_categories;
create policy "Admins can delete product categories"
  on public.product_categories
  for delete
  using (public.is_admin());

insert into public.product_categories (name, slug, is_active, sort_order)
values
  ('Regular Cakes', 'regular_cake', true, 10),
  ('Cheesecake', 'cheesecake', true, 20),
  ('Ube', 'ube', true, 30),
  ('Graham de Leche', 'graham_de_leche', true, 40),
  ('Leche Flan', 'leche_flan', true, 50),
  ('Puto', 'puto', true, 60)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;
