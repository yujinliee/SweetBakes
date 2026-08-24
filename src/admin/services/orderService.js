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
  const referencePaths = items
    .flatMap((item) => item.customization_data?.reference_images || [])
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

  return items.map((item) => {
    const referenceImages = item.customization_data?.reference_images

    if (!Array.isArray(referenceImages)) {
      return item
    }

    return {
      ...item,
      customization_data: {
        ...item.customization_data,
        reference_images: referenceImages.map((image) => ({
          ...image,
          signed_url: image.path ? signedUrlByPath[image.path] || '' : '',
        })),
      },
    }
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

  const itemsByOrderId = itemsWithSignedUrls.reduce((groups, item) => {
    const orderId = item.order_id

    if (!groups[orderId]) {
      groups[orderId] = []
    }

    groups[orderId].push(item)
    return groups
  }, {})

  return (orders || []).map((order) => ({
    ...order,
    order_items: itemsByOrderId[order.id] || [],
  }))
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

export async function reviewCustomOrderRequest(orderId, action, finalPrice = null, rejectionReason = '') {
  const { data, error } = await supabase.rpc('review_custom_order_request', {
    p_order_id: orderId,
    p_action: action,
    p_final_price: finalPrice,
    p_rejection_reason: rejectionReason,
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
