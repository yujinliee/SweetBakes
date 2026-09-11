import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchAdminReviews } from '../../services/reviewService.js'
import { fetchAdminOrders } from '../../services/orderService.js'
import { getOrderProgressStages, getOrderProgressStage, isRegularProgressOrder } from '../../../services/orderStatusDisplay.js'
import { formatDisplayTime } from '../../../components/timeUtils.js'
import chocolateCakeImage from '../../../assets/othersweettreats/regular_chocolate.jpg'
import redVelvetCakeImage from '../../../assets/othersweettreats/regular_redvelvet.png'
import cheesecakeImage from '../../../assets/othersweettreats/halfordozen_cheesecake.png'
import ubeImage from '../../../assets/othersweettreats/ube.png'
import grahamImage from '../../../assets/othersweettreats/graham de leche.png'
import lecheFlanImage from '../../../assets/othersweettreats/leche_flan.png'
import putoImage from '../../../assets/othersweettreats/puto.jpg'
import './Reviews.css'
import '../Orders/Orders.css'

const TAB_OPTIONS = ['All Reviews', '5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star']
const RATING_OPTIONS = ['All Ratings', '5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star']
const DATE_OPTIONS = ['All Dates', 'Today', 'This Week', 'This Month']
const ROWS_PER_PAGE_OPTIONS = [5, 10, 15]

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

const PRODUCT_TYPE_LABELS = {
  cake: 'Cakes',
  cupcake: 'Cupcakes',
  party_package: 'Party Packages',
  sweet_treat: 'Sweet Treats',
}

const CUSTOM_CAKE_TYPE_LABEL = 'Custom Cake'

