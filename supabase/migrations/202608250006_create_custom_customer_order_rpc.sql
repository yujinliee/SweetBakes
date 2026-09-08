create or replace function public.create_custom_customer_order(
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
  p_product_type text,
  p_product_name text,
  p_quantity integer,
  p_customization_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_request_type text;
  v_item_type text;
  v_customization jsonb;
begin
  if auth.uid() is null or p_customer_id is null or p_customer_id <> auth.uid() then
    raise exception 'CUSTOMER_ID_MISMATCH';
  end if;

  if p_product_type not in ('custom_cupcake', 'custom_party_package') then
    raise exception 'INVALID_CUSTOM_ORDER_TYPE';
  end if;

  if nullif(trim(p_first_name), '') is null
    or nullif(trim(p_last_name), '') is null
    or nullif(trim(p_email), '') is null
    or nullif(trim(p_contact_number), '') is null
    or p_preferred_date is null then
    raise exception 'CUSTOMER_INFORMATION_REQUIRED';
  end if;

  if lower(coalesce(trim(p_order_method), '')) not in ('pickup', 'delivery') then
    raise exception 'INVALID_ORDER_METHOD';
  end if;

  if coalesce(p_quantity, 0) < 1 then
    raise exception 'INVALID_ORDER_QUANTITY';
  end if;

  v_request_type := p_product_type;
  v_item_type := case
    when p_product_type = 'custom_cupcake' then 'cupcake'
    else 'party_package'
  end;
  v_customization := jsonb_set(
    coalesce(p_customization_data, '{}'::jsonb),
    '{request_type}',
    to_jsonb(v_request_type),
    true
  );
  v_customization := jsonb_set(v_customization, '{is_custom}', 'true'::jsonb, true);

  v_order_number := 'SB-' ||
    to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.sweetbakes_order_number_seq')::text, 4, '0');

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
    'Custom customer request pending admin quotation.'
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
    p_product_name,
    v_item_type,
    null,
    p_quantity,
    0,
    0,
    v_customization
  );

  return (select to_jsonb(orders) from public.orders where id = v_order_id);
end;
$$;

revoke execute on function public.create_custom_customer_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, boolean, text, text, date, time, text, text, integer, jsonb
) from anon;

grant execute on function public.create_custom_customer_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, boolean, text, text, date, time, text, text, integer, jsonb
) to authenticated;
