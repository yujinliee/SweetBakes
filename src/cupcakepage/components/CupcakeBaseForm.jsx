import { getActiveCustomizationOptions } from '../../admin/services/customizationOptionsService.js'

function CupcakeBaseForm({ selections, onSelectionsChange, onContinue }) {
  const optionGroups = [
    {
      name: 'flavor',
      label: 'Base Flavor',
      options: getActiveCustomizationOptions('Cupcakes', 'Flavors'),
    },
    {
      name: 'quantity',
      label: 'Quantity',
      options: getActiveCustomizationOptions('Cupcakes', 'Sizes'),
    },
  ]
  const handleChange = (groupName, value) => {
    onSelectionsChange((current) => ({
      ...current,
      [groupName]: value,
    }))
  }

  const isComplete = Boolean(selections.flavor && selections.quantity)

  return (
    <section className="cake-base-form" aria-labelledby="cupcake-base-title">
      <div className="cake-form-heading">
        <h2 id="cupcake-base-title">Choose Your Cupcake Base</h2>
        <p>Start by selecting the cupcake flavor and quantity that best suits your celebration.</p>
      </div>

      <form>
        {optionGroups.map((group) => (
          <fieldset className="cake-option-group" key={group.name}>
            <legend>{group.label}</legend>
            <div className="cake-option-list">
              {group.options.length === 0 ? (
                <p className="cake-field-empty">No active options available for this category.</p>
              ) : (
                group.options.map((option) => (
                  <label className="cake-radio" key={option.value}>
                    <input
                      type="radio"
                      name={`cupcake-${group.name}`}
                      value={option.value}
                      checked={selections[group.name] === option.value}
                      onChange={() => handleChange(group.name, option.value)}
                    />
                    <span className="cake-radio-control" aria-hidden="true" />
                    <span>{option.label}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>
        ))}

        <div className="cake-form-actions">
          <button
            className="cake-continue-button"
            type="button"
            disabled={!isComplete}
            onClick={onContinue}
          >
            <span>Continue</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>
    </section>
  )
}

export default CupcakeBaseForm
