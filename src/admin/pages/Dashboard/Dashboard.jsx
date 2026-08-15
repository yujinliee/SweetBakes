import './Dashboard.css'

function Dashboard() {
  return (
    <section className="admin-page admin-dashboard-page">
      <div className="admin-page-heading">
        <h2>Dashboard</h2>
        <p>Overview of Sweet Bakes operations and recent activity.</p>
      </div>

      <div className="admin-dashboard-grid">
        <article>
          <div className="admin-metric-header">
            <span className="admin-metric-icon" aria-hidden="true" />
            <small>Total Orders</small>
          </div>
          <strong>0</strong>
          <span>All requests</span>
        </article>
        <article>
          <div className="admin-metric-header">
            <span className="admin-metric-icon" aria-hidden="true" />
            <small>Pending Orders</small>
          </div>
          <strong>0</strong>
          <span>Needs review</span>
        </article>
        <article>
          <div className="admin-metric-header">
            <span className="admin-metric-icon" aria-hidden="true" />
            <small>Total Products</small>
          </div>
          <strong>0</strong>
          <span>Catalog items</span>
        </article>
        <article>
          <div className="admin-metric-header">
            <span className="admin-metric-icon" aria-hidden="true" />
            <small>Customers</small>
          </div>
          <strong>0</strong>
          <span>Saved records</span>
        </article>
      </div>

      <div className="admin-dashboard-panel">
        <div className="admin-section-heading">
          <h3>Recent Activity</h3>
          <p>New orders and updates will appear here.</p>
        </div>
        <div className="admin-empty-panel">No recent activity yet.</div>
      </div>
    </section>
  )
}

export default Dashboard
