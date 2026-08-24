const packageLabels = {
  packageA: 'Package A',
  packageB: 'Package B',
  packageC: 'Package C',
}

const flavorLabels = {
  chocolate: 'Chocolate',
  redvelvet: 'Red Velvet',
}

const cakeCountLabels = {
  1: '1 Layer',
  2: '2 Layers',
  3: '3 Layers',
}

const packageCakeQuantityLabels = {
  1: '1 Cake',
  2: '2 Cakes',
  3: '3 Cakes',
}

const fallbackText = 'None'
const emptyCustomerText = 'Not provided'

const importantLabels = new Set([
  'Package',
  'Cake',
  'Cupcakes',
  'Flavor',
  'Size',
  'Layers',
  'Quantity',
  'Theme',
  'Order Method',
  'Preferred Date',
  'Preferred Time',
])

const formatTime = (time) => {
  if (!time) {
    return ''
  }

  const [hourValue, minuteValue] = time.split(':')
  const hour = Number(hourValue)
  const minute = minuteValue || '00'

  if (Number.isNaN(hour)) {
    return time
  }

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${displayHour}:${minute} ${period}`
}

function ReviewSection({ title, items }) {
  return (
    <section className="cake-review-section">
      <h3>{title}</h3>
      <dl>
        {items.map((item) => (
          <div className="cake-review-row" key={item.label}>
            <dt>{item.label}</dt>
            <dd
              className={`${importantLabels.has(item.label) ? 'cake-review-value--important' : ''}${
                item.isEmpty ? ' cake-review-value--empty' : ''
              }`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function PackageReviewForm({
  packageSelection,
  packageCustomization,
  customerInfo,
  submissionError = '',
  onBack,
  onSubmit,
}) {
  const cakeTheme =
    packageCustomization.packageCakeTheme === 'Other'
      ? packageCustomization.packageCakeOtherTheme || 'Other'
      : packageCustomization.packageCakeTheme || emptyCustomerText
  const cupcakeTheme =
    packageCustomization.packageCupcakeTheme === 'Other'
      ? packageCustomization.packageCupcakeOtherTheme || 'Other'
      : packageCustomization.packageCupcakeTheme || emptyCustomerText
  const fulfillmentLabel =
    customerInfo.fulfillment === 'pickup'
      ? 'Pickup'
      : customerInfo.fulfillment === 'delivery'
        ? 'Delivery'
        : emptyCustomerText
  const preferredTime =
    customerInfo.fulfillment === 'pickup'
      ? customerInfo.preferredPickupTime
      : customerInfo.preferredDeliveryTime
  const formattedPreferredTime = formatTime(preferredTime)
  const recipientName = [customerInfo.recipientLastName, customerInfo.recipientFirstName]
    .filter(Boolean)
    .join(', ')
  const isDelivery = customerInfo.fulfillment === 'delivery'
  const sharedFlavor = packageCustomization.packageCakeFlavor

  const customerItems = [
    { label: 'Customer Name', value: customerInfo.fullName || emptyCustomerText },
    { label: 'Contact Number', value: customerInfo.contactNumber || emptyCustomerText },
    { label: 'Email Address', value: customerInfo.email || emptyCustomerText },
    { label: 'Order Method', value: fulfillmentLabel },
    ...(isDelivery
      ? [
          ...(customerInfo.deliverDifferentRecipient
            ? [
                { label: 'Recipient Name', value: recipientName || fallbackText },
                {
                  label: 'Recipient Contact Number',
                  value: customerInfo.recipientContact || fallbackText,
                },
              ]
            : []),
          { label: 'Delivery Address', value: customerInfo.deliveryAddress || fallbackText },
          {
            label: 'Landmark',
            value: customerInfo.landmark || fallbackText,
            isEmpty: !customerInfo.landmark,
          },
        ]
      : []),
    { label: 'Preferred Date', value: customerInfo.preferredDate || emptyCustomerText },
    { label: 'Preferred Time', value: formattedPreferredTime || emptyCustomerText },
  ]

  return (
    <section className="cake-base-form cake-review-form" aria-labelledby="package-review-title">
      <div className="cake-form-heading">
        <h2 id="package-review-title">Review Your Order</h2>
        <p>Please review your party package customization details before submitting your request.</p>
      </div>

      <div className="cake-review-content">
        <ReviewSection
          title="Selected Package"
          items={[
            {
              label: 'Package',
              value: packageLabels[packageSelection.selectedPackage] ?? emptyCustomerText,
            },
            {
              label: 'Cake',
              value:
                packageCakeQuantityLabels[packageSelection.cakeQuantity] ??
                (packageSelection.cakeQuantity
                  ? `${packageSelection.cakeQuantity} Cake`
                  : emptyCustomerText),
            },
            {
              label: 'Cupcakes',
              value: packageSelection.cupcakeQuantity
                ? `${packageSelection.cupcakeQuantity} Cupcakes`
                : emptyCustomerText,
            },
          ]}
        />

        <ReviewSection
          title="Cake"
          items={[
            {
              label: 'Flavor',
              value: flavorLabels[sharedFlavor] ?? emptyCustomerText,
            },
            {
              label: 'Size',
              value: packageCustomization.packageCakeSize
                ? `${packageCustomization.packageCakeSize}"`
                : emptyCustomerText,
            },
            {
              label: 'Layers',
              value: cakeCountLabels[packageCustomization.packageCakeLayers] ?? emptyCustomerText,
            },
            { label: 'Theme', value: cakeTheme },
            {
              label: 'Cake Message',
              value: packageCustomization.packageCakeMessage || fallbackText,
              isEmpty: !packageCustomization.packageCakeMessage,
            },
            {
              label: 'Special Instructions',
              value: packageCustomization.packageCakeSpecialInstructions || fallbackText,
              isEmpty: !packageCustomization.packageCakeSpecialInstructions,
            },
          ]}
        />

        <ReviewSection
          title="Cupcakes"
          items={[
            {
              label: 'Flavor',
              value: flavorLabels[sharedFlavor] ?? emptyCustomerText,
            },
            {
              label: 'Quantity',
              value: packageSelection.cupcakeQuantity
                ? `${packageSelection.cupcakeQuantity} Cupcakes`
                : emptyCustomerText,
            },
            { label: 'Theme', value: cupcakeTheme },
            {
              label: 'Special Instructions',
              value: packageCustomization.packageCupcakeSpecialInstructions || fallbackText,
              isEmpty: !packageCustomization.packageCupcakeSpecialInstructions,
            },
          ]}
        />

        <ReviewSection title="Customer Information" items={customerItems} />

        <section className="cake-review-notice" aria-label="Notice">
          <h3>
            <span className="cake-review-notice-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M12 10.8v5M12 7.8h.01"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>Notice</span>
          </h3>
          <p>
            Final pricing will be provided after Sweet Bakes reviews your customization request.
          </p>
          <p>
            Payment instructions and QR code will be sent only after your order has been reviewed
            and approved.
          </p>
        </section>
      </div>

      {submissionError ? <p className="cake-field-error">* {submissionError}</p> : null}

      <div className="cake-form-actions">
        <button className="cake-continue-button cake-back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">&larr;</span>
          <span>Back</span>
        </button>
        <button className="cake-continue-button cake-submit-button" type="button" onClick={onSubmit}>
          <span>Submit Request</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </section>
  )
}

export default PackageReviewForm
