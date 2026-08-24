import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase.js'
import {
  fetchAdminChatConversations,
  fetchAdminChatMessages,
  sendAdminChatMessage,
} from '../../services/chatService.js'
import './Messages.css'

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : TIME_FORMATTER.format(date)
}

const normalizeText = (value) => String(value ?? '').toLowerCase()

const logAdminChatDebug = (...values) => {
  if (import.meta.env.DEV) {
    console.log('[ADMIN CHAT]', ...values)
  }
}

function ConversationItem({ conversation, isActive, onSelect }) {
  const latestMessage = conversation.latestMessage
  const preview = latestMessage?.message || 'No messages yet.'
  const hasCustomerLatest = latestMessage?.senderType === 'customer'

  return (
    <button
      type="button"
      className={`admin-messages-conversation${isActive ? ' is-active' : ''}${hasCustomerLatest ? ' has-customer-latest' : ''}`}
      onClick={() => onSelect(conversation.id)}
    >
      <span className="admin-messages-conversation-top">
        <strong>{conversation.customerName}</strong>
        <span>{formatTime(latestMessage?.createdAt || conversation.createdAt)}</span>
      </span>
      <span className="admin-messages-email">{conversation.customerEmail}</span>
      <span className="admin-messages-preview">{preview}</span>
      <span className={`admin-messages-status admin-messages-status--${conversation.status}`}>
        {conversation.status}
      </span>
    </button>
  )
}

function MessageBubble({ message }) {
  const isAdmin = message.senderType === 'admin'
  const label = isAdmin
    ? 'Admin'
    : message.senderType === 'customer'
      ? 'Customer'
      : 'Assistant'

  return (
    <div className={`admin-messages-bubble-row${isAdmin ? ' is-admin' : ''}`}>
      <div className="admin-messages-message-group">
        <div className="admin-messages-bubble">
          <p>{message.message}</p>
        </div>
        <span className="admin-messages-message-meta">{label} • {formatTime(message.createdAt)}</span>
      </div>
    </div>
  )
}

function Messages() {
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [messages, setMessages] = useState([])
  const [searchValue, setSearchValue] = useState('')
  const [reply, setReply] = useState('')
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [messageError, setMessageError] = useState('')
  const messagesThreadRef = useRef(null)

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId,
  )

  const filteredConversations = useMemo(() => {
    const needle = normalizeText(searchValue).trim()

    if (!needle) return conversations

    return conversations.filter((conversation) =>
      [
        conversation.customerName,
        conversation.customerEmail,
        conversation.latestMessage?.message,
      ].some((value) => normalizeText(value).includes(needle)),
    )
  }, [conversations, searchValue])

  const loadConversations = async () => {
    setIsLoadingConversations(true)
    setError('')

    try {
      const rows = await fetchAdminChatConversations()
      logAdminChatDebug('conversations:', rows)
      setConversations(rows)
      setSelectedConversationId((current) =>
        current && rows.some((conversation) => conversation.id === current)
          ? current
          : rows[0]?.id || '',
      )
    } catch (loadError) {
      console.error('[ADMIN MESSAGES] load conversations:', loadError)
      setError('Unable to load customer conversations.')
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      setMessages([])
      return
    }

    setIsLoadingMessages(true)
    setMessageError('')

    try {
      const rows = await fetchAdminChatMessages(conversationId)
      logAdminChatDebug('selected conversation:', conversationId)
      logAdminChatDebug('messages:', rows)
      setMessages(rows)
    } catch (loadError) {
      console.error('[ADMIN MESSAGES] load messages:', loadError)
      setMessageError('Unable to load this conversation.')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    loadMessages(selectedConversationId)
  }, [selectedConversationId])

  useEffect(() => {
    const thread = messagesThreadRef.current

    if (!thread) return

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, selectedConversationId])

  useEffect(() => {
    if (!selectedConversationId) return undefined

    const channel = supabase
      .channel(`admin-chat-messages-${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const row = payload.new
          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) return current
            return [
              ...current,
              {
                id: row.id,
                conversationId: row.conversation_id,
                senderType: row.sender_type,
                message: row.message || '',
                createdAt: row.created_at,
              },
            ]
          })
          loadConversations()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversationId])

  const handleSend = async (event) => {
    event.preventDefault()
    const trimmedReply = reply.trim()

    if (!selectedConversationId || !trimmedReply || isSending) return

    setIsSending(true)
    setMessageError('')

    try {
      const savedMessage = await sendAdminChatMessage(selectedConversationId, trimmedReply)
      setMessages((current) =>
        current.some((message) => message.id === savedMessage.id)
          ? current
          : [...current, savedMessage],
      )
      setReply('')
      await loadConversations()
    } catch (sendError) {
      console.error('[ADMIN MESSAGES] send reply:', sendError)
      setMessageError('Unable to send reply.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="admin-page admin-messages-page">
      <div className="admin-page-heading">
        <h2>Messages</h2>
      </div>

      <div className="admin-messages-shell">
        <aside className="admin-messages-list-pane" aria-label="Customer conversations">
          <div className="admin-messages-list-header">
            <div>
              <h3>Conversations</h3>
              <p>{conversations.length} total</p>
            </div>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search name or email..."
              aria-label="Search conversations"
            />
          </div>

          <div className="admin-messages-list">
            {isLoadingConversations ? (
              <p className="admin-messages-empty">Loading conversations...</p>
            ) : error ? (
              <p className="admin-messages-empty admin-messages-empty--error">{error}</p>
            ) : filteredConversations.length === 0 ? (
              <p className="admin-messages-empty">No customer conversations yet.</p>
            ) : (
              filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === selectedConversationId}
                  onSelect={setSelectedConversationId}
                />
              ))
            )}
          </div>
        </aside>

        <section className="admin-messages-thread-pane" aria-label="Selected conversation">
          {!selectedConversation ? (
            <div className="admin-messages-thread-empty">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <header className="admin-messages-thread-header">
                <div>
                  <h3>{selectedConversation.customerName}</h3>
                  <p>{selectedConversation.customerEmail}</p>
                </div>
              </header>

              <div className="admin-messages-thread" ref={messagesThreadRef}>
                {isLoadingMessages ? (
                  <p className="admin-messages-empty">Loading messages...</p>
                ) : messageError ? (
                  <p className="admin-messages-empty admin-messages-empty--error">{messageError}</p>
                ) : messages.length === 0 ? (
                  <p className="admin-messages-empty">No messages yet.</p>
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
              </div>

              <form className="admin-messages-reply" onSubmit={handleSend}>
                <input
                  type="text"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Type a reply..."
                  aria-label="Type a reply"
                />
                <button
                  type="submit"
                  disabled={isSending || !reply.trim()}
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  )
}

export default Messages
