import { useMemo, useState } from 'react'

const orderMethods = [
  {
    title: 'Delivery',
    value: 'delivery',
    description: 'In-house delivery',
  },
  {
    title: 'Store Pickup',
    value: 'pickup',
    description: 'Pick up at our bakery',
  },
]

const optionalLabel = <span className="cake-optional-label">Optional</span>
const contactNumberPattern = /^\d{11}$/
const contactNumberFields = new Set(['contactNumber', 'recipientContact'])

const normalizeContactNumber = (value) => value.replace(/\D/g, '').slice(0, 11)

function CupcakeCustomerForm({
  customerInfo,
  onCustomerInfoChange,
  validationTouched = {},
  onValidationTouchedChange,
  onBack,
  onContinue,
}) {
  const [localTouched, setLocalTouched] = useState({})
  const touched = {
    ...localTouched,
    ...validationTouched,
  }

  const updateInfo = (field, value) => {
    const nextValue = contactNumberFields.has(field) ? normalizeContactNumber(value) : value

    onCustomerInfoChange((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === 'fulfillment' && value === 'pickup'
        ? {
            deliverDifferentRecipient: false,
            recipientFirstName: '',
            recipientLastName: '',
            recipientContact: '',
            deliveryAddress: '',
            landmark: '',
            preferredDeliveryTime: '',
          }
        : {}),
      ...(field === 'fulfillment' && value === 'delivery'
        ? {
            preferredPickupTime: '',
          }
        : {}),
      ...(field === 'deliverDifferentRecipient' && !value
        ? {
            recipientFirstName: '',
            recipientLastName: '',
            recipientContact: '',
          }
        : {}),
    }))
  }

  const markTouched = (field) => {
    setLocalTouched((current) => ({
      ...current,
      [field]: true,
    }))
  }

  const errors = useMemo(() => {
    const nextErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!customerInfo.fullName.trim()) {
      nextErrors.fullName = 'Please enter your full name.'
    }

    if (!customerInfo.contactNumber.trim()) {
      nextErrors.contactNumber = 'Please enter your contact number.'
    } else if (!contactNumberPattern.test(customerInfo.contactNumber)) {
      nextErrors.contactNumber = 'Please enter an 11-digit contact number.'
    }

    if (!customerInfo.email.trim() || !emailPattern.test(customerInfo.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (!customerInfo.fulfillment) {
      nextErrors.fulfillment = 'Please select Pickup or Delivery.'
    }

    if (!customerInfo.preferredDate) {
      nextErrors.preferredDate = 'Please select an available date.'
    }

    if (customerInfo.fulfillment === 'pickup' && !customerInfo.preferredPickupTime) {
      nextErrors.preferredPickupTime = 'Please select a pickup time.'
    }

    if (customerInfo.fulfillment === 'delivery') {
      if (!customerInfo.deliveryAddress.trim()) {
        nextErrors.deliveryAddress = 'Please enter a delivery address.'
      }
      if (!customerInfo.preferredDeliveryTime) {
        nextErrors.preferredDeliveryTime = 'Please select a delivery time.'
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

    if (!customerInfo.agreement) {
      nextErrors.agreement = 'Please confirm that you understand the review process.'
    }

    return nextErrors
  }, [customerInfo])

  const isComplete = Object.keys(errors).length === 0
  const hasError = (field) => touched[field] && errors[field]

  const showError = (field) =>
    hasError(field) ? (
      <p className="cake-field-error">* {errors[field]}</p>
    ) : null

  const getValidationOrder = () => [
    'fullName',
    'contactNumber',
    'email',
    'fulfillment',
    'preferredDate',
    ...(customerInfo.fulfillment === 'delivery'
      ? [
          'deliveryAddress',
          'preferredDeliveryTime',
          ...(customerInfo.deliverDifferentRecipient
            ? ['recipientLastName', 'recipientFirstName', 'recipientContact']
            : []),
        ]
      : []),
    ...(customerInfo.fulfillment === 'pickup' ? ['preferredPickupTime'] : []),
    'agreement',
  ]

  const focusInvalidField = (field) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-validation-field="${field}"]`)

      if (!target) {
        return
      }

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      const focusTarget = target.matches('input, textarea, select, button')
        ? target
        : target.querySelector('input, textarea, select, button')

      if (focusTarget) {
        window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 280)
      }
    })
  }

  const handleContinue = () => {
    if (isComplete) {
      onContinue()
      return
    }

    const firstInvalidField = getValidationOrder().find((field) => errors[field])

    if (!firstInvalidField) {
      return
    }

    const invalidTouched = Object.keys(errors).reduce(
      (fields, field) => ({
        ...fields,
        [field]: true,
      }),
      {},
    )

    setLocalTouched((current) => ({
      ...current,
      ...invalidTouched,
    }))
    onValidationTouchedChange((current) => ({
      ...current,
      ...invalidTouched,
    }))
    focusInvalidField(firstInvalidField)
  }

  return (
    <section className="cake-base-form cake-customer-form" aria-labelledby="customer-info-title">
      <div className="cake-form-heading">
        <h2 id="customer-info-title">Customer Information</h2>
        <p>
          Tell us how we can contact you and when you&apos;d like to receive your cupcake order.
        </p>
      </div>

      <form>
        <fieldset className="cake-option-group cake-customer-section">
          <legend>Personal Information</legend>
          <label className="cake-field">
            <span>Full Name *</span>
            <input
              className="cake-text-input"
              data-validation-field="fullName"
              aria-invalid={hasError('fullName') ? 'true' : undefined}
              type="text"
              placeholder="Enter full name"
              value={customerInfo.fullName}
              onBlur={() => markTouched('fullName')}
              onChange={(event) => updateInfo('fullName', event.target.value)}
            />
            {showError('fullName')}
          </label>
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
        </fieldset>

        <fieldset className="cake-option-group cake-customer-section">
          <legend>Order Method *</legend>
          <p className="cake-option-description">
            Choose how you&apos;d like to receive your cupcake order.
          </p>
          <div
            className="cake-order-method-toggle"
            data-validation-field="fulfillment"
            aria-invalid={hasError('fulfillment') ? 'true' : undefined}
          >
            {orderMethods.map((method) => (
              <label
                className={`cake-order-method-option${
                  customerInfo.fulfillment === method.value
                    ? ' cake-order-method-option--selected'
                    : ''
                }`}
                key={method.value}
              >
                <input
                  type="radio"
                  name="cupcake-fulfillment"
                  value={method.value}
                  checked={customerInfo.fulfillment === method.value}
                  onBlur={() => markTouched('fulfillment')}
                  onChange={() => updateInfo('fulfillment', method.value)}
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
          {showError('fulfillment')}
        </fieldset>

        {customerInfo.fulfillment === 'pickup' ? (
          <fieldset className="cake-option-group cake-customer-section">
            <legend>Pickup Schedule</legend>
            <label className="cake-field">
              <span>Preferred Pickup Time *</span>
              <input
                className="cake-text-input"
                data-validation-field="preferredPickupTime"
                aria-invalid={hasError('preferredPickupTime') ? 'true' : undefined}
                type="time"
                placeholder="Select your preferred time"
                value={customerInfo.preferredPickupTime}
                onBlur={() => markTouched('preferredPickupTime')}
                onChange={(event) => updateInfo('preferredPickupTime', event.target.value)}
              />
              {showError('preferredPickupTime')}
            </label>
          </fieldset>
        ) : null}

        {customerInfo.fulfillment === 'delivery' ? (
          <fieldset className="cake-option-group cake-customer-section">
            <legend>Delivery Details</legend>
            <label className="cake-field">
              <span>Delivery Address *</span>
              <textarea
                className="cake-textarea"
                data-validation-field="deliveryAddress"
                aria-invalid={hasError('deliveryAddress') ? 'true' : undefined}
                placeholder="House No., Street, Barangay, City"
                value={customerInfo.deliveryAddress}
                onBlur={() => markTouched('deliveryAddress')}
                onChange={(event) => updateInfo('deliveryAddress', event.target.value)}
              />
              {showError('deliveryAddress')}
            </label>
            <label className="cake-field">
              <span>Landmark {optionalLabel}</span>
              <input
                className="cake-text-input"
                type="text"
                placeholder="Nearby establishment or landmark"
                value={customerInfo.landmark}
                onChange={(event) => updateInfo('landmark', event.target.value)}
              />
            </label>
            <label className="cake-field">
              <span>Preferred Delivery Time *</span>
              <input
                className="cake-text-input"
                data-validation-field="preferredDeliveryTime"
                aria-invalid={hasError('preferredDeliveryTime') ? 'true' : undefined}
                type="time"
                placeholder="Select your preferred time"
                value={customerInfo.preferredDeliveryTime}
                onBlur={() => markTouched('preferredDeliveryTime')}
                onChange={(event) => updateInfo('preferredDeliveryTime', event.target.value)}
              />
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
              <span>Deliver to a different recipient</span>
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
                      onChange={(event) => updateInfo('recipientLastName', event.target.value)}
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
                      onChange={(event) => updateInfo('recipientFirstName', event.target.value)}
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
                    onChange={(event) => updateInfo('recipientContact', event.target.value)}
                  />
                  {showError('recipientContact')}
                </label>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="cake-option-group">
          <legend>Additional Contact</legend>
          <label className="cake-field">
            <span>Facebook / Messenger Name {optionalLabel}</span>
            <small>
              You may provide your Facebook name if you prefer to receive order updates through
              Messenger.
            </small>
            <input
              className="cake-text-input"
              type="text"
              placeholder="Enter your Facebook or Messenger name"
              value={customerInfo.messengerName}
              onChange={(event) => updateInfo('messengerName', event.target.value)}
            />
          </label>
        </fieldset>

        <div
          className="cake-agreement"
          data-validation-field="agreement"
          aria-invalid={hasError('agreement') ? 'true' : undefined}
        >
          <input
            type="checkbox"
            aria-label="Confirm that you understand the Sweet Bakes review process"
            checked={customerInfo.agreement}
            onBlur={() => markTouched('agreement')}
            onChange={(event) => updateInfo('agreement', event.target.checked)}
          />
          <span>
            I understand that the final price will be provided after Sweet Bakes reviews my
            customization request.
          </span>
        </div>
        {showError('agreement')}

        <div className="cake-form-actions">
          <button
            className="cake-continue-button cake-back-button"
            type="button"
            onClick={onBack}
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back</span>
          </button>
          <button
            className="cake-continue-button"
            type="button"
            onClick={handleContinue}
          >
            <span>Continue</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>
    </section>
  )
}

export default CupcakeCustomerForm
