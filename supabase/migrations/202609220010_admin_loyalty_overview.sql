create or replace function public.get_admin_loyalty_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'ADMIN_AUTHENTICATION_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'ADMIN_AUTHORIZATION_REQUIRED';
  end if;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'total_rewards', (select count(*) from public.customer_loyalty_rewards),
      'available_rewards', (select count(*) from public.customer_loyalty_rewards where status = 'available'),
      'reserved_rewards', (select count(*) from public.customer_loyalty_rewards where status = 'reserved'),
      'used_rewards', (select count(*) from public.customer_loyalty_rewards where status = 'used')
    ),
    'customers', coalesce((
      select jsonb_agg(row_data order by lower(coalesce(row_data->>'last_name', '') || ' ' || coalesce(row_data->>'first_name', '')), row_data->>'email')
      from (
        select jsonb_build_object(
          'customer_id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'email', p.email,
          'completed_orders', (select count(*) from public.orders o where o.customer_id = p.id and o.order_status = 'completed'),
          'threshold', 2,
          'progress', mod((select count(*) from public.orders o where o.customer_id = p.id and o.order_status = 'completed'), 2),
          'total_rewards', (select count(*) from public.customer_loyalty_rewards r where r.customer_id = p.id),
          'available_rewards', (select count(*) from public.customer_loyalty_rewards r where r.customer_id = p.id and r.status = 'available'),
          'reserved_rewards', (select count(*) from public.customer_loyalty_rewards r where r.customer_id = p.id and r.status = 'reserved'),
          'used_rewards', (select count(*) from public.customer_loyalty_rewards r where r.customer_id = p.id and r.status = 'used')
        ) as row_data
        from public.profiles p
        where p.role = 'customer'
          and (exists (select 1 from public.orders o where o.customer_id = p.id and o.order_status = 'completed')
            or exists (select 1 from public.customer_loyalty_rewards r where r.customer_id = p.id))
      ) rows
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_loyalty_overview() from public, anon, authenticated;
grant execute on function public.get_admin_loyalty_overview() to authenticated;
