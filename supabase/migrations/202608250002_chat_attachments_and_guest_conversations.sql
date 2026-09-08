alter table public.chat_conversations
  add column if not exists guest_token text;

alter table public.chat_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size integer;

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
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "Chat users can upload attachments" on storage.objects;
create policy "Chat users can upload attachments"
on storage.objects
for insert
with check (
  bucket_id = 'chat-attachments'
  and (
    name like 'guest/%'
    or (
      auth.uid() is not null
      and name like ('customer/' || auth.uid()::text || '/%')
    )
  )
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

drop policy if exists "Admins can read chat attachments" on storage.objects;
create policy "Admins can read chat attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and public.is_admin()
);

drop policy if exists "Admins can upload chat attachments" on storage.objects;
create policy "Admins can upload chat attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and public.is_admin()
  and name like ('admin/' || auth.uid()::text || '/%')
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

  select id into conversation_id
  from public.chat_conversations
  where guest_token = p_guest_token
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

create or replace function public.send_guest_chat_message(
  p_conversation_id uuid,
  p_guest_token text,
  p_message text,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_mime_type text default null,
  p_attachment_size integer default null
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_type text,
  message text,
  created_at timestamptz,
  attachment_path text,
  attachment_name text,
  attachment_mime_type text,
  attachment_size integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.chat_conversations
    where chat_conversations.id = p_conversation_id
      and chat_conversations.guest_token = p_guest_token
      and chat_conversations.customer_id is null
      and chat_conversations.status = 'open'
  ) then
    raise exception 'Guest chat conversation not found';
  end if;

  if nullif(trim(coalesce(p_message, '')), '') is null
     and p_attachment_path is null then
    raise exception 'Message or attachment is required';
  end if;

  return query
  insert into public.chat_messages (
    conversation_id,
    sender_type,
    message,
    attachment_path,
    attachment_name,
    attachment_mime_type,
    attachment_size
  ) values (
    p_conversation_id,
    'customer',
    coalesce(trim(p_message), ''),
    p_attachment_path,
    p_attachment_name,
    p_attachment_mime_type,
    p_attachment_size
  )
  returning
    chat_messages.id,
    chat_messages.conversation_id,
    chat_messages.sender_type,
    chat_messages.message,
    chat_messages.created_at,
    chat_messages.attachment_path,
    chat_messages.attachment_name,
    chat_messages.attachment_mime_type,
    chat_messages.attachment_size;
end;
$$;

revoke all on function public.create_guest_chat_conversation(text) from public;
grant execute on function public.create_guest_chat_conversation(text) to anon, authenticated;
revoke all on function public.send_guest_chat_message(uuid, text, text, text, text, text, integer) from public;
grant execute on function public.send_guest_chat_message(uuid, text, text, text, text, text, integer) to anon, authenticated;
