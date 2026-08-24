create or replace function public.is_customer()
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
      and role = 'customer'
  );
$$;

drop policy if exists "Customers can view own chat conversations" on public.chat_conversations;
create policy "Customers can view own chat conversations"
  on public.chat_conversations
  for select
  using (
    public.is_customer()
    and customer_id = auth.uid()
  );

drop policy if exists "Customers can create own chat conversations" on public.chat_conversations;
create policy "Customers can create own chat conversations"
  on public.chat_conversations
  for insert
  with check (
    public.is_customer()
    and customer_id = auth.uid()
    and status = 'open'
  );

drop policy if exists "Customers can view own chat messages" on public.chat_messages;
create policy "Customers can view own chat messages"
  on public.chat_messages
  for select
  using (
    public.is_customer()
    and exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.customer_id = auth.uid()
    )
  );

drop policy if exists "Customers can create own chat messages" on public.chat_messages;
create policy "Customers can create own chat messages"
  on public.chat_messages
  for insert
  with check (
    public.is_customer()
    and sender_type in ('customer', 'assistant')
    and exists (
      select 1
      from public.chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
        and chat_conversations.customer_id = auth.uid()
        and chat_conversations.status = 'open'
    )
  );
