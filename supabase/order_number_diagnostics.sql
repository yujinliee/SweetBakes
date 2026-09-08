-- Read-only live inspection. One result preserves all fields in CLI/API output.
select jsonb_build_object(
 'functions', (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_order_safe')),
 'columns', (select jsonb_agg(to_jsonb(c)) from (select column_name,column_default,is_nullable from information_schema.columns where table_schema='public' and table_name='orders' and column_name in ('order_number','customer_id')) c),
 'triggers', (select jsonb_agg(jsonb_build_object('name',t.tgname,'trigger',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid))) from pg_trigger t where t.tgrelid='public.orders'::regclass and not t.tgisinternal),
 'indexes', (select jsonb_agg(to_jsonb(i)) from (select indexname,indexdef from pg_indexes where schemaname='public' and tablename='orders') i),
 'sequence', (select jsonb_agg(to_jsonb(s)) from (select sequencename,increment_by,cycle,last_value from pg_sequences where schemaname='public' and sequencename='sweetbakes_order_number_seq') s)
) as diagnostics;
