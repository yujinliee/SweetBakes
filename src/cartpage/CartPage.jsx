import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SiteTopbar } from '../landingpage/LandingPage.jsx'
import {
  subscribeCart,
  getCartItems,
  getCartItemMetadata,
  setCartQuantity,
  removeCartQuantity,
  removeFromCart,
} from '../cartStore.js'
import CakeAvailabilityCalendar from '../cakepage/components/CakeAvailabilityCalendar.jsx'
import AutocompleteTextInput from './components/AutocompleteTextInput.jsx'
import addressData from './data/philippineAddressData.js'
import WheelTimePicker from '../components/WheelTimePicker.jsx'
import { resolveSweetTreatsPrice } from '../sweettreats/sweetTreatsData.js'
import { useAvailability } from '../hooks/useAvailability.js'
import { assertCanAcceptOrderForDate } from '../admin/services/availabilityService.js'
import { supabase } from '../lib/supabase.js'
import { fetchAuthenticatedCustomerProfile } from '../services/customerProfileService.js'
import OrderRequestSuccessModal from '../components/OrderRequestSuccessModal.jsx'
import chocolateCakeImage from '../assets/othersweettreats/regular_chocolate.jpg'
import redVelvetCakeImage from '../assets/othersweettreats/regular_redvelvet.png'
import cheesecakeImage from '../assets/othersweettreats/halfordozen_cheesecake.png'
import ubeImage from '../assets/othersweettreats/ube.png'
import grahamImage from '../assets/othersweettreats/graham de leche.png'
import lecheFlanImage from '../assets/othersweettreats/leche_flan.png'
import putoImage from '../assets/othersweettreats/puto.jpg'
import './CartPage.css'

const PRODUCT_PRICES = {
  'Chocolate Cake': 650,
  'Red Velvet Cake': 700,
  'Puto': 120,
  'Graham de Leche': 180,
  'Blueberry Cheesecake': 850,
  'Strawberry Cheesecake': 850,
  'Mango Cheesecake': 850,
  'Biscoff Cheesecake': 620,
  'Oreo Cheesecake': 850,
}

const ORDER_METHODS = [
  { value: 'delivery', title: 'Delivery', description: 'In-house delivery' },
  { value: 'pickup', title: 'Store Pickup', description: 'Pick up at our bakery' },
]

const CART_ORDER_PAYMENT_METHOD = 'Xendit'
const CART_PAYMENT_RETURN_STORAGE_KEY = 'sweetbakes:cart-payment-return-v1'

const CART_IMAGE_FALLBACKS = {
  'Chocolate Cake': chocolateCakeImage,
  'Red Velvet Cake': redVelvetCakeImage,
  Cheesecake: cheesecakeImage,
  Ube: ubeImage,
  'Graham de Leche': grahamImage,
  'Leche Flan': lecheFlanImage,
  Puto: putoImage,
}

const resolveFallbackImage = (productName) => {
  const normalizedName = String(productName || '').toLowerCase()

  if (normalizedName.includes('chocolate cake')) return CART_IMAGE_FALLBACKS['Chocolate Cake']
  if (normalizedName.includes('red velvet')) return CART_IMAGE_FALLBACKS['Red Velvet Cake']
  if (normalizedName.includes('cheesecake')) return CART_IMAGE_FALLBACKS.Cheesecake
  if (normalizedName.includes('ube')) return CART_IMAGE_FALLBACKS.Ube
  if (normalizedName.includes('graham de leche')) return CART_IMAGE_FALLBACKS['Graham de Leche']
  if (normalizedName.includes('leche flan')) return CART_IMAGE_FALLBACKS['Leche Flan']
  if (normalizedName.includes('puto')) return CART_IMAGE_FALLBACKS.Puto

  return ''
}

const formatPrice = (value) => `₱${value.toLocaleString('en-PH')}`

const optionalLabel = <span className="cake-optional-label">Optional</span>
const contactNumberPattern = /^\d{11}$/

const normalizeContactNumber = (value) => value.replace(/\D/g, '').slice(0, 11)

const mapProductType = (productName) => {
  const normalizedName = productName.toLowerCase()

  if (normalizedName.includes('cupcake')) {
    return 'cupcake'
  }

  if (normalizedName.includes('package')) {
    return 'party_package'
  }

  if (normalizedName.includes('cake') && !normalizedName.includes('cheesecake')) {
    return 'cake'
  }

  return 'sweet_treat'
}

const mapCreateOrderErrorMessage = (message = '') => {
  if (message.includes('Selected date is fully booked')) {
    return 'This date has just become fully booked. Please select another available date.'
  }

  if (message.includes('Selected date is unavailable')) {
    return 'This date is no longer available. Please select another date.'
  }

  if (message.includes('Selected date does not meet the minimum lead time')) {
    return 'Please select a date outside the minimum preparation period.'
  }

  if (message.includes('Selected time is outside service hours')) {
    return 'Please select a time within the available service hours.'
  }

  return 'We could not submit your order right now. Please try again.'
}

