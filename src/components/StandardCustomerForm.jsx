import { useMemo, useState } from 'react'
import PersonalInformationFields from './PersonalInformationFields.jsx'
import OrderMethodSection from './OrderMethodSection.jsx'
import { useAvailability } from '../hooks/useAvailability.js'
import { useCustomerProfileAutofill } from '../hooks/useCustomerProfileAutofill.js'

const contactNumberPattern = /^\d{11}$/

const normalizeContactNumber = (value) => value.replace(/\D/g, '').slice(0, 11)

function StandardCustomerForm({
  title,
  description,
  details,
  onDetailsChange,
  validationTouched = {},
  onValidationTouchedChange,
  onBack,
  onContinue,
  autofillReady = true,
}) {
  useCustomerProfileAutofill({
    onDetailsChange,
    ready: autofillReady,
  })
  const availability = useAvailability()
  const timeAvailabilityMessage = availability.serviceHoursLabel
    ? `Please select a time between ${availability.serviceHoursLabel}.`
    : 'Available times are temporarily unavailable. Please try again shortly.'
  const [localTouched, setLocalTouched] = useState({})
  const touched = { ...localTouched, ...validationTouched }

  const updateDetail = (field, value) => {
    const nextValue =
      field === 'contactNumber' || field === 'recipientContact'
        ? normalizeContactNumber(value)
        : value

    onDetailsChange((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === 'customerFirstName' || field === 'customerLastName'
        ? {
            fullName:
              field === 'customerFirstName'
                ? `${nextValue} ${current.customerLastName ?? ''}`.trim()
                : `${current.customerFirstName ?? ''} ${nextValue}`.trim(),
          }
        : {}),
      ...(field === 'fulfillment' && value === 'pickup'
        ? {
            deliverDifferentRecipient: false,
            recipientFirstName: '',
            recipientLastName: '',
            recipientContact: '',
            deliveryAddress: '',
            address: '',
            apartment: '',
            landmark: '',
            preferredDeliveryTime: '',
          }
        : {}),
      ...(field === 'fulfillment' && value === 'delivery' ? { preferredPickupTime: '' } : {}),
      ...(field === 'deliverDifferentRecipient' && !value
        ? { recipientFirstName: '', recipientLastName: '', recipientContact: '' }
        : {}),
    }))
  }

  const markTouched = (field) => {
    setLocalTouched((current) => ({ ...current, [field]: true }))
  }

  const errors = useMemo(() => {
    const nextErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!details.customerLastName?.trim()) nextErrors.customerLastName = 'Please enter your last name.'
    if (!details.customerFirstName?.trim()) nextErrors.customerFirstName = 'Please enter your first name.'
    if (!details.contactNumber?.trim()) {
      nextErrors.contactNumber = 'Please enter your contact number.'
    } else if (!contactNumberPattern.test(details.contactNumber)) {
      nextErrors.contactNumber = 'Please enter an 11-digit contact number.'
    }
    if (!details.email?.trim() || !emailPattern.test(details.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.'
    }
    if (!details.fulfillment) nextErrors.fulfillment = 'Please select Pickup or Delivery.'
    if (availability.loading) {
      nextErrors.preferredDate = 'Available dates are still loading. Please wait a moment.'
    } else if (availability.error || !availability.settings) {
      nextErrors.preferredDate = 'Available dates are temporarily unavailable. Please try again shortly.'
    } else if (!details.preferredDate || !availability.isDateAvailable(details.preferredDate)) {
      nextErrors.preferredDate = 'Please select an available date.'
    }

    if (details.fulfillment === 'pickup') {
      if (!details.preferredPickupTime) {
        nextErrors.preferredPickupTime = 'Please select a pickup time.'
      } else if (!availability.isTimeAvailable(details.preferredPickupTime)) {
        nextErrors.preferredPickupTime = timeAvailabilityMessage
      }
    }

    if (details.fulfillment === 'delivery') {
      if (!details.address?.trim()) nextErrors.address = 'Please enter a delivery address.'
      if (!details.preferredDeliveryTime) {
        nextErrors.preferredDeliveryTime = 'Please select a delivery time.'
      } else if (!availability.isTimeAvailable(details.preferredDeliveryTime)) {
        nextErrors.preferredDeliveryTime = timeAvailabilityMessage
      }
      if (details.deliverDifferentRecipient) {
        if (!details.recipientLastName?.trim()) {
          nextErrors.recipientLastName = 'Please enter the recipient last name.'
        }
        if (!details.recipientFirstName?.trim()) {
          nextErrors.recipientFirstName = 'Please enter the recipient first name.'
        }
        if (!details.recipientContact?.trim()) {
          nextErrors.recipientContact = 'Please enter the recipient contact number.'
        } else if (!contactNumberPattern.test(details.recipientContact)) {
          nextErrors.recipientContact = 'Please enter an 11-digit recipient contact number.'
        }
      }
    }

    if (!details.agreement) {
      nextErrors.agreement = 'Please confirm that you understand the review process.'
    }

    return nextErrors
  }, [availability, details, timeAvailabilityMessage])

  const hasError = (field) => touched[field] && errors[field]
  const showError = (field) =>
    hasError(field) ? <p className="cake-field-error">* {errors[field]}</p> : null

  const getValidationOrder = () => [
    'customerLastName',
    'customerFirstName',
    'contactNumber',
    'email',
    'fulfillment',
    'preferredDate',
    ...(details.fulfillment === 'delivery'
      ? [
          'address',
          'preferredDeliveryTime',
          ...(details.deliverDifferentRecipient
            ? ['recipientLastName', 'recipientFirstName', 'recipientContact']
            : []),
        ]
      : []),
    ...(details.fulfillment === 'pickup' ? ['preferredPickupTime'] : []),
    'agreement',
  ]

  const focusInvalidField = (field) => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-validation-field="${field}"]`)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const focusTarget = target.matches('input, textarea, select, button')
        ? target
        : target.querySelector('input, textarea, select, button')
      if (focusTarget) window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 280)
    })
  }

  const handleContinue = () => {
    if (Object.keys(errors).length === 0) {
      onContinue()
      return
    }
    const invalidTouched = Object.keys(errors).reduce(
      (fields, field) => ({ ...fields, [field]: true }),
      {},
    )
    setLocalTouched((current) => ({ ...current, ...invalidTouched }))
    onValidationTouchedChange((current) => ({ ...current, ...invalidTouched }))
    const firstInvalid = getValidationOrder().find((field) => errors[field])
    if (firstInvalid) focusInvalidField(firstInvalid)
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <section className="cake-base-form cake-customer-form" aria-labelledby="customer-info-title">
      <div className="cake-form-heading">
        <h2 id="customer-info-title">{title}</h2>
        <p>{description}</p>
      </div>
      <form onSubmit={handleFormSubmit}>
        <PersonalInformationFields
          details={details}
          onChange={updateDetail}
          hasError={hasError}
          showError={showError}
          markTouched={markTouched}
        />
        <OrderMethodSection
          method={details.fulfillment}
          details={details}
          onMethodChange={(value) => updateDetail('fulfillment', value)}
          onDetailsChange={onDetailsChange}
          hasError={hasError}
          showError={showError}
          markTouched={markTouched}
          methodValidationField="fulfillment"
          methodError={errors.fulfillment}
        />
        {showError('preferredDate')}
        <div
          className="cake-agreement"
          data-validation-field="agreement"
          aria-invalid={hasError('agreement') ? 'true' : undefined}
        >
          <input
            type="checkbox"
            aria-label="Confirm that you understand the Sweet Bakes review process"
            checked={details.agreement ?? false}
            onChange={(event) => updateDetail('agreement', event.target.checked)}
          />
          <span>I understand that my order will be reviewed before confirmation.</span>
        </div>
        {showError('agreement')}
      </form>
      <div className="cake-form-actions">
        <button className="cake-continue-button cake-back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">&larr;</span>
          <span>Back</span>
        </button>
        <button className="cake-continue-button" type="button" onClick={handleContinue}>
          <span>Continue</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </section>
  )
}

export default StandardCustomerForm
