-- Ensure customized-order confirmation persists the calculated down payment.
-- The browser-supplied p_final_price is intentionally not trusted; the total
-- is calculated from the submitted itemized breakdown inside this function.

create or replace function public.review_custom_order_request_with_pricing(
  p_order_id uuid,
  p_action text,
  p_final_price numeric default null,
  p_rejection_reason text default '',
  p_price_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_final_price numeric(10, 2);
  v_required_down_payment numeric(10, 2);
  v_updated_order_id uuid;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if lower(coalesce(p_action, '')) = 'accept' then
    if jsonb_typeof(p_price_items) <> 'array'
      or jsonb_array_length(p_price_items) = 0 then
      raise exception 'PRICE_BREAKDOWN_REQUIRED';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_price_items) item
      where nullif(trim(item ->> 'description'), '') is null
        or coalesce((item ->> 'amount')::numeric, -1) < 0
    ) then
      raise exception 'INVALID_PRICE_BREAKDOWN';
    end if;

    select round(sum((item ->> 'amount')::numeric), 2)
    into v_final_price
    from jsonb_array_elements(p_price_items) item;

    if v_final_price is null or v_final_price <= 0 then
      raise exception 'FINAL_PRICE_REQUIRED';
    end if;

    v_required_down_payment := round(v_final_price * 0.50, 2);

    if v_final_price > 0
      and v_required_down_payment <> round(v_final_price * 0.50, 2) then
      raise exception 'INVALID_REQUIRED_DOWN_PAYMENT';
    end if;

    delete from public.order_price_breakdown_items
    where order_id = p_order_id;

    insert into public.order_price_breakdown_items(order_id, description, amount, sort_order)
    select
      p_order_id,
      trim(item ->> 'description'),
      round((item ->> 'amount')::numeric, 2),
      coalesce((item ->> 'sort_order')::integer, row_number() over () - 1)
    from jsonb_array_elements(p_price_items) item;

    update public.orders
    set subtotal = v_final_price,
        total = v_final_price,
        required_down_payment = v_required_down_payment,
        order_status = 'confirmed',
        payment_status = 'pending',
        updated_at = now()
    where id = p_order_id
      and order_status = 'pending';

    if not found then
      raise exception 'CUSTOM_ORDER_NOT_PENDING';
    end if;

    update public.order_items
    set unit_price = v_final_price,
        subtotal = v_final_price
    where order_id = p_order_id
      and customization_data ->> 'request_type' = 'custom_cake';

  elsif lower(coalesce(p_action, '')) = 'reject' then
    update public.orders
    set order_status = 'rejected',
        payment_status = 'unpaid',
        required_down_payment = null,
        notes = coalesce(notes, '') ||
          case when nullif(trim(p_rejection_reason), '') is null
            then E'\nCustom cake request rejected.'
            else E'\nCustom cake request rejected: ' || trim(p_rejection_reason)
          end,
        updated_at = now()
    where id = p_order_id
      and order_status = 'pending'
    returning id into v_updated_order_id;

    if v_updated_order_id is null then
      raise exception 'CUSTOM_ORDER_NOT_PENDING';
    end if;

    delete from public.order_price_breakdown_items
    where order_id = p_order_id;
  else
    raise exception 'INVALID_REVIEW_ACTION';
  end if;

  select to_jsonb(o) || jsonb_build_object(
    'order_items', coalesce((
      select jsonb_agg(to_jsonb(oi))
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'price_items', coalesce((
      select jsonb_agg(to_jsonb(pi) order by pi.sort_order)
      from public.order_price_breakdown_items pi
      where pi.order_id = o.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.orders o
  where o.id = p_order_id;

  return v_result;
end;
$$;

grant execute on function public.review_custom_order_request_with_pricing(uuid, text, numeric, text, jsonb)
to authenticated;

-- Repair already-confirmed customized orders that have a saved breakdown but
-- an empty or zero down payment from the previous RPC implementation.
update public.orders o
set subtotal = breakdown.final_price,
    total = breakdown.final_price,
    required_down_payment = round(breakdown.final_price * 0.50, 2),
    updated_at = now()
from (
  select order_id, round(sum(amount), 2) as final_price
  from public.order_price_breakdown_items
  group by order_id
) breakdown
where o.id = breakdown.order_id
  and o.order_status = 'confirmed'
  and coalesce(o.required_down_payment, 0) = 0
  and breakdown.final_price > 0;

notify pgrst, 'reload schema';
