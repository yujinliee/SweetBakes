const STORAGE_KEY = 'sweetbakes:customization-options-v1'

export const PRODUCT_OPTION_GROUPS = {
  Cake: ['Flavors', 'Sizes', 'Layers', 'Frosting', 'Fillings', 'Designs / Details', 'Add-ons'],
  Cupcakes: ['Flavors', 'Sizes', 'Designs / Details', 'Add-ons'],
  'Party Package': ['Flavors', 'Sizes', 'Layers', 'Frosting', 'Fillings', 'Designs / Details', 'Add-ons'],
}

const defaultCatalog = {
  Cake: {
    Flavors: [
      { id: 'cake-flavor-chocolate', label: 'Chocolate', value: 'chocolate', active: true },
      { id: 'cake-flavor-vanilla', label: 'Vanilla', value: 'vanilla', active: true },
      { id: 'cake-flavor-redvelvet', label: 'Red Velvet', value: 'redvelvet', active: true },
      { id: 'cake-flavor-ube', label: 'Ube', value: 'ube', active: true },
    ],
    Sizes: [
      { id: 'cake-size-6', label: '6"', value: '6', active: true },
      { id: 'cake-size-8', label: '8"', value: '8', active: true },
      { id: 'cake-size-10', label: '10"', value: '10', active: true },
      { id: 'cake-size-12', label: '12"', value: '12', active: true },
    ],
    Layers: [
      { id: 'cake-layer-1', label: '1 Layer', value: '1', active: true },
      { id: 'cake-layer-2', label: '2 Layers', value: '2', active: true },
      { id: 'cake-layer-3', label: '3 Layers', value: '3', active: true },
    ],
    Frosting: [
      { id: 'cake-frosting-buttercream', label: 'Buttercream', value: 'buttercream', active: true },
      { id: 'cake-frosting-cream-cheese', label: 'Cream Cheese', value: 'cream-cheese', active: true },
      { id: 'cake-frosting-ganache', label: 'Ganache', value: 'ganache', active: true },
    ],
    Fillings: [
      { id: 'cake-filling-strawberry', label: 'Strawberry Compote', value: 'strawberry-compote', active: true },
      { id: 'cake-filling-chocolate', label: 'Chocolate Ganache', value: 'chocolate-ganache', active: true },
      { id: 'cake-filling-cheesecake', label: 'Cream Cheese', value: 'cream-cheese', active: true },
      { id: 'cake-filling-vanilla', label: 'Vanilla Custard', value: 'vanilla-custard', active: true },
    ],
    'Designs / Details': [
      { id: 'cake-design-floral', label: 'Floral', value: 'floral', active: true },
      { id: 'cake-design-minimalist', label: 'Minimalist', value: 'minimalist', active: true },
      { id: 'cake-design-3d', label: '3D Figurines', value: '3d-figurines', active: true },
      { id: 'cake-design-handpainted', label: 'Handpainted', value: 'handpainted', active: true },
    ],
    'Add-ons': [
      { id: 'cake-addon-fresh-flowers', label: 'Fresh Flowers', value: 'fresh-flowers', active: true },
      { id: 'cake-addon-gold-accent', label: 'Gold Accents', value: 'gold-accents', active: true },
      { id: 'cake-addon-topper', label: 'Cake Topper', value: 'cake-topper', active: true },
      { id: 'cake-addon-stand', label: 'Cake Stand', value: 'cake-stand', active: true },
    ],
  },
  Cupcakes: {
    Flavors: [
      { id: 'cupcake-flavor-chocolate', label: 'Chocolate', value: 'chocolate', active: true },
      { id: 'cupcake-flavor-vanilla', label: 'Vanilla', value: 'vanilla', active: true },
      { id: 'cupcake-flavor-redvelvet', label: 'Red Velvet', value: 'redvelvet', active: true },
      { id: 'cupcake-flavor-ube', label: 'Ube', value: 'ube', active: true },
    ],
    Sizes: [
      { id: 'cupcake-size-6', label: '6 pcs', value: '6', active: true },
      { id: 'cupcake-size-12', label: '12 pcs', value: '12', active: true },
      { id: 'cupcake-size-18', label: '18 pcs', value: '18', active: true },
    ],
    'Designs / Details': [
      { id: 'cupcake-design-birthday', label: 'Birthday', value: 'birthday', active: true },
      { id: 'cupcake-design-wedding', label: 'Wedding', value: 'wedding', active: true },
      { id: 'cupcake-design-theme', label: 'Themed', value: 'themed', active: true },
      { id: 'cupcake-design-minimal', label: 'Minimal', value: 'minimal', active: true },
    ],
    'Add-ons': [
      { id: 'cupcake-addon-topper', label: 'Cupcake Toppers', value: 'cupcake-toppers', active: true },
      { id: 'cupcake-addon-box', label: 'Gift Box', value: 'gift-box', active: true },
      { id: 'cupcake-addon-lights', label: 'LED Accent Lights', value: 'led-accent-lights', active: true },
    ],
  },
  'Party Package': {
    Flavors: [
      { id: 'party-flavor-chocolate', label: 'Chocolate', value: 'chocolate', active: true },
      { id: 'party-flavor-vanilla', label: 'Vanilla', value: 'vanilla', active: true },
      { id: 'party-flavor-redvelvet', label: 'Red Velvet', value: 'redvelvet', active: true },
      { id: 'party-flavor-ube', label: 'Ube', value: 'ube', active: true },
    ],
    Sizes: [
      { id: 'party-size-6', label: '6"', value: '6', active: true },
      { id: 'party-size-8', label: '8"', value: '8', active: true },
      { id: 'party-size-10', label: '10"', value: '10', active: true },
      { id: 'party-size-12', label: '12"', value: '12', active: true },
    ],
    Layers: [
      { id: 'party-layer-1', label: '1 Layer', value: '1', active: true },
      { id: 'party-layer-2', label: '2 Layers', value: '2', active: true },
      { id: 'party-layer-3', label: '3 Layers', value: '3', active: true },
    ],
    'Designs / Details': [
      { id: 'party-design-birthday', label: 'Birthday Theme', value: 'birthday-theme', active: true },
      { id: 'party-design-wedding', label: 'Wedding Theme', value: 'wedding-theme', active: true },
      { id: 'party-design-corporate', label: 'Corporate', value: 'corporate', active: true },
      { id: 'party-design-custom', label: 'Custom Theme', value: 'custom-theme', active: true },
    ],
    'Add-ons': [
      { id: 'party-addon-cupcakes', label: 'Cupcake Pairing', value: 'cupcake-pairing', active: true },
      { id: 'party-addon-flowers', label: 'Floral Arrangement', value: 'floral-arrangement', active: true },
      { id: 'party-addon-candles', label: 'Candles', value: 'candles', active: true },
      { id: 'party-addon-toppers', label: 'Party Toppers', value: 'party-toppers', active: true },
    ],
  },
}

