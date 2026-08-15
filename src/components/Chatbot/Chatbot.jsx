import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import logo from '../../assets/landingpage/sweetbakes_logo.svg'
import './Chatbot.css'

const pendingChatMessageKey = 'sweetbakes_pending_chat_message'
const returnToChatAfterLoginKey = 'sweetbakes_return_to_chat_after_login'
const chatbotMessagesKey = 'sweetbakes_chatbot_messages'
const chatbotWaitingForAdminKey = 'sweetbakes_chatbot_waiting_for_admin'
const chatbotAdminHandoffKey = 'sweetbakes_chatbot_admin_handoff'
const customerAuthStorageKey = 'sweetbakes_customer_authenticated'

const quickActions = [
  {
    id: 'cakes',
    label: 'Order a Cake',
    response:
      'Looking for a custom cake? You can choose your cake base, size, layers, design, and other details on our Cakes page.',
    cta: 'Go to Cakes',
    href: '/cakes',
  },
  {
    id: 'cupcakes',
    label: 'Order Cupcakes',
    response: 'You can customize your cupcake order through our Cupcakes page.',
    cta: 'Go to Cupcakes',
    href: '/cupcakes',
  },
  {
    id: 'packages',
    label: 'Party Packages',
    response:
      'Planning a celebration? Explore our Party Packages for cake and cupcake combinations.',
    cta: 'View Party Packages',
    href: '/customize?type=packages',
  },
  {
    id: 'track',
    label: 'Track My Order',
    response:
      'Already placed an order? You can check its current status through Track Order.',
    cta: 'Track Order',
    action: 'track',
  },
  {
    id: 'pickup',
    label: 'Pickup & Delivery',
    response:
      'Sweet Bakes offers pickup and delivery options. You can choose your preferred order method when completing your order details.',
  },
  {
    id: 'contact',
    label: 'Contact Sweet Bakes',
    response:
      'Need more help? You can contact Sweet Bakes directly through our Contact section.',
    cta: 'Contact Us',
    href: '#contact',
  },
]

const getMessageTime = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

const createWelcomeMessage = () => ({
  id: 'welcome',
  sender: 'bot',
  text: 'Hi! Welcome to Sweet Bakes. How can I help you today?',
  timestamp: getMessageTime(),
})

const createAdminAcknowledgementMessage = () => ({
  id: `bot-admin-wait-${Date.now()}`,
  sender: 'bot',
  text:
    "Thank you for your message! We've received your inquiry. Please wait for a response from Sweet Bakes. We'll get back to you as soon as possible.",
  timestamp: getMessageTime(),
})

const getStoredMessages = () => {
  try {
    const storedMessages = window.sessionStorage.getItem(chatbotMessagesKey)

    if (!storedMessages) {
      return [createWelcomeMessage()]
    }

    const parsedMessages = JSON.parse(storedMessages)

    return Array.isArray(parsedMessages) && parsedMessages.length
      ? parsedMessages
      : [createWelcomeMessage()]
  } catch {
    return [createWelcomeMessage()]
  }
}

const getCustomerAuthenticated = () =>
  window.localStorage.getItem(customerAuthStorageKey) === 'true'

const persistMessages = (nextMessages) => {
  window.sessionStorage.setItem(chatbotMessagesKey, JSON.stringify(nextMessages))
}

const prepareAdminHandoff = (messages) => {
  const now = new Date().toISOString()

  window.sessionStorage.setItem(
    chatbotAdminHandoffKey,
    JSON.stringify({
      conversationId: `chat-${now}`,
      customerId: 'customer-session',
      customerName: 'Sweet Bakes Customer',
      messages,
      status: 'waiting_for_admin',
      lastMessageAt: now,
      unreadByAdmin: true,
    }),
  )
}

