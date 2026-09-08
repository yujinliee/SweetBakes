-- Run against a disposable/staging database AFTER the review migration.
-- Requires two existing orders, two customer profiles and one admin profile.
-- Uses real authenticated roles and RPC calls. All fixture changes roll back.
begin;
create temporary table review_test_fixture as
select
  (select id from public.profiles where role = 'customer' order by id limit 1) as customer,
  (select id from public.profiles where role = 'customer' order by id offset 1 limit 1) as other_customer,
  (select id from public.profiles where role = 'admin' order by id limit 1) as admin,
  (select id from public.orders order by id limit 1) as first_order,
  (select id from public.orders order by id offset 1 limit 1) as second_order;
grant select on review_test_fixture to authenticated, anon;

create function pg_temp.check_review_test(ok boolean, label text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_review_error(command text, expected_code text, label text)
returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate = expected_code then raise notice 'PASS: %', label; return; end if;
    raise;
  end;
  raise exception 'FAIL: % was accepted', label;
end $$;

select pg_temp.check_review_test(customer is not null and other_customer is not null
  and admin is not null and first_order is not null and second_order is not null, 'fixtures available')
from review_test_fixture;
delete from public.order_reviews where order_id in
  (select first_order from review_test_fixture union all select second_order from review_test_fixture);
update public.orders set customer_id = (select customer from review_test_fixture),
  order_status = 'completed', payment_status = 'paid'
where id in (select first_order from review_test_fixture union all select second_order from review_test_fixture);

select set_config('request.jwt.claim.sub', customer::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub', customer, 'role', 'authenticated')::text, true)
from review_test_fixture;
set local role authenticated;

select public.submit_order_review(first_order, 5, E' \tGreat order!\n') from review_test_fixture;
select pg_temp.check_review_test(exists(select 1 from public.order_reviews r, review_test_fixture f
  where r.order_id = f.first_order and r.customer_id = f.customer and r.rating = 5
  and r.comment = 'Great order!'), 'A: valid review, owner inferred, trimmed comment');
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', first_order),
  '23505', 'F: duplicate rejected') from review_test_fixture;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,0,null)', second_order),
  '22023', 'C: rating 0 rejected') from review_test_fixture;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,6,null)', second_order),
  '22023', 'C: rating 6 rejected') from review_test_fixture;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,null,null)', second_order),
  '22023', 'C: missing rating rejected') from review_test_fixture;

reset role;
update public.orders set order_status = 'preparing' where id = (select second_order from review_test_fixture);
set local role authenticated;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', second_order),
  '22023', 'D: incomplete rejected') from review_test_fixture;
reset role;
update public.orders set order_status = 'cancelled' where id = (select second_order from review_test_fixture);
set local role authenticated;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', second_order),
  '22023', 'D: cancelled rejected') from review_test_fixture;
reset role;
update public.orders set order_status = 'completed', payment_status = 'unpaid'
where id = (select second_order from review_test_fixture);
set local role authenticated;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', second_order),
  '22023', 'D: unpaid rejected') from review_test_fixture;
reset role;
update public.orders set payment_status = 'paid' where id = (select second_order from review_test_fixture);
select set_config('request.jwt.claim.sub', other_customer::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub', other_customer, 'role', 'authenticated')::text, true)
from review_test_fixture;
set local role authenticated;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', second_order),
  '42501', 'E: wrong customer rejected') from review_test_fixture;
select pg_temp.check_review_test(not exists(select 1 from public.order_reviews
  where order_id = (select first_order from review_test_fixture)), 'RLS: other customer cannot read review');

reset role;
select set_config('request.jwt.claim.sub', customer::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub', customer, 'role', 'authenticated')::text, true)
from review_test_fixture;
update public.orders set customer_id = null where id = (select second_order from review_test_fixture);
set local role authenticated;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', second_order),
  '42501', 'G: guest order rejected') from review_test_fixture;
reset role;
update public.orders set customer_id = (select customer from review_test_fixture)
where id = (select second_order from review_test_fixture);
set local role authenticated;
select public.submit_order_review(second_order, 4, E' \t\n ') from review_test_fixture;
select pg_temp.check_review_test(exists(select 1 from public.order_reviews
  where order_id = (select second_order from review_test_fixture) and comment is null), 'B: blank comment stored as NULL');
select pg_temp.expect_review_error('update public.order_reviews set rating = 1', '42501', 'RLS: no customer editing');
select pg_temp.expect_review_error('delete from public.order_reviews', '42501', 'RLS: no customer deletion');
select pg_temp.expect_review_error(format('insert into public.order_reviews(order_id,customer_id,rating) values (%L,%L,5)',
  second_order, customer), '42501', 'RLS: no raw customer insert') from review_test_fixture;
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.expect_review_error(format('select public.submit_order_review(%L,5,null)', second_order),
  '42501', 'G: anonymous RPC rejected') from review_test_fixture;
reset role;
select set_config('request.jwt.claim.sub', admin::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub', admin, 'role', 'authenticated')::text, true)
from review_test_fixture;
set local role authenticated;
select pg_temp.check_review_test((select count(*) from public.order_reviews r
  join public.orders o on o.id = r.order_id
  where r.order_id in (select first_order from review_test_fixture union all select second_order from review_test_fixture)) = 2,
  'H: canonical admin can read both reviews and related orders');
reset role;
rollback;
