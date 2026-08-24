const listeners = new Set()
const cartStorageKey = 'sweetbakes_cart'

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const sanitizeQuantityMap = (items) => {
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    return {}
  }

  return Object.entries(items).reduce((nextItems, [name, quantity]) => {
    const productName = String(name || '').trim()
    const numericQuantity = Number(quantity)

    if (!productName || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return nextItems
    }

    return {
      ...nextItems,
      [productName]: Math.max(1, Math.floor(numericQuantity)),
    }
  }, {})
}

const sanitizeMetadataMap = (metadata, validItems) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {}
  }

  return Object.entries(metadata).reduce((nextMetadata, [name, value]) => {
    if (!(name in validItems) || !value || typeof value !== 'object' || Array.isArray(value)) {
      return nextMetadata
    }

    try {
      const serialized = JSON.stringify(value, (key, nestedValue) => {
        const isFile =
          typeof File !== 'undefined' && nestedValue instanceof File
        const isBlob =
          typeof Blob !== 'undefined' && nestedValue instanceof Blob

        if (isFile || isBlob) {
          return undefined
        }

        if (typeof nestedValue === 'string' && nestedValue.startsWith('blob:')) {
          return undefined
        }

        return nestedValue
      })

      return {
        ...nextMetadata,
        [name]: JSON.parse(serialized),
      }
    } catch {
      return nextMetadata
    }
  }, {})
}

const readStoredCart = () => {
  if (!isBrowser()) {
    return { items: {}, metadata: {} }
  }

  try {
    const savedCart = window.localStorage.getItem(cartStorageKey)

    if (!savedCart) {
      return { items: {}, metadata: {} }
    }

    const parsedCart = JSON.parse(savedCart)
    const parsedItems = parsedCart?.items || parsedCart
    const items = sanitizeQuantityMap(parsedItems)
    const metadata = sanitizeMetadataMap(parsedCart?.metadata, items)

    return { items, metadata }
  } catch (error) {
    console.error('[CART] Unable to restore saved cart:', error)
    return { items: {}, metadata: {} }
  }
}

const persistCart = () => {
  if (!isBrowser()) {
    return
  }

  try {
    window.localStorage.setItem(
      cartStorageKey,
      JSON.stringify({
        items: cartItems,
        metadata: cartItemMetadata,
      }),
    )
  } catch (error) {
    console.error('[CART] Unable to save cart:', error)
  }
}

const initialCart = readStoredCart()
let cartItems = initialCart.items
let cartItemMetadata = initialCart.metadata

const notifyListeners = () => {
  listeners.forEach((listener) => listener())
}

const commitCartChange = () => {
  persistCart()
  notifyListeners()
}

if (isBrowser()) {
  window.addEventListener('storage', (event) => {
    if (event.key !== cartStorageKey) {
      return
    }

    const nextCart = readStoredCart()
    cartItems = nextCart.items
    cartItemMetadata = nextCart.metadata
    notifyListeners()
  })
}

export function subscribeCart(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCartItems() {
  return cartItems
}

export function getCartItemMetadata(productName) {
  return cartItemMetadata[productName] || null
}

export function getCartCount() {
  return Object.values(cartItems).reduce((total, quantity) => total + quantity, 0)
}

export function addToCart(productName, quantity = 1, metadata = null) {
  const safeProductName = String(productName || '').trim()
  const safeQuantity = Number(quantity)

  if (!safeProductName || !Number.isFinite(safeQuantity) || safeQuantity <= 0) {
    return
  }

  cartItems = {
    ...cartItems,
    [safeProductName]: (cartItems[safeProductName] ?? 0) + Math.floor(safeQuantity),
  }

  if (metadata) {
    cartItemMetadata = {
      ...cartItemMetadata,
      [safeProductName]: {
        ...(cartItemMetadata[safeProductName] || {}),
        ...metadata,
      },
    }
  }

  cartItemMetadata = sanitizeMetadataMap(cartItemMetadata, cartItems)
  commitCartChange()
}

export function setCartQuantity(productName, quantity) {
  const safeProductName = String(productName || '').trim()
  const safeQuantity = Number(quantity)

  if (!safeProductName || !Number.isFinite(safeQuantity)) {
    return
  }

  cartItems = {
    ...cartItems,
    [safeProductName]: Math.max(1, Math.floor(safeQuantity)),
  }
  commitCartChange()
}

export function removeFromCart(productName) {
  const safeProductName = String(productName || '').trim()

  if (!(safeProductName in cartItems)) {
    return
  }

  cartItems = { ...cartItems }
  delete cartItems[safeProductName]
  cartItemMetadata = { ...cartItemMetadata }
  delete cartItemMetadata[safeProductName]
  commitCartChange()
}

export function clearCart() {
  cartItems = {}
  cartItemMetadata = {}
  commitCartChange()
}
