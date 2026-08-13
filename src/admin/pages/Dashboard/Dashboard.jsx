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
          <small>Total Orders</small>
          <strong>0</strong>
          <span>All requests</span>
        </article>
        <article>
          <small>Pending Orders</small>
          <strong>0</strong>
          <span>Needs review</span>
        </article>
        <article>
          <small>Total Products</small>
          <strong>0</strong>
          <span>Catalog items</span>
        </article>
        <article>
          <small>Customers</small>
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
