import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveItemImage } from './orderImageResolver.js'

const reference = 'https://bucket.example/reference/cake.jpg'
const chocolateOneLayer = '/assets/cake-chocolate-1.svg'
const vanillaTwoLayer = '/assets/cake-vanilla-2.svg'
const ubeHalfDozen = '/assets/cupcake-ube-6.svg'
const packageChocolate = '/assets/package-chocolate-2-12.svg'
const customFallback = '/icons/cake.svg'
const catalogImage = '/catalog/chocolate-cake.jpg'

const previewImages = {
  cake: { chocolate: { '1': chocolateOneLayer }, vanilla: { '2': vanillaTwoLayer } },
  cupcake: { ube: { '6': ubeHalfDozen } },
  package: { chocolate: { '2-12': packageChocolate } },
}

function customCakeItem({ customization_data: overridden = {}, ...rest } = {}) {
  return {
    product_type: 'custom_cake',
    customization_data: {
      request_type: 'custom_cake',
      flavor: 'Chocolate',
      layers: 1,
      ...overridden,
    },
    ...rest,
  }
}

test('reference image wins over preview and catalog for custom orders', () => {
  const url = resolveItemImage(customCakeItem({
    customization_data: { flavor: 'Vanilla', layers: 2, reference_images: [{ path: 'r.png', signed_url: reference }] },
  }), { previewImages, customFallback, catalogImage })
  assert.equal(url, reference)
})

test('flavor x layers preview resolves for custom cake without reference', () => {
  assert.equal(
    resolveItemImage(customCakeItem(), { previewImages, customFallback, catalogImage }),
    chocolateOneLayer,
  )
})

test('layers fall back to 1 when absent', () => {
  assert.equal(
    resolveItemImage(customCakeItem({ customization_data: { flavor: 'Chocolate' } }), { previewImages, customFallback, catalogImage }),
    chocolateOneLayer,
  )
})

test('nested package reference image wins for custom packages', () => {
  const packageReference = 'https://bucket.example/reference/package.jpg'
  const resolved = resolveItemImage({
    product_type: 'party_package',
    customization_data: {
      request_type: 'custom_party_package',
      package_customization: { packageReferenceImages: [{ path: 'pkg.png', url: packageReference }] },
    },
  }, { previewImages, customFallback, catalogImage })
  assert.equal(resolved, packageReference)
})

test('custom package preview resolves from saved selections', () => {
  const resolved = resolveItemImage({
    product_type: 'party_package',
    customization_data: {
      request_type: 'custom_party_package',
      package_customization: { packageCakeFlavor: 'Chocolate', packageCakeLayers: 2 },
      package_selection: { cakeQuantity: 2, cupcakeQuantity: 12 },
    },
  }, { previewImages, customFallback, catalogImage })
  assert.equal(resolved, packageChocolate)
})

test('custom cupcake preview resolves from flavor x quantity', () => {
  const resolved = resolveItemImage({
    product_type: 'cupcake',
    customization_data: { request_type: 'custom_cupcakes', flavor: 'Ube', quantity: 6 },
  }, { previewImages, customFallback, catalogImage })
  assert.equal(resolved, ubeHalfDozen)
})

test('custom order without reference, preview, or legacy image uses the neutral fallback, not the catalog image', () => {
  const resolved = resolveItemImage(customCakeItem({ customization_data: { flavor: 'Red Velvet', layers: 2 } }), {
    previewImages,
    customFallback,
    catalogImage,
  })
  assert.equal(resolved, customFallback)
})

test('legacy customization imageUrl is treated as a reference and wins over preview', () => {
  const resolved = resolveItemImage(customCakeItem({ customization_data: { flavor: 'Vanilla', layers: 2, imageUrl: 'https://bucket.example/legacy/cake.jpg' } }), {
    previewImages,
    customFallback,
    catalogImage,
  })
  assert.equal(resolved, 'https://bucket.example/legacy/cake.jpg')
})

test('non-custom items resolve to the catalog image, never the custom fallback', () => {
  const resolved = resolveItemImage(
    { product_type: 'sweet_treat', product_slug: 'chocolate-cake', history_image: catalogImage },
    { previewImages, customFallback, catalogImage },
  )
  assert.equal(resolved, catalogImage)
})

test('nothing resolved on an empty item', () => {
  assert.equal(resolveItemImage({}, { previewImages, customFallback, catalogImage }), catalogImage)
})