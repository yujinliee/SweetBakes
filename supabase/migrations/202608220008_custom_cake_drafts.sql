create table if not exists public.custom_cake_drafts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  current_step integer not null default 1 check (current_step between 1 and 4),
  selections jsonb not null default '{}'::jsonb,
  design_details jsonb not null default '{}'::jsonb,
  customer_info jsonb not null default '{}'::jsonb,
  reference_images jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists custom_cake_drafts_one_active_per_customer
  on public.custom_cake_drafts(customer_id) where status = 'active';

alter table public.custom_cake_drafts enable row level security;

drop policy if exists "Customers can read own cake drafts" on public.custom_cake_drafts;
create policy "Customers can read own cake drafts"
on public.custom_cake_drafts for select to authenticated
using (customer_id = auth.uid());

drop policy if exists "Customers can create own cake drafts" on public.custom_cake_drafts;
create policy "Customers can create own cake drafts"
on public.custom_cake_drafts for insert to authenticated
with check (
  customer_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'customer')
);

drop policy if exists "Customers can update own cake drafts" on public.custom_cake_drafts;
create policy "Customers can update own cake drafts"
on public.custom_cake_drafts for update to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists "Customers can delete own cake drafts" on public.custom_cake_drafts;
create policy "Customers can delete own cake drafts"
on public.custom_cake_drafts for delete to authenticated
using (customer_id = auth.uid());

drop policy if exists "Customers can upload custom order references" on storage.objects;
create policy "Customers can upload custom order references"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'custom-order-references'
  and (
    (
      name ~ '^drafts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3][.](jpg|png|webp)$'
      and split_part(name, '/', 2) = auth.uid()::text
    )
    or (
      split_part(name, '/', 1) = auth.uid()::text
      and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3]\\.(jpg|png|webp)$'
    )
  )
);

drop policy if exists "Customers can read own draft references" on storage.objects;
create policy "Customers can read own draft references"
on storage.objects for select to authenticated
using (
  bucket_id = 'custom-order-references'
  and name ~ '^drafts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3][.](jpg|png|webp)$'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "Customers can delete own draft references" on storage.objects;
create policy "Customers can delete own draft references"
on storage.objects for delete to authenticated
using (
  bucket_id = 'custom-order-references'
  and name ~ '^drafts/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/reference-[1-3][.](jpg|png|webp)$'
  and split_part(name, '/', 2) = auth.uid()::text
);

notify pgrst, 'reload schema';
