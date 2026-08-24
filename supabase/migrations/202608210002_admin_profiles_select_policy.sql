create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Admins can view customer profiles" on public.profiles;
create policy "Admins can view customer profiles"
  on public.profiles
  for select
  using (public.is_admin());
