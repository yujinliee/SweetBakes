import {
  isCustomOrderItem,
  getCustomReferenceImage,
  getCustomPreviewImage,
} from '../admin/pages/Orders/orderThumbnailResolver.js'

export function resolveItemImage(item, options = {}) {
  const {
    previewImages = {},
    customFallback = null,
    catalogImage = '',
  } = options

  const referenceImage = getCustomReferenceImage(item) || item?.customization_data?.imageUrl || ''
  if (referenceImage) return referenceImage

  const previewImage = getCustomPreviewImage(item, previewImages)
  if (previewImage) return previewImage

  if (isCustomOrderItem(item)) return customFallback || catalogImage
  return catalogImage
}