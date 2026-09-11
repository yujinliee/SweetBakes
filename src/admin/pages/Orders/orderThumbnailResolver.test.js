import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeThumbnailText,
  isCustomOrderItem,
  findCustomOrderItem,
  getCustomReferenceImage,
  getCustomPreviewImage,
  resolveOrderThumbnail,
} from './orderThumbnailResolver.js'

const CAKE = {
  chocolate: { 1: 'cake-choc-1', 2: 'cake-choc-2', 3: 'cake-choc-3' },
  redvelvet: { 1: 'cake-rv-1', 2: 'cake-rv-2', 3: 'cake-rv-3' },
}
const CUPCAKE = {
  chocolate: { 6: 'cupcake-choc-6', 12: 'cupcake-choc-12', 18: 'cupcake-choc-18' },
  redvelvet: { 6: 'cupcake-rv-6', 12: 'cupcake-rv-12', 18: 'cupcake-rv-18' },
}
const PACKAGE = {
  chocolate: {
    '1-6': 'package-choc-1-6',
    '1-12': 'package-choc-1-12',
    '2-6': 'package-choc-2-6',
    '3-18': 'package-choc-3-18',
  },
  redvelvet: {
    '1-6': 'package-rv-1-6',
    '2-18': 'package-rv-2-18',
  },
}
const PREVIEWS = { cake: CAKE, cupcake: CUPCAKE, package: PACKAGE }
const FALLBACKS = {
  'chocolate cake': 'static-chocolate-cake',
  'red velvet cake': 'static-red-velvet-cake',
  cheesecake: 'static-cheesecake',
}

const customCakeItem = (overrides = {}) => ({
  product_type: 'cake',
  customization_data: { request_type: 'custom_cake', ...overrides },
})
const customCupcakeItem = (overrides = {}) => ({
  product_type: 'cupcake',
  customization_data: { request_type: 'custom_cupcake', ...overrides },
})
const customPackageItem = (overrides = {}) => ({
  product_type: 'party_package',
  customization_data: {
    request_type: 'custom_party_package',
    package_selection: { cakeQuantity: 1, cupcakeQuantity: 6 },
    package_customization: { packageCakeFlavor: 'chocolate', packageCakeLayers: '1' },
    ...overrides,
  },
})
const orderWith = (item) => ({ order_items: [item], thumbnailUrl: 'order-db-image' })

test('normalizeThumbnailText lowercases safely', () => {
  assert.equal(normalizeThumbnailText('Custom Cake'), 'custom cake')
  assert.equal(normalizeThumbnailText(null), '')
})

test('isCustomOrderItem recognizes all custom request types', () => {
  for (const type of ['custom_cake', 'custom_cupcake', 'custom_cupcakes', 'custom_party_package', 'custom_package']) {
    assert.equal(isCustomOrderItem({ customization_data: { request_type: type } }), true, type)
  }
})

test('isCustomOrderItem recognizes legacy custom cupcake via product type + is_custom', () => {
  assert.equal(
    isCustomOrderItem({ product_type: 'cupcake', customization_data: { is_custom: true } }),
    true,
  )
  assert.equal(isCustomOrderItem({ product_type: 'cupcake', customization_data: {} }), false)
})

test('findCustomOrderItem picks the first custom item in the order', () => {
  const item = customCakeItem({ flavor: 'chocolate', layers: 2 })
  const found = findCustomOrderItem({ order_items: [{ product_name: 'Cheesecake' }, item] })
  assert.equal(found, item)
})

test('getCustomReferenceImage reads top-level reference_images', () => {
  const item = customCupcakeItem({ reference_images: [{ path: 'a' }, { path: 'b', signed_url: 'https://ref' }] })
  assert.equal(getCustomReferenceImage(item), 'https://ref')
})

test('getCustomReferenceImage reads nested package reference images', () => {
  const item = {
    product_type: 'party_package',
    customization_data: {
      package_customization: { packageReferenceImages: [{ path: 'p1', url: 'https://pkg-ref' }] },
    },
  }
  assert.equal(getCustomReferenceImage(item), 'https://pkg-ref')
})

test('getCustomReferenceImage returns null when no usable reference', () => {
  assert.equal(getCustomReferenceImage(customCakeItem()), null)
})

test('custom cake preview is built from flavor x layers', () => {
  assert.equal(getCustomPreviewImage(customCakeItem({ flavor: 'chocolate', layers: 3 }), PREVIEWS), 'cake-choc-3')
  assert.equal(getCustomPreviewImage(customCakeItem({ flavor: 'redvelvet', layers: 1 }), PREVIEWS), 'cake-rv-1')
  assert.equal(getCustomPreviewImage(customCakeItem({ flavor: 'chocolate' }), PREVIEWS), 'cake-choc-1')
  assert.equal(getCustomPreviewImage(customCakeItem({ flavor: 'ube', layers: 2 }), PREVIEWS), null)
})

