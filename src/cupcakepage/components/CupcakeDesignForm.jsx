import { getActiveCustomizationOptions } from '../../admin/services/customizationOptionsService.js'

function CupcakeDesignForm({
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
    ...(!details.cupcakeTheme ? { cupcakeTheme: 'Please select a theme.' } : {}),
    ...(details.cupcakeTheme === 'Other' && !details.cupcakeOtherTheme.trim()
      ? { cupcakeOtherTheme: 'Please enter your theme.' }
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
    <section className="cake-base-form cake-design-form" aria-labelledby="cupcake-design-title">
      <div className="cake-form-heading">
        <h2 id="cupcake-design-title">Design & Details</h2>
        <p>Personalize your cupcakes by selecting a theme and adding your custom details.</p>
      </div>

      <form>
        <fieldset className="cake-option-group">
          <legend>Theme *</legend>
          <select
            className="cake-select"
            data-validation-field="cupcakeTheme"
            aria-invalid={hasError('cupcakeTheme') ? 'true' : undefined}
            value={details.cupcakeTheme}
            onChange={(event) => updateDetail('cupcakeTheme', event.target.value)}
            onBlur={() =>
              onValidationTouchedChange?.((current) => ({
                ...current,
                cupcakeTheme: true,
              }))
            }
          >
            <option value="">Select a theme</option>
            {getActiveCustomizationOptions('Cupcakes', 'Designs / Details').map((opt) => (
              <option value={opt.label} key={opt.id}>
                {opt.label}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
          {showError('cupcakeTheme')}
          {details.cupcakeTheme === 'Other' ? (
            <input
              className="cake-text-input"
              data-validation-field="cupcakeOtherTheme"
              aria-invalid={hasError('cupcakeOtherTheme') ? 'true' : undefined}
              type="text"
              placeholder="Enter your theme"
              value={details.cupcakeOtherTheme}
              onChange={(event) => updateDetail('cupcakeOtherTheme', event.target.value)}
              onBlur={() =>
                onValidationTouchedChange?.((current) => ({
                  ...current,
                  cupcakeOtherTheme: true,
                }))
              }
            />
          ) : null}
          {showError('cupcakeOtherTheme')}
        </fieldset>

        <fieldset className="cake-option-group">
          <legend>
            Special Instructions <span className="cake-optional-label">Optional</span>
          </legend>
          <textarea
            className="cake-textarea cake-textarea--large"
            placeholder="Enter any additional requests or special instructions"
            value={details.cupcakeSpecialInstructions}
            onChange={(event) => updateDetail('cupcakeSpecialInstructions', event.target.value)}
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

export default CupcakeDesignForm
