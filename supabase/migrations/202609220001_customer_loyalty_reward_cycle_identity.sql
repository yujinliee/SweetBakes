-- Phase 1.1: deterministic customer-scoped loyalty reward cycle identity.
-- Future issuance must target cycles 1..floor(completed_orders / 2) and must
-- not derive the next cycle from MAX(cycle_number) + 1 alone.

alter table public.customer_loyalty_rewards
  add column cycle_number integer not null;

alter table public.customer_loyalty_rewards
  add constraint customer_loyalty_rewards_cycle_number_check
  check (cycle_number >= 1);

alter table public.customer_loyalty_rewards
  add constraint customer_loyalty_rewards_customer_cycle_unique
  unique (customer_id, cycle_number);