const getMatchedAction = (text) => {
  const normalizedText = text.toLowerCase()

  if (normalizedText.includes('cupcake') || normalizedText.includes('cupcakes')) {
    return quickActions.find((action) => action.id === 'cupcakes')
  }

  if (normalizedText.includes('custom cake') || normalizedText.includes('cake')) {
    return quickActions.find((action) => action.id === 'cakes')
  }

  if (normalizedText.includes('package') || normalizedText.includes('party')) {
    return quickActions.find((action) => action.id === 'packages')
  }

  if (
    normalizedText.includes('track') ||
    normalizedText.includes('status') ||
    normalizedText.includes('order status')
  ) {
    return quickActions.find((action) => action.id === 'track')
  }

  if (normalizedText.includes('delivery') || normalizedText.includes('pickup')) {
    return quickActions.find((action) => action.id === 'pickup')
  }

  if (
    normalizedText.includes('location') ||
    normalizedText.includes('located') ||
    normalizedText.includes('address') ||
    normalizedText.includes('where') ||
    normalizedText.includes('directions') ||
    normalizedText.includes('maps')
  ) {
    return {
      id: 'location',
      response:
        'Sweet Bakes is located at Diamond Village, Salawag, Dasmarinas City. You can also use the Get Directions button in our Location section for Google Maps.',
    }
  }

  if (
    normalizedText.includes('order') ||
    normalizedText.includes('customize') ||
    normalizedText.includes('ordering')
  ) {
    return {
      id: 'ordering',
      response:
        'You can order as a guest by choosing Cakes, Cupcakes, or Party Packages, then completing the customization form.',
    }
  }

  if (
    normalizedText.includes('contact') ||
    normalizedText.includes('help') ||
    normalizedText.includes('support')
  ) {
    return quickActions.find((action) => action.id === 'contact')
  }

  return null
}

