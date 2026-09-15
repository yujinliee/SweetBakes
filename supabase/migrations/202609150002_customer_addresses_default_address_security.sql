-- Enforce a single default address per customer and route the "set default"
-- action through a security-definer RPC so it stays atomic and cannot be
-- abused to flip other customers' rows.

-- RPC: atomically makes p_address_id the customer's default, clearing any
-- other default they had. Owned-row check prevents cross-user changes.
create or replace function public.set_default_customer_address(p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  if p_address_id is null then
    raise exception 'p_address_id is required.';
  end if;

  if not exists (
    select 1
    from public.customer_addresses
    where id = p_address_id
      and user_id = v_user_id
  ) then
    raise exception 'Address not found.';
  end if;

  update public.customer_addresses
  set is_default = (id = p_address_id),
      updated_at = now()
  where user_id = v_user_id;
end;
$$;

revoke all on function public.set_default_customer_address(uuid) from public;
revoke all on function public.set_default_customer_address(uuid) from anon;
grant execute on function public.set_default_customer_address(uuid) to authenticated;

-- Collapse any pre-existing multiple defaults (keep the most recently updated).
with ranked_defaults as (
  select id,
         row_number() over (
           partition by user_id
           order by updated_at desc, created_at desc
         ) as rn
  from public.customer_addresses
  where is_default
)
update public.customer_addresses as ca
set is_default = false
from ranked_defaults as rd
where ca.id = rd.id
  and rd.rn > 1;

-- Prevent multiple rows flagged default for the same customer.
create unique index if not exists customer_addresses_one_default_per_user
  on public.customer_addresses (user_id)
  where is_default;

-- The client must not flip is_default (or change ownership) directly; the
-- default switch goes through set_default_customer_address, and ownership is
-- fixed at insert time under RLS. Use column-level UPDATE grants so
-- authenticated keeps editing only the address fields.
revoke update on table public.customer_addresses from authenticated;
grant update (
  province,
  city_municipality,
  barangay,
  postal_code,
  address,
  apartment_unit,
  landmark,
  updated_at
) on table public.customer_addresses to authenticated;