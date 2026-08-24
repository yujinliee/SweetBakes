import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import './AdminSidebar.css'
import footerLogo from '../../../assets/landingpage/sweetbakes_footer.svg'

const adminNavItems = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
  { key: 'orders', label: 'Orders', href: '/admin/orders', icon: 'orders' },
  { key: 'messages', label: 'Messages', href: '/admin/messages', icon: 'messages' },
  {
    key: 'products',
    label: 'Products',
    icon: 'products',
    children: [
      { key: 'cakes', label: 'Cakes', href: '/admin/products/cakes' },
      { key: 'cupcakes', label: 'Cupcakes', href: '/admin/products/cupcakes' },
      { key: 'party-packages', label: 'Party Packages', href: '/admin/products/party-packages' },
      { key: 'sweet-treats', label: 'Sweet Treats', href: '/admin/products/sweet-treats' },
    ],
  },
  { key: 'inventory', label: 'Inventory', href: '/admin/inventory', icon: 'inventory' },
  { key: 'availability', label: 'Availability', href: '/admin/availability', icon: 'availability' },
  { key: 'customers', label: 'Customers', href: '/admin/customers', icon: 'customers' },
  { key: 'settings', label: 'Settings', href: '/admin/settings', icon: 'settings' },
]

const productsFlyoutItems = [
  { label: 'Cakes', href: '/admin/products/cakes' },
  { label: 'Cupcakes', href: '/admin/products/cupcakes' },
  { label: 'Party Packages', href: '/admin/products/party-packages' },
  { label: 'Sweet Treats', href: '/admin/products/sweet-treats' },
]

const iconPaths = {
  dashboard: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  orders: 'M8 4h8a2 2 0 0 1 2 2v14l-3-1.5L12 20l-3-1.5L6 20V6a2 2 0 0 1 2-2Zm2 5h4M10 13h6M10 17h3',
  messages: 'M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm3 4h8M8 13h5',
  products: 'M5 8.5 12 5l7 3.5v7L12 19l-7-3.5v-7Zm7 3.5 7-3.5M12 12 5 8.5M12 12v7',
  inventory: 'M4 7h16l-1.5 3H5.5L4 7Zm2 3h12v9H6v-9Zm4 4h4',
  availability: 'M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm4 10 2 2 4-5',
  custom: 'M5 5h14v10H8l-3 3V5Zm4 4h6M9 12h4',
  customers: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5M4 19a5 5 0 0 1 10 0M14 19a4 4 0 0 1 6 0',
  settings: 'M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Zm7.4-2.3a8.3 8.3 0 0 0 0-2.2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.9-1.1L14.8 3H9.2l-.3 2.9A7.6 7.6 0 0 0 7 7L4.6 6l-2 3.4 2 1.5a8.3 8.3 0 0 0 0 2.2l-2 1.5 2 3.4L7 17a7.6 7.6 0 0 0 1.9 1.1l.3 2.9h5.6l.3-2.9A7.6 7.6 0 0 0 17 17l2.4 1 2-3.4-2-1.5Z',
  logout: 'M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9',
}

