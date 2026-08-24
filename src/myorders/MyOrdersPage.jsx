import { useEffect, useState } from 'react'
import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import { supabase } from '../lib/supabase.js'
import './MyOrdersPage.css'

const ORDER_SELECT = `
  id,
  order_number,
  first_name,
  last_name,
  email,
  order_method,
  preferred_date,
  preferred_time,
  total,
  order_status,
  payment_status,
  created_at
`

const ORDER_ITEM_SELECT = `
  id,
  order_id,
  product_name,
  product_type,
  variant_name,
  quantity,
  subtotal
`

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const formatDate = (value) => {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatStatus = (value) => {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Pending'
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function MyOrdersPage({
  latestRequest,
  onTrackOrder,
  onNavigate,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadOrders() {
      try {
        setIsLoading(true)
        setError('')

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const user = sessionData?.session?.user || null

        if (sessionError || !user) {
          onNavigate?.('/login?redirect=/my-orders', { replace: true })
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        if (profile?.role === 'admin') {
          onNavigate?.(ADMIN_DASHBOARD_ROUTE, { replace: true })
          return
        }

        if (profile?.role !== 'customer') {
          await supabase.auth.signOut()
          onNavigate?.('/login', { replace: true })
          return
        }

        const { data: orderRows, error: ordersError } = await supabase
          .from('orders')
          .select(ORDER_SELECT)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })

        if (ordersError) {
          throw ordersError
        }

        const orderIds = (orderRows || []).map((order) => order.id).filter(Boolean)
        let itemsByOrderId = {}

        if (orderIds.length > 0) {
          const { data: itemRows, error: itemsError } = await supabase
            .from('order_items')
            .select(ORDER_ITEM_SELECT)
            .in('order_id', orderIds)

          if (itemsError) {
            throw itemsError
          }

          itemsByOrderId = (itemRows || []).reduce((groups, item) => {
            const orderId = item.order_id
            if (!groups[orderId]) groups[orderId] = []
            groups[orderId].push(item)
            return groups
          }, {})
        }

        if (isMounted) {
          setOrders((orderRows || []).map((order) => ({
            ...order,
            order_items: itemsByOrderId[order.id] || [],
          })))
        }
      } catch (loadError) {
        console.error('[MY ORDERS] load error:', loadError)

        if (isMounted) {
          setError('Unable to load your orders. Please try again.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      isMounted = false
    }
  }, [onNavigate])

  return (
    <div className="my-orders-page">
      <SiteTopbar
        forceScrolled
        homeHref="/"
        locationHref="/#location"
        contactHref="/#contact"
        latestRequest={latestRequest}
        onTrackOrder={onTrackOrder}
        onNavigate={onNavigate}
        onCustomerLogout={onCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <main className="my-orders-content">
        <section className="my-orders-shell" aria-labelledby="my-orders-title">
          <div className="my-orders-heading">
            <p className="my-orders-eyebrow">Sweet Bakes Account</p>
            <h1 id="my-orders-title">My Orders</h1>
          </div>

          {isLoading ? (
            <div className="my-orders-card my-orders-state">Loading orders...</div>
          ) : error ? (
            <div className="my-orders-card my-orders-state my-orders-state--error">{error}</div>
          ) : orders.length === 0 ? (
            <div className="my-orders-card my-orders-empty">
              <h2>No orders yet</h2>
              <p>Your Sweet Bakes orders will appear here once you submit a request.</p>
            </div>
          ) : (
            <div className="my-orders-list">
              {orders.map((order) => {
                const items = order.order_items || []
                const firstItem = items[0]
                const itemSummary =
                  items.length > 1
                    ? `${firstItem?.product_name || 'Order'} + ${items.length - 1} more`
                    : firstItem?.product_name || 'Custom order'

                return (
                  <article className="my-orders-card my-orders-item" key={order.id}>
                    <div className="my-orders-item-header">
                      <div>
                        <span className="my-orders-number">{order.order_number || 'Order'}</span>
                        <h2>{itemSummary}</h2>
                      </div>
                      <span className="my-orders-status">{formatStatus(order.order_status)}</span>
                    </div>

                    <dl className="my-orders-details">
                      <div>
                        <dt>Order Date</dt>
                        <dd>{formatDate(order.created_at)}</dd>
                      </div>
                      <div>
                        <dt>Preferred Date</dt>
                        <dd>{formatDate(order.preferred_date)}</dd>
                      </div>
                      <div>
                        <dt>Method</dt>
                        <dd>{formatStatus(order.order_method)}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>{formatCurrency(order.total)}</dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

export default MyOrdersPage