test('custom cupcake preview is built from flavor x quantity', () => {
  assert.equal(getCustomPreviewImage(customCupcakeItem({ flavor: 'chocolate', quantity: '12' }), PREVIEWS), 'cupcake-choc-12')
  assert.equal(getCustomPreviewImage(customCupcakeItem({ flavor: 'chocolate', quantity: 6 }), PREVIEWS), 'cupcake-choc-6')
  assert.equal(getCustomPreviewImage(customCupcakeItem({ flavor: 'redvelvet', quantity: 18 }), PREVIEWS), 'cupcake-rv-18')
  assert.equal(getCustomPreviewImage(customCupcakeItem({ flavor: 'redvelvet', quantity: 24 }), PREVIEWS), null)
})

test('legacy cupcake request_type/product type still resolves a preview', () => {
  const legacy = { product_type: 'cupcake', customization_data: { is_custom: true, flavor: 'redvelvet', quantity: '12' } }
  assert.equal(getCustomPreviewImage(legacy, PREVIEWS), 'cupcake-rv-12')
})

test('party package preview is built from base flavor x cake count x cupcake count', () => {
  assert.equal(getCustomPreviewImage(customPackageItem(), PREVIEWS), 'package-choc-1-6')
  assert.equal(
    getCustomPreviewImage(customPackageItem({
      package_selection: { cakeQuantity: 3, cupcakeQuantity: 18 },
      package_customization: { packageCakeFlavor: 'redvelvet', packageCakeLayers: '2' },
    }), PREVIEWS),
    'package-rv-2-18',
  )
  assert.equal(
    getCustomPreviewImage(customPackageItem({
      package_selection: { cakeQuantity: 1, cupcakeQuantity: 12 },
    }), PREVIEWS),
    'package-choc-1-12',
  )
  assert.equal(
    getCustomPreviewImage(customPackageItem({
      package_selection: { cupcakeQuantity: 9 },
      package_customization: { packageCakeLayers: '1' },
    }), PREVIEWS),
    null,
  )
})

test('legacy party_package item without request_type still resolves a package preview', () => {
  const legacy = {
    product_type: 'party_package',
    customization_data: {
      is_custom: true,
      package_selection: { cakeQuantity: 3, cupcakeQuantity: 18 },
      package_customization: { packageCakeFlavor: 'chocolate', packageCakeLayers: '3' },
    },
  }
  assert.equal(getCustomPreviewImage(legacy, PREVIEWS), 'package-choc-3-18')
})

test('custom cake: reference image wins over built preview over fallbacks', () => {
  const item = customCakeItem({
    flavor: 'chocolate',
    layers: 3,
    reference_images: [{ path: 'a', signed_url: 'https://inspiration' }],
  })
  assert.equal(resolveOrderThumbnail(orderWith(item), { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }), 'https://inspiration')
})

test('custom cupcake: reference image and preview both resolve in table + drawer', () => {
  assert.equal(resolveOrderThumbnail(orderWith(customCupcakeItem({ flavor: 'redvelvet', quantity: 6 })), { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }), 'cupcake-rv-6')
  assert.equal(
    resolveOrderThumbnail(
      orderWith(customCupcakeItem({ flavor: 'chocolate', quantity: 18, reference_images: [{ path: 'u', url: 'https://cup-ref' }] })),
      { previewImages: PREVIEWS, staticFallbacks: FALLBACKS },
    ),
    'https://cup-ref',
  )
})

test('custom party package: nested reference image wins, then preview', () => {
  const withReference = customPackageItem({
    package_customization: {
      packageCakeFlavor: 'chocolate',
      packageCakeLayers: '1',
      packageReferenceImages: [{ path: 'p', signed_url: 'https://pkg-ref' }],
    },
  })
  assert.equal(resolveOrderThumbnail(orderWith(withReference), { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }), 'https://pkg-ref')
  assert.equal(resolveOrderThumbnail(orderWith(customPackageItem()), { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }), 'package-choc-1-6')
})

test('regular order falls back to DB thumbnail then static image', () => {
  assert.equal(resolveOrderThumbnail(orderWith({ product_type: 'cake', product_name: 'Chocolate Cake' }), { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }), 'order-db-image')
  assert.equal(
    resolveOrderThumbnail({ order_items: [{ product_type: 'cake', product_name: 'Red Velvet Cake' }], thumbnailUrl: null }, { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }),
    'static-red-velvet-cake',
  )
})

test('unresolvable image resolves to null (gray placeholder)', () => {
  assert.equal(resolveOrderThumbnail({ order_items: [], thumbnailUrl: null }, { previewImages: PREVIEWS, staticFallbacks: FALLBACKS }), null)
})