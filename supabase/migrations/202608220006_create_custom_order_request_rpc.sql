-- Definitive RPC for the authenticated Custom Cake submission flow.
-- Signature intentionally matches src/cakepage/services/customCakeOrderService.js.
create sequence if not exists public.sweetbakes_order_number_seq;

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
  v_order_row public.orders%rowtype;
  v_minimum_lead_time integer := 5;
  v_maximum_orders_per_day integer := 2;
  v_service_start time := '09:00';
  v_service_end time := '19:00';
  v_order_count integer := 0;
  v_customization jsonb;
begin
  if auth.uid() is null then
    raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED';
  end if;

  if p_customer_id is null or p_customer_id <> auth.uid() then
    raise exception 'CUSTOMER_ID_MISMATCH';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer'
  ) then
    raise exception 'CUSTOMER_REQUIRED';
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

  if p_preferred_date is null or p_preferred_date < current_date then
    raise exception 'DATE_UNAVAILABLE';
  end if;

  if p_preferred_time is null then
    raise exception 'SERVICE_HOURS_FAILURE';
  end if;

  select
    coalesce(minimum_lead_time, v_minimum_lead_time),
    coalesce(maximum_orders_per_day, v_maximum_orders_per_day),
    coalesce(service_start, v_service_start),
    coalesce(service_end, v_service_end)
  into v_minimum_lead_time, v_maximum_orders_per_day, v_service_start, v_service_end
  from public.availability_settings
  where id = 1;

  if p_preferred_date < current_date + v_minimum_lead_time then
    raise exception 'LEAD_TIME_FAILURE';
  end if;

  if p_preferred_time < v_service_start or p_preferred_time > v_service_end then
    raise exception 'SERVICE_HOURS_FAILURE';
  end if;

  if exists (
    select 1 from public.blocked_dates where blocked_date = p_preferred_date
  ) then
    raise exception 'DATE_UNAVAILABLE';
  end if;

  -- Serialize capacity checks for the same date so concurrent submissions cannot
  -- both observe the same free slot and create 3 orders for a 2-order date.
  perform pg_advisory_xact_lock(hashtextextended(p_preferred_date::text, 0));

  select count(*)
  into v_order_count
  from public.orders
  where preferred_date = p_preferred_date
    and lower(coalesce(order_status, 'pending')) not in (
      'cancelled', 'canceled', 'rejected', 'declined', 'void', 'refunded'
    );

  if v_order_count >= v_maximum_orders_per_day then
    raise exception 'FULLY_BOOKED';
  end if;

  v_order_number := 'SB-' || to_char(now(), 'YYYYMMDD') || '-' ||
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
    order_number, customer_id, first_name, last_name, contact_number, email,
    order_method, province, city_municipality, barangay, postal_code, address,
    apartment_unit, landmark, different_recipient, recipient_name,
    recipient_contact, preferred_date, preferred_time, subtotal, delivery_fee,
    total, order_status, payment_status, payment_method, notes
  ) values (
    v_order_number, auth.uid(), nullif(trim(p_first_name), ''),
    nullif(trim(p_last_name), ''), nullif(trim(p_contact_number), ''),
    lower(nullif(trim(p_email), '')), lower(nullif(trim(p_order_method), '')),
    case when lower(p_order_method) = 'delivery' then p_province else null end,
    case when lower(p_order_method) = 'delivery' then p_city_municipality else null end,
    case when lower(p_order_method) = 'delivery' then p_barangay else null end,
    case when lower(p_order_method) = 'delivery' then p_postal_code else null end,
    case when lower(p_order_method) = 'delivery' then p_address else null end,
    case when lower(p_order_method) = 'delivery' then p_apartment_unit else null end,
    case when lower(p_order_method) = 'delivery' then p_landmark else null end,
    case when lower(p_order_method) = 'delivery' then coalesce(p_different_recipient, false) else false end,
    case when lower(p_order_method) = 'delivery' then p_recipient_name else null end,
    case when lower(p_order_method) = 'delivery' then p_recipient_contact else null end,
    p_preferred_date, p_preferred_time, 0, 0, 0, 'pending',
    'unpaid', null, 'Custom cake request pending admin quotation.'
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, product_type, variant_name, quantity,
    unit_price, subtotal, customization_data
  ) values (
    v_order_id, null, 'Custom Cake', 'cake', null, 1, 0, 0, v_customization
  );

  select * into v_order_row from public.orders where id = v_order_id;
  return to_jsonb(v_order_row);
end;
$$;

revoke execute on function public.create_custom_order_request(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text,
  boolean, text, text, date, time, text, text, integer, text, text, text, text, jsonb
) from anon;

grant execute on function public.create_custom_order_request(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text,
  boolean, text, text, date, time, text, text, integer, text, text, text, text, jsonb
) to authenticated;

notify pgrst, 'reload schema';
