insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'custom-order-references',
  'custom-order-references',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public can read custom order references" on storage.objects;
drop policy if exists "Customers can upload custom order references" on storage.objects;
drop policy if exists "Admins can read custom order references" on storage.objects;

create policy "Customers can upload custom order references"
on storage.objects
for insert
with check (
  bucket_id = 'custom-order-references'
  and lower((storage.foldername(name))[1]) not in ('..', '.')
);

create policy "Admins can read custom order references"
on storage.objects
for select
using (
  bucket_id = 'custom-order-references'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
);

create or replace function public.track_guest_order(
  p_order_number text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_result jsonb;
begin
  if nullif(trim(p_order_number), '') is null or nullif(trim(p_email), '') is null then
    return null;
  end if;

  select id
  into v_order_id
  from public.orders
  where lower(order_number) = lower(trim(p_order_number))
    and lower(email) = lower(trim(p_email))
  limit 1;

  if v_order_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'first_name', o.first_name,
    'last_name', o.last_name,
    'email', o.email,
    'contact_number', o.contact_number,
    'order_method', o.order_method,
    'province', o.province,
    'city_municipality', o.city_municipality,
    'barangay', o.barangay,
    'postal_code', o.postal_code,
    'address', o.address,
    'apartment_unit', o.apartment_unit,
    'landmark', o.landmark,
    'different_recipient', o.different_recipient,
    'recipient_name', o.recipient_name,
    'recipient_contact', o.recipient_contact,
    'preferred_date', o.preferred_date,
    'preferred_time', o.preferred_time,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'order_items',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', oi.id,
              'order_id', oi.order_id,
              'product_name', oi.product_name,
              'product_type', oi.product_type,
              'variant_name', oi.variant_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'subtotal', oi.subtotal,
              'customization_data', oi.customization_data
            )
          )
          from public.order_items oi
          where oi.order_id = o.id
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from public.orders o
  where o.id = v_order_id;

  return v_result;
end;
$$;

grant execute on function public.track_guest_order(text, text)
to anon, authenticated;
