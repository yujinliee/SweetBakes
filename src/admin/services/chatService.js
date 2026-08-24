import { supabase } from '../../lib/supabase.js'

const MESSAGE_SELECT = 'id, conversation_id, sender_type, message, created_at'

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
})

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
    (conversation) => profilesById[conversation.customer_id]?.role === 'customer',
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
        customerName: formatCustomerName(profile),
        customerEmail: profile?.email || 'No email available',
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
  return (data || []).map(mapMessageRow)
}

export async function sendAdminChatMessage(conversationId, message) {
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
    })
    .select(MESSAGE_SELECT)
    .single()

  if (error) throw error
  return mapMessageRow(data)
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
