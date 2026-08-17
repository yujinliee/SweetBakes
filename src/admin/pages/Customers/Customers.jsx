import { useEffect, useMemo, useRef, useState } from 'react'
import './Customers.css'

const CUSTOMERS = [
  {
    id: 'C001',
    name: 'Maria Santos',
    email: 'maria.santos@email.com',
    phone: '0917 123 4567',
    orders: 12,
    totalSpent: 18500,
    lastOrder: 'Aug 15, 2026',
    status: 'Active',
  },
  {
    id: 'C002',
    name: 'John Reyes',
    email: 'john.reyes@email.com',
    phone: '0928 456 7890',
    orders: 8,
    totalSpent: 12800,
    lastOrder: 'Aug 12, 2026',
    status: 'Active',
  },
  {
    id: 'C003',
    name: 'Angela Cruz',
    email: 'angela.cruz@email.com',
    phone: '0918 789 1234',
    orders: 5,
    totalSpent: 7250,
    lastOrder: 'Aug 8, 2026',
    status: 'Active',
  },
  {
    id: 'C004',
    name: 'Carlo Mendoza',
    email: 'carlo.mendoza@email.com',
    phone: '0906 321 9876',
    orders: 4,
    totalSpent: 6400,
    lastOrder: 'Aug 5, 2026',
    status: 'Active',
  },
  {
    id: 'C005',
    name: 'Sofia Garcia',
    email: 'sofia.garcia@email.com',
    phone: '0917 555 2468',
    orders: 3,
    totalSpent: 4850,
    lastOrder: 'Aug 2, 2026',
    status: 'Active',
  },
  {
    id: 'C006',
    name: 'Daniel Flores',
    email: 'daniel.flores@email.com',
    phone: '0920 111 3344',
    orders: 2,
    totalSpent: 3200,
    lastOrder: 'Jul 29, 2026',
    status: 'Active',
  },
  {
    id: 'C007',
    name: 'Patricia Lim',
    email: 'patricia.lim@email.com',
    phone: '0919 777 8899',
    orders: 1,
    totalSpent: 2500,
    lastOrder: 'Jul 25, 2026',
    status: 'Active',
  },
  {
    id: 'C008',
    name: 'Kevin Tan',
    email: 'kevin.tan@email.com',
    phone: '0908 444 5566',
    orders: 0,
    totalSpent: 0,
    lastOrder: 'Never',
    status: 'Inactive',
  },
]

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

