function PersonalInformationFields({ details, onChange, hasError, showError, markTouched }) {
  return (
    <fieldset className="cake-option-group cake-customer-section">
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
            value={details.customerLastName ?? ''}
            onBlur={() => markTouched('customerLastName')}
            onChange={(event) => onChange('customerLastName', event.target.value)}
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
            value={details.customerFirstName ?? ''}
            onBlur={() => markTouched('customerFirstName')}
            onChange={(event) => onChange('customerFirstName', event.target.value)}
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
            value={details.contactNumber ?? ''}
            onBlur={() => markTouched('contactNumber')}
            onChange={(event) => onChange('contactNumber', event.target.value)}
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
            value={details.email ?? ''}
            onBlur={() => markTouched('email')}
            onChange={(event) => onChange('email', event.target.value)}
          />
          {showError('email')}
        </label>
      </div>
    </fieldset>
  )
}

export default PersonalInformationFields
