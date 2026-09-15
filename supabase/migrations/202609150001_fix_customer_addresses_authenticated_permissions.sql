-- Fix customer_addresses authenticated permissions.
-- The original 202608210001_customer_addresses migration created the table,
-- enabled RLS, and added ownership policies, but never GRANTed table
-- privileges to the authenticated role. Without a GRANT, PostgreSQL rejects
-- the query with 42501 "permission denied" before RLS is even evaluated,
-- which surfaced as a 403 Forbidden when the Profile page loads addresses.
--
-- This migration grants only the privileges the Profile feature actually uses
-- (view / add addresses) to authenticated, keeps RLS enabled, grants nothing
-- to anon, and is safe to re-run.

grant select, insert, update, delete
  on table public.customer_addresses
  to authenticated;

-- Explicitly ensure anon has no table privileges on customer addresses.
revoke all
  on table public.customer_addresses
  from anon;