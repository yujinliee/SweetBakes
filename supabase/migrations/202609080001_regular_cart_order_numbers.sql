-- The deployed regular-cart RPC omitted order_number. Keep its signature,
-- ownership argument, availability checks, and item insertion unchanged.
-- Reuse the sequence used by the custom-order RPCs; do not backfill old rows.
CREATE OR REPLACE FUNCTION public.create_order_safe(
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
  p_preferred_time time without time zone,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order_id uuid;
  v_order_number text;
  v_order_sequence text;
  v_max_orders integer;
  v_lead_time integer;
  v_service_start time;
  v_service_end time;
  v_order_count integer;
  v_item jsonb;
begin
  -- Get global availability settings
  select minimum_lead_time, maximum_orders_per_day, service_start, service_end
  into v_lead_time, v_max_orders, v_service_start, v_service_end
  from public.availability_settings
  where id = 1;

  if not found then
    raise exception 'Availability settings are not configured';
  end if;

  if p_preferred_date < current_date then
    raise exception 'Selected date has already passed';
  end if;

  if p_preferred_date < current_date + v_lead_time then
    raise exception 'Selected date does not meet the minimum lead time';
  end if;

  if exists (select 1 from public.blocked_dates where blocked_date = p_preferred_date) then
    raise exception 'Selected date is unavailable';
  end if;

  if p_preferred_time < v_service_start or p_preferred_time > v_service_end then
    raise exception 'Selected time is outside service hours';
  end if;

  -- Keep the existing capacity lock.
  perform pg_advisory_xact_lock(hashtext(p_preferred_date::text));

  select count(*) into v_order_count
  from public.orders
  where preferred_date = p_preferred_date
    and order_status not in ('cancelled', 'rejected');

  if v_order_count >= v_max_orders then
    raise exception 'Selected date is fully booked';
  end if;

  -- nextval is shared with custom orders and safe across concurrent checkouts.
  -- Pad to at least four digits without truncating the sequence after 9999.
  v_order_sequence := nextval('public.sweetbakes_order_number_seq')::text;
  v_order_number := 'SB-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(v_order_sequence, greatest(4, length(v_order_sequence)), '0');

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
    p_first_name,
    p_last_name,
    p_contact_number,
    p_email,
    p_order_method,
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
    p_subtotal,
    p_delivery_fee,
    p_total,
    'pending',
    'unpaid',
    p_payment_method,
    p_notes
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, product_name, product_type, variant_name,
      quantity, unit_price, subtotal, customization_data
    )
    values (
      v_order_id,
      nullif(v_item->>'product_id', '')::uuid,
      v_item->>'product_name',
      v_item->>'product_type',
      v_item->>'variant_name',
      coalesce((v_item->>'quantity')::integer, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'subtotal')::numeric, 0),
      v_item->'customization_data'
    );
  end loop;

  return v_order_id;
end;
$function$;
