import { supabase } from '../lib/supabase.js'

const splitCustomerName = (customerInfo = {}) => {
  const fullName = String(customerInfo.fullName || '').trim()
  const parts = fullName.split(/\s+/).filter(Boolean)
  return {
    firstName: customerInfo.customerFirstName?.trim() || parts[0] || '',
    lastName: customerInfo.customerLastName?.trim() || parts.slice(1).join(' ') || parts[0] || '',
  }
}

export async function createCustomCustomerOrder({
  productType,
  productName,
  quantity,
  customerInfo,
  preferredDate,
  preferredTime,
  customizationData,
}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const user = sessionData?.session?.user
  if (sessionError || !user) throw new Error('AUTH_REQUIRED')

  const { firstName, lastName } = splitCustomerName(customerInfo)
  const recipientName = [customerInfo.recipientLastName, customerInfo.recipientFirstName]
    .filter(Boolean)
    .join(', ')

  const { data, error } = await supabase.rpc('create_custom_customer_order', {
    p_customer_id: user.id,
    p_first_name: firstName,
    p_last_name: lastName,
    p_contact_number: customerInfo.contactNumber?.trim() || '',
    p_email: customerInfo.email?.trim() || '',
    p_order_method: customerInfo.fulfillment,
    p_province: customerInfo.province || 'Cavite',
    p_city_municipality: customerInfo.city || '',
    p_barangay: customerInfo.barangay || '',
    p_postal_code: customerInfo.postalCode || '',
    p_address: customerInfo.deliveryAddress || customerInfo.address || '',
    p_apartment_unit: customerInfo.apartment || '',
    p_landmark: customerInfo.landmark || '',
    p_different_recipient: Boolean(customerInfo.deliverDifferentRecipient),
    p_recipient_name: recipientName,
    p_recipient_contact: customerInfo.recipientContact || '',
    p_preferred_date: preferredDate,
    p_preferred_time: preferredTime,
    p_product_type: productType,
    p_product_name: productName,
    p_quantity: Number(quantity) || 1,
    p_customization_data: customizationData || {},
  })

  if (error) throw error
  return data
}
