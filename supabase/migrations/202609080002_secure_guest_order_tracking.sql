-- Secure, deliberately narrow guest order lookup for the public tracking page.
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
  v_result jsonb;
begin
  select jsonb_build_object(
    'order_number', o.order_number,
    'order_status', o.order_status,
    'payment_status', o.payment_status,
    'order_method', o.order_method,
    'preferred_date', o.preferred_date,
    'preferred_time', o.preferred_time,
    'created_at', o.created_at,
    'total', o.total,
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'variant_name', oi.variant_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'subtotal', oi.subtotal
      ) order by oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.orders o
  where o.customer_id is null
    and lower(trim(o.order_number)) = lower(trim(p_order_number))
    and lower(trim(o.email)) = lower(trim(p_email));

  return v_result;
end;
$$;

revoke all on function public.track_guest_order(text, text) from public;
grant execute on function public.track_guest_order(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
