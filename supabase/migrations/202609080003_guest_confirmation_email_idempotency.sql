-- Two-phase idempotency columns for guest order confirmation emails.
--
-- guest_confirmation_email_claimed_at
--   Set atomically by the first webhook that wins the claim race.
--   Cleared back to NULL when:
--     (a) Resend succeeds  → sent_at is written, claimed_at is cleared
--     (b) Resend fails     → claimed_at is cleared so a future retry can claim
--     (c) Process crashes  → stale-claim recovery clears it after the timeout
--   A non-NULL claimed_at with a NULL sent_at means "in-flight or stale".
--
-- guest_confirmation_email_sent_at
--   Written ONLY after Resend successfully accepts the email.
--   Once non-NULL, no further email will ever be sent for this order.
--   claimed_at is set back to NULL at the same time.
--
-- Only guest orders (customer_id IS NULL) ever have these set.
-- Authenticated orders remain NULL and are never targeted.

alter table public.orders
  add column if not exists guest_confirmation_email_claimed_at timestamptz,
  add column if not exists guest_confirmation_email_sent_at    timestamptz;

-- Fast lookup for the atomic claim: only unclaimed, unsent guest orders.
create index if not exists orders_guest_email_claimable_idx
  on public.orders (id)
  where customer_id is null
    and guest_confirmation_email_sent_at is null
    and guest_confirmation_email_claimed_at is null;

-- Fast lookup for stale-claim recovery: claimed but not yet sent.
-- Used to find rows where a process crashed mid-flight.
create index if not exists orders_guest_email_claimed_idx
  on public.orders (guest_confirmation_email_claimed_at)
  where customer_id is null
    and guest_confirmation_email_sent_at is null
    and guest_confirmation_email_claimed_at is not null;
