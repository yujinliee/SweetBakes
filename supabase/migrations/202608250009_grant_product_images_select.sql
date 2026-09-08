alter table public.product_images enable row level security;

grant select on table public.product_images to anon, authenticated;

drop policy if exists "Public can read active product images" on public.product_images;
create policy "Public can read active product images"
on public.product_images
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.products
    where products.id = product_images.product_id
      and products.is_active = true
  )
);
