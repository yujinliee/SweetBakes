import { supabase } from '../lib/supabase.js'
import { normalizePhoneNumber } from '../utils/phoneNumber.js'
import { requireCustomerSession } from '../auth/customerSession.js'

const ADDRESS_SELECT = `
  id,
  user_id,
  province,
  city_municipality,
  barangay,
  postal_code,
  address,
  apartment_unit,
  landmark,
  phone_number,
  is_default,
  created_at,
  updated_at
`

function normalizeAddressPayload(payload) {
  return {
    province: payload.province.trim(),
    city_municipality: payload.city_municipality.trim(),
    barangay: payload.barangay.trim(),
    postal_code: payload.postal_code.trim(),
    address: payload.address.trim(),
    apartment_unit: typeof payload.apartment_unit === 'string' ? payload.apartment_unit.trim() || null : null,
    landmark: typeof payload.landmark === 'string' ? payload.landmark.trim() || null : null,
    phone_number: typeof payload.phone_number === 'string' ? normalizePhoneNumber(payload.phone_number) || null : null,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchCustomerAddresses() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const user = sessionData?.session?.user || null

  if (!user) {
    return { addresses: [], userId: null }
  }

  return fetchAddressesForUser(user)
}

async function fetchAddressesForUser(user) {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select(ADDRESS_SELECT)
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return { addresses: data || [], userId: user.id }
}

export async function fetchDefaultCustomerAddress() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const user = sessionData?.session?.user || null

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .select(ADDRESS_SELECT)
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function createCustomerAddress(payload) {
  const session = await requireCustomerSession()

  const { addresses } = await fetchAddressesForUser(session.user)
  const insertPayload = {
    ...normalizeAddressPayload(payload),
    user_id: session.user.id,
    is_default: addresses.length === 0,
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert(insertPayload)
    .select(ADDRESS_SELECT)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateCustomerAddress(addressId, payload) {
  const session = await requireCustomerSession()
  const { data, error } = await supabase
    .from('customer_addresses')
    .update(normalizeAddressPayload(payload))
    .eq('id', addressId)
    .eq('user_id', session.user.id)
    .select(ADDRESS_SELECT)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function deleteCustomerAddress(addressId) {
  const session = await requireCustomerSession()
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', session.user.id)

  if (error) {
    throw error
  }
}

export async function setDefaultCustomerAddress(addressId) {
  await requireCustomerSession()
  const { error } = await supabase.rpc('set_default_customer_address', {
    p_address_id: addressId,
  })

  if (error) {
    throw error
  }
}
