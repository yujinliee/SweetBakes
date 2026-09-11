import { supabase } from '../../lib/supabase.js'

const adminOrdersStorageKey = 'sweetbakes:cake-requests'

const ORDER_COLUMNS = `
  id,
  order_number,
  customer_id,
  first_name,
  last_name,
  contact_number,
  email,
  order_method,
  province,
  city_municipality,
  barangay,
  postal_code,
  address,
  apartment_unit,
  landmark,
  different_recipient,
  recipient_name,
  recipient_contact,
  preferred_date,
  preferred_time,
  subtotal,
  delivery_fee,
  total,
  required_down_payment,
  amount_paid,
  loyalty_reward_applied,
  loyalty_discount_percent,
  loyalty_discount_amount,
  payment_amount_due,
  order_status,
  payment_status,
  payment_method,
  notes,
  created_at,
  updated_at
`

const ORDER_ITEM_COLUMNS = `
  id,
  order_id,
  product_id,
  product_name,
  product_type,
  variant_name,
  quantity,
  unit_price,
  subtotal,
  customization_data
`

const PRICE_ITEM_COLUMNS = 'id, order_id, description, amount, sort_order'

const referenceBucket = 'custom-order-references'

export const getOrders = () => {
  try {
    return JSON.parse(window.localStorage.getItem(adminOrdersStorageKey)) || []
  } catch {
    return []
  }
}

export const getOrderByRequestNumber = (requestNumber) =>
  getOrders().find((order) => order.requestNumber === requestNumber) || null

async function attachReferenceImageSignedUrls(items = []) {
  // Safely collect all reference-image paths from an order item's customization data.
  // Handles: null customization_data, missing reference_images, nested package references,
  // and deduplicates paths so the same storage object is not signed twice.
  function collectReferences(customization) {
    if (customization == null || typeof customization !== 'object') return []

    const topLevelRefs =
      Array.isArray(customization.reference_images)
        ? customization.reference_images
        : []

    const packageRefs =
      Array.isArray(
        customization.package_customization?.packageReferenceImages
      )
        ? customization.package_customization.packageReferenceImages
        : []

    // Deduplicate within the collected set before returning.
    const all = [...topLevelRefs, ...packageRefs]
    return [...new Set(all)]
  }

  const referencePaths = items
    .flatMap((item) => collectReferences(item.customization_data))
    .map((image) => image?.path)
    .filter(Boolean)

  if (referencePaths.length === 0) {
    return items
  }

  const uniquePaths = [...new Set(referencePaths)]
  const { data, error } = await supabase.storage
    .from(referenceBucket)
    .createSignedUrls(uniquePaths, 60 * 60)

  if (error) {
    console.error('[ADMIN ORDERS] reference image signed URL error:', error)
    return items
  }

  const signedUrlByPath = (data || []).reduce((urls, entry) => {
    if (entry.path && entry.signedUrl) {
      urls[entry.path] = entry.signedUrl
    }

    return urls
  }, {})

  const signReferences = (image) => ({
    ...image,
    signed_url: image.path ? signedUrlByPath[image.path] || '' : '',
  })

  return items.map((item) => {
    const customization = item.customization_data
    if (!customization) return item

    const referenceImages = customization.reference_images
    const packageReferences =
      customization.package_customization?.packageReferenceImages

    const nextCustomization = { ...customization }

    if (Array.isArray(referenceImages)) {
      nextCustomization.reference_images = referenceImages.map(signReferences)
    }

    if (packageReferences != null && Array.isArray(packageReferences)) {
      nextCustomization.package_customization = {
        ...customization.package_customization,
        packageReferenceImages: packageReferences.map(signReferences),
      }
    }

    return { ...item, customization_data: nextCustomization }
  })
}

