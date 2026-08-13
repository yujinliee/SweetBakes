const packageOptions = [
  {
    label: 'Package A',
    value: 'packageA',
    cakeQuantity: 1,
    cupcakeQuantity: 6,
  },
  {
    label: 'Package B',
    value: 'packageB',
    cakeQuantity: 1,
    cupcakeQuantity: 12,
  },
  {
    label: 'Package C',
    value: 'packageC',
    cakeQuantity: 1,
    cupcakeQuantity: 18,
  },
]

function PackageSelectionForm({
  selectedPackage,
  validationTouched = false,
  onPackageChange,
  onValidationTouchedChange,
  onContinue,
}) {
  const hasSelectedPackage = Boolean(selectedPackage.selectedPackage)
  const showError = validationTouched && !hasSelectedPackage

  const handleContinue = () => {
    if (hasSelectedPackage) {
      onContinue()
      return
    }

    onValidationTouchedChange(true)
    window.requestAnimationFrame(() => {
      const target = document.querySelector('[data-validation-field="selectedPackage"]')

      if (!target) {
        return
      }

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      const focusTarget = target.querySelector('input, button')

      if (focusTarget) {
        window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 280)
      }
    })
  }

  return (
    <section className="cake-base-form" aria-labelledby="package-selection-title">
      <div className="cake-form-heading">
        <h2 id="package-selection-title">Choose Your Party Package</h2>
        <p>
          Select the package that best fits your celebration. Each package includes a combination
          of cake and cupcakes that you can personalize.
        </p>
      </div>

      <form>
        <fieldset className="cake-option-group" data-validation-field="selectedPackage">
          <legend>Options *</legend>
          <div className="cake-option-list package-option-list">
            {packageOptions.map((option) => (
              <label className="cake-radio package-radio package-option" key={option.value}>
                <span className="package-option-header">
                  <input
                    type="radio"
                    name="party-package"
                    value={option.value}
                    checked={selectedPackage?.selectedPackage === option.value}
                    onChange={() => {
                      onValidationTouchedChange(false)
                      onPackageChange({
                        selectedPackage: option.value,
                        cakeQuantity: option.cakeQuantity,
                        cupcakeQuantity: option.cupcakeQuantity,
                      })
                    }}
                  />
                  <span className="cake-radio-control" aria-hidden="true" />
                  <span className="package-title">{option.label}</span>
                </span>
                <span className="package-details">
                  <span>{option.cakeQuantity} Cake</span>
                  <span>{option.cupcakeQuantity} Cupcakes</span>
                </span>
              </label>
            ))}
          </div>
          {showError ? <p className="cake-field-error">* Please select a party package.</p> : null}
        </fieldset>

        <div className="cake-form-actions">
          <button className="cake-continue-button" type="button" onClick={handleContinue}>
            <span>Continue</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>
    </section>
  )
}

export default PackageSelectionForm
