do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'custom-order-references'
  ) then
    raise exception 'Required storage bucket custom-order-references does not exist';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'custom-order-references'
      and public = true
  ) then
    raise exception 'Storage bucket custom-order-references must remain private';
  end if;
end $$;

drop policy if exists "Customers can upload custom order references" on storage.objects;
create policy "Customers can upload custom order references"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'custom-order-references'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Customers can read own draft references" on storage.objects;
create policy "Customers can read own draft references"
on storage.objects
for select to authenticated
using (
  bucket_id = 'custom-order-references'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Customers can update own draft references" on storage.objects;
create policy "Customers can update own draft references"
on storage.objects
for update to authenticated
using (
  bucket_id = 'custom-order-references'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'custom-order-references'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Customers can delete own draft references" on storage.objects;
create policy "Customers can delete own draft references"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'custom-order-references'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);
