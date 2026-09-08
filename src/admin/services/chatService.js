import { supabase } from '../../lib/supabase.js'

const MESSAGE_SELECT = 'id, conversation_id, sender_type, message, created_at, attachment_path, attachment_name, attachment_mime_type, attachment_size'

const formatCustomerName = (profile) => {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  return name || profile?.email || 'Sweet Bakes Customer'
}

const mapMessageRow = (row) => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderType: row.sender_type,
  message: row.message || '',
  createdAt: row.created_at,
  attachment: row.attachment_path
    ? {
        path: row.attachment_path,
        name: row.attachment_name || 'Attachment',
        mimeType: row.attachment_mime_type || '',
        size: row.attachment_size || null,
      }
    : null,
})

const hydrateAttachment = async (message) => {
  if (!message.attachment?.path) return message

  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(message.attachment.path, 3600)

  if (error) throw error
  return { ...message, attachment: { ...message.attachment, url: data.signedUrl } }
}

const logAdminChat = (...values) => {
  if (import.meta.env.DEV) {
    console.log(...values)
  }
}

const logAdminChatError = (...values) => {
  if (import.meta.env.DEV) {
    console.error(...values)
  }
}

export async function fetchAdminChatConversations() {
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser()

  logAdminChat('[ADMIN CHAT] current admin:', adminUser?.id || null)

  const {
    data: conversations,
    error: conversationsError,
  } = await supabase
    .from('chat_conversations')
    .select('*')
    .order('updated_at', { ascending: false })

  logAdminChat('[ADMIN CHAT CONVERSATIONS]', conversations || [])
  logAdminChatError('[ADMIN CHAT CONVERSATIONS ERROR]', conversationsError)

  if (conversationsError) throw conversationsError

  const rawCustomerIds = (conversations || []).map((row) => row.customer_id)
  const customerIds = [...new Set(rawCustomerIds.filter(Boolean))]
  logAdminChat('[ADMIN CHAT CUSTOMER IDS]', rawCustomerIds)

  let profilesById = {}
  if (customerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .in('id', customerIds)

    logAdminChat('[ADMIN CHAT PROFILES]', profiles || [])
    logAdminChatError('[ADMIN CHAT PROFILES ERROR]', profilesError)

    if (profilesError) throw profilesError

    profilesById = (profiles || []).reduce(
      (profilesMap, profile) => ({ ...profilesMap, [profile.id]: profile }),
      {},
    )
  }

  const customerConversations = (conversations || []).filter(
    (conversation) => conversation.customer_id
      ? profilesById[conversation.customer_id]?.role === 'customer'
      : Boolean(conversation.guest_token),
  )
  const conversationIds = customerConversations.map((row) => row.id).filter(Boolean)

  let latestMessagesByConversationId = {}
  if (conversationIds.length > 0) {
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    if (messagesError) throw messagesError

    latestMessagesByConversationId = (messages || []).reduce((latestMap, message) => {
      if (latestMap[message.conversation_id]) return latestMap
      return { ...latestMap, [message.conversation_id]: mapMessageRow(message) }
    }, {})
  }

  return customerConversations
    .map((conversation) => {
      const profile = profilesById[conversation.customer_id] || null
      const latestMessage = latestMessagesByConversationId[conversation.id] || null

      return {
        id: conversation.id,
        customerId: conversation.customer_id,
        status: conversation.status || 'open',
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        customerName: profile ? formatCustomerName(profile) : 'Guest Customer',
        customerEmail: profile?.email || 'Guest visitor',
        latestMessage,
      }
    })
    .sort((a, b) => {
      const aTime = new Date(a.latestMessage?.createdAt || a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.latestMessage?.createdAt || b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })
}

export async function fetchAdminChatMessages(conversationId) {
  if (!conversationId) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return Promise.all((data || []).map(mapMessageRow).map(hydrateAttachment))
}

export async function sendAdminChatMessage(conversationId, message, attachment = null) {
  const trimmedMessage = String(message || '').trim()

  if (!conversationId || !trimmedMessage) {
    throw new Error('Message is required.')
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'admin',
      message: trimmedMessage,
      attachment_path: attachment?.path || null,
      attachment_name: attachment?.name || null,
      attachment_mime_type: attachment?.mimeType || null,
      attachment_size: attachment?.size || null,
    })
    .select(MESSAGE_SELECT)
    .single()

  if (error) throw error
  return hydrateAttachment(mapMessageRow(data))
}

export async function updateAdminChatConversationStatus(conversationId, status) {
  const { data, error } = await supabase
    .from('chat_conversations')
    .update({ status })
    .eq('id', conversationId)
    .select('id, customer_id, status, created_at')
    .single()

  if (error) throw error
  return data
}

export async function deleteAdminChatConversation(conversationId) {
  if (!conversationId) throw new Error('Conversation is required.')

  const { error: messagesError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('conversation_id', conversationId)

  if (messagesError) throw messagesError

  const { error: conversationError } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId)

  if (conversationError) throw conversationError
}
