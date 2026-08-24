create or replace function public.track_customer_order(p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'CUSTOMER_AUTHENTICATION_REQUIRED';
  end if;

  select to_jsonb(o) || jsonb_build_object(
    'order_items', coalesce(
      (select jsonb_agg(to_jsonb(oi))
       from public.order_items oi
       where oi.order_id = o.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.orders o
  where lower(o.order_number) = lower(trim(p_order_number))
    and o.customer_id = auth.uid();

  return v_result;
end;
$$;

revoke execute on function public.track_customer_order(text) from anon;
grant execute on function public.track_customer_order(text) to authenticated;

notify pgrst, 'reload schema';
