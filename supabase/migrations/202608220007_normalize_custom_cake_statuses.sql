-- Align custom-cake review and status constraints with the live orders schema.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%order_status%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_row.conname);
  end loop;
  for constraint_row in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_status%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.orders add constraint orders_order_status_check check (
  order_status in ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'rejected')
);

alter table public.orders add constraint orders_payment_status_check check (
  payment_status in ('unpaid', 'pending', 'partial', 'paid', 'failed', 'refunded')
);

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
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if lower(coalesce(p_action, '')) = 'accept' then
    if p_final_price is null or p_final_price <= 0 then
      raise exception 'FINAL_PRICE_REQUIRED';
    end if;

    update public.orders
    set subtotal = p_final_price,
        delivery_fee = coalesce(delivery_fee, 0),
        total = p_final_price + coalesce(delivery_fee, 0),
        order_status = 'confirmed',
        payment_status = 'pending',
        notes = coalesce(notes, '') || E'\nCustom cake quotation confirmed. Awaiting payment.',
        updated_at = now()
    where id = p_order_id and order_status = 'pending';

    update public.order_items
    set unit_price = p_final_price,
        subtotal = p_final_price
    where order_id = p_order_id
      and customization_data ->> 'request_type' = 'custom_cake';
  elsif lower(coalesce(p_action, '')) = 'reject' then
    update public.orders
    set order_status = 'rejected',
        payment_status = 'unpaid',
        notes = coalesce(notes, '') ||
          case when nullif(trim(p_rejection_reason), '') is null
            then E'\nCustom cake request rejected.'
            else E'\nCustom cake request rejected: ' || trim(p_rejection_reason)
          end,
        updated_at = now()
    where id = p_order_id and order_status = 'pending';
  else
    raise exception 'INVALID_REVIEW_ACTION';
  end if;

  select to_jsonb(o) || jsonb_build_object(
    'order_items', coalesce(
      (select jsonb_agg(to_jsonb(oi)) from public.order_items oi where oi.order_id = o.id),
      '[]'::jsonb
    )
  ) into v_result
  from public.orders o where o.id = p_order_id;

  return v_result;
end;
$$;

grant execute on function public.review_custom_order_request(uuid, text, numeric, text)
to authenticated;

notify pgrst, 'reload schema';