const cloneCatalog = (catalog) => JSON.parse(JSON.stringify(catalog))

const normalizeGroupOptions = (groupOptions = []) =>
  (Array.isArray(groupOptions) ? groupOptions : []).map((option) => ({
    id: option.id || `${option.value || option.label || 'option'}-${Math.random().toString(16).slice(2, 8)}`,
    label: String(option.label ?? option.value ?? 'Option'),
    value: String(option.value ?? option.label ?? ''),
    active: option.active !== false,
  }))

const mergeCatalog = (baseCatalog, storedCatalog) => {
  const mergedCatalog = cloneCatalog(baseCatalog)

  if (!storedCatalog || typeof storedCatalog !== 'object') {
    return mergedCatalog
  }

  Object.keys(mergedCatalog).forEach((productKey) => {
    const baseGroups = mergedCatalog[productKey]
    const storedGroups = storedCatalog[productKey] || {}

    Object.keys(baseGroups).forEach((groupName) => {
      const mergedOptions = normalizeGroupOptions(storedGroups[groupName] || baseGroups[groupName])
      mergedCatalog[productKey][groupName] = mergedOptions
    })
  })

  Object.keys(storedCatalog).forEach((productKey) => {
    if (!mergedCatalog[productKey]) {
      mergedCatalog[productKey] = {}
    }

    Object.keys(storedCatalog[productKey] || {}).forEach((groupName) => {
      if (!mergedCatalog[productKey][groupName]) {
        mergedCatalog[productKey][groupName] = normalizeGroupOptions(storedCatalog[productKey][groupName])
      }
    })
  })

  return mergedCatalog
}

