import { useMemo, useState } from 'react'
import {
  deleteCustomizationOption,
  getCustomizationCatalog,
  getProductOptionGroups,
  toggleCustomizationOptionStatus,
  upsertCustomizationOption,
} from '../../services/customizationOptionsService.js'
import './Customization.css'

const PRODUCT_TABS = [
  { label: 'Cakes', productCategory: 'Cake' },
  { label: 'Cupcakes', productCategory: 'Cupcakes' },
  { label: 'Party Packages', productCategory: 'Party Package' },
]

const STATUS_OPTIONS = ['All Status', 'Active', 'Inactive']

const EMPTY_DRAFT = {
  id: '',
  productCategory: 'Cake',
  groupName: 'Flavors',
  label: '',
  value: '',
  active: true,
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

function StatusBadge({ isActive }) {
  return (
    <span className={`admin-customization-status ${isActive ? 'admin-customization-status--active' : 'admin-customization-status--inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
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
    <div className="admin-customization-filter-dropdown">
      <button
        id={`${id}-trigger`}
        type="button"
        className={`admin-customization-control admin-customization-control--select${isOpen ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        {icon}
        <span className="admin-customization-control-value">{value}</span>
        <svg
          className={`admin-customization-control-chevron${isOpen ? ' is-open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
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
        className={`admin-customization-dropdown-menu${isOpen ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={`${id}-trigger`}
      >
        {options.map((option) => (
          <li key={option} role="option" aria-selected={value === option}>
            <button
              type="button"
              className={`admin-customization-dropdown-option${value === option ? ' is-selected' : ''}`}
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

function CustomizationOptionsForm({ initialDraft, onClose, onSave }) {
  const [draft, setDraft] = useState(initialDraft)

  const handleChange = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const nextLabel = draft.label.trim()
    const nextValue = draft.value.trim() || nextLabel.toLowerCase().replace(/\s+/g, '-')

    if (!nextLabel) return

    onSave({ ...draft, label: nextLabel, value: nextValue })
  }

  const categoryLabel = PRODUCT_TABS.find((t) => t.productCategory === draft.productCategory)?.label || draft.productCategory

  return (
    <div className="admin-customization-modal-backdrop" onClick={onClose}>
      <div className="admin-customization-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-customization-modal-header">
          <div>
            <p className="admin-customization-modal-kicker">{categoryLabel} · {draft.groupName}</p>
            <h3>{draft.id ? 'Edit option' : 'Add option'}</h3>
          </div>
          <button type="button" className="admin-customization-close-btn" onClick={onClose} aria-label="Close form">
            ×
          </button>
        </div>

        <form className="admin-customization-form" onSubmit={handleSubmit}>
          <div className="admin-customization-form-grid">
            <label className="admin-customization-form-wide">
              <span>Option label</span>
              <input
                type="text"
                value={draft.label}
                placeholder="Example: Mango"
                autoFocus
                onChange={(event) => handleChange('label', event.target.value)}
              />
            </label>

            <label className="admin-customization-form-wide">
              <span>Value <span style={{fontWeight:400,color:'#9ca3af'}}>(auto-filled if left blank)</span></span>
              <input
                type="text"
                value={draft.value}
                placeholder="mango"
                onChange={(event) => handleChange('value', event.target.value)}
              />
            </label>

            <label className="admin-customization-toggle">
              <span>Status</span>
              <button
                type="button"
                className={`admin-customization-toggle-btn${draft.active ? ' is-on' : ''}`}
                onClick={() => handleChange('active', !draft.active)}
              >
                <span className="admin-customization-toggle-thumb" />
              </button>
            </label>
          </div>

          <div className="admin-customization-form-actions">
            <button type="button" className="admin-customization-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-customization-primary-btn">
              {draft.id ? 'Save Changes' : 'Add Option'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Customization() {
  const [catalog, setCatalog] = useState(() => getCustomizationCatalog())
  const [activeTab, setActiveTab] = useState('Cakes')
  const [searchValue, setSearchValue] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  const activeProductCategory = PRODUCT_TABS.find((tab) => tab.label === activeTab)?.productCategory || 'Cake'
  const optionGroups = getProductOptionGroups(activeProductCategory)

  const groupedSections = useMemo(() => {
    const searchNeedle = normalizeText(searchValue).trim()

    return optionGroups.map((groupName) => {
      const options = Array.isArray(catalog[activeProductCategory]?.[groupName])
        ? catalog[activeProductCategory][groupName]
        : []

      const filteredOptions = options.filter((option) => {
        const matchesSearch =
          searchNeedle.length === 0 ||
          normalizeText(option.label).includes(searchNeedle) ||
          normalizeText(option.value).includes(searchNeedle)

        const matchesStatus =
          selectedStatus === 'All Status' ||
          ((option.active !== false ? 'Active' : 'Inactive') === selectedStatus)

        return matchesSearch && matchesStatus
      })

      return {
        groupName,
        options: filteredOptions,
      }
    })
  }, [catalog, activeProductCategory, optionGroups, searchValue, selectedStatus])

  const handleOpenAddForm = (groupName) => {
    setDraft({
      ...EMPTY_DRAFT,
      productCategory: activeProductCategory,
      groupName,
    })
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (groupName, option) => {
    setDraft({
      id: option.id,
      productCategory: activeProductCategory,
      groupName,
      label: option.label,
      value: option.value,
      active: option.active !== false,
    })
    setIsFormOpen(true)
  }

  const handleSaveOption = (payload) => {
    const nextCatalog = upsertCustomizationOption(
      payload.productCategory,
      payload.groupName,
      {
        id: payload.id,
        label: payload.label,
        value: payload.value,
        active: payload.active,
      },
    )

    setCatalog(nextCatalog)
    setIsFormOpen(false)
  }

  const handleToggleStatus = (groupName, option) => {
    const nextCatalog = toggleCustomizationOptionStatus(
      activeProductCategory,
      groupName,
      option.id,
      option.active === false,
    )
    setCatalog(nextCatalog)
  }

  const handleDelete = (groupName, option) => {
    const nextCatalog = deleteCustomizationOption(activeProductCategory, groupName, option.id)
    setCatalog(nextCatalog)
  }

  const handleToggleDropdown = (dropdownKey) => {
    setOpenDropdown((current) => (current === dropdownKey ? null : dropdownKey))
  }

  const handleSelectDropdownValue = (setter) => (value) => {
    setter(value)
    setOpenDropdown(null)
  }

  return (
    <section className="admin-page admin-customization-page">
      <div className="admin-page-heading">
        <h2>Customization Management</h2>
      </div>

      <div className="admin-customization-tabs" role="tablist" aria-label="Customization product categories">
        {PRODUCT_TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.label}
            className={`admin-customization-tab${activeTab === tab.label ? ' admin-customization-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.label)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-customization-toolbar" role="region" aria-label="Customization search and status filters">
        <div className="admin-customization-search-wrap">
          <div className="admin-customization-control admin-customization-control--search">
            <svg className="admin-customization-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              className="admin-customization-search"
              type="search"
              placeholder="Search choices..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              aria-label="Search customization choices"
            />
          </div>
        </div>

        <div className="admin-customization-filters">
          <div className="admin-customization-filter">
            <FilterDropdown
              id="customization-status"
              value={selectedStatus}
              options={STATUS_OPTIONS}
              isOpen={openDropdown === 'status'}
              onToggle={() => handleToggleDropdown('status')}
              onSelect={handleSelectDropdownValue(setSelectedStatus)}
              icon={
                <svg className="admin-customization-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
          </div>
        </div>
      </div>

      {groupedSections.map(({ groupName, options }) => (
        <section key={groupName} className="admin-customization-section">
          <div className="admin-customization-section-header">
            <h3>{groupName}</h3>
            <button type="button" className="admin-customization-primary-btn" onClick={() => handleOpenAddForm(groupName)}>
              Add choice
            </button>
          </div>

          {options.length === 0 ? (
            <div className="admin-customization-empty-card">
              No active choices for this section yet.
            </div>
          ) : (
            <div className="admin-customization-table-shell">
              <div className="admin-customization-table-scroll">
                <table className="admin-customization-table">
                  <thead>
                    <tr>
                      <th>Choice</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((option) => (
                      <tr key={option.id || `${groupName}-${option.value}`}>
                        <td>{option.label}</td>
                        <td>{option.value}</td>
                        <td>
                          <StatusBadge isActive={option.active !== false} />
                        </td>
                        <td>
                          <div className="admin-customization-action-group">
                            <button
                              type="button"
                              className="admin-customization-action-btn"
                              onClick={() => handleOpenEditForm(groupName, option)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="admin-customization-action-btn admin-customization-action-btn--ghost"
                              onClick={() => handleToggleStatus(groupName, option)}
                            >
                              {option.active === false ? 'Activate' : 'Deactivate'}
                            </button>
                            <button
                              type="button"
                              className="admin-customization-action-btn admin-customization-action-btn--danger"
                              onClick={() => handleDelete(groupName, option)}
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
        </section>
      ))}

      {isFormOpen ? (
        <CustomizationOptionsForm
          initialDraft={draft}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveOption}
        />
      ) : null}
    </section>
  )
}

export default Customization
