import {
  refreshReferenceImageUrls,
  removeReferenceImage,
  uploadReferenceImages,
} from '../../services/referenceImageStorageService.js'

export function refreshCupcakeReferenceUrls(references = []) {
  return refreshReferenceImageUrls(references, { productType: 'cupcake' })
}

export async function uploadCupcakeReferenceImages(files = [], existingReferences = [], options = {}) {
  return uploadReferenceImages(files, existingReferences, {
    ...options,
    productType: 'cupcake',
  })
}

export function removeCupcakeReference(reference, remainingReferences = []) {
  return removeReferenceImage(reference, remainingReferences, { productType: 'cupcake' })
}
