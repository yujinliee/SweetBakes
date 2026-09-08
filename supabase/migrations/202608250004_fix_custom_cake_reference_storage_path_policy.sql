-- Custom Cake references are stored under drafts/<customer>/<draft>/...
-- Keep the bucket private and scope access to the authenticated owner.
drop policy if exists "Customers can upload custom order references" on storage.objects;
create policy "Customers can upload custom order references"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'custom-order-references'
  and name ~ '^drafts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3][.](jpg|png|webp)$'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "Customers can read own draft references" on storage.objects;
create policy "Customers can read own draft references"
on storage.objects
for select to authenticated
using (
  bucket_id = 'custom-order-references'
  and name ~ '^drafts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3][.](jpg|png|webp)$'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "Customers can delete own draft references" on storage.objects;
create policy "Customers can delete own draft references"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'custom-order-references'
  and name ~ '^drafts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3][.](jpg|png|webp)$'
  and split_part(name, '/', 2) = auth.uid()::text
);
