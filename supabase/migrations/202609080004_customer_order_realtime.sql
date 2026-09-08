-- Private invalidations avoid broadcasting other customers' deleted order IDs.
-- No order data is sent; clients refetch through existing customer order RLS.
begin;

create or replace function public.notify_customer_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP <> 'DELETE' and NEW.customer_id is not null then
    perform realtime.send('{}'::jsonb, 'orders_changed',
      'customer-orders:' || NEW.customer_id::text, true);
  end if;
  if TG_OP = 'DELETE' then
    if OLD.customer_id is not null then
      perform realtime.send('{}'::jsonb, 'orders_changed',
        'customer-orders:' || OLD.customer_id::text, true);
    end if;
  elsif TG_OP = 'UPDATE' then
    if OLD.customer_id is not null and OLD.customer_id is distinct from NEW.customer_id then
      perform realtime.send('{}'::jsonb, 'orders_changed',
        'customer-orders:' || OLD.customer_id::text, true);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.notify_customer_order_change() from public, anon, authenticated;

drop trigger if exists customer_order_realtime on public.orders;
create trigger customer_order_realtime
after insert or update or delete on public.orders
for each row execute function public.notify_customer_order_change();

create policy "Customers receive their own order invalidations"
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() = 'customer-orders:' || (select auth.uid())::text
);

commit;
