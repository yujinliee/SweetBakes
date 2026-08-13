import PackagePreview from './PackagePreview.jsx'
import PackageReferenceUpload from './PackageReferenceUpload.jsx'

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

const cakeOptionGroups = [
  {
    name: 'packageCakeFlavor',
    label: 'Flavor *',
    options: [
      { label: 'Chocolate', value: 'chocolate' },
      { label: 'Red Velvet', value: 'redvelvet' },
    ],
  },
  {
    name: 'packageCakeSize',
    label: 'Size *',
    options: [
      { label: '6"', value: '6' },
      { label: '8"', value: '8' },
      { label: '10"', value: '10' },
      { label: '12"', value: '12' },
    ],
  },
  {
    name: 'packageCakeLayers',
    label: 'Layers *',
    options: [
      { label: '1 Layer', value: '1' },
      { label: '2 Layers', value: '2' },
      { label: '3 Layers', value: '3' },
    ],
  },
]

const errorMessages = {
  packageCakeFlavor: 'Please select a cake flavor.',
  packageCakeSize: 'Please select a cake size.',
  packageCakeLayers: 'Please select the number of layers.',
  packageCakeTheme: 'Please select a cake theme.',
  packageCakeOtherTheme: 'Please enter your cake theme.',
  packageCupcakeTheme: 'Please select a cupcake theme.',
  packageCupcakeOtherTheme: 'Please enter your cupcake theme.',
}

