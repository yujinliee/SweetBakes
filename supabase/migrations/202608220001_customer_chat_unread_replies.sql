alter table public.chat_messages
  add column if not exists customer_read_at timestamptz;

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
  if not public.is_customer() then
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
