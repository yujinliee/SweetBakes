alter table public.orders
  add column if not exists xendit_payment_session_id text;

create index if not exists orders_xendit_payment_session_idx
  on public.orders(xendit_payment_session_id)
  where xendit_payment_session_id is not null;
