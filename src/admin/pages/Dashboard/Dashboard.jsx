import { useEffect, useState } from 'react'
import { fetchAdminOrders } from '../../services/orderService.js'
import './Dashboard.css'

const SUMMARY_CARDS = [
  { label: 'Total Orders', value: 128 },
  { label: 'Pending Orders', value: 12 },
  { label: 'Completed Orders', value: 96 },
  { label: 'Total Customers', value: 84 },
]

const STATUS_CLASS = {
  Pending: 'dash-status--pending',
  Confirmed: 'dash-status--confirmed',
  Completed: 'dash-status--completed',
}

function formatOrderNumber(order) {
  if (order.order_number) return order.order_number

  const shortId = String(order.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return shortId ? `#SB-${shortId}` : '#SB'
}

function formatCustomerName(order) {
  return [order.first_name, order.last_name].filter(Boolean).join(' ').trim() || '—'
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatStatus(value) {
  const status = String(value || 'pending')
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function mapRecentOrder(order) {
  const status = formatStatus(order.order_status)
  const firstItem = order.order_items?.[0]

  return {
    id: formatOrderNumber(order),
    customer: formatCustomerName(order),
    email: order.email,
    product: firstItem?.product_name || '—',
    type: order.order_method ? formatStatus(order.order_method) : '—',
    status,
    date: formatDate(order.created_at),
  }
}

function Dashboard() {
  const [recentOrders, setRecentOrders] = useState([])
  const [isLoadingRecentOrders, setIsLoadingRecentOrders] = useState(true)

  useEffect(() => {
    let isMounted = true

    fetchAdminOrders()
      .then((orders) => {
        if (isMounted) setRecentOrders(orders.slice(0, 5).map(mapRecentOrder))
      })
      .catch(() => {
        if (isMounted) setRecentOrders([])
      })
      .finally(() => {
        if (isMounted) setIsLoadingRecentOrders(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="admin-page admin-dashboard-page">
      <div className="admin-page-heading">
        <h2>Dashboard</h2>
      </div>

      <div className="dash-cards">
        {SUMMARY_CARDS.map((card) => (
          <div className="dash-card" key={card.label}>
            <span className="dash-card-accent" aria-hidden="true" />
            <span className="dash-card-label">{card.label}</span>
            <strong className="dash-card-value">{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="dash-panel">
        <div className="dash-panel-header">
          <span className="dash-panel-title">Recent Orders</span>
        </div>
        <div className="dash-table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Order Type</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRecentOrders ? (
                <tr><td className="dash-empty" colSpan={6}>Loading orders...</td></tr>
              ) : recentOrders.length === 0 ? (
                <tr><td className="dash-empty" colSpan={6}>No recent orders found.</td></tr>
              ) : recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="dash-order-id">{order.id}</td>
                  <td>
                    <div className="admin-customer-cell">
                      <span className="admin-customer-name">{order.customer}</span>
                      {order.email ? <span className="admin-customer-email">{order.email}</span> : null}
                    </div>
                  </td>
                  <td>{order.product}</td>
                  <td>{order.type}</td>
                  <td><span className={`dash-status ${STATUS_CLASS[order.status] || ''}`}>{order.status}</span></td>
                  <td className="dash-muted">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dash-panel-footer">
          <a className="dash-view-all" href="/admin/orders">View All Orders →</a>
        </div>
      </div>
    </section>
  )
}

export default Dashboard
