import { supabase } from '../../lib/supabase.js'

const inactiveOrderStatuses = new Set(['cancelled', 'rejected'])

const PROFILE_COLUMNS = `
  id,
  email,
  first_name,
  last_name,
  role,
  created_at,
  updated_at
`

const CUSTOMER_ORDER_COLUMNS = `
  id,
  order_number,
  customer_id,
  contact_number,
  total,
  order_status,
  payment_status,
  created_at
`

function isValidCustomerOrder(order) {
  return !inactiveOrderStatuses.has(String(order?.order_status || '').trim().toLowerCase())
}

function buildCustomerStats(orders) {
  return (orders || []).reduce((stats, order) => {
    if (!order.customer_id || !isValidCustomerOrder(order)) {
      return stats
    }

    if (!stats[order.customer_id]) {
      stats[order.customer_id] = {
        validOrderCount: 0,
        totalSpent: 0,
        lastOrder: null,
        recentOrders: [],
        latestContactNumber: null,
      }
    }

    const customerStats = stats[order.customer_id]
    customerStats.validOrderCount += 1
    customerStats.totalSpent += Number(order.total) || 0
    customerStats.recentOrders.push(order)

    if (!customerStats.latestContactNumber && order.contact_number) {
      customerStats.latestContactNumber = order.contact_number
    }

    const currentDate = new Date(order.created_at)
    const lastDate = customerStats.lastOrder ? new Date(customerStats.lastOrder.created_at) : null

    if (!customerStats.lastOrder || currentDate > lastDate) {
      customerStats.lastOrder = order
    }

    return stats
  }, {})
}

export async function fetchAdminCustomers() {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .ilike('role', 'customer')
    .order('created_at', { ascending: false })

  if (profilesError) {
    throw profilesError
  }

  const customerIds = (profiles || []).map((profile) => profile.id).filter(Boolean)

  if (customerIds.length === 0) {
    return []
  }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(CUSTOMER_ORDER_COLUMNS)
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })

  if (ordersError) {
    throw ordersError
  }

  const statsByCustomerId = buildCustomerStats(orders)

  return (profiles || []).map((profile) => {
    const stats = statsByCustomerId[profile.id] || {
      validOrderCount: 0,
      totalSpent: 0,
      lastOrder: null,
      recentOrders: [],
      latestContactNumber: null,
    }

    return {
      ...profile,
      stats: {
        ...stats,
        recentOrders: stats.recentOrders.slice(0, 5),
      },
    }
  })
}

export async function fetchAdminCustomerDetails(customerId) {
  const { data: customer, error: customerError } = await supabase
    .from('profiles').select(PROFILE_COLUMNS).eq('id', customerId).ilike('role', 'customer').maybeSingle()
  if (customerError) throw customerError
  if (!customer) return null
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`${CUSTOMER_ORDER_COLUMNS}, order_items(id, product_name, product_type, quantity, subtotal)`)
    .eq('customer_id', customerId).order('created_at', { ascending: false })
  if (ordersError) throw ordersError
  const validOrders = (orders || []).filter(isValidCustomerOrder)
  return {
    ...customer,
    orders: validOrders,
    stats: {
      validOrderCount: validOrders.length,
      totalSpent: validOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      lastOrder: validOrders[0] || null,
      latestContactNumber: validOrders.find((order) => order.contact_number)?.contact_number || null,
    },
  }
}

export async function fetchAdminCustomerLoyalty(customerId) {
  const { data, error } = await supabase.rpc('get_admin_customer_loyalty_state', { p_customer_id: customerId })
  if (error) throw error
  return data
}

export async function fetchAdminLoyaltyOverview() {
  const { data, error } = await supabase.rpc('get_admin_loyalty_overview')
  if (error) throw error
  return data || { summary: {}, customers: [] }
}
