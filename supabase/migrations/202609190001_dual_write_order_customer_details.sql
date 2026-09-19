-- Phase 3: atomically snapshot customer/order details for every new order.
-- Signatures, validation, legacy writes, item writes, and return behavior are preserved.

create or replace function public.create_order_safe(
  p_customer_id uuid, p_first_name text, p_last_name text, p_contact_number text,
  p_email text, p_order_method text, p_province text, p_city_municipality text,
  p_barangay text, p_postal_code text, p_address text, p_apartment_unit text,
  p_landmark text, p_different_recipient boolean, p_recipient_name text,
  p_recipient_contact text, p_preferred_date date, p_preferred_time time without time zone,
  p_subtotal numeric, p_delivery_fee numeric, p_total numeric, p_payment_method text,
  p_notes text, p_items jsonb
)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_order_id uuid; v_order_number text; v_order_sequence text; v_max_orders integer;
  v_lead_time integer; v_service_start time; v_service_end time; v_order_count integer;
  v_item jsonb;
begin
  select minimum_lead_time, maximum_orders_per_day, service_start, service_end
  into v_lead_time, v_max_orders, v_service_start, v_service_end
  from public.availability_settings where id = 1;
  if not found then raise exception 'Availability settings are not configured'; end if;
  if p_preferred_date < current_date then raise exception 'Selected date has already passed'; end if;
  if p_preferred_date < current_date + v_lead_time then raise exception 'Selected date does not meet the minimum lead time'; end if;
  if exists (select 1 from public.blocked_dates where blocked_date = p_preferred_date) then raise exception 'Selected date is unavailable'; end if;
  if p_preferred_time < v_service_start or p_preferred_time > v_service_end then raise exception 'Selected time is outside service hours'; end if;
  perform pg_advisory_xact_lock(hashtext(p_preferred_date::text));
  select count(*) into v_order_count from public.orders
  where preferred_date = p_preferred_date and order_status not in ('cancelled', 'rejected');
  if v_order_count >= v_max_orders then raise exception 'Selected date is fully booked'; end if;
  v_order_sequence := nextval('public.sweetbakes_order_number_seq')::text;
  v_order_number := 'SB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_order_sequence, greatest(4, length(v_order_sequence)), '0');
  insert into public.orders (
    order_number, customer_id, first_name, last_name, contact_number, email, order_method,
    province, city_municipality, barangay, postal_code, address, apartment_unit, landmark,
    different_recipient, recipient_name, recipient_contact, preferred_date, preferred_time,
    subtotal, delivery_fee, total, order_status, payment_status, payment_method, notes
  ) values (
    v_order_number, p_customer_id, p_first_name, p_last_name, p_contact_number, p_email,
    p_order_method, p_province, p_city_municipality, p_barangay, p_postal_code, p_address,
    p_apartment_unit, p_landmark, coalesce(p_different_recipient, false), p_recipient_name,
    p_recipient_contact, p_preferred_date, p_preferred_time, p_subtotal, p_delivery_fee,
    p_total, 'pending', 'unpaid', p_payment_method, p_notes
  ) returning id into v_order_id;
  insert into public.order_customer_details (
    order_id, first_name, last_name, contact_number, email, province, city_municipality,
    barangay, postal_code, address, apartment_unit, landmark, different_recipient,
    recipient_name, recipient_contact
  ) select id, first_name, last_name, contact_number, email, province, city_municipality,
    barangay, postal_code, address, apartment_unit, landmark, different_recipient,
    recipient_name, recipient_contact from public.orders where id = v_order_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, product_id, product_name, product_type, variant_name, quantity, unit_price, subtotal, customization_data)
    values (v_order_id, nullif(v_item->>'product_id', '')::uuid, v_item->>'product_name', v_item->>'product_type', v_item->>'variant_name', coalesce((v_item->>'quantity')::integer, 1), coalesce((v_item->>'unit_price')::numeric, 0), coalesce((v_item->>'subtotal')::numeric, 0), v_item->'customization_data');
  end loop;
  return v_order_id;
end;
$function$;

