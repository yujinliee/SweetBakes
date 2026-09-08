alter table public.chat_conversations
  add column if not exists guest_token text;

alter table public.chat_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size bigint,
  add column if not exists customer_read_at timestamptz;

create unique index if not exists chat_conversations_guest_token_idx
  on public.chat_conversations (guest_token)
  where guest_token is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_guest_chat_attachment_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select object_name like 'guest/%/%/%'
    and exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id::text = split_part(object_name, '/', 2)
        and chat_conversations.guest_token = split_part(object_name, '/', 3)
        and chat_conversations.customer_id is null
        and chat_conversations.status = 'open'
    );
$$;

revoke all on function public.is_guest_chat_attachment_path(text) from public;
grant execute on function public.is_guest_chat_attachment_path(text) to anon, authenticated;

drop policy if exists "Chat users can upload attachments" on storage.objects;
create policy "Chat users can upload attachments"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'chat-attachments'
  and (
    public.is_guest_chat_attachment_path(name)
    or (
      auth.uid() is not null
      and name like ('customer/' || auth.uid()::text || '/%')
    )
  )
);

drop policy if exists "Chat guests can read own attachments" on storage.objects;
create policy "Chat guests can read own attachments"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'chat-attachments'
  and public.is_guest_chat_attachment_path(name)
);

drop policy if exists "Chat customers can read own attachments" on storage.objects;
create policy "Chat customers can read own attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and name like ('customer/' || auth.uid()::text || '/%')
);

drop policy if exists "Chat customers can update own attachments" on storage.objects;
create policy "Chat customers can update own attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-attachments'
  and name like ('customer/' || auth.uid()::text || '/%')
)
with check (
  bucket_id = 'chat-attachments'
  and name like ('customer/' || auth.uid()::text || '/%')
);

drop policy if exists "Chat customers can delete own attachments" on storage.objects;
create policy "Chat customers can delete own attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and name like ('customer/' || auth.uid()::text || '/%')
);

drop policy if exists "Admins can read chat attachments" on storage.objects;
create policy "Admins can read chat attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and public.is_admin()
);

create or replace function public.create_guest_chat_conversation(p_guest_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
begin
  if p_guest_token is null or length(trim(p_guest_token)) < 20 then
    raise exception 'Invalid guest chat token';
  end if;

  select id
  into conversation_id
  from public.chat_conversations
  where guest_token = p_guest_token
    and customer_id is null
    and status = 'open'
  limit 1;

  if conversation_id is null then
    insert into public.chat_conversations (customer_id, guest_token, status)
    values (null, p_guest_token, 'open')
    returning id into conversation_id;
  end if;

  return conversation_id;
end;
$$;

revoke all on function public.create_guest_chat_conversation(text) from public;
grant execute on function public.create_guest_chat_conversation(text) to anon, authenticated;

create or replace function public.mark_customer_chat_admin_messages_read(
  p_conversation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'customer'
  ) then
    raise exception 'Only customers can mark chat messages read.';
  end if;

  update public.chat_messages
  set customer_read_at = now()
  where conversation_id = p_conversation_id
    and sender_type = 'admin'
    and customer_read_at is null
    and exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id = p_conversation_id
        and chat_conversations.customer_id = auth.uid()
    );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_customer_chat_admin_messages_read(uuid) from public;
grant execute on function public.mark_customer_chat_admin_messages_read(uuid) to authenticated;
