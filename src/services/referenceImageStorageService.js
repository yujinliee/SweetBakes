import { supabase } from '../lib/supabase.js'

export const customReferenceBucket = 'custom-order-references'
const acceptedReferenceTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxReferenceFileSize = 5 * 1024 * 1024

export const createReferenceDraftId = () => (
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
)

export const resolveReferenceDraftId = (references = [], draftId = '') => {
  if (draftId) return draftId
  const existingPath = references.find((reference) => reference?.path)?.path || ''
  const parts = existingPath.split('/')
  return parts[0] === 'drafts' && parts[2] ? parts[2] : createReferenceDraftId()
}

const getCustomer = async () => {
  const { data, error } = await supabase.auth.getSession()
  const user = data?.session?.user || null
  if (error || !user) throw new Error('AUTH_REQUIRED')
  return user
}

const toStoredReference = ({ name, type, size, path, position }) => ({
  name: name || 'reference image',
  type: type || 'image/jpeg',
  size: Number(size) || 0,
  path,
  position,
})

const logContext = (productType, extra = {}) => ({ productType, ...extra })

export async function restoreDraftReferenceImages(references = [], options = {}) {
  const productType = options.productType || 'unknown'

  return Promise.all(references.map(async (reference) => {
    const storedPath = reference?.path || ''
    if (!storedPath) return { ...reference, previewUrl: '', restoreError: true }

    const { data, error } = await supabase.storage
      .from(customReferenceBucket)
      .createSignedUrl(storedPath, 60 * 60)
    const displayUrl = data?.signedUrl || ''

    console.log('[REFERENCE IMAGE RESTORE]', logContext(productType, {
      storedPath,
      hasDisplayUrl: Boolean(displayUrl),
      errorCode: error?.statusCode ?? error?.code ?? null,
    }))

    return {
      ...reference,
      previewUrl: displayUrl,
      restoreError: Boolean(error || !displayUrl),
    }
  }))
}

export async function uploadDraftReferenceImages({
  productType = 'unknown',
  files = [],
  existingReferences = [],
  draftId = '',
} = {}) {
  const user = await getCustomer()

  if (files.length + existingReferences.length > 3) {
    throw new Error('REFERENCE_IMAGE_INVALID:Maximum 3 reference images allowed.')
  }

  for (const file of files) {
    if (!(file instanceof File) || !acceptedReferenceTypes.has(file.type) || file.size > maxReferenceFileSize) {
      throw new Error(`REFERENCE_IMAGE_INVALID:${file?.name || 'reference image'}`)
    }
  }

  const id = resolveReferenceDraftId(existingReferences, draftId)
  const usedPositions = new Set(existingReferences.map((reference) => reference.position))
  const existingPaths = new Set(existingReferences.map((reference) => reference.path).filter(Boolean))
  const nextReferences = [...existingReferences]
  const uploadedPaths = []

  try {
    for (const file of files) {
      let position = 1
      while (usedPositions.has(position)) position += 1
      usedPositions.add(position)

      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const storagePath = `drafts/${user.id}/${id}/reference-${position}.${extension}`

      console.log('[REFERENCE IMAGE UPLOAD START]', logContext(productType, {
        storagePath,
        fileName: file.name,
      }))

      const { data, error } = await supabase.storage
        .from(customReferenceBucket)
        .upload(storagePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: true,
        })

      if (error) {
        console.error('[REFERENCE IMAGE UPLOAD ERROR]', logContext(productType, {
          storagePath,
          errorCode: error?.code ?? error?.statusCode ?? null,
          errorMessage: error?.message ?? null,
        }))
        throw error
      }

      const uploadedPath = data?.path || storagePath
      uploadedPaths.push(uploadedPath)
      console.log('[REFERENCE IMAGE UPLOAD SUCCESS]', logContext(productType, {
        storagePath: uploadedPath,
      }))

      nextReferences.push(toStoredReference({
        name: file.name,
        type: file.type,
        size: file.size,
        path: uploadedPath,
        position,
      }))
    }

    return {
      draftId: id,
      references: await restoreDraftReferenceImages(nextReferences, { productType }),
    }
  } catch (error) {
    const newlyCreatedPaths = uploadedPaths.filter((path) => !existingPaths.has(path))
    if (newlyCreatedPaths.length) {
      await supabase.storage.from(customReferenceBucket).remove(newlyCreatedPaths)
    }
    throw error
  }
}

export async function removeDraftReferenceImage({
  productType = 'unknown',
  storagePath = '',
  remainingReferences = [],
} = {}) {
  if (storagePath) {
    const { error } = await supabase.storage
      .from(customReferenceBucket)
      .remove([storagePath])
    if (error) throw error
  }

  return restoreDraftReferenceImages(remainingReferences, { productType })
}

// Compatibility adapters for callers being migrated to the shared API.
export const refreshReferenceImageUrls = (references, options = {}) => (
  restoreDraftReferenceImages(references, options)
)

export async function uploadReferenceImages(files = [], existingReferences = [], options = {}) {
  const result = await uploadDraftReferenceImages({ ...options, files, existingReferences })
  return result.references
}

export const removeReferenceImage = (reference, remainingReferences = [], options = {}) => (
  removeDraftReferenceImage({
    ...options,
    storagePath: reference?.path || '',
    remainingReferences,
  })
)
