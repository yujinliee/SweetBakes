import { supabase } from '../../lib/supabase.js'

export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const SWEET_TREATS_CATEGORY_OPTIONS = [
  { value: 'regular_cake', label: 'Regular Cakes' },
  { value: 'cheesecake', label: 'Cheesecake' },
  { value: 'ube', label: 'Ube' },
  { value: 'graham_de_leche', label: 'Graham de Leche' },
  { value: 'leche_flan', label: 'Leche Flan' },
  { value: 'puto', label: 'Puto' },
]

export const SWEET_TREATS_CATEGORIES = SWEET_TREATS_CATEGORY_OPTIONS.map((option) => option.value)

export const SWEET_TREATS_CATEGORY_LABELS = Object.fromEntries(
  SWEET_TREATS_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
)

const CATEGORY_VALUE_ALIASES = {
  'regular-cakes': 'regular_cake',
  'graham-de-leche': 'graham_de_leche',
  'leche-flan': 'leche_flan',
}

export const normalizeSweetTreatsCategory = (category) =>
  CATEGORY_VALUE_ALIASES[category] || category || 'regular_cake'

const mapCategoryRow = (row) => ({
  id: row.id,
  name: row.name,
  label: row.name,
  slug: row.slug,
  value: row.slug,
  active: row.is_active !== false,
  sort_order: row.sort_order ?? 100,
})

const getFallbackCategories = ({ activeOnly = false } = {}) =>
  SWEET_TREATS_CATEGORY_OPTIONS.map((option, index) => ({
    id: option.value,
    name: option.label,
    label: option.label,
    slug: option.value,
    value: option.value,
    active: true,
    sort_order: (index + 1) * 10,
  })).filter((category) => !activeOnly || category.active)

export async function getSweetTreatsCategories({ activeOnly = false } = {}) {
  let query = supabase
    .from('product_categories')
    .select('id, name, slug, is_active, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[SWEET TREATS CATEGORIES FETCH]', error)
    return getFallbackCategories({ activeOnly })
  }

  const categories = (data || []).map(mapCategoryRow)
  return categories.length > 0 ? categories : getFallbackCategories({ activeOnly })
}

export const getActiveSweetTreatsCategories = () =>
  getSweetTreatsCategories({ activeOnly: true })

export async function upsertSweetTreatsCategory(draft) {
  const name = String(draft.name || draft.label || '').trim()
  const slug = slugifyProductName(draft.slug || name)
  const sortOrder = Number(draft.sort_order ?? draft.sortOrder ?? 100)

  if (!name) {
    throw new Error('Category name is required.')
  }

  if (!slug) {
    throw new Error('Category name must create a valid slug.')
  }

  if (!Number.isFinite(sortOrder)) {
    throw new Error('Enter a valid sort order.')
  }

  const duplicateQuery = supabase
    .from('product_categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const { data: duplicateCategory, error: duplicateError } = await duplicateQuery

  if (duplicateError) {
    throw duplicateError
  }

  if (duplicateCategory && duplicateCategory.id !== draft.id) {
    throw new Error('A category with this slug already exists.')
  }

  const payload = {
    name,
    slug,
    is_active: draft.active !== false,
    sort_order: sortOrder,
  }

  if (draft.id) {
    const { data, error } = await supabase
      .from('product_categories')
      .update(payload)
      .eq('id', draft.id)
      .select()
      .single()

    if (error) throw error
    return mapCategoryRow(data)
  }

  const { data, error } = await supabase
    .from('product_categories')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return mapCategoryRow(data)
}

const normalizeImageLabel = (label) => String(label || '').trim()

const DEFAULT_CHEESECAKE_VARIANTS = [
  { name: 'Half Dozen', price: 300, active: true, sort_order: 10 },
  { name: 'Dozen', price: 600, active: true, sort_order: 20 },
  { name: 'Large / Whole', price: 850, active: true, sort_order: 30 },
]

const DEFAULT_CHEESECAKE_FLAVORS = ['Blueberry', 'Mango', 'Strawberry', 'Oreo']

export function slugifyProductName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const formatVariantSummary = (variants = []) => {
  const activeVariants = variants.filter((variant) => variant.active !== false)

  if (activeVariants.length === 0) {
    return 'Regular'
  }

  if (activeVariants.length === 1) {
    return activeVariants[0].name
  }

  return activeVariants.map((variant) => variant.name).join(', ')
}

const getDisplayPrice = (product) => {
  const variantPrices = (product.variants || [])
    .filter((variant) => variant.active !== false)
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite)

  if (variantPrices.length > 0) {
    return Math.min(...variantPrices)
  }

  const basePrice = product.base_price ?? product.price

  if (basePrice === null || basePrice === undefined || basePrice === '') {
    return null
  }

  const numericPrice = Number(basePrice)
  return Number.isFinite(numericPrice) ? numericPrice : null
}

