import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchAdminOrders,
  reviewCustomOrderRequest,
  updateAdminOrderStatus,
} from '../../services/orderService.js'
import { ORDER_PROGRESS_STAGES, getOrderProgressStage } from '../../../services/orderStatusDisplay.js'
import './Orders.css'

const TAB_OPTIONS = ['All Orders', 'Pending', 'Confirmed', 'Completed', 'Cancelled']
const ORDER_DETAIL_TABS = ['Overview', 'Customer', 'Fulfillment', 'Items', 'Payment']

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

const CATEGORY_OPTIONS = ['All Categories', 'Cakes', 'Cupcakes', 'Party Packages', 'Sweet Treats']
const METHOD_OPTIONS = ['All Methods', 'Pickup', 'Delivery']
const STATUS_OPTIONS = [
  'All Status',
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
  'Rejected',
]
const DATE_OPTIONS = ['All Dates', 'This Month', 'Custom Range (Soon)']
const ORDER_STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
  'rejected',
]

const PRODUCT_TYPE_LABELS = {
  cake: 'Cakes',
  cupcake: 'Cupcakes',
  party_package: 'Party Packages',
  sweet_treat: 'Sweet Treats',
}

const CUSTOM_CAKE_TYPE_LABEL = 'Custom Cake'

const ORDER_METHOD_LABELS = {
  delivery: 'Delivery',
  pickup: 'Store Pickup',
}

const PAYMENT_STATUS_LABELS = {
  unpaid: 'Unpaid',
  pending: 'Pending',
  partial: 'Partial',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function toTitleCase(value) {
  return String(value || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    const fallbackDate = new Date(value)
    return Number.isNaN(fallbackDate.getTime()) ? '—' : DATE_FORMATTER.format(fallbackDate)
  }

  return DATE_FORMATTER.format(date)
}

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMATTER.format(date)
}

function formatTime(value) {
  return value || '—'
}

function formatOrderNumber(order) {
  if (order.order_number) {
    return order.order_number
  }

  const shortId = String(order.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return shortId ? `#SB-${shortId}` : '#SB'
}

function formatCustomerName(order) {
  const name = [order.first_name, order.last_name].filter(Boolean).join(' ').trim()
  return name || '—'
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

function formatOrderMethod(value) {
  return ORDER_METHOD_LABELS[normalizeText(value)] || toTitleCase(value) || '—'
}

function formatStatus(value) {
  return toTitleCase(value) || 'Pending'
}

function formatPaymentStatus(value) {
  return PAYMENT_STATUS_LABELS[normalizeText(value)] || toTitleCase(value) || 'Unpaid'
}

function isCustomCakeOrder(order) {
  return (order.order_items || []).some(
    (item) => item.customization_data?.request_type === 'custom_cake',
  )
}

function hasPendingPrice(order) {
  return isCustomCakeOrder(order) && normalizeText(order.order_status) === 'pending' && Number(order.total) === 0
}

function formatPrice(value, order = null) {
  if (order && hasPendingPrice(order)) {
    return 'Price Pending'
  }

  return CURRENCY_FORMATTER.format(Number(value) || 0)
}

function buildSearchText(order) {
  return [
    order.id,
    order.order_number,
    order.displayId,
    order.first_name,
    order.last_name,
    order.customer,
    order.email,
    order.contact_number,
    order.category,
    ...(order.order_items || []).map((item) => item.product_name),
  ]
    .map(normalizeText)
    .join(' ')
}

function isThisMonth(dateValue) {
  if (!dateValue) return false

  const date = new Date(`${dateValue}T00:00:00`)
  const today = new Date()

  return (
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function mapAdminOrder(order) {
  return {
    ...order,
    displayId: formatOrderNumber(order),
    customer: formatCustomerName(order),
    category: formatCategory(order),
    categoryTypes: getOrderItemTypes(order),
    orderMethod: formatOrderMethod(order.order_method),
    orderDate: formatDateTime(order.created_at),
    requestedDate: formatDate(order.preferred_date),
    preferredTime: formatTime(order.preferred_time),
    status: formatStatus(order.order_status),
    paymentStatus: formatPaymentStatus(order.payment_status),
    total: order.total === null || order.total === undefined ? null : Number(order.total) || 0,
    subtotal: order.subtotal === null || order.subtotal === undefined ? null : Number(order.subtotal) || 0,
    deliveryFee:
      order.delivery_fee === null || order.delivery_fee === undefined
        ? null
        : Number(order.delivery_fee) || 0,
    isCustomCake: isCustomCakeOrder(order),
    isPricePending: hasPendingPrice(order),
    searchText: buildSearchText(order),
  }
}

function formatCustomizationLabel(key) {
  return toTitleCase(key)
}

function flattenCustomizationData(value, prefix = '') {
  if (!value || typeof value !== 'object') return []

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry == null || entry === '') return null
        if (typeof entry === 'object') return flattenCustomizationData(entry, prefix)
        return { label: prefix || 'Option', value: String(entry) }
      })
      .flat()
      .filter(Boolean)
  }

  return Object.entries(value)
    .map(([key, entry]) => {
      if (entry == null || entry === '' || (Array.isArray(entry) && entry.length === 0)) {
        return null
      }

      if (key === 'reference_images') {
        return null
      }

      const label = prefix ? `${prefix} ${formatCustomizationLabel(key)}` : formatCustomizationLabel(key)

      if (typeof entry === 'object' && !Array.isArray(entry)) {
        return flattenCustomizationData(entry, label)
      }

      return {
        label,
        value: Array.isArray(entry) ? entry.filter(Boolean).join(', ') : String(entry),
      }
    })
    .flat()
    .filter((entry) => entry && entry.value)
}