export function getCustomizationCatalog() {
  if (typeof window === 'undefined') {
    return cloneCatalog(defaultCatalog)
  }

  try {
    const rawCatalog = window.localStorage.getItem(STORAGE_KEY)

    if (!rawCatalog) {
      return cloneCatalog(defaultCatalog)
    }

    const storedCatalog = JSON.parse(rawCatalog)
    return mergeCatalog(defaultCatalog, storedCatalog)
  } catch {
    return cloneCatalog(defaultCatalog)
  }
}

export function saveCustomizationCatalog(catalog) {
  if (typeof window === 'undefined') {
    return catalog
  }

  const normalizedCatalog = mergeCatalog(defaultCatalog, catalog)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedCatalog))
  return normalizedCatalog
}

export function getCustomizationGroupOptions(productCategory, groupName, includeInactive = true) {
  const catalog = getCustomizationCatalog()
  const groups = catalog[productCategory] || {}
  const options = normalizeGroupOptions(groups[groupName] || [])

  if (includeInactive) {
    return options
  }

  return options.filter((option) => option.active !== false)
}

export function getActiveCustomizationOptions(productCategory, groupName) {
  return getCustomizationGroupOptions(productCategory, groupName, false)
}

export function getCustomizationOptionLabel(productCategory, groupName, value) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  const activeOptions = getActiveCustomizationOptions(productCategory, groupName)
  const option = activeOptions.find((entry) => String(entry.value) === String(value))

  return option?.label || String(value)
}

export function upsertCustomizationOption(productCategory, groupName, optionDraft) {
  const catalog = getCustomizationCatalog()
  const safeProduct = catalog[productCategory] || {}
  const currentGroup = normalizeGroupOptions(safeProduct[groupName] || [])

  const nextOption = {
    id: optionDraft.id || `option-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    label: String(optionDraft.label || '').trim(),
    value: String(optionDraft.value || optionDraft.label || '').trim().toLowerCase().replace(/\s+/g, '-'),
    active: optionDraft.active !== false,
  }

  if (!nextOption.label || !nextOption.value) {
    return catalog
  }

  const existingIndex = currentGroup.findIndex((option) => option.id === nextOption.id)

  if (existingIndex >= 0) {
    currentGroup[existingIndex] = {
      ...currentGroup[existingIndex],
      ...nextOption,
    }
  } else {
    currentGroup.push(nextOption)
  }

  const nextCatalog = {
    ...catalog,
    [productCategory]: {
      ...safeProduct,
      [groupName]: currentGroup,
    },
  }

  saveCustomizationCatalog(nextCatalog)
  return nextCatalog
}

export function toggleCustomizationOptionStatus(productCategory, groupName, optionId, isActive) {
  const catalog = getCustomizationCatalog()
  const safeProduct = catalog[productCategory] || {}
  const currentGroup = normalizeGroupOptions(safeProduct[groupName] || [])

  const updatedGroup = currentGroup.map((option) =>
    option.id === optionId ? { ...option, active: isActive } : option,
  )

  const nextCatalog = {
    ...catalog,
    [productCategory]: {
      ...safeProduct,
      [groupName]: updatedGroup,
    },
  }

  saveCustomizationCatalog(nextCatalog)
  return nextCatalog
}

export function deleteCustomizationOption(productCategory, groupName, optionId) {
  const catalog = getCustomizationCatalog()
  const safeProduct = catalog[productCategory] || {}
  const currentGroup = normalizeGroupOptions(safeProduct[groupName] || [])

  const nextCatalog = {
    ...catalog,
    [productCategory]: {
      ...safeProduct,
      [groupName]: currentGroup.filter((option) => option.id !== optionId),
    },
  }

  saveCustomizationCatalog(nextCatalog)
  return nextCatalog
}

export function getProductOptionGroups(productCategory) {
  return PRODUCT_OPTION_GROUPS[productCategory] || []
}

export const defaultCustomizationCatalog = cloneCatalog(defaultCatalog)
