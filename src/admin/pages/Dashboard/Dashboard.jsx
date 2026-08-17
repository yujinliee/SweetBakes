import './Dashboard.css'

const SUMMARY_CARDS = [
  { label: 'Total Orders', value: 128 },
  { label: 'Pending Orders', value: 12 },
  { label: 'Completed Orders', value: 96 },
  { label: 'Total Customers', value: 84 },
]

const RECENT_ORDERS = [
  { id: '#ORD-001', customer: 'Maria Santos', product: 'Custom Cake', type: 'Pickup', status: 'Pending', date: 'Aug 15, 2026' },
  { id: '#ORD-002', customer: 'John Reyes', product: 'Custom Cupcakes', type: 'Delivery', status: 'Confirmed', date: 'Aug 15, 2026' },
  { id: '#ORD-003', customer: 'Angela Cruz', product: 'Party Package', type: 'Pickup', status: 'Completed', date: 'Aug 14, 2026' },
  { id: '#ORD-004', customer: 'Carlo Mendoza', product: 'Custom Cake', type: 'Delivery', status: 'Completed', date: 'Aug 14, 2026' },
  { id: '#ORD-005', customer: 'Sofia Garcia', product: 'Custom Cupcakes', type: 'Pickup', status: 'Pending', date: 'Aug 13, 2026' },
]

const STATUS_CLASS = {
  Pending: 'dash-status--pending',
  Confirmed: 'dash-status--confirmed',
  Completed: 'dash-status--completed',
}

function Dashboard() {
  return (
    <section className="admin-page admin-dashboard-page">
      <div className="admin-page-heading">
        <h2>Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div className="dash-cards">
        {SUMMARY_CARDS.map((card) => (
          <div className="dash-card" key={card.label}>
            <span className="dash-card-accent" aria-hidden="true" />
            <span className="dash-card-label">{card.label}</span>
            <strong className="dash-card-value">{card.value}</strong>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
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
        <div className="dash-panel-footer">
          <a className="dash-view-all" href="/admin/orders">View All Orders →</a>
        </div>
      </div>
    </section>
  )
}

export default Dashboard