const mapProductRow = (
  row,
  variantsByProductId = {},
  optionsByProductId = {},
  productImagesByProductId = {},
) => {
  const variants = (variantsByProductId[row.id] || [])
    .map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: Number(variant.price ?? 0),
      active: variant.is_active !== false,
      sort_order: variant.sort_order ?? 0,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  const flavors = (optionsByProductId[row.id] || [])
    .filter((option) => option.option_name === 'flavor' && option.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((option) => option.value)

  const productImages = (productImagesByProductId[row.id] || [])
    .map((image) => ({
      id: image.id,
      product_id: image.product_id,
      label: image.label,
      image_url: image.image_url || '',
      imageUrl: image.image_url || '',
      sort_order: image.sort_order ?? 0,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  const product = {
    id: row.id,
    product: row.name,
    name: row.name,
    slug: row.slug,
    category: row.category,
    categoryLabel: SWEET_TREATS_CATEGORY_LABELS[row.category] || row.category,
    description: row.description || '',
    base_price: row.base_price === null || row.base_price === undefined ? null : Number(row.base_price),
    price: row.base_price === null || row.base_price === undefined ? null : Number(row.base_price),
    active: row.is_active !== false,
    image_url: row.image_url || '',
    imageUrl: row.image_url || '',
    variants,
    flavors,
    productImages,
    sort_order: row.sort_order ?? 0,
  }

  return {
    ...product,
    variant: formatVariantSummary(variants),
    price: getDisplayPrice(product),
  }
}

export async function getSweetTreatsProducts({ activeOnly = false } = {}) {
  const categories = await getSweetTreatsCategories()
  const categoryValues = Array.from(
    new Set([
      ...categories.map((category) => category.value),
      ...Object.keys(CATEGORY_VALUE_ALIASES),
    ]),
  )

  let query = supabase
    .from('products')
    .select(
      'id, name, slug, category, description, base_price, image_url, is_active, sort_order, created_at, updated_at',
    )
    .in('category', categoryValues)
    .order('sort_order', { ascending: true })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[ADMIN SWEET TREATS FETCH]', error)
    throw error
  }

  const productIds = (data || []).map((product) => product.id)
  let variantsByProductId = {}
  let optionsByProductId = {}
  let productImagesByProductId = {}

  if (productIds.length > 0) {
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, product_id, name, price, is_active, sort_order')
      .in('product_id', productIds)
      .order('sort_order', { ascending: true })

    if (variantsError) {
      console.error('[ADMIN SWEET TREATS VARIANTS FETCH]', variantsError)
    } else {
      variantsByProductId = (variants || []).reduce((groups, variant) => {
        const productVariants = groups[variant.product_id] || []
        return { ...groups, [variant.product_id]: [...productVariants, variant] }
      }, {})
    }

    const { data: optionValues, error: optionValuesError } = await supabase
      .from('product_option_values')
      .select('id, product_id, option_name, value, is_active, sort_order')
      .in('product_id', productIds)
      .order('sort_order', { ascending: true })

    if (optionValuesError) {
      console.error('[ADMIN SWEET TREATS OPTIONS FETCH]', optionValuesError)
    } else {
      optionsByProductId = (optionValues || []).reduce((groups, option) => {
        const productOptions = groups[option.product_id] || []
        return { ...groups, [option.product_id]: [...productOptions, option] }
      }, {})
    }

    const { data: productImages, error: productImagesError } = await supabase
      .from('product_images')
      .select('id, product_id, label, image_url, sort_order, created_at, updated_at')
      .in('product_id', productIds)
      .order('sort_order', { ascending: true })

    if (productImagesError) {
      console.error('[ADMIN SWEET TREATS PRODUCT IMAGES FETCH]', productImagesError)
    } else {
      productImagesByProductId = (productImages || []).reduce((groups, image) => {
        const images = groups[image.product_id] || []
        return { ...groups, [image.product_id]: [...images, image] }
      }, {})
    }
  }

  return (data || []).map((product) =>
    mapProductRow(product, variantsByProductId, optionsByProductId, productImagesByProductId),
  )
}

export const getActiveSweetTreatsProducts = () => getSweetTreatsProducts({ activeOnly: true })

export function validateProductImage(file) {
  if (!file) {
    return
  }

  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Please upload a JPEG, PNG, or WebP image.')
  }

  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('Product image must be 5MB or smaller.')
  }
}

const getImageExtension = (file) => {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

async function uploadProductImage(productId, file) {
  validateProductImage(file)

  const extension = getImageExtension(file)
  const filePath = `products/${productId}/main-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

async function uploadProductFlavorImage(productId, label, file) {
  validateProductImage(file)

  const normalizedLabel = normalizeImageLabel(label)
  if (!normalizedLabel) {
    throw new Error('Flavor image label is required.')
  }

  const extension = getImageExtension(file)
  const safeLabel = slugifyProductName(normalizedLabel)
  const filePath = `products/${productId}/flavors/${safeLabel}-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

async function saveProductFlavorImage(productId, label, imageUrl, sortOrder) {
  const normalizedLabel = normalizeImageLabel(label)
  const { data: existingImage, error: existingError } = await supabase
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .eq('label', normalizedLabel)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existingImage?.id) {
    const { error } = await supabase
      .from('product_images')
      .update({
        image_url: imageUrl,
        sort_order: sortOrder,
      })
      .eq('id', existingImage.id)

    if (error) throw error
    return
  }

  const { error } = await supabase.from('product_images').insert({
    product_id: productId,
    label: normalizedLabel,
    image_url: imageUrl,
    sort_order: sortOrder,
  })

  if (error) throw error
}

const normalizeVariantsForSave = (draft) => {
  const variants = Array.isArray(draft.variants) ? draft.variants : []

  if (draft.category === 'cheesecake') {
    const source = variants.length > 0 ? variants : DEFAULT_CHEESECAKE_VARIANTS
    return source
      .map((variant, index) => ({
        id: variant.id || undefined,
        name: String(variant.name || variant.label || '').trim(),
        price: Number(variant.price),
        is_active: variant.active !== false,
        sort_order: variant.sort_order ?? (index + 1) * 10,
      }))
      .filter((variant) => variant.name && Number.isFinite(variant.price) && variant.price >= 0)
  }

  return []
}

const normalizeFlavorsForSave = (draft) => {
  if (draft.category !== 'cheesecake') {
    return []
  }

  const flavors = Array.isArray(draft.flavors) && draft.flavors.length > 0
    ? draft.flavors
    : DEFAULT_CHEESECAKE_FLAVORS

  return flavors
    .map((flavor) => String(flavor).trim())
    .filter(Boolean)
    .map((value, index) => ({ value, sort_order: (index + 1) * 10 }))
}

export async function upsertSweetTreatsProduct(draft) {
  const name = String(draft.product || draft.name || '').trim()
  const category = normalizeSweetTreatsCategory(draft.category)
  const rawBasePrice = draft.base_price ?? draft.price
  const basePrice = rawBasePrice === '' || rawBasePrice === null || rawBasePrice === undefined
    ? category === 'cheesecake' || draft.id
      ? null
      : NaN
    : Number(rawBasePrice)
  const slug = draft.slug || slugifyProductName(name)

  if (!name) {
    throw new Error('Product name is required.')
  }

  if (!slug) {
    throw new Error('Product name must create a valid slug.')
  }

  if (basePrice !== null && (!Number.isFinite(basePrice) || basePrice < 0)) {
    throw new Error('Enter a valid price.')
  }

  validateProductImage(draft.imageFile)

  Object.values(draft.flavorImageFiles || {}).forEach((file) => validateProductImage(file))

  const duplicateQuery = supabase.from('products').select('id').eq('slug', slug).maybeSingle()
  const { data: duplicateProduct, error: duplicateError } = await duplicateQuery

  if (duplicateError) {
    throw duplicateError
  }

  if (duplicateProduct && duplicateProduct.id !== draft.id) {
    throw new Error('A product with this name already exists.')
  }

  const productPayload = {
    name,
    slug,
    category,
    description: String(draft.description || '').trim(),
    base_price: basePrice,
    is_active: draft.active !== false,
    sort_order: draft.sort_order ?? 100,
  }

  const existingImageUrl = draft.image_url || draft.imageUrl || null
  let savedProduct

  if (draft.id) {
    const { data, error } = await supabase
      .from('products')
      .update(productPayload)
      .eq('id', draft.id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || error.message?.includes('products_slug_key')) {
        throw new Error('A product with this name already exists.')
      }
      throw error
    }
    savedProduct = data
  } else {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...productPayload, image_url: existingImageUrl })
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || error.message?.includes('products_slug_key')) {
        throw new Error('A product with this name already exists.')
      }
      throw error
    }
    savedProduct = data
  }

  let nextImageUrl = existingImageUrl

  if (draft.imageFile) {
    nextImageUrl = await uploadProductImage(savedProduct.id, draft.imageFile)

    const { data, error } = await supabase
      .from('products')
      .update({ image_url: nextImageUrl })
      .eq('id', savedProduct.id)
      .select()
      .single()

    if (error) throw error
    savedProduct = data
  }

  const variants = normalizeVariantsForSave({ ...draft, category })

  await supabase.from('product_variants').update({ is_active: false }).eq('product_id', savedProduct.id)

  for (const variant of variants) {
    const { error } = await supabase.from('product_variants').upsert(
      {
        ...variant,
        product_id: savedProduct.id,
      },
      { onConflict: 'product_id,name' },
    )

    if (error) throw error
  }

  await supabase
    .from('product_option_values')
    .update({ is_active: false })
    .eq('product_id', savedProduct.id)
    .eq('option_name', 'flavor')

  const flavors = normalizeFlavorsForSave({ ...draft, category })
  for (const flavor of flavors) {
    const { error } = await supabase.from('product_option_values').upsert(
      {
        product_id: savedProduct.id,
        option_name: 'flavor',
        value: flavor.value,
        is_active: true,
        sort_order: flavor.sort_order,
      },
      { onConflict: 'product_id,option_name,value' },
    )

    if (error) throw error
  }

  const flavorImageFiles = draft.flavorImageFiles || {}
  for (const [label, file] of Object.entries(flavorImageFiles)) {
    if (!file) continue

    const flavorSortOrder =
      flavors.find((flavor) => flavor.value.toLowerCase() === label.toLowerCase())?.sort_order ?? 100
    const flavorImageUrl = await uploadProductFlavorImage(savedProduct.id, label, file)
    await saveProductFlavorImage(savedProduct.id, label, flavorImageUrl, flavorSortOrder)
  }

  return {
    ...mapProductRow({
      ...savedProduct,
      image_url: nextImageUrl,
    }),
  }
}

export async function toggleSweetTreatsProductStatus(productId, isActive) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId)

  if (error) throw error

  return getSweetTreatsProducts()
}

export async function deleteSweetTreatsProduct(productId) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', productId)

  if (error) throw error

  return getSweetTreatsProducts()
}
