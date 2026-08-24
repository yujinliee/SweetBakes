-- Customers may read only breakdown items belonging to their own orders.
drop policy if exists "Customers can view own order price breakdowns" on public.order_price_breakdown_items;
create policy "Customers can view own order price breakdowns"
  on public.order_price_breakdown_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_price_breakdown_items.order_id
        and orders.customer_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
