create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  description text not null default '',
  base_price numeric(10, 2) not null default 0 check (base_price >= 0),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_name_unique unique (product_id, name)
);

create table if not exists public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  option_name text not null,
  value text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_values_unique unique (product_id, option_name, value)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

drop trigger if exists set_product_option_values_updated_at on public.product_option_values;
create trigger set_product_option_values_updated_at
  before update on public.product_option_values
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_option_values enable row level security;

drop policy if exists "Customers can view active products" on public.products;
create policy "Customers can view active products"
  on public.products
  for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products
  for delete
  using (public.is_admin());

drop policy if exists "Customers can view active product variants" on public.product_variants;
create policy "Customers can view active product variants"
  on public.product_variants
  for select
  using (
    public.is_admin()
    or (
      is_active = true
      and exists (
        select 1
        from public.products
        where products.id = product_variants.product_id
          and products.is_active = true
      )
    )
  );

drop policy if exists "Admins can insert product variants" on public.product_variants;
create policy "Admins can insert product variants"
  on public.product_variants
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update product variants" on public.product_variants;
create policy "Admins can update product variants"
  on public.product_variants
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete product variants" on public.product_variants;
create policy "Admins can delete product variants"
  on public.product_variants
  for delete
  using (public.is_admin());

drop policy if exists "Customers can view active product option values" on public.product_option_values;
create policy "Customers can view active product option values"
  on public.product_option_values
  for select
  using (
    public.is_admin()
    or (
      is_active = true
      and exists (
        select 1
        from public.products
        where products.id = product_option_values.product_id
          and products.is_active = true
      )
    )
  );

drop policy if exists "Admins can insert product option values" on public.product_option_values;
create policy "Admins can insert product option values"
  on public.product_option_values
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update product option values" on public.product_option_values;
create policy "Admins can update product option values"
  on public.product_option_values
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete product option values" on public.product_option_values;
create policy "Admins can delete product option values"
  on public.product_option_values
  for delete
  using (public.is_admin());

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
  on storage.objects
  for select
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects
  for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects
  for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects
  for delete
  using (bucket_id = 'product-images' and public.is_admin());

insert into public.products (name, slug, category, description, base_price, image_url, is_active, sort_order)
values
  ('Chocolate Cake', 'chocolate-cake', 'regular-cakes', 'Classic chocolate cake made for simple celebrations and everyday cravings.', 650, null, true, 10),
  ('Red Velvet Cake', 'red-velvet-cake', 'regular-cakes', 'A Sweet Bakes red velvet favorite perfect for celebrations and sharing.', 700, null, true, 20),
  ('Cheesecake', 'cheesecake', 'cheesecake', 'Mini cheesecake boxes or one whole cheesecake in Blueberry, Mango, Strawberry, and Oreo.', 850, null, true, 30),
  ('Ube', 'ube', 'ube', 'Soft and fluffy ube chiffon cake with a light, nutty flavor.', 200, null, true, 40),
  ('Graham de Leche', 'graham-de-leche', 'graham-de-leche', 'A sweet Graham de Leche dessert for celebrations or simple cravings.', 180, null, true, 50),
  ('Leche Flan', 'leche-flan', 'leche-flan', 'Silky, golden caramel custard that melts in your mouth.', 120, null, true, 60),
  ('Puto', 'puto', 'puto', 'Soft and fluffy steamed rice cakes, lightly sweet and served warm.', 120, null, true, 70)
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  base_price = excluded.base_price,
  sort_order = excluded.sort_order;

insert into public.product_variants (product_id, name, price, is_active, sort_order)
select products.id, variants.name, variants.price, true, variants.sort_order
from public.products
cross join (
  values
    ('Half Dozen', 300::numeric, 10),
    ('Dozen', 600::numeric, 20),
    ('Large / Whole', 850::numeric, 30)
) as variants(name, price, sort_order)
where products.slug = 'cheesecake'
on conflict (product_id, name) do update
set
  price = excluded.price,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into public.product_option_values (product_id, option_name, value, is_active, sort_order)
select products.id, 'flavor', flavors.value, true, flavors.sort_order
from public.products
cross join (
  values
    ('Blueberry', 10),
    ('Mango', 20),
    ('Strawberry', 30),
    ('Oreo', 40)
) as flavors(value, sort_order)
where products.slug = 'cheesecake'
on conflict (product_id, option_name, value) do update
set
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
