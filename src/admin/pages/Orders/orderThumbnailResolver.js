// Pure, virtual-DOM-free resolution of the thumbnail shown for an admin order
// row and for each order item inside the Manage Order drawer. The customer
// preview maps (flavor x layers / flavor x quantity / flavor x cake-count and
// cupcake-count) are injected so this stays unit-testable without importing
// image assets.
//
// Priority (same for the whole order in the table and for a single item in the
// drawer):
//   1. Customer inspiration/reference image (top-level reference_images or the
//      nested package_customization.packageReferenceImages for packages).
//   2. Preview built from the customer's actual selections (the same asset the
//      customer saw during customization).
//   3. Catalog product image resolved from the product id.
//   4. Static bundled fallback keyed by the first item product name.
//   5. null -> the gray placeholder is rendered by <OrderThumbnail />.

export function normalizeThumbnailText(value) {
  return String(value ?? '').toLowerCase()
}

export function isCustomOrderItem(item) {
  if (!item?.customization_data) return false

  const requestType = normalizeThumbnailText(item.customization_data.request_type)
  const productType = normalizeThumbnailText(item.product_type)

  return requestType === 'custom_cake' ||
    requestType === 'custom_cupcake' ||
    requestType === 'custom_cupcakes' ||
    requestType === 'custom_party_package' ||
    requestType === 'custom_package' ||
    (['cupcake', 'cupcakes', 'party_package'].includes(productType) && item.customization_data.is_custom === true)
}

export function findCustomOrderItem(order) {
  return (order?.order_items || []).find(isCustomOrderItem) || null
}

export function getCustomReferenceImage(item) {
  const customization = item?.customization_data
  if (!customization) return null

  const references =
    customization.reference_images ||
    customization.package_customization?.packageReferenceImages ||
    []

  const firstReference = Array.isArray(references)
    ? references.find((image) => image?.signed_url || image?.url)
    : null

  return (firstReference?.signed_url || firstReference?.url) || null
}

export function getCustomPreviewImage(item, previewImages = {}) {
  const customization = item?.customization_data
  if (!customization) return null

  const requestType = normalizeThumbnailText(customization.request_type)
  const productType = normalizeThumbnailText(item?.product_type)
  const flavor = normalizeThumbnailText(customization.flavor)

  if (requestType === 'custom_cake') {
    const layer = String(customization.layers ?? '1')
    return previewImages.cake?.[flavor]?.[layer] ?? null
  }

  const isCupcake =
    requestType === 'custom_cupcake' ||
    requestType === 'custom_cupcakes' ||
    ['cupcake', 'cupcakes'].includes(productType)

  if (isCupcake) {
    const quantity = String(customization.quantity ?? '')
    return previewImages.cupcake?.[flavor]?.[quantity] ?? null
  }

  const isPackage =
    requestType === 'custom_party_package' ||
    requestType === 'custom_package' ||
    productType === 'party_package'

  if (isPackage) {
    const packageCustomization = customization.package_customization || {}
    const packageSelection = customization.package_selection || {}
    const baseFlavor = normalizeThumbnailText(
      packageCustomization.packageCakeFlavor || customization.flavor,
    )
    const cakeCount = String(
      packageCustomization.packageCakeLayers ?? packageSelection.cakeQuantity ?? '',
    )
    const cupcakeCount = String(
      packageSelection.cupcakeQuantity ?? packageCustomization.packageCupcakeQuantity ?? '',
    )

    return previewImages.package?.[baseFlavor]?.[`${cakeCount}-${cupcakeCount}`] ?? null
  }

  return null
}

export function resolveOrderThumbnail(order, options = {}) {
  const { previewImages = {}, staticFallbacks = {} } = options

  const customItem = findCustomOrderItem(order)

  if (customItem) {
    const inspirationImage = getCustomReferenceImage(customItem)
    if (inspirationImage) return inspirationImage

    const customizationPreview = getCustomPreviewImage(customItem, previewImages)
    if (customizationPreview) return customizationPreview
  }

  if (order?.thumbnailUrl) return order.thumbnailUrl

  const firstName = normalizeThumbnailText(order?.order_items?.[0]?.product_name || '')
  if (firstName) {
    for (const [key, image] of Object.entries(staticFallbacks)) {
      if (firstName.includes(key)) return image
    }
  }

  return null
}