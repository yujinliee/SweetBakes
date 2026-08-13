import { useState } from 'react'
import AdminTable from '../../components/common/AdminTable.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import './Customers.css'

const columns = [
  { key: 'name', label: 'Customer Name' },
  { key: 'contact', label: 'Contact Number' },
  { key: 'email', label: 'Email Address' },
  { key: 'actions', label: 'Actions' },
]

function Customers() {
  const [searchValue, setSearchValue] = useState('')

  return (
    <section className="admin-page admin-customers-page">
      <div className="admin-page-toolbar">
        <div className="admin-page-heading">
          <h2>Customers</h2>
          <p>View customer records and contact details.</p>
        </div>
        <SearchBar
          value={searchValue}
          placeholder="Search customers"
          showLabel={false}
          onChange={setSearchValue}
        />
      </div>

      <AdminTable columns={columns} rows={[]} emptyText="No customers found." />
    </section>
  )
}

export default Customers
