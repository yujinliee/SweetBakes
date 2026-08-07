const themes = [
  'Birthday',
  'Wedding',
  'Anniversary',
  'Christening',
  'Baby Shower',
  'Graduation',
  'Corporate',
  'Minimalist',
  'Floral',
  'Custom Theme',
  'Other',
]

function CakeDesignForm({
  details,
  onDetailsChange,
  validationTouched = {},
  onValidationTouchedChange,
  onBack,
  onContinue,
}) {
  const updateDetail = (field, value) => {
    onDetailsChange((current) => ({
      ...current,
      [field]: value,
    }))
  }
  const errors = {
    ...(!details.theme ? { theme: 'Please select a theme.' } : {}),
    ...(details.theme === 'Other' && !details.otherTheme.trim()
      ? { otherTheme: 'Please enter your theme.' }
      : {}),
  }
  const hasError = (field) => validationTouched[field] && errors[field]
  const showError = (field) =>
    hasError(field) ? <p className="cake-field-error">* {errors[field]}</p> : null
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
    const invalidFields = Object.keys(errors)

    if (!invalidFields.length) {
      onContinue()
      return
    }

    onValidationTouchedChange?.((current) => ({
      ...current,
      ...invalidFields.reduce(
        (fields, field) => ({
          ...fields,
          [field]: true,
        }),
        {},
      ),
    }))
    focusInvalidField(invalidFields[0])
  }

  return (
    <section className="cake-base-form cake-design-form" aria-labelledby="cake-design-title">
      <div className="cake-form-heading">
        <h2 id="cake-design-title">Design & Details</h2>
        <p>Personalize your cake by selecting a theme and adding your custom message.</p>
      </div>

      <form>
        <fieldset className="cake-option-group">
          <legend>Theme</legend>
          <select
            className="cake-select"
            data-validation-field="theme"
            aria-invalid={hasError('theme') ? 'true' : undefined}
            value={details.theme}
            onChange={(event) => updateDetail('theme', event.target.value)}
            onBlur={() =>
              onValidationTouchedChange?.((current) => ({
                ...current,
                theme: true,
              }))
            }
          >
            <option value="">Select a theme</option>
            {themes.map((theme) => (
              <option value={theme} key={theme}>
                {theme}
              </option>
            ))}
          </select>
          {showError('theme')}
          {details.theme === 'Other' ? (
            <input
              className="cake-text-input"
              data-validation-field="otherTheme"
              aria-invalid={hasError('otherTheme') ? 'true' : undefined}
              type="text"
              placeholder="Enter your theme"
              value={details.otherTheme}
              onChange={(event) => updateDetail('otherTheme', event.target.value)}
              onBlur={() =>
                onValidationTouchedChange?.((current) => ({
                  ...current,
                  otherTheme: true,
                }))
              }
            />
          ) : null}
          {showError('otherTheme')}
        </fieldset>

        <fieldset className="cake-option-group">
          <legend>
            Cake Message <span className="cake-optional-label">Optional</span>
          </legend>
          <textarea
            className="cake-textarea"
            maxLength={40}
            placeholder="Enter the dedication message"
            value={details.message}
            onChange={(event) => updateDetail('message', event.target.value)}
          />
        </fieldset>

        <fieldset className="cake-option-group">
          <legend>
            Special Instructions <span className="cake-optional-label">Optional</span>
          </legend>
          <textarea
            className="cake-textarea cake-textarea--large"
            placeholder="Enter additional requests for your cake"
            value={details.instructions}
            onChange={(event) => updateDetail('instructions', event.target.value)}
          />
        </fieldset>

        <div className="cake-form-actions">
          <button
            className="cake-continue-button cake-back-button"
            type="button"
            onClick={onBack}
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back</span>
          </button>
          <button className="cake-continue-button" type="button" onClick={handleContinue}>
            <span>Continue</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>
    </section>
  )
}

export default CakeDesignForm
