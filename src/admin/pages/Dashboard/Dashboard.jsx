import './Dashboard.css'

const WEEK_DATA = [
  { day: 'Mon', orders: 4 },
  { day: 'Tue', orders: 7 },
  { day: 'Wed', orders: 5 },
  { day: 'Thu', orders: 9 },
  { day: 'Fri', orders: 12 },
  { day: 'Sat', orders: 15 },
  { day: 'Sun', orders: 8 },
]

const CATEGORY_DATA = [
  { label: 'Cakes', count: 38, color: '#8b6ea8' },
  { label: 'Cupcakes', count: 27, color: '#a78cc4' },
  { label: 'Party Packages', count: 19, color: '#c4aad8' },
]

const RECENT_ORDERS = [
  { id: 'SB-1035', customer: 'Jerome Flores', product: 'Custom Cake', type: 'Delivery', status: 'Cancelled', date: 'Aug 4, 2026' },
  { id: 'SB-1034', customer: 'Liza Ramos', product: 'Cupcake Box', type: 'Pickup', status: 'Ready', date: 'Aug 5, 2026' },
  { id: 'SB-1033', customer: 'Mark Bautista', product: 'Party Package', type: 'Pickup', status: 'Preparing', date: 'Aug 6, 2026' },
  { id: 'SB-1032', customer: 'Alyssa Cruz', product: 'Custom Cake', type: 'Delivery', status: 'Completed', date: 'Aug 7, 2026' },
  { id: 'SB-1031', customer: 'Paolo Villanueva', product: 'Cupcake Box', type: 'Delivery', status: 'Confirmed', date: 'Aug 8, 2026' },
  { id: 'SB-1030', customer: 'Nina Garcia', product: 'Custom Cake', type: 'Pickup', status: 'Pending', date: 'Aug 9, 2026' },
]

const RECENT_CUSTOMERS = [
  { name: 'Nina Garcia', email: 'nina@email.com', joined: 'Aug 9, 2026' },
  { name: 'Paolo Villanueva', email: 'paolo@email.com', joined: 'Aug 8, 2026' },
  { name: 'Alyssa Cruz', email: 'alyssa@email.com', joined: 'Aug 7, 2026' },
  { name: 'Mark Bautista', email: 'mark@email.com', joined: 'Aug 6, 2026' },
]

const STATUS_CLASS = {
  Pending: 'dash-status--pending',
  Confirmed: 'dash-status--confirmed',
  Preparing: 'dash-status--preparing',
  Ready: 'dash-status--ready',
  Completed: 'dash-status--completed',
  Cancelled: 'dash-status--cancelled',
}

const CHART_H = 96
const maxOrders = Math.max(...WEEK_DATA.map((d) => d.orders))

function Dashboard() {
  const totalCategory = CATEGORY_DATA.reduce((s, c) => s + c.count, 0)

  return (
    <section className="admin-page admin-dashboard-page">
      <div className="admin-page-heading">
        <h2>Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div className="dash-cards">
        {[
          { label: 'Total Orders', value: 84, sub: 'All time' },
          { label: 'Pending Orders', value: 12, sub: 'Needs review' },
          { label: 'Completed Orders', value: 57, sub: 'Fulfilled' },
          { label: 'Total Customers', value: 43, sub: 'Registered' },
        ].map((card) => (
          <div className="dash-card" key={card.label}>
            <span className="dash-card-label">{card.label}</span>
            <strong className="dash-card-value">{card.value}</strong>
            <span className="dash-card-sub">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Middle row: chart + category */}
      <div className="dash-mid-row">
        {/* Orders Overview */}
        <div className="dash-panel dash-panel--chart">
          <div className="dash-panel-header">
            <span className="dash-panel-title">Orders Overview</span>
            <span className="dash-panel-meta">Past 7 days</span>
          </div>
          <div className="dash-chart">
            <svg
              className="dash-chart-svg"
              viewBox={`0 0 ${WEEK_DATA.length * 52} ${CHART_H + 28}`}
              preserveAspectRatio="none"
              aria-label="Orders over the past week"
              role="img"
            >
              {WEEK_DATA.map((d, i) => {
                const barH = Math.round((d.orders / maxOrders) * CHART_H)
                const x = i * 52 + 10
                const y = CHART_H - barH
                return (
                  <g key={d.day}>
                    <rect
                      x={x}
                      y={y}
                      width={32}
                      height={barH}
                      rx={5}
                      fill="#8b6ea8"
                      opacity="0.18"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={32}
                      height={6}
                      rx={3}
                      fill="#8b6ea8"
                    />
                    <text
                      x={x + 16}
                      y={CHART_H + 18}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#9ca3af"
                      fontFamily="Poppins, sans-serif"
                    >
                      {d.day}
                    </text>
                    <text
                      x={x + 16}
                      y={y - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#6b7280"
                      fontFamily="Poppins, sans-serif"
                    >
                      {d.orders}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Orders by Category */}
        <div className="dash-panel dash-panel--category">
          <div className="dash-panel-header">
            <span className="dash-panel-title">Orders by Category</span>
            <span className="dash-panel-meta">{totalCategory} total</span>
          </div>
          <div className="dash-category-list">
            {CATEGORY_DATA.map((cat) => {
              const pct = Math.round((cat.count / totalCategory) * 100)
              return (
                <div className="dash-category-row" key={cat.label}>
                  <div className="dash-category-top">
                    <span className="dash-category-name">{cat.label}</span>
                    <span className="dash-category-count">{cat.count} <span className="dash-category-pct">({pct}%)</span></span>
                  </div>
                  <div className="dash-bar-track">
                    <div
                      className="dash-bar-fill"
                      style={{ width: `${pct}%`, background: cat.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="dash-panel">
        <div className="dash-panel-header">
          <span className="dash-panel-title">Recent Orders</span>
          <a className="dash-view-all" href="/admin/orders">View All Orders →</a>
        </div>
        <div className="dash-table-shell">
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
              {RECENT_ORDERS.map((order) => (
                <tr key={order.id}>
                  <td className="dash-order-id">{order.id}</td>
                  <td>{order.customer}</td>
                  <td>{order.product}</td>
                  <td>{order.type}</td>
                  <td>
                    <span className={`dash-status ${STATUS_CLASS[order.status]}`}>{order.status}</span>
                  </td>
                  <td className="dash-muted">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Customers */}
      <div className="dash-panel">
        <div className="dash-panel-header">
          <span className="dash-panel-title">Recent Customers</span>
          <a className="dash-view-all" href="/admin/customers">View Customers →</a>
        </div>
        <div className="dash-customer-list">
          {RECENT_CUSTOMERS.map((c) => (
            <div className="dash-customer-row" key={c.email}>
              <div className="dash-customer-avatar" aria-hidden="true">
                {c.name.charAt(0)}
              </div>
              <div className="dash-customer-info">
                <span className="dash-customer-name">{c.name}</span>
                <span className="dash-customer-email">{c.email}</span>
              </div>
              <span className="dash-customer-date">{c.joined}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Dashboard
