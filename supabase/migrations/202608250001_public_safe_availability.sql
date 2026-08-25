-- Public storefront availability must not depend on customer RLS.
-- Return only settings, blocked dates, and aggregate order counts. Never expose
-- rows or personal fields from public.orders to anon/authenticated callers.
create or replace function public.get_public_availability(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  minimum_lead_time integer,
  maximum_orders_per_day integer,
  service_start time,
  service_end time,
  blocked_dates jsonb,
  order_counts jsonb
)
language sql
security definer
set search_path = public
as $$
  with active_order_counts as (
    select
      o.preferred_date::text as date_value,
      count(*)::integer as order_count
    from public.orders o
    where o.preferred_date is not null
      and (p_start_date is null or o.preferred_date >= p_start_date)
      and (p_end_date is null or o.preferred_date <= p_end_date)
      and lower(coalesce(o.order_status, 'pending')) not in (
        'cancelled', 'canceled', 'rejected', 'declined', 'void', 'refunded'
      )
    group by o.preferred_date
  ),
  blocked_date_values as (
    select
      b.blocked_date::text as date_value,
      jsonb_build_object(
        'reason', coalesce(b.reason, 'Closed manually by admin')
      ) as block_rule
    from public.blocked_dates b
    where (p_start_date is null or b.blocked_date >= p_start_date)
      and (p_end_date is null or b.blocked_date <= p_end_date)
  )
  select
    coalesce(a.minimum_lead_time, 5),
    least(coalesce(a.maximum_orders_per_day, 2), 2),
    coalesce(a.service_start, '09:00'::time),
    coalesce(a.service_end, '19:00'::time),
    coalesce((
      select jsonb_object_agg(date_value, block_rule)
      from blocked_date_values
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(date_value, order_count)
      from active_order_counts
    ), '{}'::jsonb)
  from public.availability_settings a
  where a.id = 1;
$$;

revoke all on function public.get_public_availability(date, date) from public;
grant execute on function public.get_public_availability(date, date) to anon, authenticated;

notify pgrst, 'reload schema';
