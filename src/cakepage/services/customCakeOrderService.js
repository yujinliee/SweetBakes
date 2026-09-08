import { supabase } from '../../lib/supabase.js'
import {
  createReferenceDraftId,
  removeDraftReferenceImage,
  resolveReferenceDraftId,
  restoreDraftReferenceImages,
  uploadDraftReferenceImages,
} from '../../services/referenceImageStorageService.js'

const draftTable = 'custom_cake_drafts'

export const createRequestUploadId = createReferenceDraftId

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

const withPreviewUrls = (references = []) => restoreDraftReferenceImages(
  references,
  { productType: 'cake' },
)

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
  console.log('[REFERENCE DRAFT RESTORED]', {
    productType: 'cake',
    draftId: data.id || null,
    storedReferences: references.map(({ previewUrl, ...reference }) => reference),
  })
  return { ...data, reference_images: references }
}

export async function saveCustomCakeDraft({
  draftId,
  currentStep,
  selections,
  designDetails,
  customerInfo,
  referenceImages = [],
  source = 'saveCustomCakeDraft',
}) {
  const user = await getCustomerSession()
  const id = resolveReferenceDraftId(referenceImages, draftId)
  const storedReferences = referenceImages
    .filter((reference) => reference?.path)
    .map(toStoredReference)
  const payload = {
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
  }

  console.log('[CAKE DB WRITE]', {
    source,
    draftId: payload.id,
    referenceImages: payload.reference_images,
    timestamp: Date.now(),
  })
  console.log('[CAKE DRAFT FINAL PAYLOAD]', {
    draftId: payload.id,
    customerId: payload.customer_id,
    referenceImages: payload.reference_images,
  })

  const { data, error } = await supabase
    .from(draftTable)
    .upsert(payload, { onConflict: 'customer_id' })
    .select('*')
    .single()
  if (error) throw error
  console.log('[REFERENCE DRAFT SAVED]', {
    productType: 'cake',
    draftId: data.id || id,
    referencePaths: storedReferences.map((reference) => reference.path),
  })

  const { data: roundtrip, error: roundtripError } = await supabase
    .from(draftTable)
    .select('id, reference_images')
    .eq('id', data.id || id)
    .maybeSingle()
  if (roundtripError) {
    console.error('[CAKE DB AFTER WRITE]', {
      source,
      draftId: data.id || id,
      remoteReferenceImages: null,
      updatedAt: null,
      errorCode: roundtripError.code ?? null,
      errorMessage: roundtripError.message ?? null,
    })
    console.error('[CAKE DRAFT ROUNDTRIP]', {
      draftId: data.id || id,
      errorCode: roundtripError.code ?? null,
      errorMessage: roundtripError.message ?? null,
    })
  } else {
    console.log('[CAKE DB AFTER WRITE]', {
      source,
      draftId: roundtrip?.id || data.id || id,
      remoteReferenceImages: roundtrip?.reference_images ?? null,
      updatedAt: roundtrip?.updated_at ?? null,
    })
    const savedReferencePaths = (roundtrip?.reference_images || [])
      .map((reference) => reference?.path)
      .filter(Boolean)
    const expectedPaths = storedReferences.map((reference) => reference.path).filter(Boolean)
    const matches = expectedPaths.length === savedReferencePaths.length &&
      expectedPaths.every((path) => savedReferencePaths.includes(path))

    console.log('[CAKE DRAFT ROUNDTRIP]', {
      draftId: roundtrip?.id || data.id || id,
      savedReferencePaths,
    })
    console.log('[CAKE REFERENCE DB VERIFY]', {
      draftId: roundtrip?.id || data.id || id,
      expectedPaths,
      remoteReferenceImages: savedReferencePaths,
      matches,
    })
    console.log('[CAKE DRAFT DB VERIFY]', {
      draftId: roundtrip?.id || data.id || id,
      remoteReferenceImages: roundtrip?.reference_images ?? null,
    })

    if (!matches) {
      throw new Error('CAKE_REFERENCE_DB_VERIFY_FAILED')
    }
  }
  return { ...data, reference_images: await withPreviewUrls(storedReferences) }
}

export async function uploadCustomCakeDraftReferences(
  files = [],
  draftId,
  existingReferences = [],
  draftData = {},
) {
  const id = resolveReferenceDraftId(existingReferences, draftId)
  try {
    const result = await uploadDraftReferenceImages({
      productType: 'cake',
      files,
      existingReferences,
      draftId: id,
    })
    const saved = await saveCustomCakeDraft({
      draftId: id,
      currentStep: draftData.currentStep || 2,
      selections: draftData.selections || {},
      designDetails: draftData.designDetails || {},
      customerInfo: draftData.customerInfo || {},
      referenceImages: result.references,
      source: 'uploadCustomCakeDraftReferences',
    })
    return { draftId: id, referenceImages: await withPreviewUrls(saved.reference_images) }
  } catch (error) {
    throw error
  }
}

export async function removeCustomCakeDraftReference(path, draftId, references = [], draftData = {}) {
  const remaining = references.filter((reference) => reference.path !== path)
  const restored = await removeDraftReferenceImage({
    productType: 'cake',
    storagePath: path,
    remainingReferences: remaining,
  })
  await saveCustomCakeDraft({
    draftId,
    currentStep: draftData.currentStep || 2,
    selections: draftData.selections || {},
    designDetails: draftData.designDetails || {},
    customerInfo: draftData.customerInfo || {},
    referenceImages: remaining,
    source: 'removeCustomCakeDraftReference',
  })
  return restored
}

export async function completeCustomCakeDraft(draftId) {
  if (!draftId) return
  await getCustomerSession()
  const payload = { status: 'completed', completed_at: new Date().toISOString() }
  console.log('[CAKE DB WRITE]', {
    source: 'completeCustomCakeDraft',
    draftId,
    referenceImages: undefined,
    timestamp: Date.now(),
  })
  const { data, error } = await supabase
    .from(draftTable)
    .update(payload)
    .eq('id', draftId)
    .select('id, reference_images, updated_at')
    .single()
  if (error) throw error
  console.log('[CAKE DB AFTER WRITE]', {
    source: 'completeCustomCakeDraft',
    draftId: data?.id || draftId,
    remoteReferenceImages: data?.reference_images ?? null,
    updatedAt: data?.updated_at ?? null,
  })
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