const STATUS_OPTIONS = ['All Status', 'Active', 'Inactive']
const ACTIVITY_OPTIONS = ['All Customers', 'Has Orders', 'No Orders']

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function FilterDropdown({ id, value, options, icon, isOpen, onToggle, onSelect }) {
  return (
    <div className="admin-customers-filter-dropdown">
      <button
        id={`${id}-trigger`}
        type="button"
        className={`admin-customers-control admin-customers-control--select${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        {icon}
        <span className="admin-customers-control-value">{value}</span>
        <svg
          className={`admin-customers-control-chevron${isOpen ? ' is-open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul
        id={`${id}-menu`}
        className={`admin-customers-dropdown-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
      >
        {options.map((option) => (
          <li key={option} role="option" aria-selected={value === option}>
            <button
              type="button"
              className={`admin-customers-dropdown-option${value === option ? ' is-selected' : ''}`}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CustomerDetailModal({ customer, onClose }) {
  return (
    <div className="admin-customers-modal-backdrop" onClick={onClose}>
      <div className="admin-customers-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-customers-modal-header">
          <h3>Customer Details</h3>
          <button type="button" className="admin-customers-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="admin-customers-modal-body">
          <div className="admin-customers-modal-section">
            <p className="admin-customers-modal-name">{customer.name}</p>
            <p className="admin-customers-modal-meta">{customer.email}</p>
            <p className="admin-customers-modal-meta">{customer.phone}</p>
          </div>
          <div className="admin-customers-modal-stats">
            <div className="admin-customers-modal-stat">
              <span className="admin-customers-modal-stat-label">Order History</span>
              <span className="admin-customers-modal-stat-value">{customer.orders} {customer.orders === 1 ? 'Order' : 'Orders'}</span>
            </div>
            <div className="admin-customers-modal-stat">
              <span className="admin-customers-modal-stat-label">Total Spent</span>
              <span className="admin-customers-modal-stat-value">{CURRENCY_FORMATTER.format(customer.totalSpent)}</span>
            </div>
            <div className="admin-customers-modal-stat">
              <span className="admin-customers-modal-stat-label">Last Order</span>
              <span className="admin-customers-modal-stat-value">{customer.lastOrder}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Customers() {
  const selectAllRef = useRef(null)
  const filtersRef = useRef(null)
  const [searchValue, setSearchValue] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [selectedActivity, setSelectedActivity] = useState('All Customers')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [managingCustomer, setManagingCustomer] = useState(null)

  const filteredCustomers = useMemo(() => {
    const needle = normalizeText(searchValue).trim()

    return CUSTOMERS.filter((customer) => {
      const matchesSearch =
        needle.length === 0 ||
        normalizeText(customer.name).includes(needle) ||
        normalizeText(customer.email).includes(needle) ||
        normalizeText(customer.phone).includes(needle)

      const matchesStatus = selectedStatus === 'All Status' || customer.status === selectedStatus

      const matchesActivity =
        selectedActivity === 'All Customers' ||
        (selectedActivity === 'Has Orders' ? customer.orders > 0 : customer.orders === 0)

      return matchesSearch && matchesStatus && matchesActivity
    })
  }, [searchValue, selectedStatus, selectedActivity])

  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / rowsPerPage))
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)
  const visibleIds = paginatedCustomers.map((c) => c.id)
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const hasVisibleRows = visibleIds.length > 0
  const isAllVisibleSelected = hasVisibleRows && selectedVisibleCount === visibleIds.length
  const isPartiallySelected = selectedVisibleCount > 0 && !isAllVisibleSelected

  const from = filteredCustomers.length === 0 ? 0 : startIndex + 1
  const to = filteredCustomers.length === 0 ? 0 : Math.min(endIndex, filteredCustomers.length)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartiallySelected
    }
  }, [isPartiallySelected])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!filtersRef.current?.contains(event.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const goToPage = (nextPage) => setPage(Math.min(pageCount, Math.max(1, nextPage)))

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value)
    setPage(1)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value))
    setPage(1)
  }

  const handleToggleDropdown = (key) => {
    setOpenDropdown((current) => (current === key ? null : key))
  }

  const handleSelectDropdownValue = (setter) => (value) => {
    setter(value)
    setPage(1)
    setOpenDropdown(null)
  }

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <section className="admin-page admin-customers-page">
      <div className="admin-page-heading">
        <h2>Customers</h2>
      </div>

      <div className="admin-customers-toolbar" role="region" aria-label="Customer search and filters">
        <div className="admin-customers-search-wrap">
          <div className="admin-customers-control admin-customers-control--search">
            <svg className="admin-customers-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              id="customers-search"
              className="admin-customers-search"
              type="search"
              placeholder="Search customers..."
              value={searchValue}
              onChange={handleSearchChange}
              aria-label="Search customers"
            />
          </div>
        </div>

        <div className="admin-customers-filters" ref={filtersRef}>
          <label className="admin-customers-filter" aria-label="Status filter">
            <FilterDropdown
              id="customers-status"
              value={selectedStatus}
              options={STATUS_OPTIONS}
              isOpen={openDropdown === 'status'}
              onToggle={() => handleToggleDropdown('status')}
              onSelect={handleSelectDropdownValue(setSelectedStatus)}
              icon={
                <svg className="admin-customers-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
          </label>

          <label className="admin-customers-filter" aria-label="Order activity filter">
            <FilterDropdown
              id="customers-activity"
              value={selectedActivity}
              options={ACTIVITY_OPTIONS}
              isOpen={openDropdown === 'activity'}
              onToggle={() => handleToggleDropdown('activity')}
              onSelect={handleSelectDropdownValue(setSelectedActivity)}
              icon={
                <svg className="admin-customers-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M7 4h10l2 3v13H5V7l2-3Zm0 3h10M8 11h8M8 15h6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
          </label>
        </div>
      </div>

      <div className="admin-customers-table-shell">
        <div className="admin-customers-table-scroll">
          <table className="admin-customers-table">
            <thead>
              <tr>
                <th className="admin-customers-checkbox-column">
                  <input
                    ref={selectAllRef}
                    className="admin-customers-checkbox"
                    type="checkbox"
                    aria-label="Select all visible customers"
                    checked={isAllVisibleSelected}
                    disabled={!hasVisibleRows}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Last Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td className="admin-customers-empty" colSpan={8}>
                    No customers matched your filters.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="admin-customers-checkbox-column">
                      <input
                        className="admin-customers-checkbox"
                        type="checkbox"
                        aria-label={`Select ${customer.name}`}
                        checked={selectedIds.has(customer.id)}
                        onChange={() => handleToggleRow(customer.id)}
                      />
                    </td>
                    <td>
                      <div className="admin-customers-name">{customer.name}</div>
                      <div className="admin-customers-email">{customer.email}</div>
                    </td>
                    <td>{customer.phone}</td>
                    <td className="admin-customers-orders">{customer.orders}</td>
                    <td className="admin-customers-spent">{CURRENCY_FORMATTER.format(customer.totalSpent)}</td>
                    <td className={customer.lastOrder === 'Never' ? 'admin-customers-never' : ''}>{customer.lastOrder}</td>
                    <td>
                      <span className={`admin-customers-status admin-customers-status--${customer.status.toLowerCase()}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-customers-action-btn"
                        onClick={() => setManagingCustomer(customer)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-customers-pagination">
          <div className="admin-customers-pagination-summary">
            Showing {from}–{to} of {filteredCustomers.length} customers
          </div>

          <div className="admin-customers-pagination-controls">
            <label className="admin-customers-pagination-rows" htmlFor="customers-rows-per-page">
              Rows per page:
              <select id="customers-rows-per-page" value={rowsPerPage} onChange={handleRowsPerPageChange}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>

            <button
              type="button"
              className="admin-customers-page-btn"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="admin-customers-page-number">{currentPage}</span>
            <span className="admin-customers-page-divider">/</span>
            <span className="admin-customers-page-number">{pageCount}</span>

            <button
              type="button"
              className="admin-customers-page-btn"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {managingCustomer ? (
        <CustomerDetailModal customer={managingCustomer} onClose={() => setManagingCustomer(null)} />
      ) : null}
    </section>
  )
}

export default Customers
