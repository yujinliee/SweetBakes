import { useState } from 'react'
import {
  deleteCustomizationOption,
  getCustomizationCatalog,
  getProductOptionGroups,
  toggleCustomizationOptionStatus,
  upsertCustomizationOption,
} from '../../services/customizationOptionsService.js'
import './Products.css'

const CATEGORY_TABS = [
  { label: 'Cakes', productCategory: 'Cake' },
  { label: 'Cupcakes', productCategory: 'Cupcakes' },
  { label: 'Party Packages', productCategory: 'Party Package' },
]

const EMPTY_DRAFT = { id: '', label: '', value: '', active: true }

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function OptionStatusBadge({ isActive }) {
  return (
    <span className={`admin-products-opt-badge admin-products-opt-badge--${isActive ? 'active' : 'inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

function OptionModal({ productCategory, groupName, draft, onClose, onSave }) {
  const [form, setForm] = useState(draft)
  const categoryLabel = CATEGORY_TABS.find((t) => t.productCategory === productCategory)?.label || productCategory

  const handleSubmit = (event) => {
    event.preventDefault()
    const label = form.label.trim()
    if (!label) return
    const value = form.value.trim() || label.toLowerCase().replace(/\s+/g, '-')
    onSave({ ...form, label, value })
  }

  return (
    <div className="admin-products-modal-backdrop" onClick={onClose}>
      <div className="admin-products-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-products-modal-header">
          <div>
            <p className="admin-products-modal-kicker">{categoryLabel} · {groupName}</p>
            <h3>{form.id ? 'Edit option' : 'Add option'}</h3>
          </div>
          <button type="button" className="admin-products-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="admin-products-modal-form" onSubmit={handleSubmit}>
          <label>
            <span>Option label</span>
            <input
              type="text"
              value={form.label}
              placeholder="e.g. Mango"
              autoFocus
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <label>
            <span>Value <span className="admin-products-modal-hint">(auto-filled if blank)</span></span>
            <input
              type="text"
              value={form.value}
              placeholder="e.g. mango"
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </label>
          <label className="admin-products-modal-toggle-row">
            <span>Active</span>
            <button
              type="button"
              className={`admin-products-toggle${form.active ? ' is-on' : ''}`}
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
            >
              <span className="admin-products-toggle-thumb" />
            </button>
          </label>
          <div className="admin-products-modal-actions">
            <button type="button" className="admin-products-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-products-primary-btn">
              {form.id ? 'Save Changes' : 'Add Option'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Products() {
  const [activeCategoryTab, setActiveCategoryTab] = useState('Cakes')
  const [activeGroupTab, setActiveGroupTab] = useState(() => getProductOptionGroups('Cake')[0])
  const [searchValue, setSearchValue] = useState('')
  const [catalog, setCatalog] = useState(() => getCustomizationCatalog())
  const [modal, setModal] = useState(null)

  const activeCategory = CATEGORY_TABS.find((t) => t.label === activeCategoryTab).productCategory
  const groups = getProductOptionGroups(activeCategory)

  const handleCategoryChange = (tab) => {
    const category = CATEGORY_TABS.find((t) => t.label === tab).productCategory
    setActiveCategoryTab(tab)
    setActiveGroupTab(getProductOptionGroups(category)[0])
    setSearchValue('')
  }

  const handleGroupChange = (group) => {
    setActiveGroupTab(group)
    setSearchValue('')
  }

  const needle = normalizeText(searchValue).trim()
  const allOptions = Array.isArray(catalog[activeCategory]?.[activeGroupTab])
    ? catalog[activeCategory][activeGroupTab]
    : []
  const visibleOptions = needle
    ? allOptions.filter((o) => normalizeText(o.label).includes(needle) || normalizeText(o.value).includes(needle))
    : allOptions

  const openAdd = () => setModal({ draft: { ...EMPTY_DRAFT } })
  const openEdit = (option) => setModal({ draft: { id: option.id, label: option.label, value: option.value, active: option.active !== false } })

  const handleSave = (saved) => {
    setCatalog(upsertCustomizationOption(activeCategory, activeGroupTab, saved))
    setModal(null)
  }

  const handleToggle = (option) => {
    setCatalog(toggleCustomizationOptionStatus(activeCategory, activeGroupTab, option.id, option.active === false))
  }

  const handleDelete = (option) => {
    setCatalog(deleteCustomizationOption(activeCategory, activeGroupTab, option.id))
  }

  const searchPlaceholder = `Search ${activeCategoryTab.toLowerCase()} options...`

  return (
    <section className="admin-page admin-products-page">
      <div className="admin-page-heading">
        <h2>Products</h2>
      </div>

      <div className="admin-products-toolbar" role="region" aria-label="Options search">
        <div className="admin-products-search-wrap">
          <div className="admin-products-control admin-products-control--search">
            <svg className="admin-products-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              className="admin-products-search"
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      </div>

      {/* Level 1 — Product Category */}
      <div className="admin-products-tabs" role="tablist" aria-label="Product category">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={activeCategoryTab === tab.label}
            className={`admin-products-tab${activeCategoryTab === tab.label ? ' admin-products-tab--active' : ''}`}
            onClick={() => handleCategoryChange(tab.label)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Level 2 — Customization Group */}
      <div className="admin-products-subtabs" role="tablist" aria-label="Customization type">
        {groups.map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={activeGroupTab === group}
            className={`admin-products-subtab${activeGroupTab === group ? ' admin-products-subtab--active' : ''}`}
            onClick={() => handleGroupChange(group)}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Options table */}
      <div className="admin-products-content">
        <div className="admin-products-content-header">
          <span className="admin-products-content-title">
            {activeCategoryTab} — {activeGroupTab}
          </span>
          <button type="button" className="admin-products-primary-btn" onClick={openAdd}>
            + Add Option
          </button>
        </div>

        {visibleOptions.length === 0 ? (
          <div className="admin-products-opt-empty">
            {needle ? 'No options matched your search.' : 'No options yet. Click + Add Option to get started.'}
          </div>
        ) : (
          <div className="admin-products-table-shell">
            <div className="admin-products-table-scroll">
              <table className="admin-products-table">
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOptions.map((option) => (
                    <tr key={option.id}>
                      <td className="admin-products-opt-label">{option.label}</td>
                      <td className="admin-products-opt-value">{option.value}</td>
                      <td><OptionStatusBadge isActive={option.active !== false} /></td>
                      <td>
                        <div className="admin-products-opt-actions">
                          <button type="button" className="admin-products-action-btn" onClick={() => openEdit(option)}>Edit</button>
                          <button
                            type="button"
                            className="admin-products-action-btn admin-products-action-btn--ghost"
                            onClick={() => handleToggle(option)}
                          >
                            {option.active === false ? 'Activate' : 'Deactivate'}
                          </button>
                          <button
                            type="button"
                            className="admin-products-action-btn admin-products-action-btn--danger"
                            onClick={() => handleDelete(option)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal ? (
        <OptionModal
          productCategory={activeCategory}
          groupName={activeGroupTab}
          draft={modal.draft}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      ) : null}
    </section>
  )
}

export default Products
