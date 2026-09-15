-- Add an optional contact phone number to saved customer addresses.
-- text (not numeric) so leading zeroes, '+' and formatting are preserved.
alter table public.customer_addresses
  add column if not exists phone_number text;

comment on column public.customer_addresses.phone_number
  is 'Optional contact number for this address destination. Nullable for legacy rows.';

-- Extend the column-level UPDATE grant introduced in 202609150002 so that
-- authenticated customers can set phone_number on their own addresses while
-- is_default and user_id remain immutable client-side.
grant update (phone_number) on table public.customer_addresses to authenticated;