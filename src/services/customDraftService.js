import { supabase } from '../lib/supabase.js'

const draftKeyPrefix = 'sweetbakes_custom_draft'
const databaseName = 'sweetbakes_custom_drafts'
const fileStoreName = 'reference_files'

const getStorageKey = (flow, scope) => `${draftKeyPrefix}:${flow}:${scope}`

const openFileDatabase = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(fileStoreName, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const readStoredFiles = async (key) => {
  const database = await openFileDatabase()
  if (!database) return []

  return new Promise((resolve, reject) => {
    const request = database.transaction(fileStoreName, 'readonly').objectStore(fileStoreName).get(key)
    request.onsuccess = () => resolve(request.result?.files || [])
    request.onerror = () => reject(request.error)
  })
}

const writeStoredFiles = async (key, files) => {
  const database = await openFileDatabase()
  if (!database) return

  return new Promise((resolve, reject) => {
    const request = database
      .transaction(fileStoreName, 'readwrite')
      .objectStore(fileStoreName)
      .put({ key, files })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

const deleteStoredFiles = async (key) => {
  const database = await openFileDatabase()
  if (!database) return

  return new Promise((resolve, reject) => {
    const request = database.transaction(fileStoreName, 'readwrite').objectStore(fileStoreName).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

const getDraftFiles = (flow, draft) => {
  if (flow === 'party-package') return draft.packageCustomization?.packageReferenceImages || []
  return []
}

const withoutDraftFiles = (flow, draft) => {
  if (flow === 'cupcake') {
    return {
      ...draft,
      designDetails: {
        ...draft.designDetails,
        cupcakeReferenceImages: (draft.designDetails?.cupcakeReferenceImages || [])
          .filter((reference) => reference?.path)
          .map(({ name, type, size, path, position }) => ({ name, type, size, path, position })),
      },
    }
  }

  if (flow === 'party-package') {
    return {
      ...draft,
      packageCustomization: { ...draft.packageCustomization, packageReferenceImages: [] },
    }
  }

  return draft
}

export async function getCustomDraftScope() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id || 'guest'
}

export function subscribeToCustomDraftAuth(onScopeChange) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      onScopeChange(session?.user?.id || 'guest')
    }
  })

  return () => data.subscription.unsubscribe()
}

export async function loadCustomDraft(flow, scope) {
  let draft

  try {
    const stored = window.localStorage.getItem(getStorageKey(flow, scope))
    draft = stored ? JSON.parse(stored) : null
  } catch {
    return null
  }

  if (!draft) return null

  try {
    const files = await readStoredFiles(getStorageKey(flow, scope))
    if (files.length && flow === 'party-package') {
      draft.packageCustomization.packageReferenceImages = files
    }
  } catch (error) {
    console.error('[CUSTOM DRAFT] reference restore failed:', error)
  }

  return draft
}

export async function saveCustomDraft(flow, scope, draft) {
  const key = getStorageKey(flow, scope)
  const files = getDraftFiles(flow, draft)

  try {
    window.localStorage.setItem(key, JSON.stringify(withoutDraftFiles(flow, draft)))
    await writeStoredFiles(key, files)
  } catch (error) {
    console.error('[CUSTOM DRAFT] save failed:', error)
  }
}

export async function clearCustomDraft(flow, scope) {
  const key = getStorageKey(flow, scope)
  window.localStorage.removeItem(key)

  try {
    await deleteStoredFiles(key)
  } catch (error) {
    console.error('[CUSTOM DRAFT] clear failed:', error)
  }
}
