begin;

create table public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_reviews_one_per_order unique (order_id)
);
create index order_reviews_customer_id_idx on public.order_reviews(customer_id);
create index order_reviews_created_at_idx on public.order_reviews(created_at desc);

alter table public.order_reviews enable row level security;
revoke all on public.order_reviews from public, anon, authenticated;
grant select on public.order_reviews to authenticated;
create policy "Customers read own order reviews" on public.order_reviews
  for select to authenticated using (customer_id = (select auth.uid()));
create policy "Admins read order reviews" on public.order_reviews
  for select to authenticated using (public.is_admin());
-- No direct INSERT/UPDATE/DELETE grants or policies: submission is RPC-only.

create function public.submit_order_review(p_order_id uuid, p_rating integer, p_comment text default null)
returns public.order_reviews
language plpgsql security definer set search_path = public
as $$
declare
  v_customer uuid := auth.uid();
  v_order public.orders%rowtype;
  v_review public.order_reviews%rowtype;
begin
  if v_customer is null or not exists (
    select 1 from public.profiles where id = v_customer and role = 'customer'
  ) then
    raise exception 'Please sign in as a customer to review an order.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Choose a rating between 1 and 5.' using errcode = '22023';
  end if;
  -- Lock against concurrent status/ownership changes and simultaneous submissions.
  select * into v_order from public.orders
    where id = p_order_id and customer_id = v_customer for update;
  if not found then
    raise exception 'This order is not available for you to review.' using errcode = '42501';
  end if;
  if v_order.order_status is distinct from 'completed'
     or v_order.payment_status is distinct from 'paid' then
    raise exception 'Only completed, paid orders can be reviewed.' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_reviews where order_id = p_order_id) then
    raise exception 'You have already reviewed this order.' using errcode = '23505';
  end if;
  insert into public.order_reviews(order_id, customer_id, rating, comment)
    values (p_order_id, v_customer, p_rating,
      nullif(regexp_replace(p_comment, '^\s+|\s+$', '', 'g'), ''))
    returning * into v_review;
  return v_review;
end;
$$;
revoke all on function public.submit_order_review(uuid, integer, text) from public, anon;
grant execute on function public.submit_order_review(uuid, integer, text) to authenticated;

commit;