const readSafeFunctionErrorBody = async (error) => {
  const response = error?.context
  if (!response || typeof response.clone !== 'function') {
    return {
      error: error?.message || 'Unknown error',
      code: error?.code ?? null,
      message: error?.message || null,
    }
  }

  try {
    return await response.clone().json()
  } catch {
    return { error: error?.message || 'Unknown error' }
  }
}

const EMPTY_CUSTOMER_INFO = {
  customerLastName: '',
  customerFirstName: '',
  contactNumber: '',
  email: '',
  province: 'Cavite',
  city: '',
  barangay: '',
  address: '',
  apartment: '',
  landmark: '',
  preferredDeliveryTime: '',
  deliverDifferentRecipient: false,
  recipientLastName: '',
  recipientFirstName: '',
  recipientContact: '',
  preferredPickupTime: '',
}

function CartSummaryThumb({ product }) {
  const [hasImageError, setHasImageError] = useState(false)
  const imageUrl = product.image_url || product.imageUrl || ''

  if (!imageUrl || hasImageError) {
    return (
      <div
        className="cart-summary-thumb cart-summary-thumb--placeholder"
        aria-hidden="true"
      />
    )
  }

  return (
    <div className="cart-summary-thumb">
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        onError={() => setHasImageError(true)}
      />
    </div>
  )
}

