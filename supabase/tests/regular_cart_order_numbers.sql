-- Run as a database administrator after applying the migration.
-- Each actual RPC call and its order/items are rolled back in a subtransaction.
-- PostgreSQL sequence values are intentionally consumed (never reset).
-- No Xendit endpoints are invoked. Customer UUIDs/emails are not returned.
create or replace function pg_temp.verify_order_numbers()
returns jsonb language plpgsql as $$
declare
  v_customer uuid;
  v_owner uuid;
  v_kind text;
  v_date date;
  v_time time;
  v_id uuid;
  v_row public.orders%rowtype;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_numbers text[] := array[]::text[];
  v_visible integer;
  v_null_before bigint;
  v_count_before bigint;
begin
  select id into strict v_customer from public.profiles where role = 'customer' limit 1;
  select count(*), count(*) filter (where order_number is null)
  into v_count_before, v_null_before from public.orders;

  select d::date, s.service_start into v_date, v_time
  from public.availability_settings s,
    lateral generate_series(current_date + greatest(s.minimum_lead_time, 5) + 1,
                            current_date + greatest(s.minimum_lead_time, 5) + 365,
                            interval '1 day') d
  where s.id = 1
    and not exists (select 1 from public.blocked_dates b where b.blocked_date = d::date)
    and (select count(*) from public.orders o where o.preferred_date = d::date
         and o.order_status not in ('cancelled', 'rejected')) < s.maximum_orders_per_day
  order by d limit 1;
  if v_date is null or v_time is null then raise exception 'No available test date/time'; end if;

  foreach v_kind in array array['regular_customer', 'regular_guest', 'custom_cake', 'custom_cupcake', 'custom_party_package']
  loop
    begin
      v_owner := case when v_kind = 'regular_guest' then null else v_customer end;
      perform set_config('request.jwt.claim.sub', coalesce(v_owner::text, ''), true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role',
        case when v_owner is null then 'anon' else 'authenticated' end)::text, true);
      perform set_config('role', case when v_owner is null then 'anon' else 'authenticated' end, true);

      if v_kind like 'regular_%' then
        v_id := public.create_order_safe(
          p_customer_id => v_owner, p_first_name => 'Numbering', p_last_name => 'Test',
          p_contact_number => '09123456789', p_email => 'numbering-test@example.invalid',
          p_order_method => 'pickup', p_province => null, p_city_municipality => null,
          p_barangay => null, p_postal_code => null, p_address => null,
          p_apartment_unit => null, p_landmark => null, p_different_recipient => false,
          p_recipient_name => null, p_recipient_contact => null,
          p_preferred_date => v_date, p_preferred_time => v_time,
          p_subtotal => 350::numeric, p_delivery_fee => 0::numeric, p_total => 350::numeric,
          p_payment_method => 'Xendit', p_notes => 'Rolled-back order-number verification',
          p_items => '[{"product_name":"Ube","product_type":"sweet_treat","quantity":1,"unit_price":200,"subtotal":200},{"product_name":"Leche Flan","product_type":"sweet_treat","quantity":1,"unit_price":150,"subtotal":150}]'::jsonb);
      elsif v_kind = 'custom_cake' then
        v_result := public.create_custom_order_request(
          p_customer_id => v_owner, p_first_name => 'Numbering', p_last_name => 'Test',
          p_contact_number => '09123456789', p_email => 'numbering-test@example.invalid',
          p_order_method => 'pickup', p_province => null, p_city_municipality => null,
          p_barangay => null, p_postal_code => null, p_address => null,
          p_apartment_unit => null, p_landmark => null, p_different_recipient => false,
          p_recipient_name => null, p_recipient_contact => null,
          p_preferred_date => v_date, p_preferred_time => v_time,
          p_flavor => 'chocolate', p_size => '8', p_layers => 1, p_theme => 'Test',
          p_original_theme => null, p_cake_message => null, p_special_instructions => null,
          p_reference_images => '[]'::jsonb);
        v_id := (v_result->>'id')::uuid;
      else
        v_result := public.create_custom_customer_order(
          p_customer_id => v_owner, p_first_name => 'Numbering', p_last_name => 'Test',
          p_contact_number => '09123456789', p_email => 'numbering-test@example.invalid',
          p_order_method => 'pickup', p_province => null, p_city_municipality => null,
          p_barangay => null, p_postal_code => null, p_address => null,
          p_apartment_unit => null, p_landmark => null, p_different_recipient => false,
          p_recipient_name => null, p_recipient_contact => null,
          p_preferred_date => v_date, p_preferred_time => v_time,
          p_product_type => v_kind,
          p_product_name => case when v_kind = 'custom_cupcake' then 'Custom Cupcakes' else 'Party Package' end,
          p_quantity => 1, p_customization_data => '{}'::jsonb);
        v_id := (v_result->>'id')::uuid;
      end if;

      perform set_config('role', 'none', true);
      select * into strict v_row from public.orders where id = v_id;
      if v_row.customer_id is distinct from v_owner then raise exception 'Wrong owner for %', v_kind; end if;
      if v_row.order_number is null or v_row.order_number !~ '^SB-[0-9]{8}-[0-9]{4,}$' then
        raise exception 'Missing/invalid order number for %', v_kind;
      end if;
      if v_row.order_number = any(v_numbers) then raise exception 'Duplicate order number'; end if;
      v_numbers := array_append(v_numbers, v_row.order_number);

      -- Exercise customer SELECT permissions and the exact My Orders owner filter.
      perform set_config('request.jwt.claim.sub', v_customer::text, true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub',v_customer,'role','authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_visible from public.orders
      where id = v_id and customer_id = auth.uid() and order_number = v_row.order_number;
      if v_visible <> (case when v_owner is null then 0 else 1 end) then
        raise exception 'Wrong My Orders visibility for %', v_kind;
      end if;
      if v_owner is null and exists (select 1 from public.orders where id = v_id) then
        raise exception 'Guest order exposed by customer SELECT policy';
      end if;
      if v_kind = 'regular_customer' and
         (select count(*) from public.order_items i join public.orders o on o.id=i.order_id
          where o.id=v_id and o.order_number=v_row.order_number) <> 2 then
        raise exception 'Regular item grouping failed';
      end if;
      perform set_config('role', 'none', true);
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'flow', v_kind, 'order_number', v_row.order_number, 'ownership_correct', true,
        'customer_visible', v_visible = 1, 'passed', true));
      raise exception using errcode = 'ZB001', message = 'Rollback successful test order';
    exception when sqlstate 'ZB001' then
      null;
    end;
  end loop;

  if (select count(*) from public.orders) <> v_count_before or
     (select count(*) from public.orders where order_number is null) <> v_null_before then
    raise exception 'Historical orders changed or test orders remain';
  end if;
  return jsonb_build_object('tests', v_results, 'historical_orders_unchanged', true,
    'test_orders_rolled_back', true, 'payments_created', false);
end;
$$;

select pg_temp.verify_order_numbers() as verification;
