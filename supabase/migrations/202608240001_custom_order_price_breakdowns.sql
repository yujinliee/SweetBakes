-- Admin-only, itemized quotations for customized orders.
alter table if exists public.orders
  add column if not exists required_down_payment numeric(10, 2);

create table if not exists public.order_price_breakdown_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  description text not null check (char_length(trim(description)) > 0),
  amount numeric(10, 2) not null check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_price_breakdown_items_order_id_idx
  on public.order_price_breakdown_items(order_id, sort_order);

alter table public.order_price_breakdown_items enable row level security;

drop policy if exists "Admins can view order price breakdowns" on public.order_price_breakdown_items;
create policy "Admins can view order price breakdowns"
  on public.order_price_breakdown_items for select
  using (public.is_admin());

drop policy if exists "Admins can manage order price breakdowns" on public.order_price_breakdown_items;
create policy "Admins can manage order price breakdowns"
  on public.order_price_breakdown_items for all
  using (public.is_admin())
  with check (public.is_admin());

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

    select sum((item ->> 'amount')::numeric)
    into v_final_price
    from jsonb_array_elements(p_price_items) item;

    if v_final_price <= 0 then
      raise exception 'FINAL_PRICE_REQUIRED';
    end if;

    perform public.review_custom_order_request(
      p_order_id,
      p_action,
      v_final_price,
      p_rejection_reason
    );

    delete from public.order_price_breakdown_items
    where order_id = p_order_id;

    insert into public.order_price_breakdown_items(order_id, description, amount, sort_order)
    select
      p_order_id,
      trim(item ->> 'description'),
      (item ->> 'amount')::numeric,
      coalesce((item ->> 'sort_order')::integer, row_number() over () - 1)
    from jsonb_array_elements(p_price_items) item;

    update public.orders
    set required_down_payment = round(v_final_price * 0.5, 2),
        updated_at = now()
    where id = p_order_id;
  elsif lower(coalesce(p_action, '')) = 'reject' then
    perform public.review_custom_order_request(
      p_order_id,
      p_action,
      null,
      p_rejection_reason
    );

    delete from public.order_price_breakdown_items
    where order_id = p_order_id;

    update public.orders
    set required_down_payment = null,
        updated_at = now()
    where id = p_order_id;
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

notify pgrst, 'reload schema';
