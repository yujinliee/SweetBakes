import { useEffect, useMemo, useRef, useState } from 'react'
import './Orders.css'

const ORDERS = [
  {
    id: 'SB-1024',
    customer: 'Juan Dela Cruz',
    category: 'Cake',
    orderMethod: 'Pickup',
    orderDate: 'Aug 15, 2026',
    requestedDate: 'Aug 18, 2026',
    status: 'Pending',
    paymentStatus: 'Awaiting Payment',
    total: 2500,
  },
  {
    id: 'SB-1025',
    customer: 'Maria Santos',
    category: 'Cupcakes',
    orderMethod: 'Delivery',
    orderDate: 'Aug 14, 2026',
    requestedDate: 'Aug 17, 2026',
    status: 'Confirmed',
    paymentStatus: 'Verification',
    total: 1800,
  },
  {
    id: 'SB-1026',
    customer: 'Carlo Mendoza',
    category: 'Party Package',
    orderMethod: 'Pickup',
    orderDate: 'Aug 13, 2026',
    requestedDate: 'Aug 16, 2026',
    status: 'Preparing',
    paymentStatus: 'Paid',
    total: 5200,
  },
  {
    id: 'SB-1027',
    customer: 'Angelica Reyes',
    category: 'Cake',
    orderMethod: 'Delivery',
    orderDate: 'Aug 12, 2026',
    requestedDate: 'Aug 15, 2026',
    status: 'Ready',
    paymentStatus: 'Paid',
    total: 3100,
  },
  {
    id: 'SB-1028',
    customer: 'Rafael Lim',
    category: 'Cupcakes',
    orderMethod: 'Pickup',
    orderDate: 'Aug 11, 2026',
    requestedDate: 'Aug 14, 2026',
    status: 'Completed',
    paymentStatus: 'Paid',
    total: 1450,
  },
  {
    id: 'SB-1029',
    customer: 'Camille Tan',
    category: 'Party Package',
    orderMethod: 'Delivery',
    orderDate: 'Aug 10, 2026',
    requestedDate: 'Aug 13, 2026',
    status: 'Cancelled',
    paymentStatus: 'Unpaid',
    total: 4700,
  },
  {
    id: 'SB-1030',
    customer: 'Nina Garcia',
    category: 'Cake',
    orderMethod: 'Pickup',
    orderDate: 'Aug 9, 2026',
    requestedDate: 'Aug 12, 2026',
    status: 'Pending',
    paymentStatus: 'Awaiting Payment',
    total: 2200,
  },
  {
    id: 'SB-1031',
    customer: 'Paolo Villanueva',
    category: 'Cupcakes',
    orderMethod: 'Delivery',
    orderDate: 'Aug 8, 2026',
    requestedDate: 'Aug 11, 2026',
    status: 'Confirmed',
    paymentStatus: 'Verification',
    total: 1950,
  },
  {
    id: 'SB-1032',
    customer: 'Alyssa Cruz',
    category: 'Cake',
    orderMethod: 'Delivery',
    orderDate: 'Aug 7, 2026',
    requestedDate: 'Aug 10, 2026',
    status: 'Completed',
    paymentStatus: 'Paid',
    total: 2850,
  },
  {
    id: 'SB-1033',
    customer: 'Mark Bautista',
    category: 'Party Package',
    orderMethod: 'Pickup',
    orderDate: 'Aug 6, 2026',
    requestedDate: 'Aug 9, 2026',
    status: 'Preparing',
    paymentStatus: 'Verification',
    total: 5600,
  },
  {
    id: 'SB-1034',
    customer: 'Liza Ramos',
    category: 'Cupcakes',
    orderMethod: 'Pickup',
    orderDate: 'Aug 5, 2026',
    requestedDate: 'Aug 8, 2026',
    status: 'Ready',
    paymentStatus: 'Awaiting Payment',
    total: 1700,
  },
  {
    id: 'SB-1035',
    customer: 'Jerome Flores',
    category: 'Cake',
    orderMethod: 'Delivery',
    orderDate: 'Aug 4, 2026',
    requestedDate: 'Aug 7, 2026',
    status: 'Cancelled',
    paymentStatus: 'Unpaid',
    total: 2600,
  },
]

const TAB_OPTIONS = ['All Orders', 'Pending', 'Confirmed', 'Completed', 'Cancelled']

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

const CATEGORY_OPTIONS = ['All Categories', 'Cake', 'Cupcakes', 'Party Packages']
const METHOD_OPTIONS = ['All Methods', 'Pickup', 'Delivery']
const STATUS_OPTIONS = ['All Status', 'Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled']
const DATE_OPTIONS = ['All Dates', 'This Month', 'Custom Range (Soon)']

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function getStatusClassName(status) {
  const key = normalizeText(status).replace(/\s+/g, '-')
  return `admin-orders-status admin-orders-status--${key}`
}

