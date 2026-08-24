-- Custom cake requests are customer-owned; normal guest cart/order flows are unchanged.
revoke execute on function public.create_custom_order_request(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text,
  boolean, text, text, date, time, text, text, integer, text, text, text, text, jsonb
) from anon;

drop policy if exists "Customers can upload custom order references" on storage.objects;
create policy "Customers can upload custom order references"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'custom-order-references'
  and split_part(name, '/', 1) = auth.uid()::text
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3]\.(jpg|png|webp)$'
);

create or replace function public.require_customer_custom_cake_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  if lower(coalesce(new.product_name, '')) = 'custom cake'
     or coalesce(new.customization_data ->> 'request_type', '') = 'custom_cake' then
    select customer_id into v_customer_id from public.orders where id = new.order_id;
    if auth.uid() is null or v_customer_id is null or v_customer_id <> auth.uid()
       or not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then
      raise exception 'CUSTOMER_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists require_customer_custom_cake_order on public.order_items;
create trigger require_customer_custom_cake_order
before insert on public.order_items
for each row execute function public.require_customer_custom_cake_order();

notify pgrst, 'reload schema';
