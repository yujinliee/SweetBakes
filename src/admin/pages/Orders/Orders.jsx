import AdminTable from '../../components/common/AdminTable.jsx'
import StatusBadge from '../../components/common/StatusBadge.jsx'
import './Orders.css'

const columns = [
  { key: 'requestNumber', label: 'Request Number' },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
]

function Orders() {
  return (
    <section className="admin-page admin-orders-page">
      <div className="admin-page-heading">
        <h2>Orders</h2>
        <p>Manage standard Sweet Bakes order requests.</p>
      </div>

      <AdminTable
        columns={columns}
        rows={[
          {
            id: 'sample-order',
            requestNumber: 'No orders yet',
            customer: 'None',
            status: <StatusBadge />,
          },
        ]}
      />
    </section>
  )
}

export default Orders
