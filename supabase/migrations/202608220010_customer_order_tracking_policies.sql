-- Allow authenticated customers to read only their own orders for Track My Order.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Customers can read their own orders" on public.orders;
create policy "Customers can read their own orders"
on public.orders
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders"
on public.orders
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Customers can read items from their own orders" on public.order_items;
create policy "Customers can read items from their own orders"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where public.orders.id = order_items.order_id
      and public.orders.customer_id = auth.uid()
  )
);

drop policy if exists "Admins can read order items" on public.order_items;
create policy "Admins can read order items"
on public.order_items
for select
to authenticated
using (public.is_admin());

notify pgrst, 'reload schema';