function PackageCustomizeForm({
  details,
  cupcakeQuantity,
  previewImage,
  validationTouched = {},
  onDetailsChange,
  onValidationTouchedChange,
  onBack,
  onContinue,
}) {
  const updateDetail = (field, value) => {
    onDetailsChange((current) => ({
      ...current,
      [field]: value,
      ...(field === 'packageCakeFlavor' && !current.packageCakeLayers
        ? { packageCakeLayers: '1' }
        : {}),
    }))
  }

  const updateReferenceImages = (field, files) => {
    onDetailsChange((current) => ({
      ...current,
      [field]: files,
    }))
  }

  const errors = {
    ...(!details.packageCakeFlavor ? { packageCakeFlavor: errorMessages.packageCakeFlavor } : {}),
    ...(!details.packageCakeSize ? { packageCakeSize: errorMessages.packageCakeSize } : {}),
    ...(!details.packageCakeLayers ? { packageCakeLayers: errorMessages.packageCakeLayers } : {}),
    ...(!details.packageCakeTheme ? { packageCakeTheme: errorMessages.packageCakeTheme } : {}),
    ...(details.packageCakeTheme === 'Other' && !details.packageCakeOtherTheme.trim()
      ? { packageCakeOtherTheme: errorMessages.packageCakeOtherTheme }
      : {}),
    ...(!details.packageCupcakeTheme
      ? { packageCupcakeTheme: errorMessages.packageCupcakeTheme }
      : {}),
    ...(details.packageCupcakeTheme === 'Other' && !details.packageCupcakeOtherTheme.trim()
      ? { packageCupcakeOtherTheme: errorMessages.packageCupcakeOtherTheme }
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
    const validationOrder = [
      'packageCakeFlavor',
      'packageCakeSize',
      'packageCakeLayers',
      'packageCakeTheme',
      ...(details.packageCakeTheme === 'Other' ? ['packageCakeOtherTheme'] : []),
      'packageCupcakeTheme',
      ...(details.packageCupcakeTheme === 'Other' ? ['packageCupcakeOtherTheme'] : []),
    ]
    const firstInvalidField = validationOrder.find((field) => errors[field])

    if (!firstInvalidField) {
      onContinue()
      return
    }

    onValidationTouchedChange((current) => ({
      ...current,
      ...Object.keys(errors).reduce(
        (fields, field) => ({
          ...fields,
          [field]: true,
        }),
        {},
      ),
    }))
    focusInvalidField(firstInvalidField)
  }

  return (
    <section className="package-customize-flow" aria-labelledby="package-customize-title">
      <div className="cake-form-heading package-customize-heading">
        <h2 id="package-customize-title">Customize</h2>
      </div>

      <div className="cake-customization-grid package-customize-grid">
        <div className="cake-preview-column package-sticky-preview-column">
          <div className="package-preview-fade">
            <PackagePreview imageSrc={previewImage} />
          </div>
          <PackageReferenceUpload
            referenceImages={details.packageReferenceImages}
            onReferenceImagesChange={(files) =>
              updateReferenceImages('packageReferenceImages', files)
            }
          />
        </div>

        <section className="cake-base-form package-continuous-form" aria-label="Package customization form">
          <form>
            <section className="package-customize-section" aria-labelledby="package-cake-title">
              <div className="cake-form-heading package-section-heading">
                <h2 id="package-cake-title">Customize Your Cake</h2>
                <p>Choose the cake base and design included in your selected party package.</p>
              </div>

              <fieldset className="cake-option-group">
                <legend>Cake Base</legend>
              </fieldset>
              {cakeOptionGroups.map((group) => (
                <fieldset
                  className="cake-option-group"
                  data-validation-field={group.name}
                  key={group.name}
                >
                  <legend>{group.label}</legend>
                  <div className="cake-option-list">
                    {group.options.map((option) => (
                      <label className="cake-radio" key={option.value}>
                        <input
                          type="radio"
                          name={group.name}
                          value={option.value}
                          checked={details[group.name] === option.value}
                          onChange={() => updateDetail(group.name, option.value)}
                        />
                        <span className="cake-radio-control" aria-hidden="true" />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {showError(group.name)}
                </fieldset>
              ))}

              <fieldset className="cake-option-group">
                <legend>Design &amp; Details</legend>
              </fieldset>
              <fieldset className="cake-option-group">
                <legend>Theme *</legend>
                <select
                  className="cake-select"
                  data-validation-field="packageCakeTheme"
                  aria-invalid={hasError('packageCakeTheme') ? 'true' : undefined}
                  value={details.packageCakeTheme}
                  onChange={(event) => updateDetail('packageCakeTheme', event.target.value)}
                >
                  <option value="">Select a theme</option>
                  {themes.map((theme) => (
                    <option value={theme} key={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
                {showError('packageCakeTheme')}
                {details.packageCakeTheme === 'Other' ? (
                  <input
                    className="cake-text-input"
                    data-validation-field="packageCakeOtherTheme"
                    aria-invalid={hasError('packageCakeOtherTheme') ? 'true' : undefined}
                    type="text"
                    placeholder="Enter your theme"
                    value={details.packageCakeOtherTheme}
                    onChange={(event) => updateDetail('packageCakeOtherTheme', event.target.value)}
                  />
                ) : null}
                {showError('packageCakeOtherTheme')}
              </fieldset>

              <fieldset className="cake-option-group">
                <legend>
                  Cake Message <span className="cake-optional-label">Optional</span>
                </legend>
                <textarea
                  className="cake-textarea"
                  maxLength={40}
                  placeholder="Enter the dedication message"
                  value={details.packageCakeMessage}
                  onChange={(event) => updateDetail('packageCakeMessage', event.target.value)}
                />
              </fieldset>

              <fieldset className="cake-option-group">
                <legend>
                  Special Instructions <span className="cake-optional-label">Optional</span>
                </legend>
                <textarea
                  className="cake-textarea cake-textarea--large"
                  placeholder="Enter additional requests for your cake"
                  value={details.packageCakeSpecialInstructions}
                  onChange={(event) =>
                    updateDetail('packageCakeSpecialInstructions', event.target.value)
                  }
                />
              </fieldset>

            </section>

            <section
              className="package-customize-section"
              aria-labelledby="package-cupcake-title"
            >
              <div className="cake-form-heading package-section-heading">
                <h2 id="package-cupcake-title">Customize Your Cupcakes</h2>
                <p>Personalize the cupcakes included in your selected party package.</p>
              </div>

              <fieldset className="cake-option-group">
                <legend>Included Quantity</legend>
                <p className="package-included-quantity">
                  {cupcakeQuantity ? `${cupcakeQuantity} Cupcakes` : 'Select a package first'}
                </p>
              </fieldset>

              <fieldset className="cake-option-group">
                <legend>Design &amp; Details</legend>
              </fieldset>
              <fieldset className="cake-option-group">
                <legend>Theme *</legend>
                <select
                  className="cake-select"
                  data-validation-field="packageCupcakeTheme"
                  aria-invalid={hasError('packageCupcakeTheme') ? 'true' : undefined}
                  value={details.packageCupcakeTheme}
                  onChange={(event) => updateDetail('packageCupcakeTheme', event.target.value)}
                >
                  <option value="">Select a theme</option>
                  {themes.map((theme) => (
                    <option value={theme} key={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
                {showError('packageCupcakeTheme')}
                {details.packageCupcakeTheme === 'Other' ? (
                  <input
                    className="cake-text-input"
                    data-validation-field="packageCupcakeOtherTheme"
                    aria-invalid={hasError('packageCupcakeOtherTheme') ? 'true' : undefined}
                    type="text"
                    placeholder="Enter your theme"
                    value={details.packageCupcakeOtherTheme}
                    onChange={(event) =>
                      updateDetail('packageCupcakeOtherTheme', event.target.value)
                    }
                  />
                ) : null}
                {showError('packageCupcakeOtherTheme')}
              </fieldset>

              <fieldset className="cake-option-group">
                <legend>
                  Special Instructions <span className="cake-optional-label">Optional</span>
                </legend>
                <textarea
                  className="cake-textarea cake-textarea--large"
                  placeholder="Enter additional requests for your cupcakes"
                  value={details.packageCupcakeSpecialInstructions}
                  onChange={(event) =>
                    updateDetail('packageCupcakeSpecialInstructions', event.target.value)
                  }
                />
              </fieldset>

            </section>

            <div className="cake-form-actions package-customize-actions">
              <button className="cake-continue-button cake-back-button" type="button" onClick={onBack}>
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
      </div>
    </section>
  )
}

export default PackageCustomizeForm
