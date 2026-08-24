import { useEffect, useRef, useState } from 'react'
import {
  deleteCustomizationOption,
  getCustomizationCatalog,
  getProductOptionGroups,
  toggleCustomizationOptionStatus,
  upsertCustomizationOption,
} from '../../services/customizationOptionsService.js'
import {
  deleteSweetTreatsProduct,
  getSweetTreatsCategories,
  getSweetTreatsProducts,
  slugifyProductName,
  SWEET_TREATS_CATEGORY_OPTIONS,
  toggleSweetTreatsProductStatus,
  upsertSweetTreatsCategory,
  upsertSweetTreatsProduct,
} from '../../services/sweetTreatsProductsService.js'
import chocolateCakeImage from '../../../assets/othersweettreats/regular_chocolate.jpg'
import redVelvetCakeImage from '../../../assets/othersweettreats/regular_redvelvet.png'
import cheesecakeImage from '../../../assets/othersweettreats/halfordozen_cheesecake.png'
import ubeImage from '../../../assets/othersweettreats/ube.png'
import grahamImage from '../../../assets/othersweettreats/graham de leche.png'
import lecheFlanImage from '../../../assets/othersweettreats/leche_flan.png'
import putoImage from '../../../assets/othersweettreats/puto.jpg'
import './Products.css'

const CATEGORY_TABS = [
  { label: 'Cakes', productCategory: 'Cake' },
  { label: 'Cupcakes', productCategory: 'Cupcakes' },
  { label: 'Party Packages', productCategory: 'Party Package' },
  { label: 'Sweet Treats', productCategory: 'Sweet Treats' },
]

const SEARCH_PLACEHOLDERS = {
  Cakes: 'Search cake options...',
  Cupcakes: 'Search cupcake options...',
  'Party Packages': 'Search package options...',
  'Sweet Treats': 'Search sweet treats...',
}

const EMPTY_DRAFT = { id: '', label: '', value: '', active: true }

const EMPTY_SWEET_TREATS_DRAFT = {
  id: '',
  product: '',
  category: 'regular_cake',
  description: '',
  price: '',
  active: true,
  image_url: '',
  variants: [],
  flavors: [],
}

const EMPTY_SWEET_TREATS_CATEGORY_DRAFT = {
  id: '',
  name: '',
  slug: '',
  active: true,
  sort_order: 100,
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase()
}

const formatPeso = (value) => `₱${Number(value).toLocaleString('en-PH')}`

const LOCAL_PRODUCT_IMAGE_FALLBACKS = {
  'chocolate-cake': chocolateCakeImage,
  'red-velvet-cake': redVelvetCakeImage,
  cheesecake: cheesecakeImage,
  ube: ubeImage,
  'graham-de-leche': grahamImage,
  'leche-flan': lecheFlanImage,
  puto: putoImage,
}

const formatSweetTreatsPrice = (product) => {
  if (
    product.base_price !== null &&
    product.base_price !== undefined &&
    product.base_price !== '' &&
    Number.isFinite(Number(product.base_price))
  ) {
    return formatPeso(product.base_price)
  }

  const variantPrices = (product.variants || [])
    .filter((variant) => variant.active !== false)
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite)

  if (variantPrices.length > 0) {
    return `From ${formatPeso(Math.min(...variantPrices))}`
  }

  return '—'
}

