import { supabase } from '../../lib/supabase.js'

const referenceBucket = 'custom-order-references'
const acceptedReferenceTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxReferenceFileSize = 5 * 1024 * 1024
const draftTable = 'custom_cake_drafts'

export const createRequestUploadId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const getCustomerSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  const user = data?.session?.user || null
  if (error || !user) throw new Error('AUTH_REQUIRED')
  return user
}

const toStoredReference = ({ name, type, size, path, position }) => ({
  name: name || 'reference image',
  type: type || 'image/jpeg',
  size: Number(size) || 0,
  path,
  position,
})

const withPreviewUrls = async (references = []) => {
  const paths = references.map((reference) => reference.path).filter(Boolean)
  if (!paths.length) return references
  const { data, error } = await supabase.storage
    .from(referenceBucket)
    .createSignedUrls(paths, 60 * 60)
  if (error) throw error
  const urls = (data || []).reduce((result, item, index) => {
    result[paths[index]] = item.signedUrl || ''
    return result
  }, {})
  return references.map((reference) => ({
    ...reference,
    previewUrl: urls[reference.path] || '',
  }))
}

export async function fetchCustomCakeDraft() {
  const user = await getCustomerSession()
  const { data, error } = await supabase
    .from(draftTable)
    .select('*')
    .eq('customer_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const references = await withPreviewUrls(data.reference_images || [])
  return { ...data, reference_images: references }
}

export async function saveCustomCakeDraft({
  draftId,
  currentStep,
  selections,
  designDetails,
  customerInfo,
  referenceImages = [],
}) {
  const user = await getCustomerSession()
  const id = draftId || createRequestUploadId()
  const storedReferences = referenceImages
    .filter((reference) => reference?.path)
    .map(toStoredReference)
  const { data, error } = await supabase
    .from(draftTable)
    .upsert({
      id,
      customer_id: user.id,
      current_step: currentStep,
      selections,
      design_details: {
        theme: designDetails?.theme || '',
        otherTheme: designDetails?.otherTheme || '',
        message: designDetails?.message || '',
        instructions: designDetails?.instructions || '',
      },
      customer_info: customerInfo,
      reference_images: storedReferences,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return { ...data, reference_images: await withPreviewUrls(storedReferences) }
}

export async function uploadCustomCakeDraftReferences(
  files = [],
  draftId,
  existingReferences = [],
  draftData = {},
) {
  const user = await getCustomerSession()
  if (files.length + existingReferences.length > 3) {
    throw new Error('REFERENCE_IMAGE_INVALID:Maximum 3 reference images allowed.')
  }
  const id = draftId || createRequestUploadId()
  const usedPositions = new Set(existingReferences.map((reference) => reference.position))
  const nextReferences = [...existingReferences]
  const uploadedPaths = []

  try {
    for (const file of files) {
      if (!(file instanceof File) || !acceptedReferenceTypes.has(file.type) || file.size > maxReferenceFileSize) {
        throw new Error(`REFERENCE_IMAGE_INVALID:${file?.name || 'reference image'}`)
      }
      let position = 1
      while (usedPositions.has(position)) position += 1
      usedPositions.add(position)
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `drafts/${user.id}/${id}/reference-${position}.${extension}`
      const { error } = await supabase.storage.from(referenceBucket).upload(path, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      })
      if (error) throw new Error(`REFERENCE_IMAGE_UPLOAD_FAILED:${file.name}`)
      uploadedPaths.push(path)
      nextReferences.push(toStoredReference({ name: file.name, type: file.type, size: file.size, path, position }))
    }
    const saved = await saveCustomCakeDraft({
      draftId: id,
      currentStep: draftData.currentStep || 2,
      selections: draftData.selections || {},
      designDetails: draftData.designDetails || {},
      customerInfo: draftData.customerInfo || {},
      referenceImages: nextReferences,
    })
    return { draftId: id, referenceImages: await withPreviewUrls(saved.reference_images) }
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(referenceBucket).remove(uploadedPaths)
    throw error
  }
}

export async function removeCustomCakeDraftReference(path, draftId, references = [], draftData = {}) {
  const remaining = references.filter((reference) => reference.path !== path)
  if (path) await supabase.storage.from(referenceBucket).remove([path])
  await saveCustomCakeDraft({
    draftId,
    currentStep: draftData.currentStep || 2,
    selections: draftData.selections || {},
    designDetails: draftData.designDetails || {},
    customerInfo: draftData.customerInfo || {},
    referenceImages: remaining,
  })
  return withPreviewUrls(remaining)
}

export async function completeCustomCakeDraft(draftId) {
  if (!draftId) return
  await getCustomerSession()
  const { error } = await supabase
    .from(draftTable)
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', draftId)
  if (error) throw error
}

export const mapCustomCakeSubmitError = (message = '') => {
  const normalizedMessage = String(message).toLowerCase()

  if (normalizedMessage.includes('reference_image_invalid')) {
    const fileName = String(message).split(':')[1]

    return fileName
      ? `The selected file "${fileName}" is not supported or is larger than 5MB.`
      : 'One reference image is not supported or is larger than 5MB.'
  }

  if (normalizedMessage.includes('fully_booked') || normalizedMessage.includes('fully booked')) {
    return 'This date has just become fully booked. Please select another available date.'
  }

  if (normalizedMessage.includes('lead_time')) {
    return 'Please select a date outside the minimum preparation period.'
  }

  if (
    normalizedMessage.includes('date_unavailable') ||
    normalizedMessage.includes('blocked') ||
    normalizedMessage.includes('unavailable')
  ) {
    return 'This date is no longer available.'
  }

  if (normalizedMessage.includes('reference')) {
    return 'Unable to upload one of your reference images. Please try again.'
  }

  return 'Unable to submit your request. Please try again.'
}

export async function createCustomCakeOrderRequest({
  selections,
  designDetails,
  customerInfo,
  referenceImages,
}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id || null
  if (!userId) throw new Error('AUTH_REQUIRED')

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', userId).maybeSingle()
  if (profileError || profile?.role !== 'customer') throw new Error('CUSTOMER_REQUIRED')
  const preferredTime =
    customerInfo.fulfillment === 'pickup'
      ? customerInfo.preferredPickupTime
      : customerInfo.preferredDeliveryTime
  const recipientName = customerInfo.deliverDifferentRecipient
    ? `${customerInfo.recipientFirstName} ${customerInfo.recipientLastName}`.trim()
    : null
  const theme =
    designDetails.theme === 'Other'
      ? designDetails.otherTheme.trim()
      : designDetails.theme

  const uploadedReferenceImages = referenceImages
    .filter((reference) => reference?.path)
    .map(toStoredReference)

  const { data, error } = await supabase.rpc('create_custom_order_request', {
    p_customer_id: userId,
    p_first_name: customerInfo.customerFirstName.trim(),
    p_last_name: customerInfo.customerLastName.trim(),
    p_contact_number: customerInfo.contactNumber.trim(),
    p_email: customerInfo.email.trim(),
    p_order_method: customerInfo.fulfillment,
    p_province: customerInfo.fulfillment === 'delivery' ? customerInfo.province.trim() || null : null,
    p_city_municipality:
      customerInfo.fulfillment === 'delivery' ? customerInfo.city.trim() || null : null,
    p_barangay: customerInfo.fulfillment === 'delivery' ? customerInfo.barangay.trim() || null : null,
    p_postal_code: null,
    p_address:
      customerInfo.fulfillment === 'delivery' ? customerInfo.deliveryAddress.trim() || null : null,
    p_apartment_unit:
      customerInfo.fulfillment === 'delivery' ? customerInfo.apartment.trim() || null : null,
    p_landmark:
      customerInfo.fulfillment === 'delivery' ? customerInfo.landmark.trim() || null : null,
    p_different_recipient:
      customerInfo.fulfillment === 'delivery' ? customerInfo.deliverDifferentRecipient : false,
    p_recipient_name: customerInfo.fulfillment === 'delivery' ? recipientName : null,
    p_recipient_contact:
      customerInfo.fulfillment === 'delivery' && customerInfo.deliverDifferentRecipient
        ? customerInfo.recipientContact.trim()
        : null,
    p_preferred_date: customerInfo.preferredDate,
    p_preferred_time: preferredTime,
    p_flavor: selections.flavor,
    p_size: selections.size,
    p_layers: Number(selections.layers),
    p_theme: theme,
    p_original_theme: designDetails.theme,
    p_cake_message: designDetails.message.trim() || null,
    p_special_instructions: designDetails.instructions.trim() || null,
    p_reference_images: uploadedReferenceImages,
  })

  if (error) {
    throw error
  }

  return {
    order: data,
    referenceImages: uploadedReferenceImages,
  }
}

export async function fetchCustomCakeOrderByNumber(requestNumber, email = '') {
  const normalizedRequestNumber = String(requestNumber || '').trim()
  const normalizedEmail = String(email || '').trim()

  if (!normalizedRequestNumber) {
    return null
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) {
    console.error('[TRACK ORDER ERROR]', userError)
    throw userError
  }

  const user = userData?.user || null
  console.log('[TRACK ORDER USER]', user?.id)
  console.log('[TRACK ORDER NUMBER]', normalizedRequestNumber)

  if (user) {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', normalizedRequestNumber)
      .eq('customer_id', user.id)
      .maybeSingle()

    console.log('[TRACK ORDER RESULT]', order)

    if (orderError) {
      console.error('[TRACK ORDER ERROR]', orderError)
      throw orderError
    }

    if (!order) {
      return null
    }

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)

    if (orderItemsError) {
      console.error('[TRACK ORDER ERROR]', orderItemsError)
      return { ...order, order_items: [] }
    }

    return { ...order, order_items: orderItems || [] }
  }

  const { data, error } = await supabase.rpc('track_guest_order', {
    p_order_number: normalizedRequestNumber,
    p_email: normalizedEmail || null,
  })

  console.log('[TRACK ORDER RESULT]', data)

  if (error) {
    console.error('[TRACK ORDER ERROR]', error)
    throw error
  }

  return data
}