const PAYMENT_STATUS_LABELS = {
  unpaid: 'Unpaid',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

const STATIC_FALLBACK_IMAGES = {
  'chocolate cake': chocolateCakeImage,
  'red velvet cake': redVelvetCakeImage,
  'cheesecake': cheesecakeImage,
  'blueberry cheesecake': cheesecakeImage,
  'mango cheesecake': cheesecakeImage,
  'strawberry cheesecake': cheesecakeImage,
  'oreo cheesecake': cheesecakeImage,
  'ube': ubeImage,
  'graham de leche': grahamImage,
  'leche flan': lecheFlanImage,
  'puto': putoImage,
}

const ORDER_METHOD_LABELS = {
  delivery: 'Delivery',
  pickup: 'Store Pickup',
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMATTER.format(date)
}

function formatCustomerName(order) {
  const name = [order.first_name, order.last_name].filter(Boolean).join(' ').trim()
  return name || 'Customer'
}

function buildSearchText(review) {
  const order = review.orders || {}
  const items = order.order_items || []
  return [
    order.order_number,
    order.first_name,
    order.last_name,
    order.email,
    review.comment,
    ...items.map((item) => item.product_name),
  ]
    .map(normalizeText)
    .join(' ')
}

function isToday(dateValue) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  const today = new Date()
  return (
    !Number.isNaN(date.getTime()) &&
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function isThisWeek(dateValue) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return !Number.isNaN(date.getTime()) && date >= startOfWeek && date <= today
}

function isThisMonth(dateValue) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  const today = new Date()
  return (
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function mapRatingLabel(rating) {
  const labels = { 5: '5 Stars', 4: '4 Stars', 3: '3 Stars', 2: '2 Stars', 1: '1 Star' }
  return labels[rating] || ''
}

function toTitleCase(value) {
  return String(value || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

function resolveOrderThumbnail(order) {
  if (order.thumbnailUrl) return order.thumbnailUrl
  const firstName = normalizeText((order.order_items?.[0]?.product_name) || '')
  if (firstName) {
    for (const [key, img] of Object.entries(STATIC_FALLBACK_IMAGES)) {
      if (firstName.includes(key)) return img
    }
  }
  return null
}

function formatPrice(value, order = null) {
  return CURRENCY_FORMATTER.format(Number(value) || 0)
}

function formatOrderNumber(order) {
  if (order.order_number) return order.order_number
  const shortId = String(order.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return shortId ? `#SB-${shortId}` : '#SB'
}

function formatOrderMethod(value) {
  return ORDER_METHOD_LABELS[normalizeText(value)] || toTitleCase(value) || '—'
}

function formatStatus(value) {
  return toTitleCase(value) || 'Pending'
}

function formatPaymentStatus(value) {
  return PAYMENT_STATUS_LABELS[normalizeText(value)] || toTitleCase(value) || 'Unpaid'
}

function getOrderItemTypes(order) {
  const types = new Set(
    (order.order_items || [])
      .map((item) =>
        item.customization_data?.request_type === 'custom_cake'
          ? CUSTOM_CAKE_TYPE_LABEL
          : PRODUCT_TYPE_LABELS[normalizeText(item.product_type)] || toTitleCase(item.product_type),
      )
      .filter(Boolean),
  )
  return [...types]
}

function formatCategory(order) {
  const types = getOrderItemTypes(order)
  if (types.length === 0) return '—'
  if (types.length === 1) return types[0]
  return 'Mixed'
}

function isCustomizedOrder(order) {
  return (order.order_items || []).some((item) => {
    const requestType = normalizeText(item.customization_data?.request_type)
    const productType = normalizeText(item.product_type)
    return requestType === 'custom_cake' ||
      requestType === 'custom_cupcake' ||
      requestType === 'custom_cupcakes' ||
      requestType === 'custom_party_package' ||
      requestType === 'custom_package' ||
      (['cupcake', 'cupcakes', 'party_package'].includes(productType) && item.customization_data?.is_custom === true)
  })
}

function mapAdminOrder(order) {
  return {
    ...order,
    displayId: formatOrderNumber(order),
    customer: formatCustomerName(order),
    category: formatCategory(order),
    orderMethod: formatOrderMethod(order.order_method),
    requestedDate: formatDate(order.preferred_date),
    preferredTime: formatDisplayTime(order.preferred_time, '—'),
    status: formatStatus(order.order_status),
    paymentStatus: formatPaymentStatus(order.payment_status),
    total: order.total === null || order.total === undefined ? null : Number(order.total) || 0,
    subtotal: order.subtotal === null || order.subtotal === undefined ? null : Number(order.subtotal) || 0,
    deliveryFee:
      order.delivery_fee === null || order.delivery_fee === undefined
        ? null
        : Number(order.delivery_fee) || 0,
    isCustomized: isCustomizedOrder(order),
  }
}

function getStatusClassName(status) {
  const key = normalizeText(status).replace(/\s+/g, '-')
  return `admin-orders-status admin-orders-status--${key}`
}

function getPaymentClassName(paymentStatus) {
  const key = normalizeText(paymentStatus).replace(/\s+/g, '-')
  return `admin-orders-payment admin-orders-payment--${key}`
}

function OrderDetailIcon({ type }) {
  const paths = {
    person: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0',
    calendar: 'M5 6h14v13H5V6Zm3-2v4m8-4v4M5 10h14',
    clock: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3v4l3 2',
    location: 'M12 20s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  }
  return <svg className="admin-order-detail-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[type] || paths.person} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function OrderThumbnail({ order }) {
  const [errored, setErrored] = useState(false)
  const src = resolveOrderThumbnail(order)
  if (!src || errored) {
    return <span className="admin-orders-thumb admin-orders-thumb--placeholder" aria-hidden="true" />
  }
  return (
    <span className="admin-orders-thumb" aria-hidden="true">
      <img src={src} alt="" onError={() => setErrored(true)} />
    </span>
  )
}

function FilterDropdown({ id, value, options, icon, isOpen, onToggle, onSelect }) {
  return (
    <div className="admin-reviews-filter-dropdown">
      <button
        id={`${id}-trigger`}
        type="button"
        className={`admin-reviews-control admin-reviews-control--select${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        {icon}
        <span className="admin-reviews-control-value">{value}</span>
        <svg className={`admin-reviews-control-chevron${isOpen ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul
        id={`${id}-menu`}
        className={`admin-reviews-dropdown-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
      >
        {options.map((option) => (
          <li key={option} role="option" aria-selected={value === option}>
            <button
              type="button"
              className={`admin-reviews-dropdown-option${value === option ? ' is-selected' : ''}`}
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

export default function Reviews({ onNavigate }) {
  const selectAllRef = useRef(null)
  const filtersRef = useRef(null)

  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [orders, setOrders] = useState([])
  const [activeOrderId, setActiveOrderId] = useState(null)

  const [searchValue, setSearchValue] = useState('')
  const [selectedRating, setSelectedRating] = useState('All Ratings')
  const [selectedDate, setSelectedDate] = useState('All Dates')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [activeTab, setActiveTab] = useState('All Reviews')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  useEffect(() => {
    let mounted = true
    fetchAdminReviews()
      .then((data) => {
        if (mounted) setReviews(data)
      })
      .catch(() => {
        if (mounted) setError('Unable to load reviews. Please try again.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    fetchAdminOrders()
      .then((data) => {
        if (mounted) setOrders(data)
      })
      .catch((orderError) => {
        console.error('[ADMIN REVIEWS] load orders:', orderError)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!filtersRef.current?.contains(event.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const displayReviews = useMemo(() => {
    return reviews.map((review) => {
      const order = review.orders || {}
      const items = [...(order.order_items || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
      return {
        ...review,
        orderNumber: order.order_number || 'Unavailable',
        customerName: formatCustomerName(order),
        customerEmail: order.email || '',
        productName: items[0]?.product_name || 'Order',
        extraItems: items.length > 1 ? items.length - 1 : 0,
        displayDate: formatDate(review.created_at),
        rawDate: review.created_at,
        searchText: buildSearchText(review),
      }
    })
  }, [reviews])

  const tabCounts = useMemo(() => {
    return TAB_OPTIONS.reduce((accumulator, tab) => {
      if (tab === 'All Reviews') {
        accumulator[tab] = displayReviews.length
        return accumulator
      }
      const ratingMap = { '5 Stars': 5, '4 Stars': 4, '3 Stars': 3, '2 Stars': 2, '1 Star': 1 }
      accumulator[tab] = displayReviews.filter((r) => r.rating === ratingMap[tab]).length
      return accumulator
    }, {})
  }, [displayReviews])

  const filteredReviews = useMemo(() => {
    const searchNeedle = normalizeText(searchValue).trim()

    return displayReviews.filter((review) => {
      const matchesSearch = searchNeedle.length === 0 || review.searchText.includes(searchNeedle)

      const ratingMap = { 'All Ratings': 0, '5 Stars': 5, '4 Stars': 4, '3 Stars': 3, '2 Stars': 2, '1 Star': 1 }
      const matchesRating =
        selectedRating === 'All Ratings' || review.rating === ratingMap[selectedRating]

      const matchesDate =
        selectedDate === 'All Dates' ||
        (selectedDate === 'Today' && isToday(review.rawDate)) ||
        (selectedDate === 'This Week' && isThisWeek(review.rawDate)) ||
        (selectedDate === 'This Month' && isThisMonth(review.rawDate))

      const tabRatingMap = { 'All Reviews': 0, '5 Stars': 5, '4 Stars': 4, '3 Stars': 3, '2 Stars': 2, '1 Star': 1 }
      const matchesTab =
        activeTab === 'All Reviews' || review.rating === tabRatingMap[activeTab]

      return matchesSearch && matchesRating && matchesDate && matchesTab
    })
  }, [displayReviews, searchValue, selectedRating, selectedDate, activeTab])

  const pageCount = Math.max(1, Math.ceil(filteredReviews.length / rowsPerPage))
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedReviews = filteredReviews.slice(startIndex, endIndex)
  const visibleIds = paginatedReviews.map((r) => r.id)
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const hasVisibleRows = visibleIds.length > 0
  const isAllVisibleSelected = hasVisibleRows && selectedVisibleCount === visibleIds.length
  const isPartiallyVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected

  const from = filteredReviews.length === 0 ? 0 : startIndex + 1
  const to = filteredReviews.length === 0 ? 0 : Math.min(endIndex, filteredReviews.length)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartiallyVisibleSelected
    }
  }, [isPartiallyVisibleSelected])

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
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (isAllVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
        return next
      }
      visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  const handleToggleRowSelection = (id) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDeleteSelected = () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected review(s)?`)) return
    setSelectedIds(new Set())
  }

  const activeOrder = useMemo(() => {
    const order = orders.find((item) => item.id === activeOrderId)
    return order ? mapAdminOrder(order) : null
  }, [orders, activeOrderId])

  const openOrderDetails = (orderId) => {
    setActiveOrderId(orderId)
  }

  const closeOrderDetails = () => {
    setActiveOrderId(null)
  }

  useEffect(() => {
    if (!activeOrder) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') setActiveOrderId(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [activeOrder])

  const renderStars = (rating) => {
    const filled = '\u2605'
    const empty = '\u2606'
    return `${filled.repeat(rating)}${empty.repeat(5 - rating)}`
  }

  return (
    <section className="admin-reviews-page">
      <div className="admin-page-heading">
        <p className="admin-reviews-breadcrumb">Admin / <strong>Reviews</strong></p>
        <h2>Reviews</h2>
      </div>

      <div className="admin-reviews-toolbar" role="region" aria-label="Review search and filters">
        <div className="admin-reviews-search-wrap">
          <div className="admin-reviews-control admin-reviews-control--search">
            <svg className="admin-reviews-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              id="reviews-search"
              className="admin-reviews-search"
              type="search"
              placeholder="Search reviews..."
              value={searchValue}
              onChange={handleSearchChange}
              aria-label="Search reviews"
            />
          </div>
        </div>

        <div className="admin-reviews-filters" ref={filtersRef}>
          <label className="admin-reviews-filter" aria-label="Rating filter">
            <FilterDropdown
              id="reviews-rating"
              value={selectedRating}
              options={RATING_OPTIONS}
              isOpen={openDropdown === 'rating'}
              onToggle={() => handleToggleDropdown('rating')}
              onSelect={handleSelectDropdownValue(setSelectedRating)}
              icon={
                <svg className="admin-reviews-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3-1.1-6.5L.4 8.8l6.5-.9L12 2z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
          </label>

          <label className="admin-reviews-filter" aria-label="Date filter">
            <FilterDropdown
              id="reviews-date"
              value={selectedDate}
              options={DATE_OPTIONS}
              isOpen={openDropdown === 'date'}
              onToggle={() => handleToggleDropdown('date')}
              onSelect={handleSelectDropdownValue(setSelectedDate)}
              icon={
                <svg className="admin-reviews-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

      <div className="admin-reviews-tabs" role="tablist" aria-label="Review rating tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`admin-reviews-tab${activeTab === tab ? ' admin-reviews-tab--active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab}
            <span className="admin-reviews-tab-count">{tabCounts[tab]}</span>
          </button>
        ))}
      </div>

      <div className="admin-reviews-table-shell">
        {selectedIds.size > 0 && (
          <div className="admin-reviews-bulk-bar">
            <span>{selectedIds.size} item(s) selected</span>
            <button type="button" className="admin-reviews-bulk-delete" onClick={handleDeleteSelected}>
              Delete Selected
            </button>
          </div>
        )}

        <div className="admin-reviews-table-scroll">
          <table className="admin-reviews-table">
            <thead>
              <tr>
                <th className="admin-reviews-checkbox-column">
                  <input
                    ref={selectAllRef}
                    className="admin-reviews-checkbox"
                    type="checkbox"
                    aria-label="Select all visible reviews"
                    checked={isAllVisibleSelected}
                    disabled={!hasVisibleRows}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th>Rating</th>
                <th>Customer</th>
                <th>Order ID</th>
                <th>Product</th>
                <th>Comment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="admin-reviews-empty" colSpan={8}>
                    Loading reviews...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="admin-reviews-empty admin-reviews-empty--error" colSpan={8}>
                    {error}
                  </td>
                </tr>
              ) : paginatedReviews.length === 0 ? (
                <tr>
                  <td className="admin-reviews-empty" colSpan={8}>
                    No reviews found.
                  </td>
                </tr>
              ) : (
                paginatedReviews.map((review) => (
                  <tr key={review.id}>
                    <td className="admin-reviews-checkbox-column">
                      <input
                        className="admin-reviews-checkbox"
                        type="checkbox"
                        aria-label={`Select review ${review.id}`}
                        checked={selectedIds.has(review.id)}
                        onChange={() => handleToggleRowSelection(review.id)}
                      />
                    </td>
                    <td>
                      <span className="admin-reviews-stars" aria-label={`${review.rating} out of 5 stars`}>
                        {renderStars(review.rating)}
                      </span>
                    </td>
                    <td>
                      <div className="admin-customer-cell">
                        <span className="admin-customer-name">{review.customerName}</span>
                        {review.customerEmail ? <span className="admin-customer-email">{review.customerEmail}</span> : null}
                      </div>
                    </td>
                    <td className="admin-reviews-id">{review.orderNumber}</td>
                    <td>{review.productName}{review.extraItems > 0 ? ` +${review.extraItems} more` : ''}</td>
                    <td className="admin-reviews-comment">{review.comment || 'No comment'}</td>
                    <td>{review.displayDate}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-reviews-action-btn"
                        onClick={() => openOrderDetails(review.order_id)}
                      >
                        View Order
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-reviews-pagination">
          <div className="admin-reviews-pagination-summary">
            Showing {from}-{to} of {filteredReviews.length} entries
          </div>

          <div className="admin-reviews-pagination-controls">
            <label className="admin-reviews-pagination-rows" htmlFor="reviews-rows-per-page">
              Rows per page:
              <select id="reviews-rows-per-page" value={rowsPerPage} onChange={handleRowsPerPageChange}>
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="admin-reviews-page-btn"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              &#8249;
            </button>

            <span className="admin-reviews-page-number">{currentPage}</span>
            <span className="admin-reviews-page-divider">/</span>
            <span className="admin-reviews-page-number">{pageCount}</span>

            <button
              type="button"
              className="admin-reviews-page-btn"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              &#8250;
            </button>
          </div>
        </div>
      </div>

      {activeOrder ? (
        <div
          className="admin-orders-details-backdrop admin-reviews-orders-drawer"
          role="presentation"
          onMouseDown={closeOrderDetails}
        >
          <aside
            className="admin-orders-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reviews-order-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-orders-details-header">
              <div>
                <p className="admin-orders-details-eyebrow">Order ID</p>
                <h3 id="admin-reviews-order-details-title">{activeOrder.displayId}</h3>
              </div>
              <button
                type="button"
                className="admin-orders-details-close"
                onClick={closeOrderDetails}
                aria-label="Close order details"
              >
                ×
              </button>
            </div>

            <div className="admin-orders-progress" aria-label={`Order status: ${activeOrder.status}`}>
              {normalizeText(activeOrder.order_status) === 'cancelled' || normalizeText(activeOrder.order_status) === 'rejected' ? (
                <span className={`admin-orders-progress-terminal admin-orders-progress-terminal--${normalizeText(activeOrder.order_status)}`}>{activeOrder.status}</span>
              ) : getOrderProgressStages(activeOrder).map((stage, index) => {
                const currentIndex = getOrderProgressStage({ orderStatus: activeOrder.order_status, paymentStatus: activeOrder.payment_status, isRegularOrder: isRegularProgressOrder(activeOrder) })
                const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'future'
                const displayStage = stage === 'Preparing Cake' ? 'Preparing Order' : stage
                return <div className={`admin-orders-progress-step is-${state}`} key={stage}><span className="admin-orders-progress-dot">{state === 'complete' ? '✓' : state === 'current' ? index + 1 : ''}</span><span>{displayStage}</span>{index < getOrderProgressStages(activeOrder).length - 1 ? <i /> : null}</div>
              })}
            </div>

            <div className="admin-orders-details-ecommerce-layout">
              <main className="admin-orders-details-main-column">
                <section className="admin-orders-details-card admin-orders-details-item-card">
                  <div className="admin-orders-details-card-heading"><h4>Order Information</h4><span>{activeOrder.orderMethod}</span></div>
                  {(activeOrder.order_items || []).length ? activeOrder.order_items.map((item) => {
                    const itemName = item.customization_data?.request_type === 'custom_cake' ? 'Custom Cake' : item.product_name || 'Product'
                    const itemCategory = [PRODUCT_TYPE_LABELS[normalizeText(item.product_type)] || toTitleCase(item.product_type), item.variant_name].filter(Boolean).join(' · ') || 'Sweet Treats'
                    return <div className="admin-orders-details-product-row" key={item.id}>
                      <OrderThumbnail order={{ ...activeOrder, order_items: [item] }} />
                      <div className="admin-orders-details-product-copy"><strong>{itemName}</strong><span>{itemCategory}</span><span>Qty: {item.quantity || 0} · {activeOrder.orderMethod}</span></div>
                      <div className="admin-orders-details-product-price"><span className={`admin-orders-payment-badge ${getPaymentClassName(activeOrder.payment_status)}`}>{formatPaymentStatus(activeOrder.payment_status)}</span><strong>{formatPrice(item.subtotal, activeOrder)}</strong></div>
                    </div>
                  }) : <p className="admin-orders-details-muted">No order items found.</p>}
                  <div className="admin-orders-details-total admin-orders-details-order-total"><span>Order Total</span><strong>{formatPrice(activeOrder.total, activeOrder)}</strong></div>
                </section>

                <section className="admin-orders-details-card admin-orders-details-summary-card">
                  <h4>Order Summary</h4>
                  <dl>
                    <div><dt>Subtotal</dt><dd>{formatPrice(activeOrder.subtotal, activeOrder)}</dd></div>
                    <div><dt>Delivery Fee</dt><dd>{formatPrice(activeOrder.deliveryFee, activeOrder)}</dd></div>
                    <div className="admin-orders-details-total"><dt>Total</dt><dd>{formatPrice(activeOrder.total, activeOrder)}</dd></div>
                  </dl>
                </section>
              </main>

              <aside className="admin-orders-details-side-column">
                <section className="admin-orders-details-card">
                  <h4>Customer Information</h4>
                  <div className="admin-order-detail-row"><OrderDetailIcon type="person" /><dt>Name</dt><dd className="admin-orders-details-customer-name">{activeOrder.customer}</dd></div>
                  <dl>
                    <div><dt>Email</dt><dd>{activeOrder.email || '—'}</dd></div>
                    <div><dt>Contact</dt><dd>{activeOrder.contact_number || '—'}</dd></div>
                  </dl>
                </section>

                <section className="admin-orders-details-card admin-orders-details-fulfillment-card">
                  <h4>Fulfillment Details</h4>
                  <dl>
                    <div className="admin-order-detail-row"><OrderDetailIcon type="calendar" /><dt>Date</dt><dd>{activeOrder.requestedDate}</dd></div>
                    <div className="admin-order-detail-row"><OrderDetailIcon type="clock" /><dt>Time</dt><dd>{activeOrder.preferredTime}</dd></div>
                    {normalizeText(activeOrder.order_method) === 'delivery' ? <>
                      <div className="admin-orders-details-address"><dt>Address</dt><dd>{[activeOrder.address, [activeOrder.barangay, activeOrder.city_municipality].filter(Boolean).join(', '), [activeOrder.province, activeOrder.postal_code].filter(Boolean).join(' ')].filter(Boolean).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</dd></div>
                      <div><dt>Recipient</dt><dd>{activeOrder.different_recipient ? `${activeOrder.recipient_name || '—'} (${activeOrder.recipient_contact || '—'})` : 'Same as customer'}</dd></div>
                    </> : <div><dt>Pickup Location</dt><dd>Sweet Bakes store</dd></div>}
                  </dl>
                </section>

                <section className="admin-orders-details-card">
                  <h4>Payment</h4>
                  <dl>
                    <div><dt>Payment Status</dt><dd>{activeOrder.paymentStatus}</dd></div>
                    <div><dt>Payment Method</dt><dd>{toTitleCase(activeOrder.payment_method) || '—'}</dd></div>
                  </dl>
                </section>
              </aside>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
