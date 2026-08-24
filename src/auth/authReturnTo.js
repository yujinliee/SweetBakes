export const authReturnToStorageKey = 'sweetbakes_auth_return_to'

const customizationPaths = new Set(['/cake', '/cakes', '/cupcakes', '/customize'])

const safeDecode = (value) => {
  let decoded = value || ''
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // Use the original value.
  }
  return decoded
}

export const getCustomerAuthReturnPath = (value) => {
  const decoded = safeDecode(value).trim()

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/admin')) {
    return ''
  }

  return decoded
}

export const isCustomerCustomizationRoute = (locationKey) => {
  const safePath = getCustomerAuthReturnPath(locationKey)

  if (!safePath) {
    return false
  }

  const url = new URL(safePath, window.location.origin)
  return customizationPaths.has(url.pathname)
}

export const setAuthReturnTo = (returnTo) => {
  const safeReturnTo = getCustomerAuthReturnPath(returnTo)

  if (!safeReturnTo || !isCustomerCustomizationRoute(safeReturnTo)) {
    return ''
  }

  window.localStorage.setItem(authReturnToStorageKey, safeReturnTo)

  if (import.meta.env.DEV) {
    console.log('[AUTH RETURN TO SET]', safeReturnTo)
  }

  return safeReturnTo
}

export const peekAuthReturnTo = () => {
  const savedReturnTo = getCustomerAuthReturnPath(window.localStorage.getItem(authReturnToStorageKey))
  return savedReturnTo && isCustomerCustomizationRoute(savedReturnTo) ? savedReturnTo : ''
}

export const consumeAuthReturnTo = () => {
  const returnTo = peekAuthReturnTo()
  window.localStorage.removeItem(authReturnToStorageKey)

  if (returnTo && import.meta.env.DEV) {
    console.log('[AUTH RETURN TO CONSUME]', returnTo)
  }

  return returnTo
}

export const clearAuthReturnTo = () => {
  window.localStorage.removeItem(authReturnToStorageKey)
}
