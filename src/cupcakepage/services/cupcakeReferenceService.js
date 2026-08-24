import { supabase } from '../../lib/supabase.js'

const referenceBucket = 'custom-order-references'
const acceptedTypes = new Set(['image/jpeg', 'image/png'])
const maxFileSize = 10 * 1024 * 1024

const getCustomer = async () => {
  const { data, error } = await supabase.auth.getSession()
  const user = data?.session?.user || null
  if (error || !user) throw new Error('AUTH_REQUIRED')
  return user
}

const toStoredReference = (file, path, position) => ({
  name: file.name || 'reference image',
  type: file.type || 'image/jpeg',
  size: Number(file.size) || 0,
  path,
  position,
})

export async function refreshCupcakeReferenceUrls(references = []) {
  const paths = references.map((reference) => reference?.path).filter(Boolean)
  if (!paths.length) return references

  const { data, error } = await supabase.storage
    .from(referenceBucket)
    .createSignedUrls(paths, 60 * 60)

  if (error) throw error

  const urls = (data || []).reduce((result, item, index) => {
    result[paths[index]] = item.signedUrl || ''
    return result
  }, {})

  return references.map((reference) => ({
    ...reference,
    previewUrl: urls[reference.path] || '',
  }))
}

export async function uploadCupcakeReferenceImages(files = [], existingReferences = []) {
  const user = await getCustomer()
  const usedPositions = new Set(existingReferences.map((reference) => reference.position))
  const uploadedPaths = []
  const nextReferences = [...existingReferences]

  try {
    for (const file of files) {
      if (!(file instanceof File) || !acceptedTypes.has(file.type) || file.size > maxFileSize) {
        throw new Error(`REFERENCE_IMAGE_INVALID:${file?.name || 'reference image'}`)
      }

      let position = 1
      while (usedPositions.has(position)) position += 1
      usedPositions.add(position)
      const extension = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `drafts/${user.id}/cupcake/reference-${position}.${extension}`

      const { error } = await supabase.storage.from(referenceBucket).upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: true,
      })
      if (error) throw error

      uploadedPaths.push(path)
      nextReferences.push(toStoredReference(file, path, position))
    }

    return refreshCupcakeReferenceUrls(nextReferences)
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(referenceBucket).remove(uploadedPaths)
    }
    throw error
  }
}

export async function removeCupcakeReference(reference, remainingReferences = []) {
  if (reference?.path) {
    await supabase.storage.from(referenceBucket).remove([reference.path])
  }

  return refreshCupcakeReferenceUrls(remainingReferences)
}