function SidebarIcon({ name }) {
  return (
    <svg className="admin-sidebar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={iconPaths[name]}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SidebarTooltip({ anchorRect, children }) {
  if (!anchorRect || typeof document === 'undefined') {
    return null
  }

  const maxTop = window.innerHeight - 36 - 12
  const top = Math.max(12, Math.min(anchorRect.top + anchorRect.height / 2, maxTop))
  const overlayWidth = 120
  const preferredLeft = anchorRect.right + 10
  const left = preferredLeft + overlayWidth <= window.innerWidth
    ? preferredLeft
    : Math.max(8, anchorRect.left - overlayWidth - 10)

  return createPortal(
    <div
      className="admin-sidebar-tooltip"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

function ProductsFlyout({ anchorRect, flyoutRef, items, currentPath, onNavigate }) {
  if (!anchorRect || typeof document === 'undefined') {
    return null
  }

  const flyoutWidth = 190
  const flyoutHeight = 220
  const preferredLeft = anchorRect.right + 10
  const left = preferredLeft + flyoutWidth <= window.innerWidth
    ? preferredLeft
    : Math.max(8, anchorRect.left - flyoutWidth - 10)
  const top = Math.max(12, Math.min(anchorRect.top, window.innerHeight - flyoutHeight - 12))

  return createPortal(
    <div
      ref={flyoutRef}
      className="products-flyout"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      role="menu"
      aria-label="Products"
    >
      <div className="products-flyout-title">Products</div>
      {items.map((item) => (
        <button
          type="button"
          className={`products-flyout-item${currentPath === item.href ? ' is-active' : ''}`}
          key={item.href}
          onClick={() => onNavigate(item.href)}
          role="menuitem"
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

function AdminSidebar({ currentPath, isCollapsed, onNavigate, onLogout, onToggleCollapse }) {
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [productsFlyoutOpen, setProductsFlyoutOpen] = useState(false)
  const [productsFlyoutRect, setProductsFlyoutRect] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const productsTriggerRef = useRef(null)
  const flyoutRef = useRef(null)

  useEffect(() => {
    if (!productsFlyoutOpen) {
      return undefined
    }

    const closeOnOutsideClick = (event) => {
      if (
        !productsTriggerRef.current?.contains(event.target) &&
        !flyoutRef.current?.contains(event.target)
      ) {
        setProductsFlyoutOpen(false)
        setProductsFlyoutRect(null)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setProductsFlyoutOpen(false)
        setProductsFlyoutRect(null)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [productsFlyoutOpen])

  const showTooltip = (label, element) => {
    if (!isCollapsed || productsFlyoutOpen) {
      return
    }
    setTooltip({ label, rect: element.getBoundingClientRect() })
  }

  const hideTooltip = () => setTooltip(null)

  const closeProductsFlyout = () => {
    setProductsFlyoutOpen(false)
    setProductsFlyoutRect(null)
  }

  const handleSidebarToggle = () => {
    closeProductsFlyout()
    setTooltip(null)
    onToggleCollapse?.()
  }

  const navigateFromSidebar = (href) => {
    closeProductsFlyout()
    setTooltip(null)
    onNavigate?.(href)
  }

  const toggleGroup = (groupKey) => {
    setOpenGroups((previous) => {
      const next = new Set(previous)

      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }

      return next
    })
  }

  return (
    <aside
      className={`admin-sidebar${isCollapsed ? ' admin-sidebar--collapsed' : ''}`}
      aria-label="Admin navigation"
    >
      <div className="admin-sidebar-brand-row">
        <button
          className="admin-sidebar-logo"
          type="button"
          aria-label={isCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
          aria-expanded={!isCollapsed}
          onClick={handleSidebarToggle}
        >
          <span className="admin-sidebar-logo-visual" aria-hidden="true">
            <img
              className="admin-sidebar-logo-mark"
              src={footerLogo}
              alt=""
              aria-hidden="true"
            />
            <svg className="admin-sidebar-logo-hover-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4.5 5.5h15v13h-15v-13Zm5.6 0v13M8.6 8.8l-2.5 2.7 2.5 2.7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="admin-sidebar-logo-text">SweetBakes</span>
        </button>

        {!isCollapsed && (
          <button
            className="admin-sidebar-collapse-btn"
            type="button"
            aria-label={isCollapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
            onClick={handleSidebarToggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4.5 5.5h15v13h-15v-13Zm5.6 0v13M8.6 8.8l-2.5 2.7 2.5 2.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <nav className="admin-sidebar-nav">
        {adminNavItems.map((item) => {
          if (item.children) {
            const isParentActive = item.key === 'products' && currentPath.startsWith('/admin/products')
            const isOpen = openGroups.has(item.key)

            return (
              <div
                className={`admin-sidebar-group${isOpen ? ' is-open' : ''}`}
                key={item.key}
              >
                <button
                  ref={productsTriggerRef}
                  type="button"
                  className={`admin-sidebar-link admin-sidebar-group-toggle${isParentActive ? ' admin-sidebar-group-toggle--active' : ''}`}
                  data-tooltip={item.label}
                  aria-expanded={isCollapsed ? productsFlyoutOpen : isOpen}
                  aria-controls={`admin-sidebar-group-${item.key}`}
                  onMouseEnter={(event) => showTooltip(item.label, event.currentTarget)}
                  onFocus={(event) => showTooltip(item.label, event.currentTarget)}
                  onMouseLeave={hideTooltip}
                  onClick={(event) => {
                    if (isCollapsed) {
                      const isOpening = !productsFlyoutOpen
                      setTooltip(null)
                      setProductsFlyoutOpen(isOpening)
                      setProductsFlyoutRect(
                        isOpening ? event.currentTarget.getBoundingClientRect() : null,
                      )
                    } else {
                      toggleGroup(item.key)
                    }
                  }}
                >
                  <SidebarIcon name={item.icon} />
                  <span className="admin-sidebar-label">{item.label}</span>
                  <svg className="admin-sidebar-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="m7 10 5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div className="admin-sidebar-submenu" id={`admin-sidebar-group-${item.key}`}>
                  <div className="admin-sidebar-submenu-inner">
                    {item.children.map((child) => (
                      <a
                        key={child.href}
                        className={`admin-sidebar-link admin-sidebar-sublink${currentPath === child.href ? ' admin-sidebar-link--active admin-sidebar-sublink--active' : ''}`}
                        data-tooltip={child.label}
                        href={child.href}
                        onClick={(event) => {
                          event.preventDefault()
                          navigateFromSidebar(child.href)
                        }}
                      >
                        <span className="admin-sidebar-label">{child.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )
          }

          return (
            <a
              className={currentPath === item.href ? 'admin-sidebar-link admin-sidebar-link--active' : 'admin-sidebar-link'}
              data-tooltip={item.label}
              href={item.href}
              key={item.key}
              onMouseEnter={(event) => showTooltip(item.label, event.currentTarget)}
              onFocus={(event) => showTooltip(item.label, event.currentTarget)}
              onMouseLeave={hideTooltip}
              onClick={(event) => {
                event.preventDefault()
                navigateFromSidebar(item.href)
              }}
            >
              <SidebarIcon name={item.icon} />
              <span className="admin-sidebar-label">{item.label}</span>
            </a>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <button
          className="admin-sidebar-logout"
          type="button"
          data-tooltip="Logout"
          onMouseEnter={(event) => showTooltip('Logout', event.currentTarget)}
          onFocus={(event) => showTooltip('Logout', event.currentTarget)}
          onMouseLeave={hideTooltip}
          onClick={() => {
            closeProductsFlyout()
            setTooltip(null)
            onLogout?.()
          }}
        >
          <SidebarIcon name="logout" />
          <span className="admin-sidebar-label">Logout</span>
        </button>
      </div>

      {isCollapsed && productsFlyoutOpen ? (
        <ProductsFlyout
          anchorRect={productsFlyoutRect}
          flyoutRef={flyoutRef}
          items={productsFlyoutItems}
          currentPath={currentPath}
          onNavigate={navigateFromSidebar}
        />
      ) : null}

      {isCollapsed && tooltip && !productsFlyoutOpen ? (
        <SidebarTooltip anchorRect={tooltip.rect}>
          {tooltip.label}
        </SidebarTooltip>
      ) : null}
    </aside>
  )
}

export default AdminSidebar