create or replace function public.create_custom_order_request(
  p_customer_id uuid, p_first_name text, p_last_name text, p_contact_number text, p_email text,
  p_order_method text, p_province text, p_city_municipality text, p_barangay text,
  p_postal_code text, p_address text, p_apartment_unit text, p_landmark text,
  p_different_recipient boolean, p_recipient_name text, p_recipient_contact text,
  p_preferred_date date, p_preferred_time time, p_flavor text, p_size text, p_layers integer,
  p_theme text, p_original_theme text, p_cake_message text, p_special_instructions text,
  p_reference_images jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_order_id uuid; v_order_number text; v_order_row public.orders%rowtype;
  v_minimum_lead_time integer := 5; v_maximum_orders_per_day integer := 2;
  v_service_start time := '09:00'; v_service_end time := '19:00'; v_order_count integer := 0; v_customization jsonb;
begin
  if auth.uid() is null then raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED'; end if;
  if p_customer_id is null or p_customer_id <> auth.uid() then raise exception 'CUSTOMER_ID_MISMATCH'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'customer') then raise exception 'CUSTOMER_REQUIRED'; end if;
  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null or nullif(trim(p_email), '') is null or nullif(trim(p_contact_number), '') is null then raise exception 'CUSTOMER_INFORMATION_REQUIRED'; end if;
  if lower(coalesce(trim(p_order_method), '')) not in ('pickup', 'delivery') then raise exception 'INVALID_ORDER_METHOD'; end if;
  if p_preferred_date is null or p_preferred_date < current_date then raise exception 'DATE_UNAVAILABLE'; end if;
  if p_preferred_time is null then raise exception 'SERVICE_HOURS_FAILURE'; end if;
  select coalesce(minimum_lead_time, v_minimum_lead_time), coalesce(maximum_orders_per_day, v_maximum_orders_per_day), coalesce(service_start, v_service_start), coalesce(service_end, v_service_end)
    into v_minimum_lead_time, v_maximum_orders_per_day, v_service_start, v_service_end from public.availability_settings where id = 1;
  if p_preferred_date < current_date + v_minimum_lead_time then raise exception 'LEAD_TIME_FAILURE'; end if;
  if p_preferred_time < v_service_start or p_preferred_time > v_service_end then raise exception 'SERVICE_HOURS_FAILURE'; end if;
  if exists (select 1 from public.blocked_dates where blocked_date = p_preferred_date) then raise exception 'DATE_UNAVAILABLE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_preferred_date::text, 0));
  select count(*) into v_order_count from public.orders where preferred_date = p_preferred_date and lower(coalesce(order_status, 'pending')) not in ('cancelled', 'canceled', 'rejected', 'declined', 'void', 'refunded');
  if v_order_count >= v_maximum_orders_per_day then raise exception 'FULLY_BOOKED'; end if;
  v_order_number := 'SB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.sweetbakes_order_number_seq')::text, 4, '0');
  v_customization := jsonb_build_object('request_type', 'custom_cake', 'flavor', p_flavor, 'size', p_size, 'layers', p_layers, 'theme', p_theme, 'original_theme', p_original_theme, 'cake_message', p_cake_message, 'special_instructions', p_special_instructions, 'reference_images', coalesce(p_reference_images, '[]'::jsonb));
  insert into public.orders (order_number, customer_id, first_name, last_name, contact_number, email, order_method, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact, preferred_date, preferred_time, subtotal, delivery_fee, total, order_status, payment_status, payment_method, notes)
  values (v_order_number, auth.uid(), nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''), nullif(trim(p_contact_number), ''), lower(nullif(trim(p_email), '')), lower(nullif(trim(p_order_method), '')), case when lower(p_order_method) = 'delivery' then p_province else null end, case when lower(p_order_method) = 'delivery' then p_city_municipality else null end, case when lower(p_order_method) = 'delivery' then p_barangay else null end, case when lower(p_order_method) = 'delivery' then p_postal_code else null end, case when lower(p_order_method) = 'delivery' then p_address else null end, case when lower(p_order_method) = 'delivery' then p_apartment_unit else null end, case when lower(p_order_method) = 'delivery' then p_landmark else null end, case when lower(p_order_method) = 'delivery' then coalesce(p_different_recipient, false) else false end, case when lower(p_order_method) = 'delivery' then p_recipient_name else null end, case when lower(p_order_method) = 'delivery' then p_recipient_contact else null end, p_preferred_date, p_preferred_time, 0, 0, 0, 'pending', 'unpaid', null, 'Custom cake request pending admin quotation.') returning id into v_order_id;
  insert into public.order_customer_details (order_id, first_name, last_name, contact_number, email, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact)
    select id, first_name, last_name, contact_number, email, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact from public.orders where id = v_order_id;
  insert into public.order_items (order_id, product_id, product_name, product_type, variant_name, quantity, unit_price, subtotal, customization_data) values (v_order_id, null, 'Custom Cake', 'cake', null, 1, 0, 0, v_customization);
  select * into v_order_row from public.orders where id = v_order_id; return to_jsonb(v_order_row);