function CartPage({
  onNavigate,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const [orderMethod, setOrderMethod] = useState('delivery')
  const [preferredDate, setPreferredDate] = useState('')
  const [customerInfo, setCustomerInfo] = useState(EMPTY_CUSTOMER_INFO)
  const [selectedProvince, setSelectedProvince] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const [touched, setTouched] = useState({})
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [orderSubmissionError, setOrderSubmissionError] = useState('')
  const [guestPaymentVerified, setGuestPaymentVerified] = useState(false)
  const [guestPaymentTimedOut, setGuestPaymentTimedOut] = useState(false)
  const guestPaymentStatus = new URLSearchParams(window.location.search).get('payment')
  const pendingOrderIdRef = useRef(null)
  const profileUserIdRef = useRef(null)
  const items = useSyncExternalStore(subscribeCart, getCartItems)
  const availability = useAvailability({ active: true })
  const serviceHoursLabel = availability.serviceHoursLabel || 'Loading...'
  const timeAvailabilityMessage = availability.serviceHoursLabel
    ? `Please select a time between ${availability.serviceHoursLabel}.`
    : 'Available times are temporarily unavailable. Please try again shortly.'

  useEffect(() => {
    if (isCustomerAuthenticated || guestPaymentStatus !== 'success') return undefined

    let receipt = null
    try {
      receipt = JSON.parse(window.localStorage.getItem(CART_PAYMENT_RETURN_STORAGE_KEY) || 'null')
    } catch {
      receipt = null
    }

    if (!receipt?.orderId || !receipt?.guestEmail) {
      const timeoutId = window.setTimeout(() => setGuestPaymentTimedOut(true), 0)
      return () => window.clearTimeout(timeoutId)
    }

    let isMounted = true
    let attempts = 0
    let timeoutId = null
    const pollPaymentStatus = async () => {
      attempts += 1
      const { data, error } = await supabase.functions.invoke('create-cart-xendit-payment', {
        body: { orderId: receipt.orderId, guestEmail: receipt.guestEmail, statusOnly: true },
      })

      if (!isMounted) return
      if (!error && ['paid', 'verified', 'payment_verified'].includes(String(data?.paymentStatus || '').toLowerCase())) {
        const purchasedItems = Array.isArray(receipt.items) ? receipt.items : []
        purchasedItems.forEach((item) => removeCartQuantity(item.name, item.quantity))
        window.localStorage.removeItem(CART_PAYMENT_RETURN_STORAGE_KEY)
        setGuestPaymentVerified(true)
        return
      }

      if (attempts >= 8) {
        setGuestPaymentTimedOut(true)
        return
      }

      timeoutId = window.setTimeout(pollPaymentStatus, 1500)
    }

    pollPaymentStatus().catch(() => {
      if (isMounted) setGuestPaymentTimedOut(true)
    })

    return () => {
      isMounted = false
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [guestPaymentStatus, isCustomerAuthenticated])

  useEffect(() => {
    if (
      guestPaymentStatus !== 'cancelled' &&
      !guestPaymentVerified &&
      !guestPaymentTimedOut
    ) return

    if (guestPaymentStatus === 'cancelled' || guestPaymentTimedOut) {
      window.localStorage.removeItem(CART_PAYMENT_RETURN_STORAGE_KEY)
    }

    const url = new URL(window.location.href)
    url.searchParams.delete('payment')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [guestPaymentStatus, guestPaymentTimedOut, guestPaymentVerified])

  useEffect(() => {
    if (!isCustomerAuthenticated) return undefined

    let isMounted = true

    async function loadCustomerProfile() {
      const profile = await fetchAuthenticatedCustomerProfile()

      if (!isMounted || !profile || profileUserIdRef.current === profile.userId) return

      profileUserIdRef.current = profile.userId
      setCustomerInfo((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries({
            customerLastName: profile.lastName,
            customerFirstName: profile.firstName,
            contactNumber: profile.contactNumber,
            email: profile.email,
          }).filter(([field, value]) => value && !String(current[field] || '').trim()),
        ),
      }))
    }

    loadCustomerProfile().catch((error) => {
      console.error('[CART PROFILE] load failed:', error)
    })

    return () => {
      isMounted = false
    }
  }, [isCustomerAuthenticated])

  useEffect(() => {
    if (isCustomerAuthenticated) return

    profileUserIdRef.current = null
    const resetId = window.setTimeout(() => {
      setCustomerInfo((current) => ({
        ...current,
        customerLastName: '',
        customerFirstName: '',
        contactNumber: '',
        email: '',
      }))
    }, 0)

    return () => window.clearTimeout(resetId)
  }, [isCustomerAuthenticated])

  const provinceOptions = addressData.map((province) => province.province)
  const exactProvince = addressData.find(
    (province) =>
      province.province.toLowerCase() === customerInfo.province.trim().toLowerCase(),
  )
  const provinceSelection = selectedProvince ?? exactProvince ?? null
  const cityOptions = provinceSelection?.cities ?? []
  const exactCity = cityOptions.find(
    (city) => city.name.toLowerCase() === customerInfo.city.trim().toLowerCase(),
  )
  const citySelection = selectedCity ?? exactCity ?? null
  const barangayOptions = citySelection?.barangays ?? []
  const postalCode = citySelection?.postalCode ?? ''

  const selectProvince = (value) => {
    setSelectedProvince(addressData.find((province) => province.province === value) ?? null)
    setSelectedCity(null)
    setCustomerInfo((current) => ({
      ...current,
      province: value,
      city: '',
      barangay: '',
    }))
  }

  const selectCity = (value) => {
    setSelectedCity(cityOptions.find((city) => city.name === value) ?? null)
    setCustomerInfo((current) => ({ ...current, city: value, barangay: '' }))
  }

  const updateDeliveryField = (field, value) => {
    if (field === 'province' || field === 'city') {
      if (field === 'province') setSelectedProvince(null)
      setSelectedCity(null)
      setCustomerInfo((current) => ({
        ...current,
        [field]: value,
        ...(field === 'province' ? { city: '', barangay: '' } : { barangay: '' }),
      }))
      return
    }

    updateInfo(field, value)
  }

  const updateInfo = (field, value) => {
    setCustomerInfo((current) => {
      let next = { ...current }
      if (field === 'contactNumber' || field === 'recipientContact') {
        next[field] = normalizeContactNumber(value)
      } else {
        next[field] = value
      }
      return next
    })
  }

  const markTouched = (field) => {
    setTouched((current) => ({
      ...current,
      [field]: true,
    }))
  }

  const errors = useMemo(() => {
    const nextErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!customerInfo.customerLastName.trim()) {
      nextErrors.customerLastName = 'Please enter your last name.'
    }

    if (!customerInfo.customerFirstName.trim()) {
      nextErrors.customerFirstName = 'Please enter your first name.'
    }

    if (!customerInfo.contactNumber.trim()) {
      nextErrors.contactNumber = 'Please enter your contact number.'
    } else if (!contactNumberPattern.test(customerInfo.contactNumber)) {
      nextErrors.contactNumber = 'Please enter an 11-digit contact number.'
    }

    if (!customerInfo.email.trim() || !emailPattern.test(customerInfo.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (availability.loading) {
      nextErrors.preferredDate = 'Available dates are still loading. Please wait a moment.'
    } else if (availability.error || !availability.settings) {
      nextErrors.preferredDate = 'Available dates are temporarily unavailable. Please try again shortly.'
    } else if (!preferredDate || !availability.isDateAvailable(preferredDate)) {
      nextErrors.preferredDate = 'Please select an available date.'
    }

    if (orderMethod === 'delivery') {
      if (!customerInfo.address.trim()) {
        nextErrors.address = 'Please enter a delivery address.'
      }
      if (!customerInfo.preferredDeliveryTime) {
        nextErrors.preferredDeliveryTime = 'Please select a delivery time.'
      } else if (!availability.isTimeAvailable(customerInfo.preferredDeliveryTime)) {
        nextErrors.preferredDeliveryTime = timeAvailabilityMessage
      }
      if (customerInfo.deliverDifferentRecipient) {
        if (!customerInfo.recipientLastName.trim()) {
          nextErrors.recipientLastName = 'Please enter the recipient last name.'
        }
        if (!customerInfo.recipientFirstName.trim()) {
          nextErrors.recipientFirstName = 'Please enter the recipient first name.'
        }
        if (!customerInfo.recipientContact.trim()) {
          nextErrors.recipientContact = 'Please enter the recipient contact number.'
        } else if (!contactNumberPattern.test(customerInfo.recipientContact)) {
          nextErrors.recipientContact = 'Please enter an 11-digit recipient contact number.'
        }
      }
    }

    if (orderMethod === 'pickup') {
      if (!customerInfo.preferredPickupTime) {
        nextErrors.preferredPickupTime = 'Please select a pickup time.'
      } else if (!availability.isTimeAvailable(customerInfo.preferredPickupTime)) {
        nextErrors.preferredPickupTime = timeAvailabilityMessage
      }
    }

    return nextErrors
  }, [availability, customerInfo, orderMethod, preferredDate, timeAvailabilityMessage])

  const hasError = (field) => touched[field] && errors[field]

  const showError = (field) =>
    hasError(field) ? (
      <p className="cake-field-error">* {errors[field]}</p>
    ) : null

  const getValidationOrder = () => [
    'customerLastName',
    'customerFirstName',
    'contactNumber',
    'email',
    'preferredDate',
    ...(orderMethod === 'delivery'
      ? [
          'address',
          'preferredDeliveryTime',
          ...(customerInfo.deliverDifferentRecipient
            ? ['recipientLastName', 'recipientFirstName', 'recipientContact']
            : []),
        ]
      : []),
    ...(orderMethod === 'pickup' ? ['preferredPickupTime'] : []),
  ]

  const focusInvalidField = (field) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-validation-field="${field}"]`)
      if (!target) return

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const focusable = target.matches('input, textarea, select, button')
        ? target
        : target.querySelector('input, textarea, select, button')

      if (focusable) {
        window.setTimeout(() => focusable.focus({ preventScroll: true }), 280)
      }
    })
  }

  const buildRpcItems = (products) =>
    products.map((product) => ({
      product_id: product.productId || null,
      product_name: product.name,
      product_type: mapProductType(product.name),
      variant_name: product.variantName || null,
      quantity: product.quantity,
      unit_price: product.unitPrice,
      subtotal: product.lineTotal,
      customization_data: product.customizationData || null,
    }))

  const handlePayNow = async () => {
    if (isSubmittingOrder || guestPaymentStatus === 'success') {
      return
    }

    setOrderSubmissionError('')

    if (Object.keys(errors).length > 0) {
      setTouched((current) => {
        const invalidTouched = Object.keys(errors).reduce(
          (fields, field) => ({ ...fields, [field]: true }),
          {},
        )
        return { ...current, ...invalidTouched }
      })

      const firstInvalid = getValidationOrder().find((field) => errors[field])
      if (firstInvalid) focusInvalidField(firstInvalid)

      return
    }

    try {
      const latestAvailability = await availability.refresh()
      if (!availability.isDateAvailable(preferredDate, latestAvailability)) {
        setPreferredDate('')
        setTouched((current) => ({ ...current, preferredDate: true }))
        return
      }
      assertCanAcceptOrderForDate(preferredDate, latestAvailability)
    } catch {
      setPreferredDate('')
      setTouched((current) => ({ ...current, preferredDate: true }))
      return
    }

    setIsSubmittingOrder(true)

    try {
      const preferredTime =
        orderMethod === 'pickup'
          ? customerInfo.preferredPickupTime
          : customerInfo.preferredDeliveryTime
      const deliveryFee = 0
      const total = subtotal + deliveryFee
      const recipientName = customerInfo.deliverDifferentRecipient
        ? `${customerInfo.recipientFirstName} ${customerInfo.recipientLastName}`.trim()
        : null
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session || null

      let orderId = pendingOrderIdRef.current
      if (!orderId) {
        const rpcPayload = {
          p_customer_id: session?.user?.id || null,
          p_first_name: customerInfo.customerFirstName.trim(),
          p_last_name: customerInfo.customerLastName.trim(),
          p_contact_number: customerInfo.contactNumber,
          p_email: customerInfo.email.trim(),
          p_order_method: orderMethod,
          p_province: orderMethod === 'delivery' ? customerInfo.province.trim() || null : null,
          p_city_municipality: orderMethod === 'delivery' ? customerInfo.city.trim() || null : null,
          p_barangay: orderMethod === 'delivery' ? customerInfo.barangay.trim() || null : null,
          p_postal_code: orderMethod === 'delivery' ? postalCode || null : null,
          p_address: orderMethod === 'delivery' ? customerInfo.address.trim() || null : null,
          p_apartment_unit: orderMethod === 'delivery' ? customerInfo.apartment.trim() || null : null,
          p_landmark: orderMethod === 'delivery' ? customerInfo.landmark.trim() || null : null,
          p_different_recipient:
            orderMethod === 'delivery' ? customerInfo.deliverDifferentRecipient : false,
          p_recipient_name: orderMethod === 'delivery' ? recipientName : null,
          p_recipient_contact:
            orderMethod === 'delivery' && customerInfo.deliverDifferentRecipient
              ? customerInfo.recipientContact
              : null,
          p_preferred_date: preferredDate,
          p_preferred_time: preferredTime,
          p_subtotal: subtotal,
          p_delivery_fee: deliveryFee,
          p_total: total,
          p_payment_method: CART_ORDER_PAYMENT_METHOD,
          p_notes: '',
          p_items: buildRpcItems(cartProducts),
        }
        const { data: createdOrderId, error } = await supabase.rpc('create_order_safe', rpcPayload)

        if (error) {
          console.error('[CREATE ORDER RESPONSE]', {
            error: error.message || 'Unable to create order.',
            code: error.code ?? null,
            message: error.message ?? null,
          })
          setOrderSubmissionError(mapCreateOrderErrorMessage(error.message))
          return
        }

        orderId = createdOrderId
        if (!orderId || typeof orderId !== 'string') {
          console.error('[CREATE ORDER RESPONSE]', {
            error: 'Order creation returned no valid order ID.',
            code: 'INVALID_ORDER_ID',
            message: null,
          })
          setOrderSubmissionError(mapCreateOrderErrorMessage())
          return
        }
        pendingOrderIdRef.current = orderId
      }

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
        'create-cart-xendit-payment',
        {
          body: {
            orderId,
            ...(session?.access_token ? {} : { guestEmail: customerInfo.email.trim() }),
          },
          ...(session?.access_token
            ? { headers: { Authorization: `Bearer ${session.access_token}` } }
            : {}),
        },
      )

      if (paymentError) {
        console.error('[CREATE CART XENDIT PAYMENT RESPONSE]', await readSafeFunctionErrorBody(paymentError))
        throw paymentError
      }

      if (!paymentData?.paymentUrl || typeof paymentData.paymentUrl !== 'string') {
        console.error('[CREATE CART XENDIT PAYMENT RESPONSE]', paymentData || {
          error: 'Payment service returned no checkout URL.',
          error_code: null,
          message: null,
        })
        throw new Error('Payment service returned no checkout URL.')
      }

      if (!session?.access_token) {
        window.localStorage.setItem(
          CART_PAYMENT_RETURN_STORAGE_KEY,
          JSON.stringify({
            orderId,
            guestEmail: customerInfo.email.trim(),
            items: cartProducts.map((product) => ({
              name: product.name,
              quantity: product.quantity,
            })),
          }),
        )
      }

      window.location.assign(paymentData.paymentUrl)
    } catch (error) {
      console.error('[CREATE CART CHECKOUT]', error)
      setOrderSubmissionError(mapCreateOrderErrorMessage(error?.message))
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const handleCheckoutFormSubmit = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const cartProducts = Object.entries(items).map(([name, quantity]) => {
    const metadata = getCartItemMetadata(name)
    const metadataPrice = Number(metadata?.unitPrice)
    const unitPrice = Number.isFinite(metadataPrice)
      ? metadataPrice
      : PRODUCT_PRICES[name] ?? resolveSweetTreatsPrice(name) ?? 0
    const imageUrl =
      metadata?.image_url ||
      metadata?.imageUrl ||
      metadata?.image ||
      metadata?.productImage ||
      metadata?.thumbnail ||
      metadata?.customizationData?.imageUrl ||
      metadata?.customizationData?.image_url ||
      resolveFallbackImage(name)

    return {
      name,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      productId: metadata?.productId || null,
      variantId: metadata?.variantId || null,
      variantName: metadata?.variantName || null,
      customizationData: metadata?.customizationData || null,
      image_url: imageUrl,
      imageUrl,
    }
  })

  const subtotal = cartProducts.reduce((total, product) => total + product.lineTotal, 0)

  const changeQuantity = (productName, delta) => {
    setCartQuantity(productName, (items[productName] ?? 1) + delta)
  }

  return (
    <div className="page-shell cart-page-shell">
      <SiteTopbar
        forceScrolled
        homeHref="/"
        locationHref="/#location"
        contactHref="#contact"
        onNavigate={onNavigate}
        onCustomerLogout={onCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <main className="cart-main">
        <div className="cart-container">
          <div className="cart-layout">
            <section className="cart-details" aria-label="Order details">
              <form className="cart-form" onSubmit={handleCheckoutFormSubmit}>
                <CakeAvailabilityCalendar
                  selectedDate={preferredDate}
                  onDateChange={setPreferredDate}
                  validationError={hasError('preferredDate') ? errors.preferredDate : ''}
                />

                <fieldset className="cake-option-group cake-customer-section cart-section">
                  <legend>Personal Information</legend>
                  <div className="cake-field-row">
                    <label className="cake-field">
                      <span>Last Name *</span>
                      <input
                        className="cake-text-input"
                        data-validation-field="customerLastName"
                        aria-invalid={hasError('customerLastName') ? 'true' : undefined}
                        type="text"
                        placeholder="Enter last name"
                        value={customerInfo.customerLastName}
                        onBlur={() => markTouched('customerLastName')}
                        onChange={(event) => updateInfo('customerLastName', event.target.value)}
                      />
                      {showError('customerLastName')}
                    </label>
                    <label className="cake-field">
                      <span>First Name *</span>
                      <input
                        className="cake-text-input"
                        data-validation-field="customerFirstName"
                        aria-invalid={hasError('customerFirstName') ? 'true' : undefined}
                        type="text"
                        placeholder="Enter first name"
                        value={customerInfo.customerFirstName}
                        onBlur={() => markTouched('customerFirstName')}
                        onChange={(event) => updateInfo('customerFirstName', event.target.value)}
                      />
                      {showError('customerFirstName')}
                    </label>
                  </div>
                  <div className="cake-field-row">
                    <label className="cake-field">
                      <span>Contact Number *</span>
                      <input
                        className="cake-text-input"
                        data-validation-field="contactNumber"
                        aria-invalid={hasError('contactNumber') ? 'true' : undefined}
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        pattern="\d{11}"
                        placeholder="09123456789"
                        value={customerInfo.contactNumber}
                        onBlur={() => markTouched('contactNumber')}
                        onChange={(event) => updateInfo('contactNumber', event.target.value)}
                      />
                      {showError('contactNumber')}
                    </label>
                    <label className="cake-field">
                      <span>Email Address *</span>
                      <input
                        className="cake-text-input"
                        data-validation-field="email"
                        aria-invalid={hasError('email') ? 'true' : undefined}
                        type="email"
                        placeholder="example@email.com"
                        value={customerInfo.email}
                        onBlur={() => markTouched('email')}
                        onChange={(event) => updateInfo('email', event.target.value)}
                      />
                      {showError('email')}
                    </label>
                  </div>
                </fieldset>

                <fieldset className="cake-option-group cake-customer-section cart-section">
                  <legend>Order Method *</legend>
                  <p className="cake-option-description">
                    Choose how you&apos;d like to receive your order.
                  </p>
                  <div className="cake-order-method-toggle">
                    {ORDER_METHODS.map((method) => (
                      <label
                        key={method.value}
                        className={`cake-order-method-option${
                          orderMethod === method.value ? ' cake-order-method-option--selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="orderMethod"
                          value={method.value}
                          checked={orderMethod === method.value}
                          onChange={() => setOrderMethod(method.value)}
                        />
                        <span className="cake-order-method-heading">
                          <span className="cake-order-method-icon" aria-hidden="true">
                            {method.value === 'delivery' ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M3 7.5h11v9H3v-9ZM14 10h3.5l2.5 3v3.5h-6V10ZM6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M12 21s6-5.15 6-11A6 6 0 0 0 6 10c0 5.85 6 11 6 11ZM12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="cake-order-method-title">{method.title}</span>
                        </span>
                        <span className="cake-order-method-description">{method.description}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {orderMethod === 'pickup' ? (
<fieldset className="cake-option-group cake-customer-section cart-section">
                  <legend>Pickup Details</legend>
                    <label className="cake-field">
                      <span>Preferred Pickup Time *</span>
                      <WheelTimePicker
                        value={customerInfo.preferredPickupTime}
                        onChange={(timeValue) => updateInfo('preferredPickupTime', timeValue)}
                        placeholder="Select your preferred time"
                        dataValidationField="preferredPickupTime"
                        invalid={hasError('preferredPickupTime')}
                        onBlur={() => markTouched('preferredPickupTime')}
                        minTime={availability.serviceStart}
                        maxTime={availability.serviceEnd}
                      />
                      <small>Available time: {serviceHoursLabel}</small>
                      {showError('preferredPickupTime')}
                    </label>
                  </fieldset>
                ) : null}

                {orderMethod === 'delivery' ? (
<fieldset className="cake-option-group cake-customer-section cart-section">
                  <legend>Delivery Details</legend>
                    <label className="cake-field">
                      <span>Province</span>
                      <AutocompleteTextInput
                        options={provinceOptions}
                        value={customerInfo.province}
                        placeholder="Enter province"
                        onChange={(value) => updateDeliveryField('province', value)}
                        onSelect={selectProvince}
                      />
                    </label>
                    <div className="cake-field-row">
                      <label className="cake-field">
                        <span>City / Municipality</span>
                        <AutocompleteTextInput
                          options={cityOptions.map((city) => city.name)}
                          value={customerInfo.city}
                          placeholder="Enter city or municipality"
                          onChange={(value) => updateDeliveryField('city', value)}
                          onSelect={selectCity}
                        />
                      </label>
                      <label className="cake-field">
                        <span>Barangay</span>
                        <AutocompleteTextInput
                          options={barangayOptions}
                          value={customerInfo.barangay}
                          placeholder="Enter barangay"
                          onChange={(value) => updateDeliveryField('barangay', value)}
                        />
                      </label>
                    </div>
                    <label className="cake-field">
                      <span>Postal Code</span>
                      <input
                        className="cake-text-input cart-postal-code"
                        type="text"
                        readOnly
                        placeholder="Enter postal code"
                        value={postalCode}
                      />
                    </label>
                    <label className="cake-field">
                      <span>Address *</span>
                      <input
                        className="cake-text-input"
                        data-validation-field="address"
                        aria-invalid={hasError('address') ? 'true' : undefined}
                        type="text"
                        placeholder="House No., Street, Subdivision"
                        value={customerInfo.address}
                        onBlur={() => markTouched('address')}
                        onChange={(event) => updateInfo('address', event.target.value)}
                      />
                      {showError('address')}
                    </label>
                    <label className="cake-field">
                      <span>Apartment / Suite / Unit {optionalLabel}</span>
                      <input
                        className="cake-text-input"
                        type="text"
                        placeholder="e.g., Unit 3B, Building 2, Block 4 Lot 6"
                        value={customerInfo.apartment}
                        onChange={(event) => updateInfo('apartment', event.target.value)}
                      />
                    </label>
                    <label className="cake-field">
                      <span>Landmark {optionalLabel}</span>
                      <input
                        className="cake-text-input"
                        type="text"
                        placeholder="Nearby landmark or delivery instructions"
                        value={customerInfo.landmark}
                        onChange={(event) => updateInfo('landmark', event.target.value)}
                      />
                    </label>
                    <label className="cake-field">
                      <span>Preferred Delivery Time *</span>
                      <WheelTimePicker
                        value={customerInfo.preferredDeliveryTime}
                        onChange={(timeValue) =>
                          updateInfo('preferredDeliveryTime', timeValue)
                        }
                        placeholder="Select your preferred time"
                        dataValidationField="preferredDeliveryTime"
                        invalid={hasError('preferredDeliveryTime')}
                        onBlur={() => markTouched('preferredDeliveryTime')}
                        minTime={availability.serviceStart}
                        maxTime={availability.serviceEnd}
                      />
                      <small>Available time: {serviceHoursLabel}</small>
                      {showError('preferredDeliveryTime')}
                    </label>
                    <div className="cake-agreement cake-recipient-toggle">
                      <input
                        type="checkbox"
                        aria-label="Deliver to a different recipient"
                        checked={customerInfo.deliverDifferentRecipient}
                        onChange={(event) =>
                          updateInfo('deliverDifferentRecipient', event.target.checked)
                        }
                      />
                      <span>Deliver to a Different Recipient</span>
                    </div>
                    {customerInfo.deliverDifferentRecipient ? (
                      <div className="cake-recipient-fields">
                        <h3>Recipient Information</h3>
                        <div className="cake-field-row">
                          <label className="cake-field">
                            <span>Recipient Last Name *</span>
                            <input
                              className="cake-text-input"
                              data-validation-field="recipientLastName"
                              aria-invalid={hasError('recipientLastName') ? 'true' : undefined}
                              type="text"
                              placeholder="Enter last name"
                              value={customerInfo.recipientLastName}
                              onBlur={() => markTouched('recipientLastName')}
                              onChange={(event) =>
                                updateInfo('recipientLastName', event.target.value)
                              }
                            />
                            {showError('recipientLastName')}
                          </label>
                          <label className="cake-field">
                            <span>Recipient First Name *</span>
                            <input
                              className="cake-text-input"
                              data-validation-field="recipientFirstName"
                              aria-invalid={hasError('recipientFirstName') ? 'true' : undefined}
                              type="text"
                              placeholder="Enter first name"
                              value={customerInfo.recipientFirstName}
                              onBlur={() => markTouched('recipientFirstName')}
                              onChange={(event) =>
                                updateInfo('recipientFirstName', event.target.value)
                              }
                            />
                            {showError('recipientFirstName')}
                          </label>
                        </div>
                        <label className="cake-field">
                          <span>Recipient Contact Number *</span>
                          <input
                            className="cake-text-input"
                            data-validation-field="recipientContact"
                            aria-invalid={hasError('recipientContact') ? 'true' : undefined}
                            type="tel"
                            inputMode="numeric"
                            maxLength={11}
                            pattern="\d{11}"
                            placeholder="09123456789"
                            value={customerInfo.recipientContact}
                            onBlur={() => markTouched('recipientContact')}
                            onChange={(event) =>
                              updateInfo('recipientContact', event.target.value)
                            }
                          />
                          {showError('recipientContact')}
                        </label>
                      </div>
                    ) : null}
                  </fieldset>
                ) : null}

                <div className="cart-checkout-actions">
                  {!isCustomerAuthenticated && guestPaymentStatus === 'success' && !guestPaymentVerified && !guestPaymentTimedOut ? (
                    <p className="cart-payment-placeholder cart-payment-success" role="status">
                      Confirming your payment...
                    </p>
                  ) : null}
                  {!isCustomerAuthenticated && guestPaymentStatus === 'success' && guestPaymentTimedOut ? (
                    <p className="cart-payment-placeholder" role="status">
                      Your payment is still being confirmed. Please check again shortly.
                    </p>
                  ) : null}
                  {!isCustomerAuthenticated && guestPaymentStatus === 'cancelled' ? (
                    <p className="cart-payment-placeholder" role="status">
                      Payment was not completed. Your cart is still available if you&apos;d like to try again.
                    </p>
                  ) : null}
                  {/*
                    This is a UI placeholder — no payment will be processed.
                  */}
                  <button
                    className="cart-pay-button"
                    type="button"
                    onClick={handlePayNow}
                    disabled={isSubmittingOrder || guestPaymentStatus === 'success'}
                  >
                    {isSubmittingOrder ? 'Processing...' : 'Pay Now'}
                  </button>
                  {orderSubmissionError ? (
                    <p className="cake-field-error">* {orderSubmissionError}</p>
                  ) : null}
                  {/*
                    <p className="cart-payment-placeholder cart-payment-success">
                      Your order details are ready — online payment integration is
                      coming soon.
                    </p>
                  */}
                </div>
              </form>
            </section>

            <aside className="cart-summary-pane" aria-label="Order summary">
              <div className="cart-summary-content">
                <h2>Order Summary</h2>

                <div className="cart-summary-items">
                {cartProducts.length === 0 ? (
                  <p className="cart-summary-empty">Your cart is empty.</p>
                ) : (
                  cartProducts.map((product) => (
                    <div className="cart-summary-item" key={product.name}>
                      <CartSummaryThumb product={product} />
                      <div className="cart-summary-info">
                        <span className="cart-summary-name">{product.name}</span>
                        <div className="cart-qty" role="group" aria-label="Amount">
                          <button
                            type="button"
                            className="cart-qty-btn"
                            aria-label={
                              product.quantity === 1
                                ? `Remove ${product.name}`
                                : 'Decrease'
                            }
                            onClick={() =>
                              product.quantity === 1
                                ? removeFromCart(product.name)
                                : changeQuantity(product.name, -1)
                            }
                          >
                            {product.quantity === 1 ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            ) : (
                              '−'
                            )}
                          </button>
                          <span className="cart-qty-value">{product.quantity}</span>
                          <button
                            type="button"
                            className="cart-qty-btn"
                            aria-label="Increase"
                            onClick={() => changeQuantity(product.name, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <span className="cart-summary-line-total">
                        {formatPrice(product.lineTotal)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="cart-price-summary">
                <div className="cart-price-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="cart-price-row">
                  <span>Delivery Fee</span>
                  <span>{orderMethod === 'pickup' ? 'FREE' : 'To be calculated'}</span>
                </div>
                <div className="cart-total-row">
                  <span>Total</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
              </div>
                </div>
            </aside>
          </div>
        </div>
      </main>
      {guestPaymentVerified ? (
        <OrderRequestSuccessModal
          request={{}}
          title="Payment Successful"
          description="Your payment has been received successfully. Your order has been placed and is now being processed."
          primaryLabel="Continue Shopping"
          onClose={() => setGuestPaymentVerified(false)}
          onPrimary={() => {
            setGuestPaymentVerified(false)
            onNavigate?.('/')
          }}
        />
      ) : null}
    </div>
  )
}

export default CartPage
