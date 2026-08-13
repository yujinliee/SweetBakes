import AdminTable from '../../components/common/AdminTable.jsx'
import './Products.css'

const columns = [
  { key: 'name', label: 'Product Name' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
]

function Products() {
  return (
    <section className="admin-page admin-products-page">
      <div className="admin-page-heading">
        <h2>Products</h2>
        <p>Organize cakes, cupcakes, and package offerings.</p>
      </div>

      <AdminTable columns={columns} rows={[]} emptyText="No products added yet." />
    </section>
  )
}

export default Products