end; $$;

create or replace function public.create_custom_customer_order(
  p_customer_id uuid, p_first_name text, p_last_name text, p_contact_number text, p_email text,
  p_order_method text, p_province text, p_city_municipality text, p_barangay text, p_postal_code text,
  p_address text, p_apartment_unit text, p_landmark text, p_different_recipient boolean,
  p_recipient_name text, p_recipient_contact text, p_preferred_date date, p_preferred_time time,
  p_product_type text, p_product_name text, p_quantity integer, p_customization_data jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_order_id uuid; v_order_number text; v_request_type text; v_item_type text; v_customization jsonb;
begin
  if auth.uid() is null or p_customer_id is null or p_customer_id <> auth.uid() then raise exception 'CUSTOMER_ID_MISMATCH'; end if;
  if p_product_type not in ('cupcake', 'cupcakes', 'custom_cupcake', 'custom_cupcakes', 'custom_party_package') then raise exception 'INVALID_CUSTOM_ORDER_TYPE'; end if;
  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null or nullif(trim(p_email), '') is null or nullif(trim(p_contact_number), '') is null or p_preferred_date is null then raise exception 'CUSTOMER_INFORMATION_REQUIRED'; end if;
  if lower(coalesce(trim(p_order_method), '')) not in ('pickup', 'delivery') then raise exception 'INVALID_ORDER_METHOD'; end if;
  if coalesce(p_quantity, 0) < 1 then raise exception 'INVALID_ORDER_QUANTITY'; end if;
  v_request_type := case when p_product_type in ('cupcake', 'cupcakes', 'custom_cupcake', 'custom_cupcakes') then 'custom_cupcake' else 'custom_party_package' end;
  v_item_type := case when p_product_type in ('cupcake', 'cupcakes', 'custom_cupcake', 'custom_cupcakes') then 'cupcake' else 'party_package' end;
  v_customization := jsonb_set(coalesce(p_customization_data, '{}'::jsonb), '{request_type}', to_jsonb(v_request_type), true);
  v_customization := jsonb_set(v_customization, '{is_custom}', 'true'::jsonb, true);
  v_order_number := 'SB-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.sweetbakes_order_number_seq')::text, 4, '0');
  insert into public.orders (order_number, customer_id, first_name, last_name, contact_number, email, order_method, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact, preferred_date, preferred_time, subtotal, delivery_fee, total, order_status, payment_status, payment_method, notes)
  values (v_order_number, p_customer_id, nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''), nullif(trim(p_contact_number), ''), nullif(trim(p_email), ''), lower(nullif(trim(p_order_method), '')), p_province, p_city_municipality, p_barangay, p_postal_code, p_address, p_apartment_unit, p_landmark, coalesce(p_different_recipient, false), p_recipient_name, p_recipient_contact, p_preferred_date, p_preferred_time, 0, 0, 0, 'pending', 'unpaid', null, 'Custom customer request pending admin quotation.') returning id into v_order_id;
  insert into public.order_customer_details (order_id, first_name, last_name, contact_number, email, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact)
    select id, first_name, last_name, contact_number, email, province, city_municipality, barangay, postal_code, address, apartment_unit, landmark, different_recipient, recipient_name, recipient_contact from public.orders where id = v_order_id;
  insert into public.order_items (order_id, product_id, product_name, product_type, variant_name, quantity, unit_price, subtotal, customization_data) values (v_order_id, null, p_product_name, v_item_type, null, p_quantity, 0, 0, v_customization);
  return (select to_jsonb(orders) from public.orders where id = v_order_id);
end; $$;

revoke execute on function public.create_custom_order_request(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,date,time,text,text,integer,text,text,text,text,jsonb) from anon;
grant execute on function public.create_custom_order_request(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,date,time,text,text,integer,text,text,text,text,jsonb) to authenticated;
revoke execute on function public.create_custom_customer_order(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,date,time,text,text,integer,jsonb) from anon;
grant execute on function public.create_custom_customer_order(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,date,time,text,text,integer,jsonb) to authenticated;
notify pgrst, 'reload schema';