function getPaymentClassName(paymentStatus) {
  const key = normalizeText(paymentStatus).replace(/\s+/g, '-')
  return `admin-orders-payment admin-orders-payment--${key}`
}

function FilterDropdown({
  id,
  value,
  options,
  icon,
  isOpen,
  onToggle,
  onSelect,
}) {
  return (
    <div className="admin-orders-filter-dropdown">
      <button
        id={`${id}-trigger`}
        type="button"
        className={`admin-orders-control admin-orders-control--select${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        {icon}
        <span className="admin-orders-control-value">{value}</span>
        <svg className={`admin-orders-control-chevron${isOpen ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m7 10 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <ul
        id={`${id}-menu`}
        className={`admin-orders-dropdown-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
      >
        {options.map((option) => (
          <li key={option} role="option" aria-selected={value === option}>
            <button
              type="button"
              className={`admin-orders-dropdown-option${value === option ? ' is-selected' : ''}`}
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

function Orders() {
  const selectAllRef = useRef(null)
  const filtersRef = useRef(null)
  const [searchValue, setSearchValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedMethod, setSelectedMethod] = useState('All Methods')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [selectedDate, setSelectedDate] = useState('All Dates')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [activeTab, setActiveTab] = useState('All Orders')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set())

  const tabCounts = useMemo(() => {
    return TAB_OPTIONS.reduce((accumulator, tab) => {
      if (tab === 'All Orders') {
        accumulator[tab] = ORDERS.length
        return accumulator
      }

      accumulator[tab] = ORDERS.filter((order) => order.status === tab).length
      return accumulator
    }, {})
  }, [])

  const filteredOrders = useMemo(() => {
    const searchNeedle = normalizeText(searchValue).trim()

    return ORDERS.filter((order) => {
      const matchesSearch =
        searchNeedle.length === 0 ||
        normalizeText(order.id).includes(searchNeedle) ||
        normalizeText(order.customer).includes(searchNeedle) ||
        normalizeText(order.category).includes(searchNeedle)

      const matchesCategory =
        selectedCategory === 'All Categories' ||
        (selectedCategory === 'Party Packages' ? order.category === 'Party Package' : order.category === selectedCategory)

      const matchesMethod = selectedMethod === 'All Methods' || order.orderMethod === selectedMethod

      const matchesStatus = selectedStatus === 'All Status' || order.status === selectedStatus

      const matchesDate = selectedDate === 'All Dates' || selectedDate === 'This Month'

      const matchesTab = activeTab === 'All Orders' || order.status === activeTab

      return matchesSearch && matchesCategory && matchesMethod && matchesStatus && matchesDate && matchesTab
    })
  }, [searchValue, selectedCategory, selectedMethod, selectedStatus, selectedDate, activeTab])

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage))
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)
  const visibleOrderIds = paginatedOrders.map((order) => order.id)
  const selectedVisibleCount = visibleOrderIds.filter((id) => selectedOrderIds.has(id)).length
  const hasVisibleRows = visibleOrderIds.length > 0
  const isAllVisibleSelected = hasVisibleRows && selectedVisibleCount === visibleOrderIds.length
  const isPartiallyVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected

  const from = filteredOrders.length === 0 ? 0 : startIndex + 1
  const to = filteredOrders.length === 0 ? 0 : Math.min(endIndex, filteredOrders.length)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartiallyVisibleSelected
    }
  }, [isPartiallyVisibleSelected])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!filtersRef.current?.contains(event.target)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const goToPage = (nextPage) => {
    setPage(Math.min(pageCount, Math.max(1, nextPage)))
  }

  const handleFilterChange = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value)
    setPage(1)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setPage(1)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value))
    setPage(1)
  }

  const handleToggleDropdown = (dropdownKey) => {
    setOpenDropdown((current) => (current === dropdownKey ? null : dropdownKey))
  }

  const handleSelectDropdownValue = (setter) => (value) => {
    handleFilterChange(setter)(value)
    setOpenDropdown(null)
  }

  const handleToggleSelectAll = () => {
    setSelectedOrderIds((previous) => {
      const next = new Set(previous)

      if (isAllVisibleSelected) {
        visibleOrderIds.forEach((id) => next.delete(id))
        return next
      }

      visibleOrderIds.forEach((id) => next.add(id))
      return next
    })
  }

  const handleToggleOrderSelection = (orderId) => {
    setSelectedOrderIds((previous) => {
      const next = new Set(previous)

      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }

      return next
    })
  }

  return (
    <section className="admin-page admin-orders-page">
      <div className="admin-page-heading">
        <h2>Orders</h2>
      </div>

      <div className="admin-orders-toolbar" role="region" aria-label="Order search and filters">
        <div className="admin-orders-search-wrap">
          <div className="admin-orders-control admin-orders-control--search">
            <svg className="admin-orders-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              id="orders-search"
              className="admin-orders-search"
              type="search"
              placeholder="Search orders..."
              value={searchValue}
              onChange={handleSearchChange}
              aria-label="Search orders"
            />
          </div>
        </div>

        <div className="admin-orders-filters" ref={filtersRef}>
          <label className="admin-orders-filter" aria-label="Category filter">
            <FilterDropdown
              id="orders-category"
              value={selectedCategory}
              options={CATEGORY_OPTIONS}
              isOpen={openDropdown === 'category'}
              onToggle={() => handleToggleDropdown('category')}
              onSelect={handleSelectDropdownValue(setSelectedCategory)}
              icon={
              <svg className="admin-orders-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              }
            />
          </label>

          <label className="admin-orders-filter" aria-label="Order method filter">
            <FilterDropdown
              id="orders-method"
              value={selectedMethod}
              options={METHOD_OPTIONS}
              isOpen={openDropdown === 'method'}
              onToggle={() => handleToggleDropdown('method')}
              onSelect={handleSelectDropdownValue(setSelectedMethod)}
              icon={
              <svg className="admin-orders-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 7h13M16 4l4 3-4 3M17 17H4M8 14l-4 3 4 3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              }
            />
          </label>

          <label className="admin-orders-filter" aria-label="Status filter">
            <FilterDropdown
              id="orders-status"
              value={selectedStatus}
              options={STATUS_OPTIONS}
              isOpen={openDropdown === 'status'}
              onToggle={() => handleToggleDropdown('status')}
              onSelect={handleSelectDropdownValue(setSelectedStatus)}
              icon={
              <svg className="admin-orders-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

          <label className="admin-orders-filter" aria-label="Date filter">
            <FilterDropdown
              id="orders-date"
              value={selectedDate}
              options={DATE_OPTIONS}
              isOpen={openDropdown === 'date'}
              onToggle={() => handleToggleDropdown('date')}
              onSelect={handleSelectDropdownValue(setSelectedDate)}
              icon={
              <svg className="admin-orders-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
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

      <div className="admin-orders-tabs" role="tablist" aria-label="Order status tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`admin-orders-tab${activeTab === tab ? ' admin-orders-tab--active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab}
            <span className="admin-orders-tab-count">{tabCounts[tab]}</span>
          </button>
        ))}
      </div>

      <div className="admin-orders-table-shell">
        <div className="admin-orders-table-scroll">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th className="admin-orders-checkbox-column">
                  <input
                    ref={selectAllRef}
                    className="admin-orders-checkbox"
                    type="checkbox"
                    aria-label="Select all visible orders"
                    checked={isAllVisibleSelected}
                    disabled={!hasVisibleRows}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Category</th>
                <th>Order Method</th>
                <th>Order Date</th>
                <th>Requested Date</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td className="admin-orders-empty" colSpan={11}>
                    No orders matched your filters.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="admin-orders-checkbox-column">
                      <input
                        className="admin-orders-checkbox"
                        type="checkbox"
                        aria-label={`Select order ${order.id}`}
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => handleToggleOrderSelection(order.id)}
                      />
                    </td>
                    <td className="admin-orders-id">{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.category}</td>
                    <td>{order.orderMethod}</td>
                    <td>{order.orderDate}</td>
                    <td>{order.requestedDate}</td>
                    <td>
                      <span className={getStatusClassName(order.status)}>{order.status}</span>
                    </td>
                    <td>
                      <span className={getPaymentClassName(order.paymentStatus)}>{order.paymentStatus}</span>
                    </td>
                    <td className="admin-orders-total">{CURRENCY_FORMATTER.format(order.total)}</td>
                    <td>
                      <button type="button" className="admin-orders-action-btn">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-orders-pagination">
          <div className="admin-orders-pagination-summary">
            Showing {from}-{to} of {filteredOrders.length} orders
          </div>

          <div className="admin-orders-pagination-controls">
            <label className="admin-orders-pagination-rows" htmlFor="orders-rows-per-page">
              Rows per page:
              <select id="orders-rows-per-page" value={rowsPerPage} onChange={handleRowsPerPageChange}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>

            <button
              type="button"
              className="admin-orders-page-btn"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="admin-orders-page-number">{currentPage}</span>
            <span className="admin-orders-page-divider">/</span>
            <span className="admin-orders-page-number">{pageCount}</span>

            <button
              type="button"
              className="admin-orders-page-btn"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Orders
