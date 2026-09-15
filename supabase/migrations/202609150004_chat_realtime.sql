begin;

alter publication supabase_realtime
  add table public.chat_conversations;

alter publication supabase_realtime
  add table public.chat_messages;

alter table public.chat_conversations replica identity full;
alter table public.chat_messages replica identity full;

create index if not exists idx_chat_messages_unread_admin
  on public.chat_messages (conversation_id)
  where sender_type = 'admin' and customer_read_at is null;

commit;