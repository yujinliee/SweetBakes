create sequence if not exists public.sweetbakes_order_number_seq;

alter table if exists public.orders
  alter column subtotal drop not null,
  alter column delivery_fee drop not null,
  alter column total drop not null;

alter table if exists public.order_items
  alter column unit_price drop not null,
  alter column subtotal drop not null;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_status%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_row.conname);
  end loop;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_status%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_order_status_check
  check (
    order_status in (
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'completed',
      'cancelled',
      'rejected'
    )
  );

alter table public.orders
  add constraint orders_payment_status_check
  check (
    payment_status in (
      'unpaid',
      'pending',
      'partial',
      'paid',
      'failed',
      'refunded'
    )
  );

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
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

create or replace function public.create_custom_order_request(
  p_customer_id uuid,
  p_first_name text,
  p_last_name text,
  p_contact_number text,
  p_email text,
  p_order_method text,
  p_province text,
  p_city_municipality text,
  p_barangay text,
  p_postal_code text,
  p_address text,
  p_apartment_unit text,
  p_landmark text,
  p_different_recipient boolean,
  p_recipient_name text,
  p_recipient_contact text,
  p_preferred_date date,
  p_preferred_time time,
  p_flavor text,
  p_size text,
  p_layers integer,
  p_theme text,
  p_original_theme text,
  p_cake_message text,
  p_special_instructions text,
  p_reference_images jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_order_row orders%rowtype;
  v_minimum_lead_time integer := 5;
  v_maximum_orders_per_day integer := 2;
  v_order_count integer := 0;
  v_customization jsonb;
begin
  if p_customer_id is not null and (auth.uid() is null or p_customer_id <> auth.uid()) then
    raise exception 'CUSTOMER_ID_MISMATCH';
  end if;

  if p_preferred_date is null then
    raise exception 'DATE_UNAVAILABLE';
  end if;

  if nullif(trim(p_first_name), '') is null
    or nullif(trim(p_last_name), '') is null
    or nullif(trim(p_email), '') is null
    or nullif(trim(p_contact_number), '') is null then
    raise exception 'CUSTOMER_INFORMATION_REQUIRED';
  end if;

  if lower(coalesce(trim(p_order_method), '')) not in ('pickup', 'delivery') then
    raise exception 'INVALID_ORDER_METHOD';
  end if;

  select
    coalesce(minimum_lead_time, 5),
    least(coalesce(maximum_orders_per_day, 2), 2)
  into v_minimum_lead_time, v_maximum_orders_per_day
  from public.availability_settings
  where id = 1;

  if p_preferred_date < current_date + v_minimum_lead_time then
    raise exception 'LEAD_TIME_FAILURE';
  end if;

  if not exists (
    select 1
    from public.availability_settings
    where id = 1
      and p_preferred_time >= service_start
      and p_preferred_time <= service_end
  ) then
    raise exception 'SERVICE_HOURS_FAILURE';
  end if;

  if exists (
    select 1
    from public.blocked_dates
    where blocked_date = p_preferred_date
  ) then
    raise exception 'DATE_UNAVAILABLE';
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where preferred_date = p_preferred_date
    and lower(coalesce(order_status, 'pending')) not in (
      'cancelled',
      'canceled',
      'rejected',
      'declined',
      'void',
      'refunded'
    );

  if v_order_count >= v_maximum_orders_per_day then
    raise exception 'FULLY_BOOKED';
  end if;

  v_order_number := 'SB-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    lpad(nextval('public.sweetbakes_order_number_seq')::text, 4, '0');

  v_customization := jsonb_build_object(
    'request_type', 'custom_cake',
    'flavor', p_flavor,
    'size', p_size,
    'layers', p_layers,
    'theme', p_theme,
    'original_theme', p_original_theme,
    'cake_message', p_cake_message,
    'special_instructions', p_special_instructions,
    'reference_images', coalesce(p_reference_images, '[]'::jsonb)
  );

  insert into public.orders (
    order_number,
    customer_id,
    first_name,
    last_name,
    contact_number,
    email,
    order_method,
    province,
    city_municipality,
    barangay,
    postal_code,
    address,
    apartment_unit,
    landmark,
    different_recipient,
    recipient_name,
    recipient_contact,
    preferred_date,
    preferred_time,
    subtotal,
    delivery_fee,
    total,
    order_status,
    payment_status,
    payment_method,
    notes
  )
  values (
    v_order_number,
    p_customer_id,
    nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''),
    nullif(trim(p_contact_number), ''),
    nullif(trim(p_email), ''),
    lower(nullif(trim(p_order_method), '')),
    p_province,
    p_city_municipality,
    p_barangay,
    p_postal_code,
    p_address,
    p_apartment_unit,
    p_landmark,
    coalesce(p_different_recipient, false),
    p_recipient_name,
    p_recipient_contact,
    p_preferred_date,
    p_preferred_time,
    0,
    0,
    0,
    'pending',
    'unpaid',
    null,
    'Custom cake request pending admin quotation.'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_type,
    variant_name,
    quantity,
    unit_price,
    subtotal,
    customization_data
  )
  values (
    v_order_id,
    null,
    'Custom Cake',
    'cake',
    null,
    1,
    0,
    0,
    v_customization
  );

  select *
  into v_order_row
  from public.orders
  where id = v_order_id;

  return to_jsonb(v_order_row);
end;
$$;

create or replace function public.review_custom_order_request(
  p_order_id uuid,
  p_action text,
  p_final_price numeric default null,
  p_rejection_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if lower(coalesce(p_action, '')) = 'accept' then
    if p_final_price is null or p_final_price <= 0 then
      raise exception 'FINAL_PRICE_REQUIRED';
    end if;

    update public.orders
    set
      subtotal = p_final_price,
      delivery_fee = coalesce(delivery_fee, 0),
      total = p_final_price + coalesce(delivery_fee, 0),
      order_status = 'confirmed',
      payment_status = 'pending',
      notes = coalesce(notes, '') || E'\nCustom cake request accepted. Awaiting downpayment.',
      updated_at = now()
    where id = p_order_id
      and order_status = 'pending';

    update public.order_items
    set
      unit_price = p_final_price,
      subtotal = p_final_price
    where order_id = p_order_id
      and customization_data ->> 'request_type' = 'custom_cake';
  elsif lower(coalesce(p_action, '')) = 'reject' then
    update public.orders
    set
      order_status = 'rejected',
      payment_status = 'unpaid',
      notes = coalesce(notes, '') ||
        case
          when nullif(trim(p_rejection_reason), '') is null then E'\nCustom cake request rejected.'
          else E'\nCustom cake request rejected: ' || trim(p_rejection_reason)
        end,
      updated_at = now()
    where id = p_order_id
      and order_status = 'pending';
  else
    raise exception 'INVALID_REVIEW_ACTION';
  end if;

  select to_jsonb(o) || jsonb_build_object(
    'order_items',
    coalesce(
      (
        select jsonb_agg(to_jsonb(oi))
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.orders o
  where o.id = p_order_id;

  return v_result;
end;
$$;

grant execute on function public.create_custom_order_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  date,
  time,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;

grant execute on function public.review_custom_order_request(uuid, text, numeric, text)
to authenticated;

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
