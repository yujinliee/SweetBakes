import AdminTable from '../../components/common/AdminTable.jsx'
import './CustomOrders.css'

const columns = [
  { key: 'requestNumber', label: 'Request Number' },
  { key: 'type', label: 'Type' },
  { key: 'preferredDate', label: 'Preferred Date' },
]

function CustomOrders() {
  return (
    <section className="admin-page admin-custom-orders-page">
      <div className="admin-page-heading">
        <h2>Custom Orders</h2>
        <p>Review custom cake, cupcake, and party package requests.</p>
      </div>

      <AdminTable columns={columns} rows={[]} emptyText="No custom orders found." />
    </section>
  )
}

export default CustomOrders