const ProductImageCell = ({ product }) => {
  const imageUrl =
    product.image_url || product.imageUrl || LOCAL_PRODUCT_IMAGE_FALLBACKS[product.slug]

  if (imageUrl) {
    return (
      <img
        className="admin-products-image-thumb"
        src={imageUrl}
        alt={product.product || product.name}
      />
    )
  }

  return (
    <span className="admin-products-image-placeholder" aria-label="No product image" title="No image">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="m6.8 16.6 3.1-3.1a1.4 1.4 0 0 1 2 0l1.1 1.1 2.2-2.2a1.4 1.4 0 0 1 2 0l2 2M8.5 9a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function SweetTreatsActionsMenu({
  product,
  isOpen,
  onToggle,
  onEdit,
  onStatusToggle,
  onDelete,
}) {
  return (
    <div className="admin-products-actions-menu-wrap">
      <button
        type="button"
        className="admin-products-more-btn"
        aria-label={`Open actions for ${product.product}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 7.25a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7ZM12 13.35a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7ZM12 19.45a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="admin-products-actions-popover" role="menu">
          <button type="button" role="menuitem" onClick={onEdit}>
            Edit Product
          </button>
          <button type="button" role="menuitem" onClick={onStatusToggle}>
            {product.active === false ? 'Activate' : 'Deactivate'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="admin-products-actions-popover-danger"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
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
      <div className="admin-products-modal admin-products-modal--sweet-treats" onClick={(e) => e.stopPropagation()}>
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

function SweetTreatsProductModal({ draft, categories = SWEET_TREATS_CATEGORY_OPTIONS, onClose, onSave }) {
  const [form, setForm] = useState(draft)
  const isCheesecake = form.category === 'cheesecake'
  const [activeProductTab, setActiveProductTab] = useState('general')
  const [flavorList, setFlavorList] = useState(
    form.flavors?.length ? form.flavors : ['Blueberry', 'Mango', 'Strawberry', 'Oreo'],
  )
  const [newFlavorName, setNewFlavorName] = useState('')
  const [imagePreview, setImagePreview] = useState(form.image_url || form.imageUrl || '')
  const initialFlavorPreviews = Object.fromEntries(
    (form.productImages || []).map((image) => [image.label, image.image_url || image.imageUrl || '']),
  )
  const [flavorImagePreviews, setFlavorImagePreviews] = useState(initialFlavorPreviews)
  const [flavorImageFiles, setFlavorImageFiles] = useState({})
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const variants = form.variants?.length
    ? form.variants
    : [
        { name: 'Half Dozen', price: 300, active: true, sort_order: 10 },
        { name: 'Dozen', price: 600, active: true, sort_order: 20 },
        { name: 'Large / Whole', price: 850, active: true, sort_order: 30 },
      ]
  const flavorNames = isCheesecake ? flavorList : []

  useEffect(() => {
    if (!isCheesecake && activeProductTab !== 'general') {
      setActiveProductTab('general')
    }
  }, [activeProductTab, isCheesecake])

  useEffect(
    () => () => {
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
      Object.values(flavorImagePreviews).forEach((preview) => {
        if (preview?.startsWith('blob:')) {
          URL.revokeObjectURL(preview)
        }
      })
    },
    [imagePreview, flavorImagePreviews],
  )

  const updateVariant = (index, updates) => {
    setForm((current) => ({
      ...current,
      variants: variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...updates } : variant,
      ),
    }))
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Image must be JPEG, PNG, or WebP.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image must be 5MB or smaller.')
      event.target.value = ''
      return
    }

    setErrorMessage('')
    const previewUrl = URL.createObjectURL(file)
    setImagePreview((current) => {
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current)
      }
      return previewUrl
    })
    setForm((current) => ({ ...current, imageFile: file }))
  }

  const handleFlavorImageChange = (flavor, event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Image must be JPEG, PNG, or WebP.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image must be 5MB or smaller.')
      event.target.value = ''
      return
    }

    setErrorMessage('')
    const previewUrl = URL.createObjectURL(file)
    setFlavorImagePreviews((current) => {
      if (current[flavor]?.startsWith('blob:')) {
        URL.revokeObjectURL(current[flavor])
      }
      return { ...current, [flavor]: previewUrl }
    })
    setFlavorImageFiles((current) => ({ ...current, [flavor]: file }))
  }

  const handleAddFlavor = () => {
    const nextFlavor = newFlavorName.trim()

    if (!nextFlavor) {
      return
    }

    setFlavorList((current) => {
      if (current.some((flavor) => flavor.toLowerCase() === nextFlavor.toLowerCase())) {
        return current
      }

      return [...current, nextFlavor]
    })
    setNewFlavorName('')
  }

  const handleRemoveFlavor = (flavorToRemove) => {
    setFlavorList((current) => current.filter((flavor) => flavor !== flavorToRemove))
    setFlavorImageFiles((current) => {
      const next = { ...current }
      delete next[flavorToRemove]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const product = form.product.trim()
    const priceIsBlank = form.price === '' || form.price === null || form.price === undefined
    const price = priceIsBlank ? '' : Number(form.price)

    if (!product) {
      setErrorMessage('Product name is required.')
      return
    }

    if (!form.category) {
      setErrorMessage('Category is required.')
      return
    }

    if (!isCheesecake && (priceIsBlank || !Number.isFinite(price) || price < 0)) {
      setErrorMessage('Enter a valid price.')
      return
    }

    if (isCheesecake && !priceIsBlank && (!Number.isFinite(price) || price < 0)) {
      setErrorMessage('Enter a valid price.')
      return
    }

    const flavors = isCheesecake ? flavorList : []

    setIsSaving(true)
    setErrorMessage('')

    try {
      await onSave({
        ...form,
        product,
        price,
        variants: isCheesecake ? variants : [],
        flavors,
        flavorImageFiles,
      })
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save product.')
    } finally {
      setIsSaving(false)
    }
  }

  const productTabs = isCheesecake
    ? [
        { id: 'general', label: 'General' },
        { id: 'variants', label: 'Variants' },
        { id: 'flavors', label: 'Flavors & Images' },
      ]
    : [{ id: 'general', label: 'General' }]

  return (
    <div className="admin-products-modal-backdrop" onClick={onClose}>
      <div className="admin-products-modal admin-products-modal--sweet-treats" onClick={(e) => e.stopPropagation()}>
        <div className="admin-products-modal-header">
          <div>
            <p className="admin-products-modal-kicker">Sweet Treats · Products</p>
            <h3>{form.id ? 'Edit product' : 'Add product'}</h3>
          </div>
          <button type="button" className="admin-products-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="admin-products-modal-form admin-products-modal-form--sweet-treats" onSubmit={handleSubmit}>
          <div className="admin-products-modal-tabs" role="tablist" aria-label="Edit product sections">
            {productTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeProductTab === tab.id}
                className={`admin-products-modal-tab${activeProductTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveProductTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="admin-products-modal-tab-content">
          {activeProductTab === 'general' ? (
          <div className="admin-products-modal-grid">
            <>
              <label>
                <span>Product Name</span>
                <input
                  type="text"
                  value={form.product}
                  placeholder="e.g. Ube"
                  autoFocus
                  onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {categories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Base Price</span>
                <div className="admin-products-price-input">
                  <span aria-hidden="true">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.price}
                    placeholder={isCheesecake ? 'Uses variant pricing' : '200'}
                    disabled={isCheesecake}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </div>
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={form.description}
                  rows="4"
                  placeholder="Short storefront description"
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="admin-products-modal-toggle-row admin-products-modal-toggle-row--sweet admin-products-status-field">
                <span>Active</span>
                <button
                  type="button"
                  className={`admin-products-toggle${form.active ? ' is-on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                >
                  <span className="admin-products-toggle-thumb" />
                </button>
              </label>
            </>
            <div className="admin-products-modal-column admin-products-modal-column--image admin-products-modal-span">
              <label className="admin-products-upload-label">
                <span>Product Image</span>
                <div className="admin-products-image-upload">
                  <div className="admin-products-image-preview">
                    {imagePreview ? (
                      <img src={imagePreview} alt={`${form.product || 'Product'} preview`} />
                    ) : (
                      <div className="admin-products-upload-empty">
                        <span className="admin-products-upload-icon" aria-hidden="true">↑</span>
                        <span>Choose image or drag & drop</span>
                        <span>Browse files</span>
                      </div>
                    )}
                  </div>
                  <span className="admin-products-upload-button">
                    {imagePreview ? 'Replace Image' : 'Choose Image'}
                  </span>
                  <span className="admin-products-upload-help">JPEG, PNG, or WebP. Max 5MB.</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
                </div>
              </label>
            </div>
          </div>
          ) : null}
          {isCheesecake && activeProductTab === 'variants' ? (
            <div className="admin-products-cheesecake-section">
              <div className="admin-products-variant-editor">
                <span className="admin-products-variant-title">Size Variants</span>
                <p className="admin-products-flavor-images-note">
                  Manage the available sizes and prices for this product.
                </p>
                <div className="admin-products-variant-list">
                  {variants.map((variant, index) => (
                    <div className="admin-products-variant-row" key={`${variant.id || variant.name}-${index}`}>
                      <input
                        type="text"
                        value={variant.name}
                        placeholder="Variant"
                        onChange={(e) => updateVariant(index, { name: e.target.value })}
                      />
                      <div className="admin-products-price-input">
                        <span aria-hidden="true">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={variant.price}
                          placeholder="Price"
                          onChange={(e) => updateVariant(index, { price: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {isCheesecake && activeProductTab === 'flavors' ? (
            <div className="admin-products-cheesecake-section">
              <div className="admin-products-flavor-manager">
                <div>
                  <span className="admin-products-variant-title">Flavors</span>
                  <p className="admin-products-flavor-images-note">
                    Manage the flavors available for this Cheesecake product.
                  </p>
                </div>
                <div className="admin-products-flavor-list">
                  {flavorNames.map((flavor) => (
                    <div className="admin-products-flavor-row" key={flavor}>
                      <span>{flavor}</span>
                      <button type="button" onClick={() => handleRemoveFlavor(flavor)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="admin-products-add-flavor-row">
                  <input
                    type="text"
                    value={newFlavorName}
                    placeholder="Add flavor"
                    onChange={(event) => setNewFlavorName(event.target.value)}
                  />
                  <button type="button" onClick={handleAddFlavor}>
                    + Add Flavor
                  </button>
                </div>
              </div>

              <div className="admin-products-flavor-images">
                <div>
                  <span className="admin-products-variant-title">Flavor Images</span>
                  <p className="admin-products-flavor-images-note">
                    Upload optional flavor-specific Cheesecake images.
                  </p>
                </div>
                <div className="admin-products-flavor-image-grid">
                  {flavorNames.map((flavor) => {
                    const preview = flavorImagePreviews[flavor]
                    return (
                      <label className="admin-products-flavor-image-card" key={flavor}>
                        <span>{flavor}</span>
                        <div className="admin-products-flavor-image-preview">
                          {preview ? (
                            <img src={preview} alt={`${flavor} cheesecake`} />
                          ) : (
                            <span>No image uploaded</span>
                          )}
                        </div>
                        <span className="admin-products-flavor-image-button">
                          {preview ? 'Replace Image' : 'Upload Image'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => handleFlavorImageChange(flavor, event)}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {errorMessage ? <p className="admin-products-modal-error">{errorMessage}</p> : null}
          </div>
          <div className="admin-products-modal-actions admin-products-modal-actions--sticky">
            <button type="button" className="admin-products-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-products-primary-btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : form.id ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SweetTreatsCategoryModal({ draft, onClose, onSave }) {
  const [form, setForm] = useState(draft)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const generatedSlug = slugifyProductName(form.name)
  const slug = form.slug || generatedSlug

  const handleSubmit = async (event) => {
    event.preventDefault()
    const name = form.name.trim()

    if (!name) {
      setErrorMessage('Category name is required.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await onSave({
        ...form,
        name,
        slug,
      })
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save category.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="admin-products-modal-backdrop" onClick={onClose}>
      <div className="admin-products-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-products-modal-header">
          <div>
            <p className="admin-products-modal-kicker">Sweet Treats · Categories</p>
            <h3>Add category</h3>
          </div>
          <button type="button" className="admin-products-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="admin-products-modal-form" onSubmit={handleSubmit}>
          <label>
            <span>Category Name</span>
            <input
              type="text"
              value={form.name}
              placeholder="e.g. Brownies"
              autoFocus
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  slug: slugifyProductName(event.target.value),
                }))
              }
            />
          </label>

          <label>
            <span>Slug</span>
            <input type="text" value={slug} readOnly aria-label="Auto-generated slug" />
            <span className="admin-products-modal-hint">Auto-generated from the category name.</span>
          </label>

          <label>
            <span>Sort Order</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.sort_order}
              onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
            />
          </label>

          <label className="admin-products-modal-toggle-row">
            <span>Status</span>
            <button
              type="button"
              className={`admin-products-toggle${form.active ? ' is-on' : ''}`}
              onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
            >
              <span className="admin-products-toggle-thumb" />
            </button>
            <span>{form.active ? 'Active' : 'Inactive'}</span>
          </label>

          {errorMessage ? <p className="admin-products-modal-error">{errorMessage}</p> : null}

          <div className="admin-products-modal-actions">
            <button type="button" className="admin-products-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="admin-products-primary-btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Products({ category = 'Cakes' }) {
  const activeCategoryTab = category
  const [activeGroupTab, setActiveGroupTab] = useState(() => getProductOptionGroups(activeCategoryTab)[0])
  const [searchValue, setSearchValue] = useState('')
  const [catalog, setCatalog] = useState(() => getCustomizationCatalog())
  const [sweetTreats, setSweetTreats] = useState([])
  const [sweetTreatsCategories, setSweetTreatsCategories] = useState(SWEET_TREATS_CATEGORY_OPTIONS)
  const [sweetTreatsLoading, setSweetTreatsLoading] = useState(false)
  const [sweetTreatsError, setSweetTreatsError] = useState('')
  const [modal, setModal] = useState(null)
  const [selectedSweetTreatIds, setSelectedSweetTreatIds] = useState(() => new Set())
  const [openSweetTreatsActionId, setOpenSweetTreatsActionId] = useState(null)
  const sweetTreatsSelectAllRef = useRef(null)
  const sweetTreatsActionMenuRef = useRef(null)

  const isSweetTreats = activeCategoryTab === 'Sweet Treats'
  const activeCategory = CATEGORY_TABS.find((t) => t.label === activeCategoryTab).productCategory
  const groups = getProductOptionGroups(activeCategory)

  const loadSweetTreats = async () => {
    setSweetTreatsLoading(true)
    setSweetTreatsError('')

    try {
      const categories = await getSweetTreatsCategories()
      setSweetTreatsCategories(categories)
      setSweetTreats(await getSweetTreatsProducts())
    } catch (error) {
      console.error('[ADMIN PRODUCTS] load sweet treats:', error)
      setSweetTreatsError('Unable to load Sweet Treats products from Supabase.')
    } finally {
      setSweetTreatsLoading(false)
    }
  }

  useEffect(() => {
    if (!isSweetTreats) {
      return
    }

    loadSweetTreats()
  }, [isSweetTreats])

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

  const visibleSweetTreats = needle
    ? sweetTreats.filter(
        (product) =>
          normalizeText(product.product).includes(needle) ||
          normalizeText(product.variant).includes(needle) ||
          normalizeText(product.category).includes(needle) ||
          normalizeText(product.categoryLabel).includes(needle),
      )
    : sweetTreats
  const visibleSweetTreatIds = visibleSweetTreats.map((product) => product.id)
  const selectedVisibleSweetTreatCount = visibleSweetTreatIds.filter((id) =>
    selectedSweetTreatIds.has(id),
  ).length
  const hasVisibleSweetTreatRows = visibleSweetTreatIds.length > 0
  const isAllVisibleSweetTreatsSelected =
    hasVisibleSweetTreatRows && selectedVisibleSweetTreatCount === visibleSweetTreatIds.length
  const isPartiallyVisibleSweetTreatsSelected =
    selectedVisibleSweetTreatCount > 0 && !isAllVisibleSweetTreatsSelected

  useEffect(() => {
    if (sweetTreatsSelectAllRef.current) {
      sweetTreatsSelectAllRef.current.indeterminate = isPartiallyVisibleSweetTreatsSelected
    }
  }, [isPartiallyVisibleSweetTreatsSelected])

  useEffect(() => {
    if (!openSweetTreatsActionId) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!sweetTreatsActionMenuRef.current?.contains(event.target)) {
        setOpenSweetTreatsActionId(null)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenSweetTreatsActionId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openSweetTreatsActionId])

  const openAdd = () => setModal({ type: 'option', draft: { ...EMPTY_DRAFT } })
  const openEdit = (option) =>
    setModal({ type: 'option', draft: { id: option.id, label: option.label, value: option.value, active: option.active !== false } })

  const getFirstActiveSweetTreatsCategory = () =>
    sweetTreatsCategories.find((category) => category.active !== false)?.value ||
    SWEET_TREATS_CATEGORY_OPTIONS[0].value

  const getSweetTreatsCategoryLabel = (categoryValue) =>
    sweetTreatsCategories.find((option) => option.value === categoryValue)?.label ||
    SWEET_TREATS_CATEGORY_OPTIONS.find((option) => option.value === categoryValue)?.label ||
    categoryValue

  const openSweetTreatsAdd = () =>
    setModal({
      type: 'sweet-treats',
      draft: { ...EMPTY_SWEET_TREATS_DRAFT, category: getFirstActiveSweetTreatsCategory() },
    })
  const openSweetTreatsCategoryAdd = () =>
    setModal({
      type: 'sweet-treats-category',
      draft: {
        ...EMPTY_SWEET_TREATS_CATEGORY_DRAFT,
        sort_order: (sweetTreatsCategories.length + 1) * 10,
      },
    })
  const openSweetTreatsEdit = (product) =>
    setModal({
      type: 'sweet-treats',
      draft: {
        id: product.id,
        product: product.product,
        category: product.category,
        description: product.description,
        price: product.base_price ?? '',
        active: product.active !== false,
        image_url: product.image_url,
        variants: product.variants || [],
        flavors: product.flavors || [],
        productImages: product.productImages || [],
      },
    })

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

  const handleSweetTreatsSave = async (saved) => {
    try {
      await upsertSweetTreatsProduct(saved)
      setModal(null)
      await loadSweetTreats()
    } catch (error) {
      console.error('[ADMIN PRODUCTS] save sweet treat:', error)
      setSweetTreatsError(error?.message || 'Unable to save Sweet Treats product.')
      throw error
    }
  }

  const handleSweetTreatsCategorySave = async (saved) => {
    try {
      await upsertSweetTreatsCategory(saved)
      setModal(null)
      setSweetTreatsCategories(await getSweetTreatsCategories())
    } catch (error) {
      console.error('[ADMIN PRODUCTS] save sweet treat category:', error)
      setSweetTreatsError(error?.message || 'Unable to save Sweet Treats category.')
      throw error
    }
  }

  const handleSweetTreatsToggle = async (product) => {
    try {
      setOpenSweetTreatsActionId(null)
      setSweetTreats(await toggleSweetTreatsProductStatus(product.id, product.active === false))
    } catch (error) {
      console.error('[ADMIN PRODUCTS] toggle sweet treat:', error)
      setSweetTreatsError(error?.message || 'Unable to update product status.')
    }
  }

  const handleSweetTreatsDelete = async (product) => {
    setOpenSweetTreatsActionId(null)
    const shouldDelete = window.confirm(
      `Delete "${product.product}"?\n\nThis action cannot be undone.`,
    )

    if (!shouldDelete) {
      return
    }

    try {
      setSweetTreats(await deleteSweetTreatsProduct(product.id))
      setSelectedSweetTreatIds((current) => {
        const next = new Set(current)
        next.delete(product.id)
        return next
      })
    } catch (error) {
      console.error('[ADMIN PRODUCTS] delete sweet treat:', error)
      setSweetTreatsError(error?.message || 'Unable to remove product.')
    }
  }

  const handleSweetTreatsSelectAll = () => {
    setSelectedSweetTreatIds((current) => {
      const next = new Set(current)

      if (isAllVisibleSweetTreatsSelected) {
        visibleSweetTreatIds.forEach((id) => next.delete(id))
      } else {
        visibleSweetTreatIds.forEach((id) => next.add(id))
      }

      return next
    })
  }

  const handleSweetTreatsSelectRow = (productId) => {
    setSelectedSweetTreatIds((current) => {
      const next = new Set(current)

      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }

      return next
    })
  }

  const handleSweetTreatsEditFromMenu = (product) => {
    setOpenSweetTreatsActionId(null)
    openSweetTreatsEdit(product)
  }

  const searchPlaceholder = SEARCH_PLACEHOLDERS[activeCategoryTab] || 'Search...'

  return (
    <section className="admin-page admin-products-page">
      <div className="admin-page-heading">
        <h2>Products</h2>
      </div>

      <div className="admin-products-toolbar" role="region" aria-label="Products search">
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

      {/* Level 2 — Customization Group (not applicable to Sweet Treats) */}
      {!isSweetTreats ? (
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
      ) : null}

      {isSweetTreats ? (
        <div className="admin-products-content">
          <div className="admin-products-content-header">
            <span className="admin-products-content-title">
              Sweet Treats — Products
            </span>
            <div className="admin-products-content-actions">
              <button type="button" className="admin-products-primary-btn" onClick={openSweetTreatsCategoryAdd}>
                + Add Category
              </button>
              <button type="button" className="admin-products-primary-btn" onClick={openSweetTreatsAdd}>
                + Add Product
              </button>
            </div>
          </div>

          {sweetTreatsError ? (
            <div className="admin-products-opt-empty">{sweetTreatsError}</div>
          ) : null}

          {sweetTreatsLoading ? (
            <div className="admin-products-opt-empty">Loading Sweet Treats products...</div>
          ) : visibleSweetTreats.length === 0 ? (
            <div className="admin-products-opt-empty">
              {needle ? 'No products matched your search.' : 'No products yet. Click + Add Product to get started.'}
            </div>
          ) : (
            <div className="admin-products-table-shell">
              <div className="admin-products-table-scroll">
                <table className="admin-products-table">
                  <thead>
                    <tr>
                      <th className="admin-products-checkbox-column">
                        <input
                          ref={sweetTreatsSelectAllRef}
                          className="admin-products-checkbox"
                          type="checkbox"
                          aria-label="Select all visible Sweet Treat products"
                          checked={isAllVisibleSweetTreatsSelected}
                          disabled={!hasVisibleSweetTreatRows}
                          onChange={handleSweetTreatsSelectAll}
                        />
                      </th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Base Price</th>
                      <th>Image</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSweetTreats.map((product) => (
                      <tr key={product.id}>
                        <td className="admin-products-checkbox-column">
                          <input
                            className="admin-products-checkbox"
                            type="checkbox"
                            aria-label={`Select ${product.product}`}
                            checked={selectedSweetTreatIds.has(product.id)}
                            onChange={() => handleSweetTreatsSelectRow(product.id)}
                          />
                        </td>
                        <td className="admin-products-opt-label">{product.product}</td>
                        <td className="admin-products-opt-value">
                          {getSweetTreatsCategoryLabel(product.category)}
                        </td>
                        <td className="admin-products-price">{formatSweetTreatsPrice(product)}</td>
                        <td><ProductImageCell product={product} /></td>
                        <td><OptionStatusBadge isActive={product.active !== false} /></td>
                        <td>
                          <div
                            ref={openSweetTreatsActionId === product.id ? sweetTreatsActionMenuRef : null}
                          >
                            <SweetTreatsActionsMenu
                              product={product}
                              isOpen={openSweetTreatsActionId === product.id}
                              onToggle={() =>
                                setOpenSweetTreatsActionId((current) =>
                                  current === product.id ? null : product.id,
                                )
                              }
                              onEdit={() => handleSweetTreatsEditFromMenu(product)}
                              onStatusToggle={() => handleSweetTreatsToggle(product)}
                              onDelete={() => handleSweetTreatsDelete(product)}
                            />
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
      ) : (
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
      )}

      {modal ? (
        modal.type === 'sweet-treats' ? (
          <SweetTreatsProductModal
            draft={modal.draft}
            categories={sweetTreatsCategories}
            onClose={() => setModal(null)}
            onSave={handleSweetTreatsSave}
          />
        ) : modal.type === 'sweet-treats-category' ? (
          <SweetTreatsCategoryModal
            draft={modal.draft}
            onClose={() => setModal(null)}
            onSave={handleSweetTreatsCategorySave}
          />
        ) : (
          <OptionModal
            productCategory={activeCategory}
            groupName={activeGroupTab}
            draft={modal.draft}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )
      ) : null}
    </section>
  )
}

export default Products
