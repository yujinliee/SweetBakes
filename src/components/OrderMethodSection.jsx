import { useState } from 'react'
import AutocompleteTextInput from '../cartpage/components/AutocompleteTextInput'
import addressData from '../cartpage/data/philippineAddressData'
import WheelTimePicker from '../components/WheelTimePicker'
import { useAvailability } from '../hooks/useAvailability.js'

const ORDER_METHODS = [
  { value: 'delivery', title: 'Delivery', description: 'In-house delivery' },
  { value: 'pickup', title: 'Store Pickup', description: 'Pick up at our bakery' },
]

const optionalLabel = <span className="cake-optional-label">Optional</span>

function OrderMethodSection({
  method,
  details,
  onMethodChange,
  onDetailsChange,
  hasError,
  showError,
  markTouched,
  methodValidationField,
  methodError,
  className = 'cake-option-group cake-customer-section',
}) {
  const availability = useAvailability()
  const serviceHoursLabel = availability.serviceHoursLabel || 'Loading...'
  const [selectedProvince, setSelectedProvince] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)

  const provinceOptions = addressData.map((province) => province.province)
  const exactProvince = addressData.find(
    (province) =>
      province.province.toLowerCase() === (details?.province ?? '').trim().toLowerCase(),
  )
  const provinceSelection = selectedProvince ?? exactProvince ?? null
  const cityOptions = provinceSelection?.cities ?? []
  const exactCity = cityOptions.find(
    (city) =>
      city.name.toLowerCase() === (details?.city ?? '').trim().toLowerCase(),
  )
  const citySelection = selectedCity ?? exactCity ?? null
  const barangayOptions = citySelection?.barangays ?? []
  const postalCode = citySelection?.postalCode ?? ''

  const handleDetailsChange = (field, value) => {
    let next = {}
    const normalizedValue =
      field === 'recipientContact'
        ? value.replace(/\D/g, '').slice(0, 11)
        : value

    next[field] = normalizedValue

    if (field === 'address') {
      next.deliveryAddress = normalizedValue
    }

    if (field === 'province') {
      next.city = ''
      next.barangay = ''
      setSelectedCity(null)
    }

    if (field === 'city') {
      next.barangay = ''
      setSelectedCity(null)
    }

    onDetailsChange((current) => ({
      ...current,
      ...next,
    }))
  }

  const selectProvince = (value) => {
    setSelectedProvince(addressData.find((province) => province.province === value) ?? null)
    setSelectedCity(null)
    onDetailsChange((current) => ({
      ...current,
      province: value,
      city: '',
      barangay: '',
    }))
  }

  const selectCity = (value) => {
    setSelectedCity(cityOptions.find((city) => city.name === value) ?? null)
    onDetailsChange((current) => ({
      ...current,
      city: value,
      barangay: '',
    }))
  }

  return (
    <>
      <fieldset className={className}>
        <legend>Order Method *</legend>
        <p className="cake-option-description">Choose how you'd like to receive your order.</p>
        <div
          className="cake-order-method-toggle"
          data-validation-field={methodValidationField}
          aria-invalid={methodError ? 'true' : undefined}
        >
          {ORDER_METHODS.map((m) => (
            <label
              key={m.value}
              className={`cake-order-method-option${
                method === m.value ? ' cake-order-method-option--selected' : ''
              }`}
            >
              <input
                type="radio"
                name="orderMethod"
                value={m.value}
                checked={method === m.value}
                onChange={() => onMethodChange(m.value)}
                onBlur={() => methodValidationField && markTouched(methodValidationField)}
              />
              <span className="cake-order-method-heading">
                <span className="cake-order-method-icon" aria-hidden="true">
                  {m.value === 'delivery' ? (
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
                <span className="cake-order-method-title">{m.title}</span>
              </span>
              <span className="cake-order-method-description">{m.description}</span>
            </label>
          ))}
        </div>
        {methodError ? <p className="cake-field-error">* {methodError}</p> : null}
      </fieldset>

      {method === 'pickup' ? (
        <fieldset className={className}>
          <legend>Pickup Details</legend>
          <label className="cake-field">
            <span>Preferred Pickup Time *</span>
            <WheelTimePicker
              value={details?.preferredPickupTime ?? ''}
              onChange={(timeValue) => handleDetailsChange('preferredPickupTime', timeValue)}
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

      {method === 'delivery' ? (
        <fieldset className={className}>
          <legend>Delivery Details</legend>
          <label className="cake-field">
            <span>Province</span>
            <AutocompleteTextInput
              options={provinceOptions}
              value={details?.province ?? ''}
              placeholder="Enter province"
              onChange={(value) => handleDetailsChange('province', value)}
              onSelect={selectProvince}
            />
          </label>
          <div className="cake-field-row">
            <label className="cake-field">
              <span>City / Municipality</span>
              <AutocompleteTextInput
                options={cityOptions.map((city) => city.name)}
                value={details?.city ?? ''}
                placeholder="Enter city or municipality"
                onChange={(value) => handleDetailsChange('city', value)}
                onSelect={selectCity}
              />
            </label>
            <label className="cake-field">
              <span>Barangay</span>
              <AutocompleteTextInput
                options={barangayOptions}
                value={details?.barangay ?? ''}
                placeholder="Enter barangay"
                onChange={(value) => handleDetailsChange('barangay', value)}
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
              value={details?.address ?? ''}
              onBlur={() => markTouched('address')}
              onChange={(event) => handleDetailsChange('address', event.target.value)}
            />
            {showError('address')}
          </label>
          <label className="cake-field">
            <span>Apartment / Suite / Unit {optionalLabel}</span>
            <input
              className="cake-text-input"
              type="text"
              placeholder="e.g., Unit 3B, Building 2, Block 4 Lot 6"
              value={details?.apartment ?? ''}
              onChange={(event) => handleDetailsChange('apartment', event.target.value)}
            />
          </label>
          <label className="cake-field">
            <span>Landmark {optionalLabel}</span>
            <input
              className="cake-text-input"
              type="text"
              placeholder="Nearby landmark or delivery instructions"
              value={details?.landmark ?? ''}
              onChange={(event) => handleDetailsChange('landmark', event.target.value)}
            />
          </label>
          <label className="cake-field">
            <span>Preferred Delivery Time *</span>
            <WheelTimePicker
              value={details?.preferredDeliveryTime ?? ''}
              onChange={(timeValue) => handleDetailsChange('preferredDeliveryTime', timeValue)}
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
              checked={details?.deliverDifferentRecipient ?? false}
              onChange={(event) => handleDetailsChange('deliverDifferentRecipient', event.target.checked)}
            />
            <span>Deliver to a Different Recipient</span>
          </div>
          {details?.deliverDifferentRecipient ? (
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
                    value={details?.recipientLastName ?? ''}
                    onBlur={() => markTouched('recipientLastName')}
                    onChange={(event) => handleDetailsChange('recipientLastName', event.target.value)}
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
                    value={details?.recipientFirstName ?? ''}
                    onBlur={() => markTouched('recipientFirstName')}
                    onChange={(event) => handleDetailsChange('recipientFirstName', event.target.value)}
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
                  value={details?.recipientContact ?? ''}
                  onBlur={() => markTouched('recipientContact')}
                  onChange={(event) => handleDetailsChange('recipientContact', event.target.value)}
                />
                {showError('recipientContact')}
              </label>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </>
  )
}

export default OrderMethodSection