export async function fetchAdminOrders() {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false })

  if (ordersError) {
    throw ordersError
  }

  const orderIds = (orders || []).map((order) => order.id).filter(Boolean)

  if (orderIds.length === 0) {
    return []
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select(ORDER_ITEM_COLUMNS)
    .in('order_id', orderIds)

  if (itemsError) {
    throw itemsError
  }

  const itemsWithSignedUrls = await attachReferenceImageSignedUrls(items || [])

  const { data: priceItems, error: priceItemsError } = await supabase
    .from('order_price_breakdown_items')
    .select(PRICE_ITEM_COLUMNS)
    .in('order_id', orderIds)
    .order('sort_order', { ascending: true })

  if (priceItemsError) {
    throw priceItemsError
  }

  // Batch-fetch product images for all product_ids present in order items.
  // One query for all orders — no N+1.
  const productIds = [...new Set(
    itemsWithSignedUrls.map((item) => item.product_id).filter(Boolean)
  )]

  let productImageByProductId = {}
  if (productIds.length > 0) {
    const { data: productRows } = await supabase
      .from('products')
      .select('id, image_url')
      .in('id', productIds)
    ;(productRows || []).forEach((row) => {
      if (row.image_url) productImageByProductId[row.id] = row.image_url
    })
  }

  const itemsByOrderId = itemsWithSignedUrls.reduce((groups, item) => {
    const orderId = item.order_id

    if (!groups[orderId]) {
      groups[orderId] = []
    }

    groups[orderId].push(item)
    return groups
  }, {})

  const priceItemsByOrderId = (priceItems || []).reduce((groups, item) => {
    if (!groups[item.order_id]) groups[item.order_id] = []
    groups[item.order_id].push({
      id: item.id,
      description: item.description,
      amount: Number(item.amount) || 0,
      sortOrder: item.sort_order,
    })
    return groups
  }, {})

  return (orders || []).map((order) => {
    const orderItems = itemsByOrderId[order.id] || []
    // Resolve thumbnail from the first item's product_id → DB image, no signed URL needed.
    const firstItem = orderItems[0] || null
    const thumbnailUrl = (firstItem?.product_id && productImageByProductId[firstItem.product_id])
      ? productImageByProductId[firstItem.product_id]
      : null
    return {
      ...order,
      order_items: orderItems,
      price_items: priceItemsByOrderId[order.id] || [],
      thumbnailUrl,
    }
  })
}

export async function fetchAdminDashboardData() {
  const [totalOrdersResult, pendingOrdersResult, completedOrdersResult, customersResult, recentOrdersResult] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('order_status', 'pending'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('order_status', 'completed'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).ilike('role', 'customer'),
    supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const queryResults = [
    totalOrdersResult,
    pendingOrdersResult,
    completedOrdersResult,
    customersResult,
    recentOrdersResult,
  ]
  const queryError = queryResults.find((result) => result.error)?.error

  if (queryError) {
    throw queryError
  }

  const recentOrders = recentOrdersResult.data || []
  const orderIds = recentOrders.map((order) => order.id).filter(Boolean)
  let items = []

  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from('order_items')
      .select(ORDER_ITEM_COLUMNS)
      .in('order_id', orderIds)

    if (error) {
      throw error
    }

    items = data || []
  }

  const itemsByOrderId = items.reduce((groups, item) => {
    if (!groups[item.order_id]) groups[item.order_id] = []
    groups[item.order_id].push(item)
    return groups
  }, {})

  return {
    summary: {
      totalOrders: totalOrdersResult.count || 0,
      pendingOrders: pendingOrdersResult.count || 0,
      completedOrders: completedOrdersResult.count || 0,
      totalCustomers: customersResult.count || 0,
    },
    recentOrders: recentOrders.map((order) => ({
      ...order,
      order_items: itemsByOrderId[order.id] || [],
    })),
  }
}

export async function updateAdminOrderStatus(orderId, newStatus) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      order_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select(ORDER_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function reviewCustomOrderRequest(orderId, action, finalPrice = null, rejectionReason = '', priceItems = []) {
  const { data, error } = await supabase.rpc('review_custom_order_request_with_pricing', {
    p_order_id: orderId,
    p_action: action,
    p_final_price: finalPrice,
    p_rejection_reason: rejectionReason,
    p_price_items: priceItems.map((item, index) => ({
      description: String(item.description || '').trim(),
      amount: Number(item.amount) || 0,
      sort_order: index,
    })),
  })

  if (error) {
    throw error
  }

  if (Array.isArray(data?.order_items)) {
    return {
      ...data,
      order_items: await attachReferenceImageSignedUrls(data.order_items),
    }
  }

  return data
}