function Chatbot({ onNavigate, onTrackOrder, isCustomerAuthenticated = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [messages, setMessages] = useState(getStoredMessages)
  const [quickActionsState, setQuickActionsState] = useState('visible')
  const [input, setInput] = useState('')
  const [waitingForAdmin, setWaitingForAdmin] = useState(
    () => window.sessionStorage.getItem(chatbotWaitingForAdminKey) === 'true',
  )
  const chatbotRef = useRef(null)
  const nextMessageId = useRef(messages.length + 1)
  const messagesEndRef = useRef(null)
  const replyTimeoutsRef = useRef([])
  const touchStartYRef = useRef(null)

  const labelledQuickActions = useMemo(
    () => quickActions.map(({ id, label }) => ({ id, label })),
    [],
  )
  const getActionById = (actionId) => quickActions.find((action) => action.id === actionId)
  const shouldShowQuickActions = quickActionsState !== 'hidden'
  const customerIsAuthenticated = isCustomerAuthenticated || getCustomerAuthenticated()

  const quickActionButtons = labelledQuickActions.map((action) => {
    const fullAction = getActionById(action.id)

    return (
      <button
        type="button"
        key={action.id}
        onClick={() => handleQuickAction(fullAction)}
      >
        {action.label}
      </button>
    )
  })

  const navigateTo = (action) => {
    if (action.action === 'track') {
      onTrackOrder?.()
      return
    }

    if (!action.href) {
      return
    }

    if (action.href.startsWith('#')) {
      const target = document.querySelector(action.href)
      window.history.pushState({}, '', action.href)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (onNavigate) {
      onNavigate(action.href)
      return
    }

    window.history.pushState({}, '', action.href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const updateMessages = useCallback((getNextMessages) => {
    setMessages((currentMessages) => {
      const nextMessages =
        typeof getNextMessages === 'function'
          ? getNextMessages(currentMessages)
          : getNextMessages

      persistMessages(nextMessages)
      return nextMessages
    })
  }, [])

  const addReplyWithQuickActions = (botMessage) => {
    updateMessages((currentMessages) => [...currentMessages, botMessage])

    const quickActionsTimeout = window.setTimeout(() => {
      setQuickActionsState('visible')
      replyTimeoutsRef.current = replyTimeoutsRef.current.filter(
        (timeoutId) => timeoutId !== quickActionsTimeout,
      )
    }, 380)

    replyTimeoutsRef.current.push(quickActionsTimeout)
  }

  const addConversationMessages = (customerText, action) => {
    const customerMessageId = nextMessageId.current
    const botMessageId = nextMessageId.current + 1

    updateMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `customer-${customerMessageId}`,
        sender: 'customer',
        text: customerText,
        timestamp: getMessageTime(),
      },
    ])
    nextMessageId.current += 2

    const replyTimeout = window.setTimeout(() => {
      const botMessage = {
        id: `bot-${botMessageId}`,
        sender: 'bot',
        text: action.response,
        actionId: action.href || action.action ? action.id : null,
        timestamp: getMessageTime(),
      }

      addReplyWithQuickActions(botMessage)
      replyTimeoutsRef.current = replyTimeoutsRef.current.filter(
        (timeoutId) => timeoutId !== replyTimeout,
      )
    }, 350)

    replyTimeoutsRef.current.push(replyTimeout)
  }

  const createLoginRequiredMessage = () => ({
    id: `bot-login-required-${Date.now()}`,
    sender: 'bot',
    text:
      'To continue this conversation with Sweet Bakes, please sign in first. Your message will be saved so you can continue after logging in.',
    timestamp: getMessageTime(),
    cta: {
      label: 'Login to Continue',
      href: '/login',
    },
  })

  const savePendingChatState = (customerText, nextMessages) => {
    window.sessionStorage.setItem(pendingChatMessageKey, customerText)
    window.sessionStorage.setItem(returnToChatAfterLoginKey, 'true')
    persistMessages(nextMessages)
  }

  const startAdminHandoff = (customerText) => {
    const customerMessageId = nextMessageId.current
    nextMessageId.current += 1

    updateMessages((currentMessages) => {
      const customerMessage = {
        id: `customer-${customerMessageId}`,
        sender: 'customer',
        text: customerText,
        timestamp: getMessageTime(),
      }

      const nextMessages = [...currentMessages, customerMessage]

      if (waitingForAdmin) {
        prepareAdminHandoff(nextMessages)
        return nextMessages
      }

      window.sessionStorage.setItem(chatbotWaitingForAdminKey, 'true')
      setWaitingForAdmin(true)

      const handoffMessages = [...nextMessages, createAdminAcknowledgementMessage()]
      prepareAdminHandoff(handoffMessages)

      return handoffMessages
    })
  }

  const requireLoginForAdminHandoff = (customerText) => {
    const customerMessageId = nextMessageId.current
    nextMessageId.current += 1

    updateMessages((currentMessages) => {
      const nextMessages = [
        ...currentMessages,
        {
          id: `customer-${customerMessageId}`,
          sender: 'customer',
          text: customerText,
          timestamp: getMessageTime(),
        },
        createLoginRequiredMessage(),
      ]

      savePendingChatState(customerText, nextMessages)
      return nextMessages
    })
  }

  const addUnknownConversationTurn = (customerText) => {
    replyTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    replyTimeoutsRef.current = []

    const addUnknownMessage = () => {
      if (customerIsAuthenticated) {
        startAdminHandoff(customerText)
        return
      }

      requireLoginForAdminHandoff(customerText)
    }

    if (shouldShowQuickActions) {
      setQuickActionsState('hiding')

      const hideTimeout = window.setTimeout(() => {
        setQuickActionsState('hidden')
        addUnknownMessage()
        replyTimeoutsRef.current = replyTimeoutsRef.current.filter(
          (timeoutId) => timeoutId !== hideTimeout,
        )
      }, 120)

      replyTimeoutsRef.current.push(hideTimeout)
      return
    }

    addUnknownMessage()
  }

  const addConversationTurn = (customerText, action) => {
    if (!action) {
      addUnknownConversationTurn(customerText)
      return
    }

    replyTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    replyTimeoutsRef.current = []

    if (shouldShowQuickActions) {
      setQuickActionsState('hiding')

      const hideTimeout = window.setTimeout(() => {
        setQuickActionsState('hidden')
        addConversationMessages(customerText, action)
        replyTimeoutsRef.current = replyTimeoutsRef.current.filter(
          (timeoutId) => timeoutId !== hideTimeout,
        )
      }, 120)

      replyTimeoutsRef.current.push(hideTimeout)
      return
    }

    addConversationMessages(customerText, action)
  }

  const handleQuickAction = (action) => {
    addConversationTurn(action.label, action)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const messageText = input.trim()

    if (!messageText) {
      return
    }

    addConversationTurn(messageText, getMatchedAction(messageText))
    setInput('')
  }

  const handleMessageCta = (cta) => {
    if (!cta?.href) {
      return
    }

    if (onNavigate) {
      onNavigate(cta.href)
      return
    }

    window.history.pushState({}, '', cta.href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleMinimize = () => {
    setIsOpen(false)
    setIsMaximized(false)
  }

  const handleOpen = () => {
    setIsOpen(true)
    setIsMaximized(false)
  }

  useEffect(() => {
    const shouldReturnToChat =
      window.sessionStorage.getItem(returnToChatAfterLoginKey) === 'true'
    const pendingMessage = window.sessionStorage.getItem(pendingChatMessageKey)

    if (!shouldReturnToChat || !pendingMessage || !customerIsAuthenticated) {
      return undefined
    }

    const restoreTimeout = window.setTimeout(() => {
      setIsOpen(true)
      setIsMaximized(false)
      setQuickActionsState('hidden')
      window.sessionStorage.removeItem(pendingChatMessageKey)
      window.sessionStorage.removeItem(returnToChatAfterLoginKey)
      window.sessionStorage.setItem(chatbotWaitingForAdminKey, 'true')
      setWaitingForAdmin(true)

      updateMessages((currentMessages) => {
        const withoutLoginPrompt = currentMessages.filter(
          (message) => !message.id.toString().startsWith('bot-login-required-'),
        )
        const hasPendingCustomerMessage = withoutLoginPrompt.some(
          (message) => message.sender === 'customer' && message.text === pendingMessage,
        )
        const restoredMessages = hasPendingCustomerMessage
          ? withoutLoginPrompt
          : [
              ...withoutLoginPrompt,
              {
                id: `customer-restored-${Date.now()}`,
                sender: 'customer',
                text: pendingMessage,
                timestamp: getMessageTime(),
              },
            ]
        const alreadyHasAcknowledgement = withoutLoginPrompt.some((message) =>
          message.id.toString().startsWith('bot-admin-wait-'),
        )

        if (alreadyHasAcknowledgement) {
          prepareAdminHandoff(restoredMessages)
          return restoredMessages
        }

        const handoffMessages = [...restoredMessages, createAdminAcknowledgementMessage()]
        prepareAdminHandoff(handoffMessages)

        return handoffMessages
      })
    }, 0)

    return () => {
      window.clearTimeout(restoreTimeout)
    }
  }, [customerIsAuthenticated, updateMessages])

  useEffect(() => {
    persistMessages(messages)
  }, [messages])

  const canScrollChatHistory = (scrollContainer, deltaY) => {
    if (!scrollContainer) {
      return false
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer
    const hasScrollableContent = scrollHeight > clientHeight

    if (!hasScrollableContent) {
      return false
    }

    if (deltaY < 0) {
      return scrollTop > 0
    }

    if (deltaY > 0) {
      return scrollTop + clientHeight < scrollHeight - 1
    }

    return true
  }

  const getChatHistoryFromEvent = (event) =>
    event.target.closest?.('.chatbot-messages')

  const handleChatbotWheel = (event) => {
    const chatHistory = getChatHistoryFromEvent(event)

    event.stopPropagation()

    if (!canScrollChatHistory(chatHistory, event.deltaY)) {
      event.preventDefault()
    }
  }

  const handleChatbotTouchStart = (event) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null
  }

  const handleChatbotTouchMove = (event) => {
    const currentY = event.touches[0]?.clientY

    if (touchStartYRef.current === null || currentY === undefined) {
      return
    }

    const chatHistory = getChatHistoryFromEvent(event)
    const deltaY = touchStartYRef.current - currentY

    event.stopPropagation()

    if (!canScrollChatHistory(chatHistory, deltaY)) {
      event.preventDefault()
      return
    }

    touchStartYRef.current = currentY
  }

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isOpen && chatbotRef.current && !chatbotRef.current.contains(event.target)) {
        setIsOpen(false)
        setIsMaximized(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  useEffect(
    () => () => {
      replyTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      replyTimeoutsRef.current = []
    },
    [],
  )

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [isOpen, messages, quickActionsState])

  return (
    <aside
      ref={chatbotRef}
      className={`chatbot${isOpen ? ' chatbot--open' : ' chatbot--closed'}${isOpen && isMaximized ? ' chatbot--maximized' : ''}`}
      aria-label="Sweet Bakes customer support chat"
    >
      <div
        className="chatbot-panel"
        aria-hidden={!isOpen}
        onTouchMove={handleChatbotTouchMove}
        onTouchStart={handleChatbotTouchStart}
        onWheel={handleChatbotWheel}
      >
        <header className="chatbot-header">
          <div className="chatbot-header-profile">
            <span className="chatbot-avatar" aria-hidden="true">
              <img src={logo} alt="" />
            </span>
            <div>
              <h2>Sweet Bakes Assistant</h2>
              <p>Here to help with your order</p>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <button
              className="chatbot-icon-button"
              type="button"
              aria-label={isMaximized ? 'Restore chat size' : 'Maximize chat'}
              aria-pressed={isMaximized}
              onClick={() => setIsMaximized((current) => !current)}
            >
              {isMaximized ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 4V9H4M15 20V15H20M5 8L9 4M19 16L15 20"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 4H4V9M15 20H20V15M4 4L9 9M20 20L15 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <button
              className="chatbot-icon-button"
              type="button"
              aria-label="Minimize chat"
              onClick={handleMinimize}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 12H18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className="chatbot-messages" aria-live="polite">
          <div className="chatbot-date-separator">Today</div>
          {messages.map((message) => {
            const messageAction = message.actionId ? getActionById(message.actionId) : null
            const messageCta = message.cta

            return (
              <div
                className={`chatbot-message-group chatbot-message-group--${message.sender}`}
                key={message.id}
              >
                <div className="chatbot-message">
                  <p>{message.text}</p>
                  {messageAction?.cta ? (
                    <button
                      className="chatbot-message-cta"
                      type="button"
                      onClick={() => navigateTo(messageAction)}
                    >
                      {messageAction.cta}
                    </button>
                  ) : null}
                  {messageCta?.label ? (
                    <button
                      className="chatbot-message-cta"
                      type="button"
                      onClick={() => handleMessageCta(messageCta)}
                    >
                      {messageCta.label}
                    </button>
                  ) : null}
                </div>
                <span className="chatbot-message-time">
                  {message.sender === 'admin'
                    ? 'Sweet Bakes'
                    : message.sender === 'bot'
                      ? 'Automated'
                      : 'Sent'}
                  <span aria-hidden="true"> • </span>
                  {message.timestamp}
                </span>
              </div>
            )
          })}
          {shouldShowQuickActions ? (
            <div
              className={`chatbot-quick-actions chatbot-quick-actions--flow chatbot-quick-actions--${quickActionsState}`}
              aria-label="Chat quick actions"
            >
              {quickActionButtons}
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-bottom">
          <form className="chatbot-input-form" onSubmit={handleSubmit}>
            <div className="chatbot-input-wrapper">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your message..."
                aria-label="Type your message"
              />
              <button type="submit" aria-label="Send message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 12L20 5L16 19L12.5 13.5L4 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      <button
        className="chatbot-toggle"
        type="button"
        aria-label={isOpen ? 'Close Sweet Bakes chat' : 'Open Sweet Bakes chat'}
        aria-expanded={isOpen}
        onClick={handleOpen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 6.5C5 5.12 6.12 4 7.5 4H16.5C17.88 4 19 5.12 19 6.5V13.5C19 14.88 17.88 16 16.5 16H11L6.5 20V16H7.5C6.12 16 5 14.88 5 13.5V6.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 8.5H15.5M8.5 11.5H13.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </aside>
  )
}

export default Chatbot
