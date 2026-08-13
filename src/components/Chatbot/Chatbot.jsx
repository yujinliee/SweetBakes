import { useEffect, useMemo, useRef, useState } from 'react'
import './Chatbot.css'

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

const welcomeMessage = {
  id: 'welcome',
  sender: 'bot',
  text: 'Hi! Welcome to Sweet Bakes. How can I help you today?',
  showQuickActions: true,
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
    normalizedText.includes('contact') ||
    normalizedText.includes('help') ||
    normalizedText.includes('support')
  ) {
    return quickActions.find((action) => action.id === 'contact')
  }

  return null
}

function Chatbot({ onNavigate, onTrackOrder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([welcomeMessage])
  const [input, setInput] = useState('')
  const nextMessageId = useRef(1)
  const messagesEndRef = useRef(null)

  const labelledQuickActions = useMemo(
    () => quickActions.map(({ id, label }) => ({ id, label })),
    [],
  )

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

  const addConversationTurn = (customerText, action) => {
    const botMessage = action
      ? {
          id: `bot-${nextMessageId.current + 1}`,
          sender: 'bot',
          text: action.response,
          actionId: action.href || action.action ? action.id : null,
        }
      : {
          id: `bot-${nextMessageId.current + 1}`,
          sender: 'bot',
          text:
            "I'm not sure about that yet. You can choose one of the options below, or contact Sweet Bakes for assistance.",
          showQuickActions: true,
        }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `customer-${nextMessageId.current}`,
        sender: 'customer',
        text: customerText,
      },
      botMessage,
    ])
    nextMessageId.current += 2
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

  const getActionById = (actionId) => quickActions.find((action) => action.id === actionId)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [isOpen, messages])

  return (
    <aside className="chatbot" aria-label="Sweet Bakes customer support chat">
      <div
        className={`chatbot-panel${isOpen ? ' chatbot-panel--open' : ''}`}
        aria-hidden={!isOpen}
      >
        <header className="chatbot-header">
          <div>
            <h2>Sweet Bakes Assistant</h2>
            <p>Here to help with your order</p>
          </div>
          <button
            className="chatbot-icon-button"
            type="button"
            aria-label="Minimize chat"
            onClick={() => setIsOpen(false)}
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
        </header>

        <div className="chatbot-messages" aria-live="polite">
          {messages.map((message) => {
            const messageAction = message.actionId ? getActionById(message.actionId) : null

            return (
              <div
                className={`chatbot-message-row chatbot-message-row--${message.sender}`}
                key={message.id}
              >
                <div className="chatbot-message">
                  <p>{message.text}</p>
                  {message.showQuickActions ? (
                    <div className="chatbot-quick-actions">
                      {labelledQuickActions.map((action) => {
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
                      })}
                    </div>
                  ) : null}
                  {messageAction?.cta ? (
                    <button
                      className="chatbot-message-cta"
                      type="button"
                      onClick={() => navigateTo(messageAction)}
                    >
                      {messageAction.cta}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <form className="chatbot-input-form" onSubmit={handleSubmit}>
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
        </form>
      </div>

      <button
        className="chatbot-toggle"
        type="button"
        aria-label={isOpen ? 'Close Sweet Bakes chat' : 'Open Sweet Bakes chat'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
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
