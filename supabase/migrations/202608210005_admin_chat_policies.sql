alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Admins can view chat conversations" on public.chat_conversations;
create policy "Admins can view chat conversations"
  on public.chat_conversations
  for select
  using (public.is_admin());

drop policy if exists "Admins can update chat conversations" on public.chat_conversations;
create policy "Admins can update chat conversations"
  on public.chat_conversations
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can view chat messages" on public.chat_messages;
create policy "Admins can view chat messages"
  on public.chat_messages
  for select
  using (public.is_admin());

drop policy if exists "Admins can insert chat messages" on public.chat_messages;
create policy "Admins can insert chat messages"
  on public.chat_messages
  for insert
  with check (
    public.is_admin()
    and sender_type = 'admin'
  );
