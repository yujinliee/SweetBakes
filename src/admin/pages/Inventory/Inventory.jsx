import { useEffect, useMemo, useRef, useState } from 'react'
import { getInventoryItems } from '../../services/inventoryService.js'
import './Inventory.css'

const CATEGORY_OPTIONS = ['All Categories', 'Cakes', 'Cupcakes', 'Party Packages', 'Sweet Treats']
const STATUS_OPTIONS = ['All Status', 'In Stock', 'Low Stock', 'Out of Stock', 'Available', 'Unavailable']

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function getInventoryStatus(item) {
  if ('stock' in item) {
    if (item.stock > 5) {
      return 'In Stock'
    }
    if (item.stock >= 1) {
      return 'Low Stock'
    }
    return 'Out of Stock'
  }
  return item.availability
}

function getStatusClassName(status) {
  const key = normalizeText(status).replace(/\s+/g, '-')
  return `admin-inventory-status admin-inventory-status--${key}`
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
    <div className="admin-inventory-filter-dropdown">
      <button
        id={`${id}-trigger`}
        type="button"
        className={`admin-inventory-control admin-inventory-control--select${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        {icon}
        <span className="admin-inventory-control-value">{value}</span>
        <svg className={`admin-inventory-control-chevron${isOpen ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        className={`admin-inventory-dropdown-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
      >
        {options.map((option) => (
          <li key={option} role="option" aria-selected={value === option}>
            <button
              type="button"
              className={`admin-inventory-dropdown-option${value === option ? ' is-selected' : ''}`}
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

function ManageModal({ item, onClose, onSave }) {
  const isQuantityBased = 'stock' in item
  const [draftStock, setDraftStock] = useState(isQuantityBased ? item.stock : null)
  const [availability, setAvailability] = useState(item.availability)

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isQuantityBased) {
      onSave({ stock: Math.max(0, Math.floor(draftStock)) })
    } else {
      onSave({ availability })
    }
    onClose()
  }

  const changeDraftStock = (delta) => {
    setDraftStock((current) => Math.max(0, current + delta))
  }

  return (
    <div className="admin-inventory-modal-backdrop" onClick={onClose}>
      <div className="admin-inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-inventory-modal-header">
          <div>
            <p className="admin-inventory-modal-kicker">
              {item.category} · {item.variant}
            </p>
            <h3>{isQuantityBased ? 'Update Stock' : 'Set Availability'}</h3>
          </div>
          <button type="button" className="admin-inventory-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="admin-inventory-modal-form" onSubmit={handleSubmit}>
          <p className="admin-inventory-modal-product">{item.product}</p>

          {isQuantityBased ? (
            <label>
              <span>Stock quantity</span>
              <div className="admin-inventory-stepper">
                <button
                  type="button"
                  className="admin-inventory-stepper-btn"
                  aria-label="Decrease stock"
                  disabled={draftStock <= 0}
                  onClick={() => changeDraftStock(-1)}
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  value={draftStock}
                  onChange={(e) => setDraftStock(Number(e.target.value))}
                  aria-label="Stock quantity"
                />
                <button
                  type="button"
                  className="admin-inventory-stepper-btn"
                  aria-label="Increase stock"
                  onClick={() => changeDraftStock(1)}
                >
                  +
                </button>
              </div>
            </label>
          ) : (
            <label>
              <span>Availability</span>
              <div className="admin-inventory-avail-chips">
                <button
                  type="button"
                  className={`admin-inventory-avail-chip${availability === 'Available' ? ' is-selected' : ''}`}
                  aria-pressed={availability === 'Available'}
                  onClick={() => setAvailability('Available')}
                >
                  Available
                </button>
                <button
                  type="button"
                  className={`admin-inventory-avail-chip${availability === 'Unavailable' ? ' is-selected' : ''}`}
                  aria-pressed={availability === 'Unavailable'}
                  onClick={() => setAvailability('Unavailable')}
                >
                  Unavailable
                </button>
              </div>
            </label>
          )}

          <div className="admin-inventory-modal-actions">
            <button type="button" className="admin-inventory-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-inventory-primary-btn">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Inventory() {
  const selectAllRef = useRef(null)
  const filtersRef = useRef(null)
  const [items, setItems] = useState(() => getInventoryItems())
  const [searchValue, setSearchValue] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set())
  const [manageItem, setManageItem] = useState(null)

  const filteredItems = useMemo(() => {
    const searchNeedle = normalizeText(searchValue).trim()

    return items.filter((item) => {
      const matchesSearch =
        searchNeedle.length === 0 ||
        normalizeText(item.product).includes(searchNeedle) ||
        normalizeText(item.variant).includes(searchNeedle)

      const matchesCategory =
        selectedCategory === 'All Categories' || item.category === selectedCategory

      const matchesStatus = selectedStatus === 'All Status' || getInventoryStatus(item) === selectedStatus

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [items, searchValue, selectedCategory, selectedStatus])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage))
  const currentPage = Math.min(page, pageCount)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)
  const visibleItemIds = paginatedItems.map((item) => item.id)
  const selectedVisibleCount = visibleItemIds.filter((id) => selectedItemIds.has(id)).length
  const hasVisibleRows = visibleItemIds.length > 0
  const isAllVisibleSelected = hasVisibleRows && selectedVisibleCount === visibleItemIds.length
  const isPartiallyVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected

  const from = filteredItems.length === 0 ? 0 : startIndex + 1
  const to = filteredItems.length === 0 ? 0 : Math.min(endIndex, filteredItems.length)

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
    setSelectedItemIds((previous) => {
      const next = new Set(previous)

      if (isAllVisibleSelected) {
        visibleItemIds.forEach((id) => next.delete(id))
        return next
      }

      visibleItemIds.forEach((id) => next.add(id))
      return next
    })
  }

  const handleToggleItemSelection = (itemId) => {
    setSelectedItemIds((previous) => {
      const next = new Set(previous)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  const handleSaveInventory = (itemId, updates) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...updates, lastUpdated: 'Aug 19, 2026' } : item,
      ),
    )
  }

  return (
    <section className="admin-page admin-inventory-page">
      <div className="admin-page-heading">
        <h2>Inventory</h2>
        <p>Monitor product availability and stock levels.</p>
      </div>

      <div className="admin-inventory-toolbar" role="region" aria-label="Inventory search and filters">
        <div className="admin-inventory-search-wrap">
          <div className="admin-inventory-control admin-inventory-control--search">
            <svg className="admin-inventory-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              id="inventory-search"
              className="admin-inventory-search"
              type="search"
              placeholder="Search products..."
              value={searchValue}
              onChange={handleSearchChange}
              aria-label="Search products"
            />
          </div>
        </div>

        <div className="admin-inventory-filters" ref={filtersRef}>
          <label className="admin-inventory-filter" aria-label="Category filter">
            <FilterDropdown
              id="inventory-category"
              value={selectedCategory}
              options={CATEGORY_OPTIONS}
              isOpen={openDropdown === 'category'}
              onToggle={() => handleToggleDropdown('category')}
              onSelect={handleSelectDropdownValue(setSelectedCategory)}
              icon={
                <svg className="admin-inventory-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

          <label className="admin-inventory-filter" aria-label="Status filter">
            <FilterDropdown
              id="inventory-status"
              value={selectedStatus}
              options={STATUS_OPTIONS}
              isOpen={openDropdown === 'status'}
              onToggle={() => handleToggleDropdown('status')}
              onSelect={handleSelectDropdownValue(setSelectedStatus)}
              icon={
                <svg className="admin-inventory-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        </div>
      </div>

      <div className="admin-inventory-table-shell">
        <div className="admin-inventory-table-scroll">
          <table className="admin-inventory-table">
            <thead>
              <tr>
                <th className="admin-inventory-checkbox-column">
                  <input
                    ref={selectAllRef}
                    className="admin-inventory-checkbox"
                    type="checkbox"
                    aria-label="Select all visible items"
                    checked={isAllVisibleSelected}
                    disabled={!hasVisibleRows}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th>Product</th>
                <th>Category</th>
                <th>Variant</th>
                <th>Stock / Availability</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td className="admin-inventory-empty" colSpan={8}>
                    No products matched your filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const status = getInventoryStatus(item)
                  return (
                    <tr key={item.id}>
                      <td className="admin-inventory-checkbox-column">
                        <input
                          className="admin-inventory-checkbox"
                          type="checkbox"
                          aria-label={`Select ${item.product}`}
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => handleToggleItemSelection(item.id)}
                        />
                      </td>
                      <td className="admin-inventory-product">{item.product}</td>
                      <td>{item.category}</td>
                      <td className="admin-inventory-variant">{item.variant}</td>
                      <td className="admin-inventory-stock">
                        {'stock' in item ? item.stock : item.availability}
                      </td>
                      <td>
                        <span className={getStatusClassName(status)}>{status}</span>
                      </td>
                      <td>{item.lastUpdated}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-inventory-action-btn"
                          onClick={() => setManageItem(item)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-inventory-pagination">
          <div className="admin-inventory-pagination-summary">
            Showing {from}-{to} of {filteredItems.length} products
          </div>

          <div className="admin-inventory-pagination-controls">
            <label className="admin-inventory-pagination-rows" htmlFor="inventory-rows-per-page">
              Rows per page:
              <select id="inventory-rows-per-page" value={rowsPerPage} onChange={handleRowsPerPageChange}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>

            <button
              type="button"
              className="admin-inventory-page-btn"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="admin-inventory-page-number">{currentPage}</span>
            <span className="admin-inventory-page-divider">/</span>
            <span className="admin-inventory-page-number">{pageCount}</span>

            <button
              type="button"
              className="admin-inventory-page-btn"
              disabled={currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {manageItem ? (
        <ManageModal
          item={manageItem}
          onClose={() => setManageItem(null)}
          onSave={(updates) => handleSaveInventory(manageItem.id, updates)}
        />
      ) : null}
    </section>
  )
}

export default Inventory