function getReferenceImages(item) {
  const referenceImages = item.customization_data?.reference_images

  return Array.isArray(referenceImages)
    ? referenceImages.filter((image) => image?.signed_url || image?.url)
    : []
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
    item: 'M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Zm0 0 8 4 8-4M12 11.5V20',
    quantity: 'M5 5h14v14H5V5Zm4 4 6 6m0-6-6 6',
    price: 'M4 7h12l4 4-8 8-8-4V7Zm3 3h.01',
    flavor: 'M7 4h10M8 4v5l-3 8.5A2 2 0 0 0 7 20h10a2 2 0 0 0 2-2.5L16 9V4M8 9h8',
    size: 'M5 19 19 5M6 6h.01M18 18h.01M5 12h3M16 5v3M12 16h3M5 19h3',
    layers: 'm4 8 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4',
    theme: 'M12 4a8 8 0 1 0 0 16 2 2 0 0 0 2-2c0-1.1.9-2 2-2h1a3 3 0 0 0 3-3 9 9 0 0 0-8-9Zm-4 7h.01M8 8h.01M16 8h.01M17 12h.01',
    person: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0',
    email: 'M4 6h16v12H4V6Zm0 1 8 6 8-6',
    phone: 'M7 4h3l1 4-2 1.5a14 14 0 0 0 5.5 5.5L16 13l4 1v3c0 1.1-.9 2-2 2C10.3 19 5 13.7 5 6c0-1.1.9-2 2-2Z',
    calendar: 'M5 6h14v13H5V6Zm3-2v4m8-4v4M5 10h14',
    clock: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3v4l3 2',
    location: 'M12 20s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    payment: 'M4 6h16v12H4V6Zm0 4h16M7 15h3',
  }

  return <svg className="admin-order-detail-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[type] || paths.item} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
  const [orders, setOrders] = useState([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [ordersError, setOrdersError] = useState('')
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [statusUpdateError, setStatusUpdateError] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const [customFinalPrice, setCustomFinalPrice] = useState('')
  const [customReviewError, setCustomReviewError] = useState('')
  const [orderDetailTab, setOrderDetailTab] = useState('Overview')
  const [previewImage, setPreviewImage] = useState(null)
  const [previewZoom, setPreviewZoom] = useState(1)

  const displayOrders = useMemo(() => orders.map(mapAdminOrder), [orders])
  const activeOrder = displayOrders.find((order) => order.id === activeOrderId) || null

  const tabCounts = useMemo(() => {
    return TAB_OPTIONS.reduce((accumulator, tab) => {
      if (tab === 'All Orders') {
        accumulator[tab] = displayOrders.length
        return accumulator
      }

      accumulator[tab] = displayOrders.filter((order) => order.status === tab).length
      return accumulator
    }, {})
  }, [displayOrders])

  const filteredOrders = useMemo(() => {
    const searchNeedle = normalizeText(searchValue).trim()

    return displayOrders.filter((order) => {
      const matchesSearch =
        searchNeedle.length === 0 ||
        order.searchText.includes(searchNeedle)

      const matchesCategory =
        selectedCategory === 'All Categories' ||
        order.categoryTypes.includes(selectedCategory)

      const matchesMethod =
        selectedMethod === 'All Methods' ||
        normalizeText(order.order_method) === normalizeText(selectedMethod) ||
        (selectedMethod === 'Pickup' && normalizeText(order.order_method) === 'pickup')

      const matchesStatus = selectedStatus === 'All Status' || order.status === selectedStatus

      const matchesDate = selectedDate === 'All Dates' || (selectedDate === 'This Month' && isThisMonth(order.preferred_date))

      const matchesTab = activeTab === 'All Orders' || order.status === activeTab

      return matchesSearch && matchesCategory && matchesMethod && matchesStatus && matchesDate && matchesTab
    })
  }, [displayOrders, searchValue, selectedCategory, selectedMethod, selectedStatus, selectedDate, activeTab])

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
    let isMounted = true

    async function loadOrders() {
      try {
        setIsLoadingOrders(true)
        setOrdersError('')

        const nextOrders = await fetchAdminOrders()

        if (isMounted) {
          setOrders(nextOrders)
        }
      } catch (error) {
        console.error('[ADMIN ORDERS] load error:', error)

        if (isMounted) {
          setOrders([])
          setOrdersError('Unable to load orders from Supabase.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrders(false)
        }
      }
    }

    loadOrders()

    return () => {
      isMounted = false
    }
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

  const handleOpenOrderDetails = (orderId) => {
    const selectedOrder = orders.find((order) => order.id === orderId)

    setActiveOrderId(orderId)
    setPreviewImage(null)
    setPreviewZoom(1)
    setOrderDetailTab('Overview')
    setStatusUpdateError('')
    setCustomReviewError('')
    setCustomFinalPrice(
      selectedOrder?.isCustomCake && normalizeText(selectedOrder.order_status) === 'pending' && Number(selectedOrder.total) === 0
        ? ''
        : selectedOrder?.total !== null && selectedOrder?.total !== undefined
          ? String(selectedOrder.total)
          : '',
    )
  }

  const handleCloseOrderDetails = () => {
    setActiveOrderId(null)
    setStatusUpdateError('')
    setCustomReviewError('')
    setCustomFinalPrice('')
    setPreviewImage(null)
    setPreviewZoom(1)
  }

  const handleStatusChange = async (event) => {
    if (!activeOrder) return

    const nextStatus = event.target.value

    try {
      setUpdatingOrderId(activeOrder.id)
      setStatusUpdateError('')

      const updatedOrder = await updateAdminOrderStatus(activeOrder.id, nextStatus)

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === activeOrder.id
            ? {
                ...order,
                ...updatedOrder,
                order_items: order.order_items,
              }
            : order,
        ),
      )
    } catch (error) {
      console.error('[ADMIN ORDERS] status update error:', error)
      setStatusUpdateError('Unable to update order status. Please try again.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleProgressOrder = async () => {
    if (!activeOrder) return

    const nextStatusByCurrentStatus = {
      pending: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'completed',
    }
    const nextStatus = nextStatusByCurrentStatus[normalizeText(activeOrder.order_status)]
    if (!nextStatus) return

    if (normalizeText(activeOrder.order_status) === 'confirmed' && !paymentVerified) {
      setStatusUpdateError('Payment must be verified before preparation can begin.')
      return
    }

    if (normalizeText(activeOrder.order_status) === 'pending' && activeOrder.isCustomCake) {
      await handleReviewCustomOrder('accept')
      return
    }

    await handleStatusChange({ target: { value: nextStatus } })
  }

  const handleReviewCustomOrder = async (action) => {
    if (!activeOrder) return

    if (action === 'reject' && !window.confirm('Reject this custom order?')) return

    const finalPrice = Number(customFinalPrice)

    if (action === 'accept' && (!Number.isFinite(finalPrice) || finalPrice <= 0)) {
      setCustomReviewError('Enter the final price before accepting this custom request.')
      return
    }

    try {
      setUpdatingOrderId(activeOrder.id)
      setCustomReviewError('')

      const updatedOrder = await reviewCustomOrderRequest(
        activeOrder.id,
        action,
        action === 'accept' ? finalPrice : null,
        '',
      )

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === activeOrder.id
            ? {
                ...order,
                ...updatedOrder,
                order_items: updatedOrder.order_items || order.order_items,
              }
            : order,
        ),
      )
    } catch (error) {
      console.error('[ADMIN ORDERS] custom review error:', error)
      setCustomReviewError('Unable to review this custom request. Please try again.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const primaryOrderItem = activeOrder?.order_items?.[0] || null
  const primaryCustomizationFields = primaryOrderItem
    ? flattenCustomizationData(primaryOrderItem.customization_data)
    : []
  const primaryReferenceImages = primaryOrderItem ? getReferenceImages(primaryOrderItem) : []
  const getCustomizationValue = (labels) => {
    const field = primaryCustomizationFields.find((entry) => labels.includes(normalizeText(entry.label)))
    return field?.value || '—'
  }

  const openImagePreview = (image) => {
    setPreviewImage(image)
    setPreviewZoom(1)
  }

  const hasCustomizationValue = (labels) => Boolean(
    primaryCustomizationFields.find((entry) => labels.includes(normalizeText(entry.label)))?.value,
  )

  const paymentVerified = ['paid', 'verified', 'payment_verified'].includes(normalizeText(activeOrder?.payment_status))

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
              {isLoadingOrders ? (
                <tr>
                  <td className="admin-orders-empty" colSpan={11}>
                    Loading orders...
                  </td>
                </tr>
              ) : ordersError ? (
                <tr>
                  <td className="admin-orders-empty admin-orders-empty--error" colSpan={11}>
                    {ordersError}
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td className="admin-orders-empty" colSpan={11}>
                    No orders found.
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
                    <td className="admin-orders-id">{order.displayId}</td>
                    <td>
                      <div className="admin-customer-cell">
                        <span className="admin-customer-name">{order.customer}</span>
                        {order.email ? <span className="admin-customer-email">{order.email}</span> : null}
                      </div>
                    </td>
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
                    <td className="admin-orders-total">{formatPrice(order.total, order)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-orders-action-btn"
                        onClick={() => handleOpenOrderDetails(order.id)}
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

      {activeOrder ? (
        <div className="admin-orders-details-backdrop" role="presentation" onMouseDown={handleCloseOrderDetails}>
          <aside
            className="admin-orders-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-orders-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-orders-details-header">
              <div>
                <p className="admin-orders-details-eyebrow">Order</p>
                <h3 id="admin-orders-details-title">{activeOrder.displayId}</h3>
              </div>
              <button
                type="button"
                className="admin-orders-details-close"
                onClick={handleCloseOrderDetails}
                aria-label="Close order details"
              >
                ×
              </button>
            </div>

            <div className="admin-orders-progress" aria-label={`Order status: ${activeOrder.status}`}>
              {normalizeText(activeOrder.order_status) === 'cancelled' || normalizeText(activeOrder.order_status) === 'rejected' ? (
                <span className={`admin-orders-progress-terminal admin-orders-progress-terminal--${normalizeText(activeOrder.order_status)}`}>{activeOrder.status}</span>
              ) : ORDER_PROGRESS_STAGES.map((stage, index) => {
                const currentIndex = getOrderProgressStage({ orderStatus: activeOrder.order_status, paymentStatus: activeOrder.payment_status })
                const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'future'
                return <div className={`admin-orders-progress-step is-${state}`} key={stage}><span className="admin-orders-progress-dot">{state === 'complete' ? '✓' : ''}</span><span>{stage}</span>{index < ORDER_PROGRESS_STAGES.length - 1 ? <i /> : null}</div>
              })}
            </div>

            <div className="admin-orders-details-ecommerce-layout">
              <main className="admin-orders-details-main-column">
                <section className="admin-orders-details-card admin-orders-details-item-card">
                  <div className="admin-orders-details-card-heading">
                    <h4>Order Item</h4>
                  </div>
                  {primaryOrderItem ? (
                    <>
                      <div className="admin-order-detail-list">
                        <div className="admin-order-detail-row"><OrderDetailIcon type="item" /><span>Order Item</span><strong>{primaryOrderItem.customization_data?.request_type === 'custom_cake' ? 'Custom Cake' : primaryOrderItem.product_name || 'Product'}</strong></div>
                        <div className="admin-order-detail-row"><OrderDetailIcon type="quantity" /><span>Quantity</span><strong>{primaryOrderItem.quantity || 0}</strong></div>
                        <div className="admin-order-detail-row"><OrderDetailIcon type="price" /><span>Price</span><strong>{formatPrice(primaryOrderItem.subtotal, activeOrder)}</strong></div>
                        {hasCustomizationValue(['flavor']) ? <div className="admin-order-detail-row"><OrderDetailIcon type="flavor" /><span>Flavor</span><strong>{getCustomizationValue(['flavor'])}</strong></div> : null}
                        {hasCustomizationValue(['size', 'cake size']) ? <div className="admin-order-detail-row"><OrderDetailIcon type="size" /><span>Size</span><strong>{getCustomizationValue(['size', 'cake size'])}</strong></div> : null}
                        {hasCustomizationValue(['layers', 'layer']) ? <div className="admin-order-detail-row"><OrderDetailIcon type="layers" /><span>Layers</span><strong>{getCustomizationValue(['layers', 'layer'])}</strong></div> : null}
                        {hasCustomizationValue(['theme', 'cupcake theme']) ? <div className="admin-order-detail-row"><OrderDetailIcon type="theme" /><span>Theme</span><strong>{getCustomizationValue(['theme', 'cupcake theme'])}</strong></div> : null}
                        {hasCustomizationValue(['cake message', 'message']) ? <div className="admin-order-detail-row"><OrderDetailIcon type="theme" /><span>Cake Message</span><strong>{getCustomizationValue(['cake message', 'message'])}</strong></div> : null}
                        {hasCustomizationValue(['special instructions', 'instructions']) ? <div className="admin-order-detail-row"><OrderDetailIcon type="theme" /><span>Special Instructions</span><strong>{getCustomizationValue(['special instructions', 'instructions'])}</strong></div> : null}
                      </div>
                      {primaryReferenceImages.length ? <div className="admin-orders-details-reference-block"><h5>Reference Images</h5><div className="admin-orders-reference-images">{primaryReferenceImages.map((image) => <button type="button" className="admin-orders-reference-thumbnail-button" key={image.path || image.signed_url || image.url} onClick={() => openImagePreview(image)}><img src={image.signed_url || image.url} alt={image.name || 'Reference'} /></button>)}</div></div> : null}
                    </>
                  ) : <p className="admin-orders-details-muted">No order items found.</p>}
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
                  <dl><div><dt>Email</dt><dd>{activeOrder.email || '—'}</dd></div><div><dt>Contact</dt><dd>{activeOrder.contact_number || '—'}</dd></div></dl>
                </section>

                <section className="admin-orders-details-card">
                  <h4>{activeOrder.orderMethod} Details</h4>
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
                  <dl><div><dt>Payment Status</dt><dd>{activeOrder.paymentStatus}</dd></div><div><dt>Payment Method</dt><dd>{toTitleCase(activeOrder.payment_method) || '—'}</dd></div></dl>
                </section>

                <section className={`admin-orders-details-card admin-orders-details-actions-card${['completed', 'cancelled', 'rejected'].includes(normalizeText(activeOrder.order_status)) ? ' is-complete' : ''}`}>
                  <h4>Order Actions</h4>
                  {normalizeText(activeOrder.order_status) === 'pending' && activeOrder.isCustomCake ? <label htmlFor="admin-custom-final-price-side">Final Price<input id="admin-custom-final-price-side" className="admin-orders-details-input" type="number" min="1" step="1" placeholder="₱ Enter final price" value={customFinalPrice} onChange={(event) => setCustomFinalPrice(event.target.value)} disabled={updatingOrderId === activeOrder.id} /></label> : null}
                  {normalizeText(activeOrder.order_status) === 'pending' && activeOrder.isCustomCake ? <div className="admin-orders-details-action-buttons"><button type="button" className="admin-orders-action-btn admin-orders-action-btn--secondary" onClick={() => handleReviewCustomOrder('reject')} disabled={updatingOrderId === activeOrder.id}>Reject Order</button><button type="button" className="admin-orders-action-btn" onClick={handleProgressOrder} disabled={updatingOrderId === activeOrder.id}>Confirm Order</button></div> : null}
                  {normalizeText(activeOrder.order_status) === 'pending' && !activeOrder.isCustomCake ? <button type="button" className="admin-orders-action-btn admin-orders-action-btn--full" onClick={handleProgressOrder} disabled={updatingOrderId === activeOrder.id}>Confirm Order</button> : null}
                  {['confirmed', 'preparing', 'ready'].includes(normalizeText(activeOrder.order_status)) ? <button type="button" className="admin-orders-action-btn admin-orders-action-btn--full" onClick={handleProgressOrder} disabled={updatingOrderId === activeOrder.id}>{({ confirmed: 'Start Preparing', preparing: 'Mark as Ready', ready: 'Complete Order' })[normalizeText(activeOrder.order_status)]}</button> : null}
                  {normalizeText(activeOrder.order_status) === 'completed' ? <p className="admin-orders-details-completed">Order Completed</p> : null}
                  {statusUpdateError ? <p className="admin-orders-details-error">{statusUpdateError}</p> : null}
                  {customReviewError ? <p className="admin-orders-details-error">{customReviewError}</p> : null}
                </section>
              </aside>
            </div>

            <section className={`admin-orders-details-actions-docked${['completed', 'cancelled', 'rejected'].includes(normalizeText(activeOrder.order_status)) ? ' is-complete' : ''}`}>
              <h4>Order Actions</h4>
              {normalizeText(activeOrder.order_status) === 'pending' && activeOrder.isCustomCake ? <label htmlFor="admin-custom-final-price-docked">Final Price<div className="admin-orders-currency-input"><span aria-hidden="true">₱</span><input id="admin-custom-final-price-docked" type="text" inputMode="numeric" placeholder="Enter final price" value={customFinalPrice ? Number(customFinalPrice).toLocaleString('en-PH') : ''} onChange={(event) => setCustomFinalPrice(event.target.value.replace(/[^0-9]/g, ''))} disabled={updatingOrderId === activeOrder.id} /></div></label> : null}
              {normalizeText(activeOrder.order_status) === 'pending' && activeOrder.isCustomCake ? <div className="admin-orders-details-action-buttons"><button type="button" className="admin-orders-action-btn admin-orders-action-btn--secondary" onClick={() => handleReviewCustomOrder('reject')} disabled={updatingOrderId === activeOrder.id}>Reject Order</button><button type="button" className="admin-orders-action-btn" onClick={handleProgressOrder} disabled={updatingOrderId === activeOrder.id}>Confirm Order</button></div> : null}
              {normalizeText(activeOrder.order_status) === 'pending' && !activeOrder.isCustomCake ? <button type="button" className="admin-orders-action-btn admin-orders-action-btn--full" onClick={handleProgressOrder} disabled={updatingOrderId === activeOrder.id}>Confirm Order</button> : null}
              {normalizeText(activeOrder.order_status) === 'confirmed' && !paymentVerified ? <p className="admin-orders-details-awaiting-payment">Payment Pending · awaiting verification</p> : null}
              {['preparing', 'ready'].includes(normalizeText(activeOrder.order_status)) || (normalizeText(activeOrder.order_status) === 'confirmed' && paymentVerified) ? <button type="button" className="admin-orders-action-btn admin-orders-action-btn--full" onClick={handleProgressOrder} disabled={updatingOrderId === activeOrder.id}>{({ confirmed: 'Start Preparing', preparing: 'Mark as Ready', ready: 'Complete Order' })[normalizeText(activeOrder.order_status)]}</button> : null}
              {statusUpdateError ? <p className="admin-orders-details-error">{statusUpdateError}</p> : null}
              {customReviewError ? <p className="admin-orders-details-error">{customReviewError}</p> : null}
            </section>

            <div className="admin-orders-details-tabbed-layout">
              <div className="admin-orders-details-header-status">
                <span className={getStatusClassName(activeOrder.status)}>{activeOrder.status}</span>
              </div>
              <nav className="admin-orders-details-tabs" aria-label="Order detail sections">
                {ORDER_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={orderDetailTab === tab ? 'is-active' : ''}
                    aria-selected={orderDetailTab === tab}
                    role="tab"
                    onClick={() => setOrderDetailTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
              <div className="admin-orders-details-content" role="tabpanel">
                {orderDetailTab === 'Overview' ? (
                  <div className="admin-orders-details-tab-grid">
                    <div className="admin-orders-details-section">
                      <h4>Order Summary</h4>
                      <dl>
                        <div><dt>Customer</dt><dd>{activeOrder.customer}</dd></div>
                        <div><dt>Order Method</dt><dd>{activeOrder.orderMethod}</dd></div>
                        <div><dt>Preferred Date</dt><dd>{activeOrder.requestedDate}</dd></div>
                        <div><dt>Preferred Time</dt><dd>{activeOrder.preferredTime}</dd></div>
                        <div><dt>Order Type</dt><dd>{activeOrder.category}</dd></div>
                        <div><dt>Price</dt><dd>{formatPrice(activeOrder.total, activeOrder)}</dd></div>
                        <div><dt>Payment Status</dt><dd>{activeOrder.paymentStatus}</dd></div>
                      </dl>
                    </div>
                    <div className="admin-orders-details-section admin-orders-details-status-control">
                      <h4>Order Status</h4>
                      <label htmlFor="admin-order-status-update">Update status</label>
                      <select id="admin-order-status-update" value={normalizeText(activeOrder.order_status) || 'pending'} onChange={handleStatusChange} disabled={updatingOrderId === activeOrder.id || (activeOrder.isCustomCake && normalizeText(activeOrder.order_status) === 'pending')}>
                        {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
                      </select>
                      {statusUpdateError ? <p className="admin-orders-details-error">{statusUpdateError}</p> : null}
                      {activeOrder.isCustomCake && normalizeText(activeOrder.order_status) === 'pending' ? (
                        <>
                          <label htmlFor="admin-custom-final-price">Final Price</label>
                          <input id="admin-custom-final-price" className="admin-orders-details-input" type="number" min="1" step="1" inputMode="numeric" placeholder="Enter final price" value={customFinalPrice} onChange={(event) => setCustomFinalPrice(event.target.value)} disabled={updatingOrderId === activeOrder.id} />
                          <div className="admin-orders-details-actions">
                            <button type="button" className="admin-orders-action-btn" onClick={() => handleReviewCustomOrder('accept')} disabled={updatingOrderId === activeOrder.id}>Accept</button>
                            <button type="button" className="admin-orders-action-btn" onClick={() => handleReviewCustomOrder('reject')} disabled={updatingOrderId === activeOrder.id}>Reject</button>
                          </div>
                          {customReviewError ? <p className="admin-orders-details-error">{customReviewError}</p> : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {orderDetailTab === 'Customer' ? (
                  <div className="admin-orders-details-section"><h4>Customer Information</h4><dl className="admin-orders-details-grid">
                    <div><dt>Name</dt><dd>{activeOrder.customer}</dd></div>
                    <div><dt>Contact Number</dt><dd>{activeOrder.contact_number || 'â€”'}</dd></div>
                    <div><dt>Email</dt><dd>{activeOrder.email || 'â€”'}</dd></div>
                    {activeOrder.different_recipient ? <div><dt>Recipient Name</dt><dd>{activeOrder.recipient_name || 'â€”'}</dd></div> : null}
                    {activeOrder.different_recipient ? <div><dt>Recipient Contact</dt><dd>{activeOrder.recipient_contact || 'â€”'}</dd></div> : null}
                  </dl></div>
                ) : null}
                {orderDetailTab === 'Fulfillment' ? (
                  <div className="admin-orders-details-section"><h4>{activeOrder.orderMethod} Details</h4><dl className="admin-orders-details-grid">
                    <div><dt>Order Method</dt><dd>{activeOrder.orderMethod}</dd></div><div><dt>Preferred Date</dt><dd>{activeOrder.requestedDate}</dd></div><div><dt>Preferred Time</dt><dd>{activeOrder.preferredTime}</dd></div>
                    {normalizeText(activeOrder.order_method) === 'delivery' ? <>
                      <div><dt>Province</dt><dd>{activeOrder.province || 'â€”'}</dd></div><div><dt>City / Municipality</dt><dd>{activeOrder.city_municipality || 'â€”'}</dd></div><div><dt>Barangay</dt><dd>{activeOrder.barangay || 'â€”'}</dd></div><div><dt>Postal Code</dt><dd>{activeOrder.postal_code || 'â€”'}</dd></div><div className="admin-orders-details-grid-wide"><dt>Address</dt><dd>{activeOrder.address || 'â€”'}</dd></div><div><dt>Apartment / Unit</dt><dd>{activeOrder.apartment_unit || 'â€”'}</dd></div><div><dt>Landmark</dt><dd>{activeOrder.landmark || 'â€”'}</dd></div><div><dt>Recipient</dt><dd>{activeOrder.different_recipient ? `${activeOrder.recipient_name || 'â€”'} (${activeOrder.recipient_contact || 'â€”'})` : 'Same as customer'}</dd></div>
                    </> : null}
                  </dl></div>
                ) : null}
                {orderDetailTab === 'Items' ? (
                  <div className="admin-orders-details-section"><h4>Order Items</h4><div className="admin-orders-details-items">
                    {(activeOrder.order_items || []).length === 0 ? <p className="admin-orders-details-muted">No order items found.</p> : activeOrder.order_items.map((item) => {
                      const customizationFields = flattenCustomizationData(item.customization_data)
                      const referenceImages = getReferenceImages(item)
                      return <div className="admin-orders-details-item" key={item.id}>
                        <div className="admin-orders-details-item-main"><div><strong>{item.product_name || 'Product'}</strong><span>{[PRODUCT_TYPE_LABELS[normalizeText(item.product_type)] || toTitleCase(item.product_type), item.variant_name].filter(Boolean).join(' Â· ') || 'â€”'}</span></div><div className="admin-orders-details-item-price"><span>Qty {item.quantity || 0}</span><strong>{formatPrice(item.subtotal, activeOrder)}</strong></div></div>
                        <dl className="admin-orders-details-item-meta admin-orders-details-item-meta--compact"><div><dt>Unit Price</dt><dd>{formatPrice(item.unit_price, activeOrder)}</dd></div>{customizationFields.map((field, fieldIndex) => <div key={`${item.id}-${field.label}-${fieldIndex}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
                        {referenceImages.length ? <div className="admin-orders-reference-images">{referenceImages.map((image) => <a key={image.path || image.signed_url || image.url} href={image.signed_url || image.url} target="_blank" rel="noreferrer"><img src={image.signed_url || image.url} alt={image.name || 'Reference'} /></a>)}</div> : null}
                      </div>
                    })}
                  </div></div>
                ) : null}
                {orderDetailTab === 'Payment' ? (
                  <div className="admin-orders-details-section"><h4>Payment</h4><dl>
                    <div><dt>Subtotal</dt><dd>{formatPrice(activeOrder.subtotal, activeOrder)}</dd></div><div><dt>Delivery Fee</dt><dd>{formatPrice(activeOrder.deliveryFee, activeOrder)}</dd></div><div><dt>Total</dt><dd>{formatPrice(activeOrder.total, activeOrder)}</dd></div><div><dt>Payment Status</dt><dd>{activeOrder.paymentStatus}</dd></div><div><dt>Payment Method</dt><dd>{toTitleCase(activeOrder.payment_method) || 'â€”'}</dd></div>
                  </dl></div>
                ) : null}
              </div>
            </div>
            <div className="admin-orders-details-legacy">
            <div className="admin-orders-details-status-row">
              <label htmlFor="admin-order-status-update">Order Status</label>
              <select
                id="admin-order-status-update"
                value={normalizeText(activeOrder.order_status) || 'pending'}
                onChange={handleStatusChange}
                disabled={
                  updatingOrderId === activeOrder.id ||
                  (activeOrder.isCustomCake && normalizeText(activeOrder.order_status) === 'pending')
                }
              >
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
              {statusUpdateError ? <p className="admin-orders-details-error">{statusUpdateError}</p> : null}
            </div>

            {activeOrder.isCustomCake && normalizeText(activeOrder.order_status) === 'pending' ? (
              <div className="admin-orders-details-status-row">
                <label htmlFor="admin-custom-final-price">Final Price</label>
                <input
                  id="admin-custom-final-price"
                  className="admin-orders-details-input"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="Enter final price"
                  value={customFinalPrice}
                  onChange={(event) => setCustomFinalPrice(event.target.value)}
                  disabled={updatingOrderId === activeOrder.id}
                />
                <div className="admin-orders-details-actions">
                  <button
                    type="button"
                    className="admin-orders-action-btn"
                    onClick={() => handleReviewCustomOrder('accept')}
                    disabled={updatingOrderId === activeOrder.id}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="admin-orders-action-btn"
                    onClick={() => handleReviewCustomOrder('reject')}
                    disabled={updatingOrderId === activeOrder.id}
                  >
                    Reject
                  </button>
                </div>
                {customReviewError ? <p className="admin-orders-details-error">{customReviewError}</p> : null}
              </div>
            ) : null}

            <div className="admin-orders-details-section">
              <h4>Customer Information</h4>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{activeOrder.customer}</dd>
                </div>
                <div>
                  <dt>Contact Number</dt>
                  <dd>{activeOrder.contact_number || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{activeOrder.email || '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="admin-orders-details-section">
              <h4>Order Method</h4>
              <dl>
                <div>
                  <dt>Method</dt>
                  <dd>{activeOrder.orderMethod}</dd>
                </div>
              </dl>
            </div>

            <div className="admin-orders-details-section">
              <h4>Schedule</h4>
              <dl>
                <div>
                  <dt>Preferred Date</dt>
                  <dd>{activeOrder.requestedDate}</dd>
                </div>
                <div>
                  <dt>Preferred Time</dt>
                  <dd>{activeOrder.preferredTime}</dd>
                </div>
              </dl>
            </div>

            {normalizeText(activeOrder.order_method) === 'delivery' ? (
              <div className="admin-orders-details-section">
                <h4>Delivery Details</h4>
                <dl>
                  <div>
                    <dt>Province</dt>
                    <dd>{activeOrder.province || '—'}</dd>
                  </div>
                  <div>
                    <dt>City / Municipality</dt>
                    <dd>{activeOrder.city_municipality || '—'}</dd>
                  </div>
                  <div>
                    <dt>Barangay</dt>
                    <dd>{activeOrder.barangay || '—'}</dd>
                  </div>
                  <div>
                    <dt>Postal Code</dt>
                    <dd>{activeOrder.postal_code || '—'}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{activeOrder.address || '—'}</dd>
                  </div>
                  <div>
                    <dt>Apartment / Unit</dt>
                    <dd>{activeOrder.apartment_unit || '—'}</dd>
                  </div>
                  <div>
                    <dt>Landmark</dt>
                    <dd>{activeOrder.landmark || '—'}</dd>
                  </div>
                  <div>
                    <dt>Recipient</dt>
                    <dd>
                      {activeOrder.different_recipient
                        ? `${activeOrder.recipient_name || '—'} (${activeOrder.recipient_contact || '—'})`
                        : 'Same as customer'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="admin-orders-details-section">
              <h4>Order Items</h4>
              <div className="admin-orders-details-items">
                {(activeOrder.order_items || []).length === 0 ? (
                  <p className="admin-orders-details-muted">No order items found.</p>
                ) : (
                  activeOrder.order_items.map((item) => {
                    const customizationFields = flattenCustomizationData(item.customization_data)
                    const referenceImages = getReferenceImages(item)

                    return (
                      <div className="admin-orders-details-item" key={item.id}>
                        <div className="admin-orders-details-item-main">
                          <div>
                            <strong>{item.product_name || 'Product'}</strong>
                            <span>
                              {[PRODUCT_TYPE_LABELS[normalizeText(item.product_type)] || toTitleCase(item.product_type), item.variant_name]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </span>
                          </div>
                          <div className="admin-orders-details-item-price">
                            <span>Qty {item.quantity || 0}</span>
                            <strong>{formatPrice(item.subtotal, activeOrder)}</strong>
                          </div>
                        </div>

                        <dl className="admin-orders-details-item-meta">
                          <div>
                            <dt>Unit Price</dt>
                            <dd>{formatPrice(item.unit_price, activeOrder)}</dd>
                          </div>
                          {customizationFields.map((field, fieldIndex) => (
                            <div key={`${item.id}-${field.label}-${fieldIndex}`}>
                              <dt>{field.label}</dt>
                              <dd>{field.value}</dd>
                            </div>
                          ))}
                        </dl>
                        {referenceImages.length ? (
                          <div className="admin-orders-reference-images">
                            {referenceImages.map((image) => (
                              <a
                                key={image.path || image.signed_url || image.url}
                                href={image.signed_url || image.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img src={image.signed_url || image.url} alt={image.name || 'Reference'} />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="admin-orders-details-section">
              <h4>Pricing</h4>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(activeOrder.subtotal, activeOrder)}</dd>
                </div>
                <div>
                  <dt>Delivery Fee</dt>
                  <dd>
                    {formatPrice(activeOrder.deliveryFee, activeOrder)}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatPrice(activeOrder.total, activeOrder)}</dd>
                </div>
              </dl>
            </div>

            <div className="admin-orders-details-section">
              <h4>Status</h4>
              <dl>
                <div>
                  <dt>Order Status</dt>
                  <dd>{activeOrder.status}</dd>
                </div>
                <div>
                  <dt>Payment Status</dt>
                  <dd>{activeOrder.paymentStatus}</dd>
                </div>
                <div>
                  <dt>Payment Method</dt>
                  <dd>{toTitleCase(activeOrder.payment_method) || '—'}</dd>
                </div>
              </dl>
            </div>
            </div>
          </aside>
          {previewImage ? (
            <div className="admin-orders-image-lightbox" role="presentation" onMouseDown={() => setPreviewImage(null)}>
              <div className="admin-orders-image-lightbox-panel" role="dialog" aria-modal="true" aria-label="Order image preview" onMouseDown={(event) => event.stopPropagation()}>
                <button type="button" className="admin-orders-image-lightbox-close" onClick={() => setPreviewImage(null)} aria-label="Close image preview">×</button>
                <div className="admin-orders-image-lightbox-stage">
                  <img src={previewImage.signed_url || previewImage.url} alt={previewImage.name || 'Order reference'} style={{ transform: `scale(${previewZoom})` }} />
                </div>
                <div className="admin-orders-image-lightbox-controls" aria-label="Image zoom controls">
                  <button type="button" onClick={() => setPreviewZoom((zoom) => Math.max(1, zoom - 0.25))}>−</button>
                  <button type="button" onClick={() => setPreviewZoom(1)}>Reset</button>
                  <button type="button" onClick={() => setPreviewZoom((zoom) => Math.min(3, zoom + 0.25))}>+</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default Orders
