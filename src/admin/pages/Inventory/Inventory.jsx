import AdminTable from '../../components/common/AdminTable.jsx'
import './Inventory.css'

const columns = [
  { key: 'item', label: 'Item' },
  { key: 'stock', label: 'Stock' },
  { key: 'unit', label: 'Unit' },
]

function Inventory() {
  return (
    <section className="admin-page admin-inventory-page">
      <div className="admin-page-heading">
        <h2>Inventory</h2>
        <p>Track ingredients, supplies, and stock levels.</p>
      </div>

      <AdminTable columns={columns} rows={[]} emptyText="No inventory items added yet." />
    </section>
  )
}

export default Inventory
